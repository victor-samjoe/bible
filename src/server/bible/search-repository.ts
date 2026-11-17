import { and, asc, count, eq, ilike, type SQL } from "drizzle-orm";
import { books, chapters, translations, verses } from "@/drizzle/schema";
import type { BibleSearchRepository } from "../contracts/bible-search";
import type { Database } from "../db/client";

/**
 * Busca lexical em Postgres, somente leitura.
 *
 * `ILIKE` com padrão ligado por parâmetro: determinístico, sem dependência de
 * extensão, e o contrato já escapou os curingas. Com 31102 versículos isso é
 * varredura sequencial — aceitável nesse tamanho. Se virar gargalo, o próximo
 * passo é um índice trigram (`pg_trgm`) ou `tsvector`, em migration própria.
 *
 * As cláusulas repetem as garantias do contrato: tradução aprovada pelo id
 * recebido e somente versículo `published`.
 */
export function createDrizzleBibleSearchRepository(database: Database): BibleSearchRepository {
  const hitColumns = {
    bookSlug: books.slug,
    bookName: books.name,
    bookOrder: books.orderNo,
    chapter: chapters.number,
    verse: verses.number,
    content: verses.content,
    published: verses.published,
  };

  const joined = () =>
    database
      .select(hitColumns)
      .from(verses)
      .innerJoin(chapters, eq(chapters.id, verses.chapterId))
      .innerJoin(books, eq(books.id, chapters.bookId));

  const filters = (
    translationId: string,
    patterns: readonly string[],
    bookSlug?: string,
  ): SQL[] => {
    const where: SQL[] = [];
    const base = and(eq(books.translationId, translationId), eq(verses.published, true));
    if (base) where.push(base);
    for (const pattern of patterns) {
      const term = ilike(verses.content, pattern);
      if (term) where.push(term);
    }
    if (bookSlug) {
      const slug = eq(books.slug, bookSlug);
      if (slug) where.push(slug);
    }
    return where;
  };

  return {
    async findTranslation(translationId: string) {
      const rows = await database
        .select({
          id: translations.id,
          name: translations.name,
          status: translations.status,
          attribution: translations.attribution,
        })
        .from(translations)
        .where(and(eq(translations.id, translationId), eq(translations.status, "approved")))
        .limit(1);
      return rows.at(0) ?? null;
    },

    async listBooks(translationId: string) {
      return await database
        .select({
          id: books.id,
          translationId: books.translationId,
          code: books.code,
          slug: books.slug,
          name: books.name,
          orderNo: books.orderNo,
        })
        .from(books)
        .where(eq(books.translationId, translationId))
        .orderBy(asc(books.orderNo));
    },

    async searchVerses({ translationId, patterns, bookSlug, limit, offset }) {
      return await joined()
        .where(and(...filters(translationId, patterns, bookSlug)))
        .orderBy(asc(books.orderNo), asc(chapters.number), asc(verses.number))
        .limit(limit)
        .offset(offset);
    },

    async countVerses({ translationId, patterns, bookSlug }) {
      const rows = await database
        .select({ total: count() })
        .from(verses)
        .innerJoin(chapters, eq(chapters.id, verses.chapterId))
        .innerJoin(books, eq(books.id, chapters.bookId))
        .where(and(...filters(translationId, patterns, bookSlug)));
      const total = rows.at(0)?.total;
      return typeof total === "number" ? total : Number(total ?? 0);
    },

    async findVerseByReference({ translationId, bookSlug, chapter, verse, limit }) {
      const where: SQL[] = filters(translationId, [], bookSlug);
      const atChapter = eq(chapters.number, chapter);
      if (atChapter) where.push(atChapter);
      if (verse !== null) {
        const atVerse = eq(verses.number, verse);
        if (atVerse) where.push(atVerse);
      }
      return await joined()
        .where(and(...where))
        .orderBy(asc(verses.number))
        .limit(limit);
    },
  };
}
