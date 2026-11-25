import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  LEXICON_REGISTRY_VERSION,
  LEXICON_SOURCES,
  assertNoLicenseMixing,
  isPinned,
  pinLabel,
  serializeRegistry,
  type LexiconSource,
} from "../src/domain/lexicon/source-registry.ts";
import { parseMaculaTsv } from "../src/importers/lexicon/macula.ts";
import { parseStepBibleLexicon } from "../src/importers/lexicon/stepbible.ts";
import { parseBrownDriverBriggsXml } from "../src/importers/lexicon/oshb-bdb.ts";
import {
  parseHebrewStrongXml,
  parseLexicalIndexXml,
} from "../src/importers/lexicon/oshb-hebrew-lexicon.ts";
import { countSenses, senseDepth } from "../src/domain/lexicon/records.ts";
import type { LexiconParseResult } from "../src/domain/lexicon/records.ts";

/**
 * Verificação offline das fontes lexicais (LEXICON-INDEX-001, fila C30).
 *
 * Não acessa rede, não grava em banco, não publica nada: confere as invariantes
 * do registro versionado e, para as fontes já coletadas, reconfere o SHA-256 e
 * roda os parsers para contar o que existe.
 *
 * Falha fechada: checksum divergente, coluna proibida presente, coluna exigida
 * ausente ou mistura de licença fazem o script sair com código 1.
 *
 * Uso: node --experimental-strip-types scripts/verify-lexicon-sources.ts
 */

const ROOT = join(import.meta.dirname, "..");
const LEXICONS = join(ROOT, "data", "sources", "lexicons");

type Manifest = {
  id: string;
  pin: unknown;
  license_declared: string;
  status: string;
  assets: { local_path: string; sha256: string; reader_status: string }[];
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function manifestOf(id: string): Promise<Manifest | null> {
  const path = join(LEXICONS, id, "MANIFEST.json");
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, "utf8")) as Manifest;
}

/** Invariantes que valem mesmo sem nenhum byte coletado. */
function checkRegistry(): string[] {
  const problems: string[] = [];
  try {
    assertNoLicenseMixing(LEXICON_SOURCES);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }
  const ids = new Set<string>();
  for (const source of LEXICON_SOURCES) {
    if (ids.has(source.id)) problems.push(`id repetido no registro: ${source.id}`);
    ids.add(source.id);
    if (source.importable && source.selectedFields.length === 0) {
      problems.push(`${source.id}: importável sem nenhum campo selecionado`);
    }
    if (!source.importable && source.selectedFields.length > 0) {
      problems.push(`${source.id}: não importável, mas declara campos selecionados`);
    }
    if (source.importable && source.license.family === "permission-required") {
      problems.push(`${source.id}: importável com licença que exige permissão específica`);
    }
    if (source.collectionStatus === "approved_for_collection" && !isPinned(source)) {
      problems.push(`${source.id}: coleta aprovada sem pino de commit resolvido`);
    }
    for (const asset of source.assets) {
      if (isPinned(source) && !asset.expectedSha256) {
        problems.push(`${source.id}/${asset.localPath}: pino resolvido sem SHA-256 registrado`);
      }
    }
  }
  return problems;
}

async function checkChecksums(source: LexiconSource, manifest: Manifest): Promise<string[]> {
  const problems: string[] = [];
  for (const asset of manifest.assets) {
    const file = join(LEXICONS, source.id, asset.local_path);
    if (!existsSync(file)) {
      problems.push(`${source.id}/${asset.local_path}: arquivo ausente`);
      continue;
    }
    const digest = sha256(new Uint8Array(await readFile(file)));
    if (digest !== asset.sha256) {
      problems.push(`${source.id}/${asset.local_path}: SHA-256 divergente do manifesto`);
      continue;
    }
    const declared = source.assets.find((item) => item.localPath === asset.local_path);
    if (declared?.expectedSha256 && declared.expectedSha256 !== digest) {
      problems.push(`${source.id}/${asset.local_path}: SHA-256 divergente do registro versionado`);
    }
  }
  return problems;
}

/**
 * Nem toda linha recusada é defeito. Duas categorias são propriedades
 * conhecidas das fontes e viram nota, não pendência:
 *
 * - **morfema sem forma escrita**: o artigo definido absorvido pela preposição
 *   no hebraico, que a fonte publica com `text` vazio de propósito;
 * - **verbete repetido** no TBESG: o arquivo tem uma linha por Strong
 *   *desambiguado*, e vários deles compartilham o mesmo Extended Strong, que é
 *   a chave por onde indexamos. A primeira linha vence e as demais são nota.
 *
 * O que sobra — coluna faltando, referência ilegível, identificador fora de
 * formato — continua sendo pendência de verdade.
 */
const EXPECTED_ISSUE = /^(morfema sem forma escrita|verbete repetido)/u;

function reportParse(label: string, result: LexiconParseResult): string[] {
  const expected = result.issues.filter((issue) => EXPECTED_ISSUE.test(issue.reason));
  const problems = result.issues.filter((issue) => !EXPECTED_ISSUE.test(issue.reason));
  console.log(
    `   ${label}: ${result.entries.length} verbete(s), ${result.occurrences.length} ocorrência(s), ` +
      `${problems.length} problema(s), ${expected.length} nota(s) esperada(s)`,
  );
  if (result.ignoredFields.length > 0) {
    console.log(`     campos ignorados (não declarados): ${result.ignoredFields.join(", ")}`);
  }
  if (expected.length > 0) {
    console.log(`     esperado: ${expected[0]?.reason ?? ""} (e mais ${expected.length - 1})`);
  }
  for (const issue of problems.slice(0, 5)) {
    console.log(`     ${issue.at}: ${issue.reason}`);
  }
  return problems.length > 0 ? [`${label}: ${problems.length} problema(s) de leitura`] : [];
}

async function parseCollected(source: LexiconSource, manifest: Manifest): Promise<string[]> {
  const problems: string[] = [];
  for (const asset of source.assets) {
    if (asset.readerStatus === "evidence_only") continue;
    const file = join(LEXICONS, source.id, asset.localPath);
    if (!existsSync(file)) continue;
    if (asset.readerStatus === "pending_parser") {
      console.log(`   ${asset.localPath}: coletado, sem parser implementado (pendência declarada)`);
      continue;
    }
    const content = await readFile(file, "utf8");
    const digest = sha256(new Uint8Array(await readFile(file)));
    const context = { source, assetPath: asset.localPath, assetSha256: digest };
    try {
      if (source.id === "oshb-bdb") {
        // O BDB não produz verbete plano: a saída é árvore de sentidos, e o que
        // interessa conferir é que a hierarquia sobreviveu à leitura.
        const tree = parseBrownDriverBriggsXml(content, context);
        const senses = tree.entries.reduce((total, entry) => total + countSenses(entry.senses), 0);
        const depth = tree.entries.reduce(
          (deepest, entry) => Math.max(deepest, senseDepth(entry.senses)),
          0,
        );
        console.log(
          `   ${asset.localPath}: ${tree.entries.length} verbete(s), ${senses} sentido(s) ` +
            `em até ${depth} nível(is), ${tree.issues.length} problema(s)`,
        );
        if (tree.ignoredFields.length > 0) {
          console.log(`     campos ignorados (não declarados): ${tree.ignoredFields.join(", ")}`);
        }
        for (const issue of tree.issues.slice(0, 5)) {
          problems.push(`${asset.localPath}: ${issue.at}: ${issue.reason}`);
        }
      } else if (source.assetKind === "occurrence_annotation") {
        problems.push(...reportParse(asset.localPath, parseMaculaTsv(content, context)));
      } else if (source.id === "oshb-hebrewlexicon" && asset.localPath === "HebrewStrong.xml") {
        problems.push(...reportParse(asset.localPath, parseHebrewStrongXml(content, context)));
      } else if (source.id === "oshb-hebrewlexicon" && asset.localPath === "LexicalIndex.xml") {
        const index = parseLexicalIndexXml(content);
        console.log(`   ${asset.localPath}: ${index.links.length} ligação(ões), ${index.issues.length} problema(s)`);
      } else {
        problems.push(...reportParse(asset.localPath, parseStepBibleLexicon(content, context)));
      }
    } catch (error) {
      problems.push(`${source.id}/${asset.localPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (manifest.status !== "collected_pending_human_approval" && manifest.status !== "approved_for_import") {
    problems.push(`${source.id}: status de manifesto inesperado (${manifest.status})`);
  }
  return problems;
}

async function main(): Promise<void> {
  const fingerprint = createHash("sha256").update(serializeRegistry(), "utf8").digest("hex");
  console.log(`Registro lexical ${LEXICON_REGISTRY_VERSION} · impressão ${fingerprint}`);

  const problems = checkRegistry();
  let collected = 0;

  for (const source of LEXICON_SOURCES) {
    console.log(`\n== ${source.id} — ${source.name}`);
    console.log(`   ${source.license.declared} · coleta ${source.collectionStatus} · ${pinLabel(source.pin)}`);
    if (!source.importable) {
      const reasons = source.prohibitedFields.map((field) => field.sourceField).join(", ");
      console.log(`   não importável${reasons ? ` · campos proibidos: ${reasons}` : ""}`);
    }
    const manifest = await manifestOf(source.id);
    if (!manifest) {
      console.log("   sem bytes locais: nada coletado para esta fonte");
      continue;
    }
    collected += 1;
    problems.push(...(await checkChecksums(source, manifest)));
    problems.push(...(await parseCollected(source, manifest)));
  }

  console.log(`\nFontes com bytes locais: ${collected} de ${LEXICON_SOURCES.length}.`);
  console.log(
    "Fonte proibida registrada: stepbible-tbesh (coluna 'Meaning'). " +
      "Nenhum parser a lê; a própria leitura interrompe se a coluna aparecer.",
  );
  if (problems.length > 0) {
    console.log("\nVERIFICAÇÃO COM PENDÊNCIAS:");
    for (const problem of problems) console.log(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log("\nVERIFICAÇÃO OK");
}

main().catch((error: unknown) => {
  console.error("FALHA:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
