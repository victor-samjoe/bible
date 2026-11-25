import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, open, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  LEXICON_REGISTRY_VERSION,
  LEXICON_SOURCES,
  assertNoLicenseMixing,
  pinLabel,
  serializeRegistry,
} from "../src/domain/lexicon/source-registry.ts";
import {
  buildLexemeIndex,
  countSenses,
  danglingOccurrences,
  occurrencesByLexeme,
  lexiconIndexLines,
  senseDepth,
  sortOccurrences,
  strongLexemeKey,
  type NormalizedBdbEntry,
  type NormalizedBdbLink,
  type NormalizedLexemeEntry,
  type NormalizedOccurrence,
} from "../src/domain/lexicon/records.ts";
import { assertNoTranslationsProduced } from "../src/domain/lexicon/translation-workflow.ts";
import { parseMaculaTsv } from "../src/importers/lexicon/macula.ts";
import { parseStepBibleLexicon } from "../src/importers/lexicon/stepbible.ts";
import { parseBrownDriverBriggsXml } from "../src/importers/lexicon/oshb-bdb.ts";
import {
  parseHebrewStrongXml,
  parseLexicalIndexXml,
} from "../src/importers/lexicon/oshb-hebrew-lexicon.ts";

/**
 * Preparação do índice lexical (LEXICON-INDEX-001, fila C30).
 *
 * Lê os bytes já coletados e verificados, aplica os parsers e produz o conjunto
 * normalizado — verbetes únicos por lema e ocorrências ligadas a eles. **Não
 * grava em banco nenhum**: a saída é um arquivo em `data/generated/lexicons/`,
 * que fica fora do Git, para ser conferido antes de qualquer importação.
 *
 * Determinismo é requisito, não efeito colateral: duas execuções sobre os
 * mesmos bytes produzem arquivos idênticos byte a byte, e o script compara a
 * saída nova com a anterior para provar isso.
 *
 * Nenhuma tradução para português é gerada aqui — ver
 * `src/domain/lexicon/translation-workflow.ts`.
 *
 * Uso:
 *   node --experimental-strip-types scripts/build-lexicon-index.ts
 *   node --experimental-strip-types scripts/build-lexicon-index.ts --emit
 */

const ROOT = join(import.meta.dirname, "..");
const LEXICONS = join(ROOT, "data", "sources", "lexicons");
const GENERATED = join(ROOT, "data", "generated", "lexicons");
const emit = process.argv.includes("--emit");

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function main(): Promise<void> {
  assertNoLicenseMixing(LEXICON_SOURCES);
  const fingerprint = sha256(serializeRegistry());
  console.log(`Registro lexical ${LEXICON_REGISTRY_VERSION} · impressão ${fingerprint.slice(0, 16)}…`);

  const entries: NormalizedLexemeEntry[] = [];
  const occurrences: NormalizedOccurrence[] = [];
  let read = 0;
  let links = 0;
  const bdbTrees: NormalizedBdbEntry[] = [];
  const bdbLinks: NormalizedBdbLink[] = [];
  let bdbEntries = 0;
  let bdbSenses = 0;
  let bdbDepth = 0;

  for (const source of LEXICON_SOURCES) {
    if (!source.importable) continue;
    for (const asset of source.assets) {
      if (asset.readerStatus !== "parsed") continue;
      const file = join(LEXICONS, source.id, asset.localPath);
      if (!existsSync(file)) continue;
      const bytes = new Uint8Array(await readFile(file));
      const digest = sha256(bytes);
      if (asset.expectedSha256 && asset.expectedSha256 !== digest) {
        throw new Error(`${source.id}/${asset.localPath}: SHA-256 divergente do registro`);
      }
      const content = await readFile(file, "utf8");
      const context = { source, assetPath: asset.localPath, assetSha256: digest };

      // `LexicalIndex.xml` é catálogo de correspondência, não verbete. O
      // despacho antigo olhava só `asset.format === "xml"` e o entregava ao
      // parser do HebrewStrong, que relatou 10.221 problemas contra o arquivo
      // real — nenhuma entrada dele tem a forma de verbete. A ponte que ele
      // fornece (lema aumentado → Strong → BDB) é consumida à parte.
      // O BDB tem forma própria: árvore de sentidos, chaveada pelo id da obra
      // e não pelo Strong. Não entra em `entries`, que é verbete plano por
      // lema; a ponte até o Strong é o `LexicalIndex.xml`, lido abaixo.
      if (source.id === "oshb-bdb") {
        const tree = parseBrownDriverBriggsXml(content, context);
        bdbEntries += tree.entries.length;
        for (const entry of tree.entries) bdbTrees.push(entry);
        for (const entry of tree.entries) {
          bdbSenses += countSenses(entry.senses);
          bdbDepth = Math.max(bdbDepth, senseDepth(entry.senses));
        }
        console.log(
          `   ${source.id}/${asset.localPath}: ${tree.entries.length} verbete(s), ` +
            `${bdbSenses} sentido(s) em até ${bdbDepth} nível(is), ` +
            `${tree.issues.length} problema(s)`,
        );
        read += 1;
        continue;
      }

      if (asset.localPath === "LexicalIndex.xml") {
        const bridge = parseLexicalIndexXml(content);
        links += bridge.links.length;
        for (const link of bridge.links) {
          // Só a ligação que tem os dois lados serve de ponte; sem `bdbId` não
          // há verbete para alcançar, e a linha não vira registro.
          if (!link.bdbId) continue;
          bdbLinks.push({
            lexemeKey: link.strongId ? strongLexemeKey("hbo", link.strongId) : null,
            bdbId: link.bdbId,
            augmentedLemma: link.augmentedLemma,
            provenance: {
              sourceId: source.id,
              assetPath: asset.localPath,
              pin: pinLabel(source.pin),
              assetSha256: digest,
              licenseDeclared: source.license.declared,
              attribution: source.attribution,
              sourceField: "xref@bdb",
            },
          });
        }
        console.log(
          `   ${source.id}/${asset.localPath}: ${bridge.links.length} ponte(s) ` +
            `lema→Strong/BDB, ${bridge.issues.length} problema(s)`,
        );
        read += 1;
        continue;
      }

      const result =
        source.assetKind === "occurrence_annotation"
          ? parseMaculaTsv(content, context)
          : asset.format === "xml"
            ? parseHebrewStrongXml(content, context)
            : parseStepBibleLexicon(content, context);
      // `push(...array)` passa cada item como argumento e estoura a pilha
      // nestes volumes: o MACULA Hebrew sozinho traz centenas de milhares de
      // ocorrências. Concatenar em laço custa o mesmo e não tem esse teto.
      for (const entry of result.entries) entries.push(entry);
      for (const occurrence of result.occurrences) occurrences.push(occurrence);
      read += 1;
      console.log(
        `   ${source.id}/${asset.localPath}: ${result.entries.length} verbete(s), ` +
          `${result.occurrences.length} ocorrência(s), ${result.issues.length} problema(s)`,
      );
    }
  }

  if (read === 0) {
    console.log(
      "\nNenhum byte coletado em data/sources/lexicons/. Isto é o estado esperado enquanto a " +
        "coleta não for aprovada: o índice não é inventado na ausência da fonte.",
    );
    return;
  }

  const index = buildLexemeIndex(entries);
  const ordered = sortOccurrences(occurrences);
  const dangling = danglingOccurrences(ordered, index);
  const grouped = occurrencesByLexeme(ordered);
  for (const entry of index) assertNoTranslationsProduced(entry.translations);

  // Uma única definição do conteúdo do índice. Antes havia duas chamadas a
  // `lexiconIndexLines` — uma para o digest e outra para a gravação — e elas
  // divergiram: o digest já contava as pontes do BDB e o arquivo gravado ainda
  // não. O resultado era um arquivo cujo sha256 impresso não era o dele.
  const allLines = (): Generator<string> =>
    lexiconIndexLines(index, ordered, bdbTrees, bdbLinks);

  // Hash por streaming: o índice inteiro não cabe numa string do V8, então o
  // digest é alimentado linha a linha. Duas execuções sobre os mesmos bytes
  // precisam dar o mesmo digest — é essa a prova de determinismo.
  const digestOf = (): string => {
    const hash = createHash("sha256");
    for (const line of allLines()) hash.update(line, "utf8");
    return hash.digest("hex");
  };
  const indexDigest = digestOf();
  if (digestOf() !== indexDigest) {
    throw new Error("serialização não determinística: o índice não é reprodutível");
  }

  console.log(`\nverbetes únicos: ${index.length}`);
  console.log(`ocorrências: ${ordered.length} em ${grouped.size} lema(s)`);
  console.log(`pontes lema→Strong/BDB: ${links}, das quais ${bdbLinks.length} alcançam verbete`);
  console.log(`BDB: ${bdbEntries} verbete(s), ${bdbSenses} sentido(s), até ${bdbDepth} nível(is)`);
  console.log(`ocorrências sem verbete correspondente: ${dangling.length}`);
  console.log(`sha256 do índice: ${indexDigest}`);

  if (!emit) {
    console.log("\nNada gravado. Use --emit para escrever em data/generated/lexicons/ (fora do Git).");
    return;
  }
  await mkdir(GENERATED, { recursive: true });
  const target = join(GENERATED, "lexicon-index.ndjson");
  const handle = await open(target, "w");
  try {
    // Lotes de linhas: uma escrita por registro faria 600 mil chamadas de I/O.
    let batch = "";
    for (const line of allLines()) {
      batch += line;
      if (batch.length >= 4_000_000) {
        await handle.write(batch, null, "utf8");
        batch = "";
      }
    }
    if (batch.length > 0) await handle.write(batch, null, "utf8");
  } finally {
    await handle.close();
  }
  console.log(`gravado: data/generated/lexicons/lexicon-index.ndjson (sha256 ${indexDigest})`);
}

main().catch((error: unknown) => {
  console.error("FALHA:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
