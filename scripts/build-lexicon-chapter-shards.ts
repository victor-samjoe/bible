import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";

// Converte o índice editorial completo em pequenos payloads públicos por
// capítulo. Chaves curtas são deliberadas: o formato é interno e a API o
// expande, evitando repetir nomes de coluna 600 mil vezes no banco.
const root = join(import.meta.dirname, "..");
const input = join(root, "data", "generated", "lexicons", "lexicon-index.ndjson");
const output = join(root, "data", "generated", "lexicons", "chapter-shards.ndjson");

type Entry = { type: "entry"; key: string; strongId: string | null; transliteration: { value: string } | null };
type Occurrence = {
  type: "occurrence"; language: "hbo" | "grc"; canonicalRef: string; wordPosition: number | null;
  sourceWordId: string; surface: string; lemma: string; lexemeKey: string; morphology: string | null;
  partOfSpeech: string | null; semanticDomain: string | null; gloss: string | null;
};
// Campo 11 é o `lexemeKey`. Entrou em 24/11 porque é por ele que a ocorrência
// alcança a tradução editorial e a árvore de acepções do BDB. Ligar por
// semelhança de grafia do lema seria adivinhar — é exatamente o que o
// `LexicalIndex.xml` existe para evitar.
type CompactRow = [number, string, string, string, string | null, string | null, string | null, string | null, string | null, string | null, string];
type ShardRow = { l: "hbo" | "grc"; b: string; c: number; h: string; p: unknown };

async function* lines(path: string): AsyncGenerator<string> {
  const reader = createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Number.POSITIVE_INFINITY });
  for await (const line of reader) if (line) yield line;
}

async function main(): Promise<void> {
  if (!existsSync(input)) throw new Error("índice ausente; rode build-lexicon-index.ts --emit");
  const entries = new Map<string, Pick<Entry, "strongId" | "transliteration">>();
  for await (const line of lines(input)) {
    const record = JSON.parse(line) as Entry | Occurrence;
    if (record.type === "entry") entries.set(record.key, record);
  }
  const groups = new Map<string, { l: "hbo" | "grc"; b: string; c: number; v: Record<string, CompactRow[]> }>();
  for await (const line of lines(input)) {
    const record = JSON.parse(line) as Entry | Occurrence;
    if (record.type !== "occurrence" || record.wordPosition === null) continue;
    const match = /^([A-Z0-9]{3}) (\d+):(\d+)$/u.exec(record.canonicalRef);
    if (!match) continue;
    const [, b, chapter, verse] = match;
    if (!b || !chapter || !verse) continue;
    const c = Number(chapter);
    const key = `${record.language}:${b}:${c}`;
    const group = groups.get(key) ?? { l: record.language, b, c, v: {} };
    const entry = entries.get(record.lexemeKey);
    const verseRows = group.v[verse] ?? [];
    verseRows.push([
      record.wordPosition, record.sourceWordId, record.surface, record.lemma,
      entry?.strongId ?? null, entry?.transliteration?.value ?? null,
      record.morphology, record.partOfSpeech, record.semanticDomain, record.gloss,
      record.lexemeKey,
    ] as CompactRow);
    group.v[verse] = verseRows;
    groups.set(key, group);
  }
  await mkdir(join(root, "data", "generated", "lexicons"), { recursive: true });
  const handle = await open(output, "w");
  try {
    for (const group of [...groups.values()].sort((a, b) => `${a.l}:${a.b}:${a.c}`.localeCompare(`${b.l}:${b.b}:${b.c}`))) {
      for (const rows of Object.values(group.v)) rows.sort((a, b) => Number(a[0]) - Number(b[0]) || String(a[1]).localeCompare(String(b[1])));
      const payload = { v: group.v };
      const encoded = JSON.stringify(payload);
      const row: ShardRow = { l: group.l, b: group.b, c: group.c, h: createHash("sha256").update(encoded).digest("hex"), p: payload };
      await handle.write(`${JSON.stringify(row)}\n`, null, "utf8");
    }
  } finally { await handle.close(); }
  console.log(`shards: ${groups.size}; verbetes em memória: ${entries.size}; saída: ${output}`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
