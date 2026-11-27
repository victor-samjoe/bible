/**
 * Gera o índice invertido de estudo de palavras (fila Claude 3, item 2).
 *
 * Lê o MACULA, monta o índice por identidade lexical, corta em partições por
 * intervalo de chave e grava **fora do repositório**, com manifesto, hashes,
 * tamanhos e tempo de geração.
 *
 *   # com as fixtures versionadas (padrão: não exige os bytes das fontes)
 *   node --experimental-strip-types scripts/build-word-study-index.ts
 *
 *   # com o corpus real, quando os bytes privados estiverem disponíveis
 *   WORD_STUDY_CORPUS_DIR=data/sources/lexicons \
 *     node --experimental-strip-types scripts/build-word-study-index.ts
 *
 *   # opções
 *   --budget=10000      ocorrências por partição (ver nota sobre o padrão)
 *   --out=<dir>         destino (padrão: <tmp>/word-study-index)
 *   --no-verify         pula a conferência de determinismo
 *
 * O orçamento padrão de 10.000 ocorrências vem da medição de
 * `scripts/measure-word-study-index.ts`, em cardinalidade realista: é onde a
 * soma "manifesto + maior partição" fica menor. Partição pequena barateia a
 * leitura de uma palavra e engorda o manifesto, que o cliente lê inteiro; a
 * curva tem fundo perto de 10.000 (manifesto ~5 KB, maior partição ~11 KB,
 * contra ~2 KB + ~46 KB em 50.000 e ~29 KB + ~5 KB em 1.000).
 *
 * O destino padrão é o diretório temporário do sistema, **fora** do checkout:
 * o índice é artefato derivado, não entra no Git nem no bundle, e nenhum caminho
 * sob `public/` é tocado. Nada é gravado em banco: este script não abre conexão.
 *
 * Nenhuma fonte é baixada aqui. O script lê o que já está em disco e confere o
 * SHA-256 contra o registro quando o registro tem hash congelado; divergência é
 * relatada, e com `--strict-hash` interrompe.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import {
  type LexiconSource,
  lexiconSourceById,
} from "../src/domain/lexicon/source-registry.ts";
import {
  DEFAULT_IDENTITY_POLICY,
  WORD_STUDY_IDENTITY_VERSION,
} from "../src/domain/word-study/identity.ts";
import {
  type IndexHeader,
  type PartitionStat,
  type SourceAttribution,
  WORD_STUDY_INDEX_FORMAT,
  buildInvertedIndex,
  partitionLines,
  planPartitions,
  serializeManifest,
} from "../src/domain/word-study/inverted-index.ts";
import {
  type MaculaTally,
  readMaculaOccurrences,
} from "../src/domain/word-study/macula-source.ts";

const argv = process.argv.slice(2);

function flag(name: string): string | null {
  const prefix = `--${name}=`;
  const found = argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function has(name: string): boolean {
  return argv.includes(`--${name}`);
}

const BUDGET = Number.parseInt(flag("budget") ?? "10000", 10);
const OUT_DIR = flag("out") ?? join(tmpdir(), "word-study-index");
const VERIFY = !has("no-verify");
const STRICT_HASH = has("strict-hash");
const CORPUS_DIR = process.env.WORD_STUDY_CORPUS_DIR ?? null;

const FIXTURE_DIR = "tests/fixtures/lexicons";

/**
 * De onde cada idioma é lido. Com `WORD_STUDY_CORPUS_DIR`, os nomes são os
 * `localPath` declarados no registro — isto é, os bytes oficiais. Sem ele, as
 * fixtures versionadas, que são recortes reais de Gênesis 1:1 e João 1:1.
 */
type Plan = {
  readonly sourceId: string;
  readonly file: string;
  readonly assetPath: string;
  readonly fixture: boolean;
};

function plans(): readonly Plan[] {
  if (CORPUS_DIR) {
    return [
      {
        sourceId: "macula-hebrew",
        file: join(CORPUS_DIR, "macula-hebrew", "macula-hebrew.tsv"),
        assetPath: "macula-hebrew.tsv",
        fixture: false,
      },
      {
        sourceId: "macula-greek",
        file: join(CORPUS_DIR, "macula-greek", "macula-greek-SBLGNT.tsv"),
        assetPath: "macula-greek-SBLGNT.tsv",
        fixture: false,
      },
    ];
  }
  return [
    {
      sourceId: "macula-hebrew",
      file: join(FIXTURE_DIR, "macula-hebrew-gen1-1.sample.tsv"),
      assetPath: "macula-hebrew-gen1-1.sample.tsv",
      fixture: true,
    },
    {
      sourceId: "macula-greek",
      file: join(FIXTURE_DIR, "macula-greek-jhn1-1.sample.tsv"),
      assetPath: "macula-greek-jhn1-1.sample.tsv",
      fixture: true,
    },
  ];
}

function sha256(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Confere o hash do arquivo lido contra o `expectedSha256` do registro, quando
 * existe. Só vale para os bytes oficiais: a fixture é um recorte, então o hash
 * dela não deve bater com o do arquivo inteiro, e comparar seria ruído.
 */
function checkHash(source: LexiconSource, plan: Plan, digest: string): string {
  if (plan.fixture) return "fixture (hash do registro não se aplica ao recorte)";
  const asset = source.assets.find((item) => item.localPath === plan.assetPath);
  const expected = asset?.expectedSha256 ?? null;
  if (expected === null) return "registro sem hash congelado para este ativo";
  if (expected === digest) return "confere com o registro";
  const message =
    `hash divergente para ${plan.assetPath}: registro ${expected}, arquivo ${digest}`;
  if (STRICT_HASH) throw new Error(message);
  return `DIVERGENTE (${message})`;
}

function describeTally(tally: MaculaTally): string {
  return [
    `${tally.accepted} aceita(s)`,
    `${tally.identifiedByLemma} por lema`,
    `${tally.withoutWrittenForm} sem forma escrita`,
    `${tally.withoutSourceWordId} sem id`,
    `${tally.withoutIdentity} sem identidade`,
    `${tally.badRef} ref inválida`,
    `${tally.badStrong} Strong inválido`,
  ].join(", ");
}

function main(): void {
  if (!Number.isSafeInteger(BUDGET) || BUDGET <= 0) {
    throw new Error(`--budget inválido: ${String(flag("budget"))}`);
  }
  const startedAt = process.hrtime.bigint();

  const attributions: SourceAttribution[] = [];
  const inputs: Parameters<typeof buildInvertedIndex>[0][number][] = [];
  const limitations: string[] = [];
  let usedFixtures = false;

  console.log(`origem: ${CORPUS_DIR ?? `${FIXTURE_DIR} (fixtures versionadas)`}`);

  for (const plan of plans()) {
    const source = lexiconSourceById(plan.sourceId);
    let raw: Buffer;
    try {
      raw = readFileSync(plan.file);
    } catch {
      console.log(`   ${plan.sourceId}: ${plan.file} ausente; idioma fica fora do índice`);
      limitations.push(
        `Idioma de ${plan.sourceId} ausente do índice: arquivo ${plan.assetPath} não estava ` +
          "disponível na geração.",
      );
      continue;
    }
    if (plan.fixture) usedFixtures = true;
    const digest = sha256(raw);
    const result = readMaculaOccurrences({
      source,
      assetPath: plan.assetPath,
      assetSha256: digest,
      content: raw.toString("utf8"),
    });
    attributions.push(result.attribution);
    inputs.push(...result.occurrences);
    console.log(
      `   ${plan.sourceId} (${result.language}): ${describeTally(result.tally)}\n` +
        `      sha256: ${digest} — ${checkHash(source, plan, digest)}\n` +
        `      colunas ignoradas: ${result.ignoredFields.length}`,
    );
    for (const sample of result.samples.slice(0, 5)) {
      console.log(`      · ${sample.at}: ${sample.reason}`);
    }
  }

  if (inputs.length === 0) {
    throw new Error("nenhuma ocorrência lida; nada a gravar");
  }

  const built = buildInvertedIndex(inputs);
  const partitions = planPartitions(built.postings, { occurrenceBudget: BUDGET });

  // Limitações declaradas. A primeira é estrutural e vale sempre enquanto o
  // mapa de redução estiver vazio; as outras dependem do que foi lido.
  if (DEFAULT_IDENTITY_POLICY.foldMapSource === null) {
    limitations.push(
      "Formas flexionadas com Strong próprio não são reunidas ao lema (no grego, ἦν = G2258 " +
        "não se junta a εἰμί = G1510): a coluna dStrong do TBESG, que faria a ponte, não é " +
        "importada por decisão registrada. Contagens por lema são, portanto, por forma.",
    );
  }
  if (usedFixtures) {
    limitations.push(
      "Índice montado a partir das fixtures versionadas (recortes de Gênesis 1:1 e João 1:1), " +
        "não do corpus completo. Não serve como medição do corpus real.",
    );
  }
  if (built.coverage.booksAbsent.length > 0) {
    limitations.push(
      `Cobertura parcial: ${built.coverage.booksPresent.length} de 66 livros têm ocorrência; ` +
        `${built.coverage.booksAbsent.length} não têm nenhuma.`,
    );
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const stats: PartitionStat[] = [];
  for (const plan of partitions) {
    const body = [...partitionLines(plan)].join("");
    const file = `postings-${String(plan.ordinal).padStart(4, "0")}.ndjson`;
    writeFileSync(join(OUT_DIR, file), body, "utf8");
    const bytes = Buffer.byteLength(body, "utf8");
    stats.push({
      ordinal: plan.ordinal,
      file,
      firstKey: plan.firstKey,
      lastKey: plan.lastKey,
      firstSortKey: plan.firstSortKey,
      lastSortKey: plan.lastSortKey,
      postings: plan.postings.length,
      occurrences: plan.occurrences,
      oversized: plan.oversized,
      bytes,
      gzipBytes: gzipSync(body, { level: 9 }).byteLength,
      sha256: sha256(body),
    });
  }

  const header: IndexHeader = {
    format: WORD_STUDY_INDEX_FORMAT,
    // Versão vinculada às fontes, formato, orçamento e bytes das partições.
    // Não leva relógio, para manter construções idênticas reproduzíveis.
    indexVersion: sha256(
      JSON.stringify([
        WORD_STUDY_IDENTITY_VERSION,
        WORD_STUDY_INDEX_FORMAT,
        BUDGET,
        attributions.map((item) => [item.sourceId, item.assetSha256]),
        stats.map((item) => [item.file, item.sha256]),
      ]),
    ).slice(0, 16),
    identityVersion: WORD_STUDY_IDENTITY_VERSION,
    identityMode: DEFAULT_IDENTITY_POLICY.mode,
    foldMapSource: DEFAULT_IDENTITY_POLICY.foldMapSource,
    sources: attributions,
    coverage: built.coverage,
    limitations,
  };

  const manifest = serializeManifest(header, stats);
  writeFileSync(join(OUT_DIR, "manifest.json"), manifest, "utf8");

  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  const totalBytes = stats.reduce((sum, item) => sum + item.bytes, 0);
  const totalGzip = stats.reduce((sum, item) => sum + item.gzipBytes, 0);
  const manifestBytes = Buffer.byteLength(manifest, "utf8");
  const biggest = stats.reduce(
    (worst, item) => (item.gzipBytes > worst ? item.gzipBytes : worst),
    0,
  );

  console.log(`\nidentidades: ${built.coverage.identities}`);
  console.log(`ocorrências: ${built.coverage.occurrences}`);
  console.log(`referências distintas: ${built.coverage.refsPresent}`);
  console.log(
    `livros com dado: ${built.coverage.booksPresent.length}/66` +
      (built.coverage.booksPresent.length > 0
        ? ` (${built.coverage.booksPresent.join(", ")})`
        : ""),
  );
  console.log(`partições: ${stats.length} (orçamento ${BUDGET} ocorrências)`);
  console.log(`   sobredimensionadas: ${stats.filter((item) => item.oversized).length}`);
  console.log(`postings: ${totalBytes} B cru, ${totalGzip} B gzip`);
  console.log(`manifesto: ${manifestBytes} B`);
  console.log(
    `maior partição: ${biggest} B gzip  ← é este o custo de uma consulta em celular`,
  );
  console.log(`problemas de montagem: ${built.problems.length}`);
  console.log(`tempo de geração: ${elapsedMs.toFixed(1)} ms`);
  console.log(`destino: ${OUT_DIR}`);
  for (const limitation of limitations) console.log(`limitação declarada: ${limitation}`);

  if (VERIFY) {
    // Reprocessar os mesmos bytes deve devolver os mesmos hashes. Sem isso não
    // existe índice versionado: duas gerações produziriam versões diferentes do
    // mesmo dado.
    const again = buildInvertedIndex(inputs);
    const againStats = planPartitions(again.postings, { occurrenceBudget: BUDGET }).map((plan) =>
      sha256([...partitionLines(plan)].join("")),
    );
    const same =
      againStats.length === stats.length &&
      againStats.every((digest, index) => digest === stats[index]?.sha256);
    console.log(`determinismo: ${same ? "OK — mesmos hashes" : "FALHOU — hashes divergiram"}`);
    if (!same) process.exitCode = 1;
  }
}

main();
