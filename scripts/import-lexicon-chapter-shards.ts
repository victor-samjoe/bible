import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { Pool } from "pg";

const root = join(import.meta.dirname, "..");
const connectionString = process.env.DATABASE_URL?.trim();
const batchSize = 100;

function argumentValue(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

// `--input` permite importar o arquivo de um shard só; sem ele, o conjunto
// completo, como antes. `--only=hbo:GEN:1` restringe o que pode ser gravado: a
// verificação **falha** diante de linha fora do alvo em vez de ignorá-la, para
// que um arquivo errado não atualize shards que ninguém pediu.
const input = argumentValue("input") ?? join(root, "data", "generated", "lexicons", "chapter-shards.ndjson");
const only = argumentValue("only");

type Shard = { l: "hbo" | "grc"; b: string; c: number; h: string; p: unknown };

async function* rows(): AsyncGenerator<Shard> {
  const reader = createInterface({ input: createReadStream(input, "utf8"), crlfDelay: Number.POSITIVE_INFINITY });
  for await (const line of reader) {
    if (!line) continue;
    const shard = JSON.parse(line) as Shard;
    if (only && `${shard.l}:${shard.b}:${shard.c}` !== only) {
      throw new Error(`arquivo contém o shard ${shard.l}:${shard.b}:${shard.c}, fora do alvo --only=${only}; nada foi gravado`);
    }
    yield shard;
  }
}

async function flush(client: import("pg").PoolClient, batch: readonly Shard[]): Promise<void> {
  if (!batch.length) return;
  const values = batch.map((_, index) => `($${index * 5 + 1},$${index * 5 + 2},$${index * 5 + 3},$${index * 5 + 4}::jsonb,$${index * 5 + 5})`).join(",");
  await client.query(
    `INSERT INTO lexicon_chapter_shards (language, book_code, chapter, payload, source_sha256)
     VALUES ${values}
     ON CONFLICT (language, book_code, chapter) DO UPDATE SET payload = EXCLUDED.payload, source_sha256 = EXCLUDED.source_sha256, generated_at = now()`,
    batch.flatMap((row) => [row.l, row.b, row.c, JSON.stringify(row.p), row.h]),
  );
}

async function main(): Promise<void> {
  if (!connectionString) throw new Error("DATABASE_URL não definida");
  if (!existsSync(input)) throw new Error(`shards ausentes: ${input}`);
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  let batch: Shard[] = [];
  let count = 0;
  try {
    await client.query("BEGIN");
    for await (const row of rows()) {
      batch.push(row);
      if (batch.length === batchSize) { await flush(client, batch); count += batch.length; batch = []; }
    }
    await flush(client, batch); count += batch.length;
    await client.query("COMMIT");
    console.log(`shards importados: ${count}; origem: ${input}${only ? `; alvo: ${only}` : ""}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); await pool.end(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
