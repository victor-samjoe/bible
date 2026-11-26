/** Mede o mecanismo anterior nos shards locais; não é leitura do banco remoto. */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";

type Row = [number, string, string, string, string | null, string | null, ...unknown[]];
type Shard = { l: string; b: string; c: number; p: { v: Record<string, Row[]> } };
type Counts = { chapters: number; occurrences: number; withLexicalValue: number; mixedWithMissingMorphemes: number; multiMorphemeSingleValue: number };
const result: Record<string, Counts> = {};
const input = join(process.cwd(), "data/generated/lexicons/chapter-shards.ndjson");
const lines = createInterface({ input: createReadStream(input, "utf8"), crlfDelay: Infinity });
for await (const line of lines) {
  if (!line.trim()) continue;
  const shard = JSON.parse(line) as Shard;
  const counts = result[shard.l] ??= { chapters: 0, occurrences: 0, withLexicalValue: 0, mixedWithMissingMorphemes: 0, multiMorphemeSingleValue: 0 };
  counts.chapters += 1;
  for (const rows of Object.values(shard.p.v)) {
    const grouped = new Map<number, Row[]>();
    for (const row of rows) {
      const group = grouped.get(row[0]) ?? [];
      group.push(row);
      grouped.set(row[0], group);
    }
    for (const group of grouped.values()) {
      const values = group.filter((row) => typeof row[5] === "string" && row[5].length > 0).length;
      counts.occurrences += 1;
      if (values > 0) counts.withLexicalValue += 1;
      if (values > 0 && group.some((row) => row[2] && !row[5])) counts.mixedWithMissingMorphemes += 1;
      if (group.length > 1 && values === 1) counts.multiMorphemeSingleValue += 1;
    }
  }
}
console.log(JSON.stringify({ note: "Contagens do arquivo local; morfemas ausentes do shard não são detectáveis; não estimam erros linguísticos.", result }, null, 2));
