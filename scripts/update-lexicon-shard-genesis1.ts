import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";

/**
 * Atualização de **um** shard: `hbo/GEN/1`, de dez para onze campos por linha.
 *
 * Por que existe: o leitor passou a alcançar tradução editorial e acepções do
 * BDB pelo 11º campo (`lexemeKey`). O shard publicado tem dez campos, então
 * `row[10]` vem `undefined`, a chave fica vazia e a consulta de acepções é
 * filtrada antes de ir ao banco. O texto original, a morfologia, a glossa e a
 * tradução continuam aparecendo — a junção da tradução é por texto da glossa,
 * não por chave de lema. O que falta é só a árvore do BDB.
 *
 * O que este programa **não** faz, de propósito:
 *
 * - não toca em nenhum outro shard: o alvo é fixo no código, não é argumento;
 * - não escreve no banco: ele emite o artefato e imprime o comando de importação;
 * - não infere `lexemeKey` pela grafia do lema. A chave vem do próprio índice,
 *   que a recebeu do `LexicalIndex.xml`. Casar por semelhança de grafia é
 *   exatamente o erro que aquele arquivo existe para evitar;
 * - não aceita divergência. Se qualquer um dos dez campos anteriores mudar, ou
 *   se faltar/sobrar ocorrência, ele falha em vez de publicar uma substituição
 *   que o revisor teria de conferir linha a linha.
 *
 * A comparação é por `sourceWordId`, que é o identificador de ocorrência da
 * fonte — não por posição no array, que mudaria de significado se a ordenação
 * mudasse.
 */

const TARGET = { language: "hbo", bookCode: "GEN", chapter: 1 } as const;

const root = join(import.meta.dirname, "..");
const generated = join(root, "data", "generated", "lexicons");
const sliceInput = join(generated, "genesis1-index.ndjson");
const artifact = join(generated, `shard-${TARGET.language}-${TARGET.bookCode}-${TARGET.chapter}.ndjson`);

/** Posição de cada campo. O 11º é o acréscimo; os dez primeiros são intocáveis. */
export type CompactRow = [
  number, // 0 wordPosition
  string, // 1 sourceWordId
  string, // 2 surface
  string, // 3 lemma
  string | null, // 4 strongId
  string | null, // 5 transliteração
  string | null, // 6 morphology
  string | null, // 7 partOfSpeech
  string | null, // 8 semanticDomain
  string | null, // 9 gloss
  string, // 10 lexemeKey  ← acréscimo de 24/11
];

/** Linha no formato publicado hoje: dez campos, sem `lexemeKey`. */
export type LegacyRow = readonly unknown[];

export type ShardPayload = { readonly v: Readonly<Record<string, readonly LegacyRow[]>> };

export type ShardRow = {
  readonly l: string;
  readonly b: string;
  readonly c: number;
  readonly h: string;
  readonly p: ShardPayload;
};

type IndexRecord =
  | { type: "entry"; key: string; strongId: string | null; transliteration: { value: string } | null }
  | {
      type: "occurrence";
      language: string;
      canonicalRef: string;
      wordPosition: number | null;
      sourceWordId: string;
      surface: string;
      lemma: string;
      lexemeKey: string;
      morphology: string | null;
      partOfSpeech: string | null;
      semanticDomain: string | null;
      gloss: string | null;
    }
  | { type: string };

export type Divergence = {
  readonly kind: "ausente" | "sobra" | "duplicado" | "divergente" | "chave-vazia" | "largura";
  readonly sourceWordId: string;
  readonly detail: string;
};

const FIELD_NAMES = [
  "wordPosition",
  "sourceWordId",
  "surface",
  "lemma",
  "strongId",
  "transliteração",
  "morphology",
  "partOfSpeech",
  "semanticDomain",
  "gloss",
] as const;

export function digestOf(payload: ShardPayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function encodedBytes(payload: ShardPayload): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

/**
 * Indexa as linhas por `sourceWordId` e **rejeita duplicidade**. Um mesmo
 * identificador duas vezes no payload significaria que a correspondência não é
 * inequívoca, e a comparação deixaria de provar o que precisa provar.
 */
export function indexBySourceWordId(
  payload: ShardPayload,
  minimumWidth: number,
): { readonly rows: Map<string, { verse: string; row: LegacyRow }>; readonly problems: readonly Divergence[] } {
  const rows = new Map<string, { verse: string; row: LegacyRow }>();
  const problems: Divergence[] = [];
  for (const [verse, items] of Object.entries(payload.v)) {
    for (const row of items) {
      const sourceWordId = typeof row[1] === "string" ? row[1] : "";
      if (row.length < minimumWidth) {
        problems.push({
          kind: "largura",
          sourceWordId,
          detail: `linha com ${row.length} campos em ${verse}; mínimo esperado ${minimumWidth}`,
        });
        continue;
      }
      if (sourceWordId.length === 0) {
        problems.push({ kind: "divergente", sourceWordId: `(verso ${verse})`, detail: "linha sem identificador de ocorrência" });
        continue;
      }
      if (rows.has(sourceWordId)) {
        problems.push({ kind: "duplicado", sourceWordId, detail: `aparece em ${rows.get(sourceWordId)?.verse} e em ${verse}` });
        continue;
      }
      rows.set(sourceWordId, { verse, row });
    }
  }
  return { rows, problems };
}

/**
 * Compara o payload publicado com o candidato. Só uma mudança é tolerada: o
 * acréscimo do 11º campo, preenchido. Tudo o mais é divergência.
 */
export function compareShardPayloads(
  before: ShardPayload,
  after: ShardPayload,
): readonly Divergence[] {
  const problems: Divergence[] = [];
  // O payload publicado pode ter dez ou onze campos: dez é o formato atual, e
  // onze acontece quando a atualização é reaplicada. Ambos têm de bater nos dez
  // primeiros, o que também é o teste de idempotência da comparação.
  const beforeIndexed = indexBySourceWordId(before, 10);
  const afterIndexed = indexBySourceWordId(after, 11);
  problems.push(...beforeIndexed.problems, ...afterIndexed.problems);

  for (const [sourceWordId, { verse, row }] of beforeIndexed.rows) {
    const candidate = afterIndexed.rows.get(sourceWordId);
    if (!candidate) {
      problems.push({ kind: "ausente", sourceWordId, detail: `estava em ${verse} e não aparece no candidato` });
      continue;
    }
    if (candidate.verse !== verse) {
      problems.push({ kind: "divergente", sourceWordId, detail: `mudou de verso: ${verse} → ${candidate.verse}` });
    }
    for (let field = 0; field < 10; field += 1) {
      const left = row[field] ?? null;
      const right = candidate.row[field] ?? null;
      if (left !== right) {
        problems.push({
          kind: "divergente",
          sourceWordId,
          detail: `campo ${field} (${FIELD_NAMES[field]}): ${JSON.stringify(left)} → ${JSON.stringify(right)}`,
        });
      }
    }
  }

  for (const [sourceWordId, { verse, row }] of afterIndexed.rows) {
    if (!beforeIndexed.rows.has(sourceWordId)) {
      problems.push({ kind: "sobra", sourceWordId, detail: `aparece em ${verse} e não existia no publicado` });
    }
    const lexemeKey = row[10];
    if (typeof lexemeKey !== "string" || lexemeKey.trim().length === 0) {
      // Gravar chave vazia seria pior do que não atualizar: o shard passaria a
      // ter onze campos e continuaria sem alcançar o verbete, agora sem o
      // formato antigo para explicar por quê.
      problems.push({ kind: "chave-vazia", sourceWordId, detail: `11º campo ausente ou vazio em ${verse}` });
    }
  }

  return problems;
}

async function* indexLines(path: string): AsyncGenerator<IndexRecord> {
  const reader = createInterface({
    input: createReadStream(path, "utf8"),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  for await (const line of reader) {
    if (line) yield JSON.parse(line) as IndexRecord;
  }
}

/**
 * Monta o payload candidato a partir do recorte de Gênesis 1 — o mesmo arquivo
 * que o recorte determinístico produz, não o índice de 564 MB. `strongId` e
 * transliteração vêm do registro de verbete, pela chave; nunca da grafia.
 */
export async function buildCandidate(path: string): Promise<ShardPayload> {
  const entries = new Map<string, { strongId: string | null; transliteration: string | null }>();
  for await (const record of indexLines(path)) {
    if (record.type === "entry" && "key" in record) {
      entries.set(record.key, {
        strongId: record.strongId,
        transliteration: record.transliteration?.value ?? null,
      });
    }
  }

  const verses: Record<string, CompactRow[]> = {};
  let skipped = 0;
  for await (const record of indexLines(path)) {
    if (record.type !== "occurrence" || !("canonicalRef" in record)) continue;
    const match = /^([A-Z0-9]{3}) (\d+):(\d+)$/u.exec(record.canonicalRef);
    if (!match) continue;
    const [, bookCode, chapter, verse] = match;
    if (
      record.language !== TARGET.language ||
      bookCode !== TARGET.bookCode ||
      Number(chapter) !== TARGET.chapter
    ) {
      // O recorte deveria conter só Gênesis 1; qualquer coisa fora do alvo é
      // contada e descartada, e a contagem aparece no relatório.
      skipped += 1;
      continue;
    }
    if (record.wordPosition === null || !verse) continue;
    const entry = entries.get(record.lexemeKey);
    const rows = verses[verse] ?? [];
    rows.push([
      record.wordPosition,
      record.sourceWordId,
      record.surface,
      record.lemma,
      entry?.strongId ?? null,
      entry?.transliteration ?? null,
      record.morphology,
      record.partOfSpeech,
      record.semanticDomain,
      record.gloss,
      record.lexemeKey,
    ]);
    verses[verse] = rows;
  }

  if (skipped > 0) {
    throw new Error(
      `recorte contém ${skipped} ocorrência(s) fora de ${TARGET.language}/${TARGET.bookCode}/${TARGET.chapter}; refaça o recorte antes de atualizar o shard`,
    );
  }
  if (Object.keys(verses).length === 0) {
    throw new Error(`nenhuma ocorrência de ${TARGET.bookCode} ${TARGET.chapter} no recorte ${path}`);
  }

  // Mesma ordenação do gerador completo, para que o digest não dependa da
  // ordem de leitura do arquivo.
  for (const rows of Object.values(verses)) {
    rows.sort((left, right) => left[0] - right[0] || left[1].localeCompare(right[1]));
  }
  const ordered: Record<string, CompactRow[]> = {};
  for (const verse of Object.keys(verses).sort((left, right) => Number(left) - Number(right))) {
    const rows = verses[verse];
    if (rows) ordered[verse] = rows;
  }
  return { v: ordered };
}

/** Lê o payload publicado de um arquivo: `{v:…}`, ou a linha `{l,b,c,h,p}`. */
export function parseBeforePayload(text: string): ShardPayload {
  const parsed = JSON.parse(text) as ShardPayload | ShardRow;
  if ("p" in parsed && parsed.p && typeof parsed.p === "object") {
    const row = parsed as ShardRow;
    if (row.l !== TARGET.language || row.b !== TARGET.bookCode || row.c !== TARGET.chapter) {
      throw new Error(`o arquivo de comparação é do shard ${row.l}/${row.b}/${row.c}, não do alvo`);
    }
    return row.p;
  }
  if ("v" in parsed && parsed.v && typeof parsed.v === "object") return parsed as ShardPayload;
  throw new Error("formato não reconhecido: esperado {v:…} ou a linha {l,b,c,h,p}");
}

async function readBeforeFromDatabase(connectionString: string): Promise<ShardPayload | null> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query<{ payload: ShardPayload; source_sha256: string }>(
      `SELECT payload, source_sha256 FROM lexicon_chapter_shards
       WHERE language = $1 AND book_code = $2 AND chapter = $3`,
      [TARGET.language, TARGET.bookCode, TARGET.chapter],
    );
    return result.rows[0]?.payload ?? null;
  } finally {
    await pool.end();
  }
}

function argumentValue(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

async function main(): Promise<void> {
  if (!existsSync(sliceInput)) {
    throw new Error(`recorte ausente: ${sliceInput}; rode scripts/build-lexicon-genesis1-slice.mjs`);
  }

  const candidate = await buildCandidate(sliceInput);
  const candidateDigest = digestOf(candidate);
  const candidateBytes = encodedBytes(candidate);
  const candidateRows = Object.values(candidate.v).reduce((total, rows) => total + rows.length, 0);

  const beforeFile = argumentValue("before");
  const databaseUrl = process.env.DATABASE_URL?.trim();
  let before: ShardPayload | null = null;
  let beforeOrigin = "nenhuma";
  if (beforeFile) {
    before = parseBeforePayload(await readFile(beforeFile, "utf8"));
    beforeOrigin = `arquivo ${beforeFile}`;
  } else if (databaseUrl) {
    before = await readBeforeFromDatabase(databaseUrl);
    beforeOrigin = before ? "banco em DATABASE_URL" : "banco em DATABASE_URL (shard inexistente)";
  }

  const report: Record<string, unknown> = {
    alvo: `${TARGET.language}/${TARGET.bookCode}/${TARGET.chapter}`,
    origemDaComparacao: beforeOrigin,
    depois: {
      sha256: candidateDigest,
      bytes: candidateBytes,
      versos: Object.keys(candidate.v).length,
      linhas: candidateRows,
      campos: 11,
    },
  };

  if (before) {
    const beforeBytes = encodedBytes(before);
    const beforeRows = Object.values(before.v).reduce((total, rows) => total + rows.length, 0);
    const widths = new Set<number>();
    for (const rows of Object.values(before.v)) for (const row of rows) widths.add(row.length);
    report.antes = {
      sha256: digestOf(before),
      bytes: beforeBytes,
      versos: Object.keys(before.v).length,
      linhas: beforeRows,
      campos: [...widths].sort((left, right) => left - right),
    };
    report.impactoDeEspaco = {
      deltaBytesDoPayload: candidateBytes - beforeBytes,
      // O TOAST comprime o jsonb, então o crescimento em disco é menor que o
      // do texto. O número do payload é o teto, não a medida.
      observacao: "delta do payload em texto; em disco o TOAST comprime, logo este valor é o teto",
    };

    const problems = compareShardPayloads(before, candidate);
    if (problems.length > 0) {
      report.divergencias = problems.slice(0, 20);
      report.totalDeDivergencias = problems.length;
      console.error(JSON.stringify(report, null, 2));
      throw new Error(
        `${problems.length} divergência(s) entre o shard publicado e o candidato; nada foi escrito`,
      );
    }
    report.comparacao = "os dez campos publicados são idênticos; a única mudança é o 11º campo, preenchido em todas as linhas";
  } else {
    report.comparacao =
      "sem shard publicado para comparar: passe --before=<arquivo> ou DATABASE_URL para que a comparação linha a linha aconteça";
  }

  const row: ShardRow = {
    l: TARGET.language,
    b: TARGET.bookCode,
    c: TARGET.chapter,
    h: candidateDigest,
    p: candidate,
  };
  await writeFile(artifact, `${JSON.stringify(row)}\n`, "utf8");
  report.artefato = { caminho: artifact, bytes: statSync(artifact).size };
  report.comandoDeImportacao = `DATABASE_URL=… node --experimental-strip-types scripts/import-lexicon-chapter-shards.ts --input=${artifact} --only=${TARGET.language}:${TARGET.bookCode}:${TARGET.chapter}`;

  console.log(JSON.stringify(report, null, 2));
}

// Só executa quando chamado como programa; o módulo é importado pelos testes.
const invokedPath = process.argv[1]?.replace(/\\/gu, "/") ?? "";
if (invokedPath.endsWith("update-lexicon-shard-genesis1.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
