import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../drizzle/schema";
import { createDrizzleLexiconRepository } from "../../src/server/lexicon/repository";
import { createLexiconReader } from "../../src/server/lexicon/reader";

/**
 * Ponta a ponta do shard `hbo/GEN/1`, pelo caminho real: Postgres →
 * `createDrizzleLexiconRepository` → `createLexiconReader`. Nada de dublê.
 *
 * **Só roda com `C30_SHARD_E2E_DATABASE_URL` apontando para um banco local
 * descartável já carregado** com o recorte de Gênesis 1 e o shard. Sem a
 * variável, o arquivo é pulado: amarrar a suíte comum a um container faria o
 * portão de testes depender do Docker estar de pé, e um teste que não roda em
 * silêncio é pior do que um teste ausente.
 *
 * Preparação em `tasks/product/LEXICON-SHARD-GEN1-atualizacao.md`, seção 5.
 */
const connectionString = process.env.C30_SHARD_E2E_DATABASE_URL?.trim();

const suite = connectionString ? describe : describe.skip;

suite("ponta a ponta: Gênesis 1 com o shard de onze campos", () => {
  let pool: Pool;
  let read: (verses: readonly number[], preview?: boolean, chapter?: number) => Promise<unknown>;
  let originalPayload: unknown;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    const database = drizzle(pool, { schema });
    read = async (verses, preview = true, chapter = 1) =>
      await createLexiconReader(createDrizzleLexiconRepository(database), {
        previewDrafts: preview,
      }).read({ book: "genesis", chapter, verses });
    const snapshot = await pool.query(
      `SELECT payload FROM lexicon_chapter_shards WHERE language='hbo' AND book_code='GEN' AND chapter=1`,
    );
    originalPayload = snapshot.rows[0]?.payload ?? null;
    if (!originalPayload) throw new Error("banco de teste sem o shard hbo/GEN/1; veja a seção 5 do relatório");
  });

  afterAll(async () => {
    // Restaura o shard, porque um dos testes o rebaixa para dez campos.
    if (originalPayload) {
      await pool.query(
        `UPDATE lexicon_chapter_shards SET payload = $1::jsonb WHERE language='hbo' AND book_code='GEN' AND chapter=1`,
        [JSON.stringify(originalPayload)],
      );
    }
    await pool.end();
  });

  type Result = {
    ok: boolean;
    reason?: string;
    verses?: readonly {
      canonicalRef: string;
      words: readonly {
        position: number;
        meaning: string | null;
        meaningSource: string | null;
        reviewState: string | null;
        draftMethod: string | null;
        sources: readonly { sourceId: string; fields: readonly string[] }[];
        morphemes: readonly {
          surface: string;
          lemma: string;
          morphology: string | null;
          bdb: readonly { bdbId: string; lemma: string; senseCount: number; maxDepth: number; definitions: readonly string[] }[];
        }[];
      }[];
    }[];
  };

  async function readVerse(verse: number, preview = true): Promise<Result["verses"] extends undefined ? never : NonNullable<Result["verses"]>[number]> {
    const result = (await read([verse], preview)) as Result;
    expect(result.ok).toBe(true);
    const found = result.verses?.[0];
    if (!found) throw new Error(`verso ${verse} ausente na resposta`);
    return found;
  }

  it("Gênesis 1:1 entrega a nota editorial revisada e as acepções do BDB", async () => {
    const verse = await readVerse(1);
    expect(verse.canonicalRef).toBe("GEN 1:1");
    expect(verse.words).toHaveLength(7);

    // A nota revisada vence a tradução de máquina, por projeto.
    expect(verse.words.map((word) => word.reviewState)).toEqual(Array(7).fill("editorial_reviewed"));
    expect(verse.words[0]?.meaning).toBe("no princípio");
    expect(verse.words[0]?.draftMethod).toBeNull();

    const acepcoes = verse.words.map((word) =>
      word.morphemes.flatMap((morpheme) => morpheme.bdb).reduce((total, entry) => total + entry.senseCount, 0),
    );
    expect(acepcoes).toEqual([4, 8, 12, 0, 7, 0, 22]);

    // Toda palavra alcança pelo menos um verbete, e o crédito do BDB aparece.
    for (const word of verse.words) {
      expect(word.morphemes.flatMap((morpheme) => morpheme.bdb).length).toBeGreaterThan(0);
      expect(word.sources.map((source) => source.sourceId)).toContain("oshb-bdb");
    }
  });

  it("preserva homógrafos em vez de escolher um verbete", async () => {
    const verse = await readVerse(1);
    const criou = verse.words[1];
    const entries = criou?.morphemes.flatMap((morpheme) => morpheme.bdb) ?? [];
    // בָּרָא alcança dois verbetes do BDB: "criar" e o homógrafo "ser gordo".
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((entry) => entry.bdbId)).size).toBe(2);
  });

  it("Gênesis 1:2 rotula o rascunho e traz a árvore profunda de הָיָה", async () => {
    const verse = await readVerse(2);
    expect(verse.words[0]?.reviewState).toBe("unreviewed_draft");
    expect(verse.words[0]?.draftMethod).not.toBeNull();

    const haya = verse.words[1]?.morphemes.flatMap((morpheme) => morpheme.bdb) ?? [];
    expect(haya).toHaveLength(1);
    expect(haya[0]?.senseCount).toBe(32);
    expect(haya[0]?.maxDepth).toBe(5);
  });

  it("não entrega rascunho quando a pré-visualização está desligada", async () => {
    const result = (await read([2], false)) as Result;
    expect(result.ok).toBe(true);
    const verse = result.verses?.[0];
    expect(verse?.words[0]?.reviewState).toBe("source_text");
    expect(verse?.words[0]?.draftMethod).toBeNull();
    // O texto do rascunho não pode estar em lugar nenhum da resposta.
    expect(JSON.stringify(result)).not.toMatch(/princípio/u);
  });

  it("todo verbete sem acepção ainda traz definição: crédito do BDB não é vazio", async () => {
    const verse = await readVerse(1);
    const semAcepcao = verse.words
      .flatMap((word) => word.morphemes)
      .flatMap((morpheme) => morpheme.bdb)
      .filter((entry) => entry.senseCount === 0);
    expect(semAcepcao.length).toBeGreaterThan(0);
    // Creditar o BDB por um verbete que não mostra nada seria atribuição vazia.
    for (const entry of semAcepcao) expect(entry.definitions.length).toBeGreaterThan(0);
  });

  it("capítulo sem shard responde not_found, sem erro e sem glossa inventada", async () => {
    const result = (await read([1], true, 2)) as Result;
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_found");
    expect(result.verses ?? []).toEqual([]);
  });

  it("com o shard antigo de dez campos, o texto original fica de pé e só o BDB falta", async () => {
    const payload = originalPayload as { v: Record<string, unknown[][]> };
    const legacy = {
      v: Object.fromEntries(
        Object.entries(payload.v).map(([verse, rows]) => [verse, rows.map((row) => row.slice(0, 10))]),
      ),
    };
    await pool.query(
      `UPDATE lexicon_chapter_shards SET payload = $1::jsonb WHERE language='hbo' AND book_code='GEN' AND chapter=1`,
      [JSON.stringify(legacy)],
    );

    const verse = await readVerse(2);
    // Forma, lema e morfologia continuam vindo dos campos 0–9.
    expect(verse.words[1]?.morphemes[0]?.morphology).toBe("Vqp3fs");
    expect(verse.words[1]?.morphemes[0]?.lemma).toBe("הָיָה");
    // A tradução também: a junção dela é pelo texto da glossa, não pela chave.
    expect(verse.words[1]?.reviewState).toBe("unreviewed_draft");
    expect(verse.words[1]?.meaning).toBe("era");
    // Só a árvore do BDB falta — e o crédito omite a fonte que não entrou.
    expect(verse.words.flatMap((word) => word.morphemes).flatMap((morpheme) => morpheme.bdb)).toEqual([]);
    for (const word of verse.words) {
      expect(word.sources.map((source) => source.sourceId)).not.toContain("oshb-bdb");
    }
  });
});
