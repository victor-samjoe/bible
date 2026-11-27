/** Medição local em lotes; não publica texto, não conecta a serviços nem ao Supabase. */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { lexiconSourceById } from "../src/domain/lexicon/source-registry.ts";
import { readMaculaOccurrences } from "../src/domain/word-study/macula-source.ts";
import { identitySortKey } from "../src/domain/word-study/identity.ts";
import { refCode } from "../src/domain/word-study/reference.ts";

const root = process.env.WORD_STUDY_CORPUS_DIR;
if (!root) throw new Error("Informe WORD_STUDY_CORPUS_DIR com as fontes locais");
const temp = mkdtempSync(join(tmpdir(), "samjoe-word-audit-"));
const file = join(temp, "audit.sqlite");
const db = new DatabaseSync(file);
const output: unknown[] = [];
try {
  db.exec("CREATE TABLE occurrence (id TEXT PRIMARY KEY, identity TEXT NOT NULL, sortkey TEXT NOT NULL, refcode INTEGER NOT NULL, position INTEGER, book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, language TEXT NOT NULL) WITHOUT ROWID");
  const insert = db.prepare("INSERT OR IGNORE INTO occurrence VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const plan of [
    { sourceId: "macula-hebrew", path: join(root, "macula-hebrew", "macula-hebrew.tsv") },
    { sourceId: "macula-greek", path: join(root, "macula-greek", "macula-greek-SBLGNT.tsv") },
  ]) {
    const source = lexiconSourceById(plan.sourceId);
    const hash = createHash("sha256");
    const stream = createReadStream(plan.path);
    stream.on("data", (chunk) => hash.update(chunk));
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    let header: string | null = null;
    let batch: string[] = [];
    const totals = { accepted: 0, identifiedByLemma: 0, withoutWrittenForm: 0, withoutSourceWordId: 0, withoutIdentity: 0, badRef: 0, badStrong: 0, duplicates: 0 };
    function flush() {
      if (!header || batch.length === 0) return;
      const parsed = readMaculaOccurrences({ source, assetPath: plan.path.split(/[\\/]/u).pop() ?? "", assetSha256: "0".repeat(64), content: `${header}\n${batch.join("\n")}\n` });
      for (const key of Object.keys(parsed.tally) as (keyof typeof parsed.tally)[]) totals[key] += parsed.tally[key];
      db.exec("BEGIN");
      for (const row of parsed.occurrences) {
        const result = insert.run(row.sourceWordId, row.identity.key, identitySortKey(row.identity), refCode(row.ref), row.position, row.ref.book, row.ref.chapter, row.ref.verse, row.identity.language);
        if (Number(result.changes) === 0) totals.duplicates += 1;
      }
      db.exec("COMMIT");
      batch = [];
    }
    for await (const line of lines) {
      if (header === null) { header = line; continue; }
      batch.push(line);
      if (batch.length >= 2000) flush();
    }
    flush();
    output.push({ source: plan.sourceId, sha256: hash.digest("hex"), ...totals });
  }
  const counts = db.prepare("SELECT language, count(*) AS occurrences, count(DISTINCT identity) AS identities, count(DISTINCT book) AS books, count(DISTINCT book || ':' || chapter || ':' || verse) AS verses FROM occurrence GROUP BY language ORDER BY language").all();
  const top = db.prepare("SELECT identity, count(*) AS occurrences FROM occurrence GROUP BY identity ORDER BY occurrences DESC, identity LIMIT 10").all();
  // Mesma codificação e regra de orçamento do índice, sem guardar o corpus no heap.
  db.exec("CREATE INDEX occurrence_identity ON occurrence(identity, refcode, position)");
  const identities = db.prepare("SELECT identity, sortkey, count(*) AS n FROM occurrence GROUP BY identity, sortkey").all() as { identity: string; sortkey: string; n: number }[];
  identities.sort((a, b) => a.sortkey < b.sortkey ? -1 : a.sortkey > b.sortkey ? 1 : 0);
  const lookup = db.prepare("SELECT refcode, position FROM occurrence WHERE identity = ? ORDER BY refcode, position IS NULL, position");
  const budget = 10000;
  const artifactHash = createHash("sha256");
  let current = "", currentCount = 0, partitions = 0, totalRaw = 0, totalGzip = 0, largestGzip = 0, oversized = 0;
  function flush() {
    if (!current) return;
    const compressed = gzipSync(current, { level: 9 }).byteLength;
    artifactHash.update(current);
    partitions += 1; totalRaw += Buffer.byteLength(current); totalGzip += compressed;
    largestGzip = Math.max(largestGzip, compressed);
    if (currentCount > budget) oversized += 1;
    current = ""; currentCount = 0;
  }
  for (const item of identities) {
    if (currentCount + item.n > budget) flush();
    let previous = 0;
    const encoded: number[] = [];
    for (const row of lookup.iterate(item.identity) as Iterable<{ refcode: number; position: number | null }>) {
      encoded.push(previous === 0 ? row.refcode : row.refcode - previous, row.position ?? 0);
      previous = row.refcode;
    }
    current += `${JSON.stringify({ k: item.identity, n: item.n, r: encoded })}\n`;
    currentCount += item.n;
    if (item.n > budget) flush();
  }
  flush();
  console.log(JSON.stringify({ method: "adaptador MACULA existente em lotes de 2000; deduplicação por id em SQLite temporário", sources: output, counts, top,
    partitionMeasurement: { budget, partitions, oversized, totalRaw, totalGzip, largestGzip, concatenatedSha256: artifactHash.digest("hex") },
    limitations: ["contagens por chave exata; não agrupam automaticamente formas flexionadas de um lema", "medição das postagens locais, sem manifesto ou medições de tráfego real; não comprova completude da fonte"] }, null, 2));
} finally {
  db.close();
  try { unlinkSync(file); } catch { /* arquivo ausente */ }
  rmdirSync(temp);
}
