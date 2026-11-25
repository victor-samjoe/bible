import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import { parseMorphhbBook } from "../src/importers/original/morphhb.ts";
import { parseSblgntBook } from "../src/importers/original/sblgnt.ts";

/**
 * Importador idempotente dos corpora aprovados em 19/11/2026.
 *
 * Por padrão faz somente preflight local. `--apply` exige conexão, localiza o
 * revisor por e-mail em `auth.users`, grava cada livro em transação e só muda a
 * edição para `approved` depois das contagens finais. Edição parcial permanece
 * `under_review` e nunca é servida pelo leitor.
 *
 * Uso:
 *   node --env-file=.env.local --experimental-strip-types scripts/import-original-corpus.ts
 *   node --env-file=.env.local --experimental-strip-types scripts/import-original-corpus.ts --apply --reviewer-email=conta@exemplo.com
 */

const ROOT = join(import.meta.dirname, "..");
const ORIGINALS = join(ROOT, "data", "sources", "originals");
const apply = process.argv.includes("--apply");
const reviewerEmail = process.argv.find((item) => item.startsWith("--reviewer-email="))?.slice(17).trim();
const BATCH = 800;

type Manifest = {
  id: string;
  name: string;
  homepage: string;
  pinned_at: string;
  license_declared: string;
  attribution_required: string;
  status: string;
  assets: { path: string; sha256: string }[];
};

type EditionSpec = {
  code: "SBLGNT" | "MORPHHB";
  language: "grc" | "hbo";
  assetKind: "text" | "text_morphology";
  corpus: "greek-nt" | "hebrew-ot";
  manifest: Manifest;
  sourceHash: string;
};

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableUuid(...parts: readonly string[]): string {
  const hex = sha256(parts.join("\u001f")).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

async function readManifest(id: string): Promise<Manifest> {
  const path = join(ORIGINALS, id, "MANIFEST.json");
  if (!existsSync(path)) throw new Error(`manifesto ausente: ${id}`);
  const manifest = JSON.parse(await readFile(path, "utf8")) as Manifest;
  if (manifest.status !== "approved_for_import") throw new Error(`${id}: status não aprovado (${manifest.status})`);
  for (const asset of manifest.assets) {
    const bytes = await readFile(join(ORIGINALS, id, asset.path));
    if (sha256(bytes) !== asset.sha256) throw new Error(`${id}/${asset.path}: checksum divergente`);
  }
  return manifest;
}

function compositeHash(manifest: Manifest): string {
  return sha256([...manifest.assets].sort((a, b) => a.path.localeCompare(b.path)).map((item) => `${item.path}:${item.sha256}`).join("\n"));
}

async function preflight(): Promise<{ greek: EditionSpec; hebrew: EditionSpec }> {
  const greekManifest = await readManifest("sblgnt");
  const hebrewManifest = await readManifest("oshb-morphhb");
  return {
    greek: { code: "SBLGNT", language: "grc", assetKind: "text", corpus: "greek-nt", manifest: greekManifest, sourceHash: compositeHash(greekManifest) },
    hebrew: { code: "MORPHHB", language: "hbo", assetKind: "text_morphology", corpus: "hebrew-ot", manifest: hebrewManifest, sourceHash: compositeHash(hebrewManifest) },
  };
}

async function insertRows(client: PoolClient, table: string, columns: readonly string[], rows: readonly (readonly unknown[])[]): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += BATCH) {
    const batch = rows.slice(offset, offset + BATCH);
    const values: unknown[] = [];
    const placeholders = batch.map((row) => {
      const base = values.length;
      values.push(...row);
      return `(${row.map((_, index) => `$${base + index + 1}`).join(",")})`;
    });
    await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders.join(",")} ON CONFLICT DO NOTHING`, values);
  }
}

async function reviewerId(client: PoolClient, email: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    "SELECT p.id::text AS id FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE lower(u.email) = lower($1) LIMIT 1",
    [email],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("o e-mail revisor não possui perfil no projeto");
  return id;
}

async function prepareEdition(client: PoolClient, spec: EditionSpec): Promise<string> {
  const id = stableUuid("original-edition", spec.code, spec.manifest.pinned_at, spec.sourceHash);
  const existing = await client.query<{ source_sha256: string }>("SELECT source_sha256 FROM original_editions WHERE code=$1 AND version=$2", [spec.code, spec.manifest.pinned_at]);
  const storedHash = existing.rows[0]?.source_sha256;
  if (storedHash && storedHash !== spec.sourceHash) throw new Error(`${spec.code}: mesma versão já existe com outro checksum`);
  await client.query(
    `INSERT INTO original_editions
      (id,code,language,asset_kind,corpus,version,source_url,license_declared,attribution,source_sha256,status,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'under_review',now(),now())
     ON CONFLICT (code,version) DO UPDATE SET source_url=EXCLUDED.source_url,
       license_declared=EXCLUDED.license_declared, attribution=EXCLUDED.attribution,
       updated_at=now(), status=CASE WHEN original_editions.status='approved' THEN 'approved'::original_edition_status ELSE 'under_review'::original_edition_status END`,
    [id, spec.code, spec.language, spec.assetKind, spec.corpus, spec.manifest.pinned_at, spec.manifest.homepage, spec.manifest.license_declared, spec.manifest.attribution_required, spec.sourceHash],
  );
  const selected = await client.query<{ id: string }>("SELECT id::text AS id FROM original_editions WHERE code=$1 AND version=$2", [spec.code, spec.manifest.pinned_at]);
  if (!selected.rows[0]?.id) throw new Error(`${spec.code}: edição não registrada`);
  return selected.rows[0].id;
}

async function importGreek(pool: Pool, spec: EditionSpec): Promise<{ editionId: string; verses: number; tokens: number }> {
  const setup = await pool.connect();
  let editionId: string;
  try { editionId = await prepareEdition(setup, spec); } finally { setup.release(); }
  const directory = join(ORIGINALS, "sblgnt", "text");
  const files = (await readdir(directory)).filter((name) => name.endsWith(".txt")).sort();
  let verseCount = 0;
  let tokenCount = 0;
  for (const file of files) {
    const code = file.replace(/^\d+-/, "").replace(/\.txt$/, "");
    const parsed = parseSblgntBook(await readFile(join(directory, file), "utf8"), code);
    if (parsed.issues.length > 0 || parsed.book.verses.length === 0) throw new Error(`${file}: parser recusou ${parsed.issues.length} linha(s)`);
    const verses: (readonly unknown[])[] = [];
    const tokens: (readonly unknown[])[] = [];
    for (const verse of parsed.book.verses) {
      const verseId = stableUuid(editionId, verse.canonBook, String(verse.chapter), String(verse.verse));
      verses.push([verseId, editionId, verse.canonBook, verse.chapter, verse.verse, verse.canonicalRef, verse.text]);
      for (const token of verse.tokens) tokens.push([stableUuid(verseId, "token", String(token.position)), verseId, token.position, token.surface, token.normalized, null]);
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await insertRows(client, "original_verses", ["id","edition_id","canon_book","chapter","verse","canonical_ref","text"], verses);
      await insertRows(client, "original_tokens", ["id","verse_id","position","surface","normalized","source_token_id"], tokens);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    verseCount += verses.length;
    tokenCount += tokens.length;
    console.log(`  SBLGNT ${code}: ${verses.length} versículos`);
  }
  return { editionId, verses: verseCount, tokens: tokenCount };
}

async function importHebrew(pool: Pool, spec: EditionSpec): Promise<{ editionId: string; verses: number; tokens: number; morphemes: number }> {
  const setup = await pool.connect();
  let editionId: string;
  try { editionId = await prepareEdition(setup, spec); } finally { setup.release(); }
  const directory = join(ORIGINALS, "oshb-morphhb", "extracted", "morphhb-v.2.2", "wlc");
  const files = (await readdir(directory)).filter((name) => name.endsWith(".xml") && name !== "VerseMap.xml").sort();
  let verseCount = 0;
  let tokenCount = 0;
  let morphemeCount = 0;
  for (const file of files) {
    const code = file.replace(/\.xml$/, "");
    const parsed = parseMorphhbBook(await readFile(join(directory, file), "utf8"), code);
    if (parsed.issues.length > 0 || parsed.verses.length === 0) throw new Error(`${file}: parser encontrou ${parsed.issues.length} problema(s)`);
    const verses: (readonly unknown[])[] = [];
    const tokens: (readonly unknown[])[] = [];
    const lemmaMap = new Map<string, string>();
    const morphemes: (readonly unknown[])[] = [];
    for (const verse of parsed.verses) {
      const verseId = stableUuid(editionId, verse.canonBook, String(verse.chapter), String(verse.verse));
      verses.push([verseId, editionId, verse.canonBook, verse.chapter, verse.verse, verse.canonicalRef, verse.text]);
      for (const token of verse.tokens) {
        const tokenId = stableUuid(verseId, "token", String(token.position));
        tokens.push([tokenId, verseId, token.position, token.surface, token.normalized, token.sourceTokenId]);
        for (const morpheme of token.morphemes) {
          const lemma = morpheme.lemma.trim();
          const lemmaId = lemma.length > 0 ? stableUuid(editionId, "lemma", lemma) : null;
          if (lemmaId) lemmaMap.set(lemma, lemmaId);
          morphemes.push([stableUuid(tokenId, "morpheme", String(morpheme.position)), tokenId, editionId, morpheme.position, morpheme.surface, lemmaId, morpheme.morphologyCode, null]);
        }
      }
    }
    const lemmas = [...lemmaMap].map(([lemma, id]) => [id, "hbo", lemma, null, null, editionId] as const);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await insertRows(client, "original_verses", ["id","edition_id","canon_book","chapter","verse","canonical_ref","text"], verses);
      await insertRows(client, "original_tokens", ["id","verse_id","position","surface","normalized","source_token_id"], tokens);
      await insertRows(client, "lemmas", ["id","language","lemma","strong_id","transliteration","source_edition_id"], lemmas);
      await insertRows(client, "original_morphemes", ["id","token_id","morphology_edition_id","position","surface","lemma_id","morphology_code","source_morpheme_id"], morphemes);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    verseCount += verses.length;
    tokenCount += tokens.length;
    morphemeCount += morphemes.length;
    console.log(`  MorphHB ${code}: ${verses.length} versículos`);
  }
  return { editionId, verses: verseCount, tokens: tokenCount, morphemes: morphemeCount };
}

async function approve(client: PoolClient, editionId: string, reviewer: string, expected: { verses: number; tokens: number; morphemes?: number }): Promise<void> {
  const result = await client.query<{ verses: string; tokens: string; morphemes: string }>(
    `SELECT
      (SELECT count(*) FROM original_verses WHERE edition_id=$1)::text AS verses,
      (SELECT count(*) FROM original_tokens t JOIN original_verses v ON v.id=t.verse_id WHERE v.edition_id=$1)::text AS tokens,
      (SELECT count(*) FROM original_morphemes WHERE morphology_edition_id=$1)::text AS morphemes`, [editionId],
  );
  const actual = result.rows[0];
  if (!actual || Number(actual.verses) !== expected.verses || Number(actual.tokens) !== expected.tokens || Number(actual.morphemes) !== (expected.morphemes ?? 0)) {
    throw new Error(`contagem final divergente: esperado ${JSON.stringify(expected)}, banco ${JSON.stringify(actual)}`);
  }
  await client.query("UPDATE original_editions SET status='approved', approved_by=$2, approved_at=now(), imported_at=now(), updated_at=now() WHERE id=$1", [editionId, reviewer]);
}

async function main() {
  const specs = await preflight();
  console.log("Preflight: manifestos aprovados e checksums conferidos.");
  if (!apply) {
    console.log("Modo seguro: nenhuma escrita. Use --apply e --reviewer-email para importar.");
    return;
  }
  if (!reviewerEmail) throw new Error("--reviewer-email é obrigatório com --apply");
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL ausente");
  const pool = new Pool({ connectionString, max: 2 });
  try {
    const audit = await pool.connect();
    let reviewer: string;
    try {
      const tables = await audit.query<{ count: string }>("SELECT count(*)::text AS count FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('original_editions','original_verses','original_tokens','original_morphemes','lemmas')");
      if (Number(tables.rows[0]?.count) !== 5) throw new Error("migration 0005 não está completa no banco alvo");
      reviewer = await reviewerId(audit, reviewerEmail);
    } finally { audit.release(); }
    console.log("Importando SBLGNT…");
    const greek = await importGreek(pool, specs.greek);
    console.log("Importando MorphHB…");
    const hebrew = await importHebrew(pool, specs.hebrew);
    const final = await pool.connect();
    try {
      await final.query("BEGIN");
      await approve(final, greek.editionId, reviewer, { verses: greek.verses, tokens: greek.tokens });
      await approve(final, hebrew.editionId, reviewer, { verses: hebrew.verses, tokens: hebrew.tokens, morphemes: hebrew.morphemes });
      await final.query("COMMIT");
    } catch (error) { await final.query("ROLLBACK"); throw error; } finally { final.release(); }
    console.log(`APROVADO: SBLGNT ${greek.verses}/${greek.tokens}; MorphHB ${hebrew.verses}/${hebrew.tokens}/${hebrew.morphemes}.`);
  } finally { await pool.end(); }
}

main().catch((error: unknown) => {
  console.error("FALHA:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
