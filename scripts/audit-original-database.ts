import { Pool } from "pg";

/** Auditoria somente-leitura do corpus original já importado. Não imprime texto nem conexão. */
async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL ausente");
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const editions = await pool.query<{
      code: string; status: string; verses: string; tokens: string; morphemes: string;
    }>(`SELECT e.code, e.status::text,
      count(DISTINCT v.id)::text AS verses,
      count(DISTINCT t.id)::text AS tokens,
      count(DISTINCT m.id)::text AS morphemes
      FROM original_editions e
      LEFT JOIN original_verses v ON v.edition_id=e.id
      LEFT JOIN original_tokens t ON t.verse_id=v.id
      LEFT JOIN original_morphemes m ON m.token_id=t.id AND m.morphology_edition_id=e.id
      WHERE e.code IN ('SBLGNT','MORPHHB')
      GROUP BY e.id,e.code,e.status ORDER BY e.code`);
    const samples = await pool.query<{ code: string; canonical_ref: string; characters: number; tokens: string }>(
      `SELECT e.code,v.canonical_ref,char_length(v.text)::int AS characters,count(t.id)::text AS tokens
       FROM original_editions e JOIN original_verses v ON v.edition_id=e.id
       LEFT JOIN original_tokens t ON t.verse_id=v.id
       WHERE e.status='approved' AND ((e.code='MORPHHB' AND v.canon_book='Gen' AND v.chapter=1 AND v.verse=1)
         OR (e.code='SBLGNT' AND v.canon_book='Jn' AND v.chapter=3 AND v.verse=16))
       GROUP BY e.code,v.id,v.canonical_ref,v.text ORDER BY e.code`,
    );
    console.log(JSON.stringify({ editions: editions.rows, samples: samples.rows }, null, 2));
  } finally { await pool.end(); }
}

main().catch((error: unknown) => {
  console.error("FALHA:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
