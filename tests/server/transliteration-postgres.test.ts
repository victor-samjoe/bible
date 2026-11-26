import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../drizzle/schema";
import { createDrizzleOriginalRepository } from "../../src/server/originals/repository";
import { createOriginalReader } from "../../src/server/originals/reader";
import { transliterateHebrewSurface } from "../../src/domain/transliteration/hebrew";
import { transliterateGreekSurface } from "../../src/domain/transliteration/greek";

// Nunca aceitar banco remoto ou banco do projeto: somente o recipiente local
// dedicado a este teste, com tabelas temporárias exclusivas da conexão.
const candidate = process.env.TRANSLITERATION_TEST_DATABASE_URL?.trim();
function localTestUrl(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new URL(value);
  if (parsed.hostname !== "127.0.0.1" || parsed.port !== "55439" || parsed.pathname !== "/translit_audit") {
    throw new Error("Teste aceita somente o banco descartável local translit_audit na porta 55439");
  }
  return value;
}
const connectionString = localTestUrl(candidate);
const suite = connectionString ? describe : describe.skip;

suite("integração Postgres local → leitor original → transliteração textual", () => {
  let pool: Pool;
  let reader: ReturnType<typeof createOriginalReader>;
  beforeAll(async () => {
    pool = new Pool({ connectionString: connectionString!, max: 1 });
    await pool.query(`
      CREATE TEMP TABLE original_editions (id uuid, code text, language text, version text, source_url text,
        license_declared text, attribution text, status text, approved_by uuid, approved_at timestamptz);
      CREATE TEMP TABLE original_verses (id uuid, edition_id uuid, canon_book text, chapter integer,
        verse integer, canonical_ref text, text text);
      CREATE TEMP TABLE original_tokens (id uuid, verse_id uuid, position integer, surface text, normalized text);
      CREATE TEMP TABLE lemmas (id uuid, lemma text);
      CREATE TEMP TABLE original_morphemes (token_id uuid, morphology_edition_id uuid, position integer,
        surface text, lemma_id uuid, morphology_code text);
      INSERT INTO original_editions VALUES
        ('11111111-1111-4111-8111-111111111111','MORPHHB','hbo',
         'tag v.2.2 / commit 6a5db284c715c18b239422e57bb89684e6a19f00',
         'https://example.test','CC BY 4.0','Fonte de teste','approved',
         '44444444-4444-4444-8444-444444444444',now()),
        ('22222222-2222-4222-8222-222222222222','SBLGNT','grc','teste',
         'https://example.test','CC BY 4.0','Fonte de teste','approved',
         '44444444-4444-4444-8444-444444444444',now());
      INSERT INTO original_verses VALUES
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Gen',1,1,'Gen 1:1','בְּרֵאשִׁ֖ית'),
        ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Jn',1,1,'Jn 1:1','λόγος λόγον');
      INSERT INTO original_tokens VALUES
        ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'בְּ/רֵאשִׁ֖ית','בְּרֵאשִׁ֖ית'),
        ('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'λόγος','λόγος'),
        ('bbbbbbbb-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,'λόγον','λόγον');
      INSERT INTO lemmas VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','רֵאשִׁית');
      INSERT INTO original_morphemes VALUES
        ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111',1,'בְּ',NULL,'R'),
        ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111',2,'רֵאשִׁ֖ית','cccccccc-cccc-4ccc-8ccc-cccccccccccc','Ncfsa');
    `);
    reader = createOriginalReader(createDrizzleOriginalRepository(drizzle(pool, { schema })));
  }, 30_000);
  afterAll(async () => { await pool?.end(); });

  it("mantém prefixo e morfemas ao ler Gênesis 1:1", async () => {
    const result = await reader.read({ book: "genesis", chapter: 1, verses: [1] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const token = result.verses[0]!.tokens[0]!;
    expect(token.morphemes).toHaveLength(2);
    expect(token.morphemes[1]?.lemma).toBe("רֵאשִׁית");
    expect(transliterateHebrewSurface(token.normalized)?.simplified).toBe("bereshit");
    expect(transliterateHebrewSurface(token.normalized)?.academic).toBe("bərēʾšît");
  });

  it("não troca duas flexões gregas pelo mesmo lema", async () => {
    const result = await reader.read({ book: "joao", chapter: 1, verses: [1] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verses[0]!.tokens.map((token) => transliterateGreekSurface(token.normalized)?.simplified))
      .toEqual(["logos", "logon"]);
  });
});
