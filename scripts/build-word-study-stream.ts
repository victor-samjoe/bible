/** Gera índice local em lotes, sem rede e sem conexão ao Supabase. */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdirSync, mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { lexiconSourceById } from "../src/domain/lexicon/source-registry.ts";
import { readMaculaOccurrences } from "../src/domain/word-study/macula-source.ts";
import { identitySortKey } from "../src/domain/word-study/identity.ts";
import { refCode } from "../src/domain/word-study/reference.ts";
import { CANON } from "../src/domain/lexicon/canon.ts";
import { DEFAULT_IDENTITY_POLICY, WORD_STUDY_IDENTITY_VERSION } from "../src/domain/word-study/identity.ts";
import { type PartitionStat, type SourceAttribution, WORD_STUDY_INDEX_FORMAT, serializeManifest } from "../src/domain/word-study/inverted-index.ts";

const root = process.env.WORD_STUDY_CORPUS_DIR;
if (!root) throw new Error("Informe WORD_STUDY_CORPUS_DIR com as fontes locais");
const out = process.argv.find((arg) => arg.startsWith("--out="))?.slice(6);
if (!out) throw new Error("Informe --out=<diretório novo>; nunca sobrescreve um índice existente");
mkdirSync(out); // falha se o destino já existe; nunca substituir dados existentes
const temp = mkdtempSync(join(tmpdir(), "samjoe-word-audit-"));
const file = join(temp, "audit.sqlite");
const db = new DatabaseSync(file);
const output: unknown[] = [];
const attributions: SourceAttribution[] = [];
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
    let attribution: SourceAttribution | null = null;
    const totals = { accepted: 0, identifiedByLemma: 0, withoutWrittenForm: 0, withoutSourceWordId: 0, withoutIdentity: 0, badRef: 0, badStrong: 0, duplicates: 0 };
    function flush() {
      if (!header || batch.length === 0) return;
      const parsed = readMaculaOccurrences({ source, assetPath: plan.path.split(/[\\/]/u).pop() ?? "", assetSha256: "0".repeat(64), content: `${header}\n${batch.join("\n")}\n` });
      attribution = parsed.attribution;
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
    const digest = hash.digest("hex");
    const parsedAttribution = attribution as SourceAttribution | null;
    if (!parsedAttribution) throw new Error(`fonte vazia: ${plan.sourceId}`);
    const assetPath = plan.path.split(/[\\/]/u).pop() ?? "";
    const expected = source.assets.find((asset) => asset.localPath === assetPath)?.expectedSha256;
    if (!expected || expected !== digest) throw new Error(`hash ausente ou divergente para ${plan.sourceId}; índice não gerado`);
    attributions.push({ ...parsedAttribution, assetSha256: digest });
    output.push({ source: plan.sourceId, sha256: digest, ...totals });
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
  const stats: PartitionStat[] = [];
  let current = "", currentCount = 0, partitions = 0, totalRaw = 0, totalGzip = 0, largestGzip = 0, oversized = 0;
  let firstKey = "", lastKey = "", firstSortKey = "", lastSortKey = "", postingCount = 0;
  function flush() {
    if (!current) return;
    const compressed = gzipSync(current, { level: 9 }).byteLength;
    artifactHash.update(current);
    const filename = `postings-${String(partitions).padStart(4, "0")}.ndjson`;
    writeFileSync(join(out!, filename), current, { encoding: "utf8", flag: "wx" });
    stats.push({ ordinal: partitions, file: filename, firstKey, lastKey, firstSortKey, lastSortKey,
      postings: postingCount, occurrences: currentCount, oversized: currentCount > budget,
      bytes: Buffer.byteLength(current), gzipBytes: compressed, sha256: createHash("sha256").update(current).digest("hex") });
    partitions += 1; totalRaw += Buffer.byteLength(current); totalGzip += compressed;
    largestGzip = Math.max(largestGzip, compressed);
    if (currentCount > budget) oversized += 1;
    current = ""; currentCount = 0; postingCount = 0;
  }
  for (const item of identities) {
    if (currentCount + item.n > budget) flush();
    if (!currentCount) { firstKey = item.identity; firstSortKey = item.sortkey; }
    lastKey = item.identity; lastSortKey = item.sortkey; postingCount += 1;
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
  const present = new Set((db.prepare("SELECT DISTINCT book FROM occurrence").all() as { book: string }[]).map((r) => r.book));
  const refs = db.prepare("SELECT count(DISTINCT refcode) AS n FROM occurrence").get() as { n: number };
  const coverage = { languages: ["grc", "hbo"] as const, identities: identities.length,
    occurrences: counts.reduce((sum, row) => sum + Number(row.occurrences), 0),
    booksPresent: CANON.filter((b) => present.has(b.code)).map((b) => b.code),
    booksAbsent: CANON.filter((b) => !present.has(b.code)).map((b) => b.code), refsPresent: refs.n };
  const limitations = ["Cobertura não certificada: registros nos livros não comprovam todas as ocorrências.",
    "Chaves Strong exatas: formas flexionadas com outro Strong não são agrupadas automaticamente ao lema.",
    "Referências são da fonte; a correspondência com outras versificações pode precisar de revisão."];
  const version = createHash("sha256").update(JSON.stringify([WORD_STUDY_IDENTITY_VERSION, WORD_STUDY_INDEX_FORMAT, budget,
    attributions.map((item) => [item.sourceId, item.assetSha256]), stats.map((item) => [item.file, item.sha256])])).digest("hex").slice(0, 16);
  const manifest = serializeManifest({ format: WORD_STUDY_INDEX_FORMAT, indexVersion: version, identityVersion: WORD_STUDY_IDENTITY_VERSION,
    identityMode: DEFAULT_IDENTITY_POLICY.mode, foldMapSource: DEFAULT_IDENTITY_POLICY.foldMapSource, sources: attributions, coverage, limitations }, stats);
  writeFileSync(join(out, "manifest.json"), manifest, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ method: "adaptador MACULA existente em lotes de 2000; deduplicação por id em SQLite temporário", sources: output, counts, top,
    partitionMeasurement: { budget, partitions, oversized, totalRaw, totalGzip, largestGzip, concatenatedSha256: artifactHash.digest("hex") },
    limitations: ["contagens por chave exata; não agrupam automaticamente formas flexionadas de um lema", "medição das postagens locais, sem manifesto ou medições de tráfego real; não comprova completude da fonte"] }, null, 2));
} finally {
  db.close();
  try { unlinkSync(file); } catch { /* arquivo ausente */ }
  rmdirSync(temp);
}
