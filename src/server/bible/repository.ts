import { and, asc, count, eq, or } from "drizzle-orm";
import { books, chapters, translations, verses } from "@/drizzle/schema";
import type { BibleRepository } from "../contracts/bible";
import type { Database } from "../db/client";

/**
 * Implementação Drizzle do repositório de leitura. Só consultas: nenhuma escrita,
 * nenhuma migration, nenhum DDL. As cláusulas repetem as garantias do contrato
 * (tradução aprovada, versículo publicado, ordem canônica) para que o banco faça o
 * trabalho; o contrato valida de novo do lado de fora, por defesa em profundidade.
 *
 * O tipo `Database` é importado apenas como tipo, então este módulo não arrasta
 * `@opennextjs/cloudflare` nem `pg` para quem só precisa do contrato.
 */
export function createDrizzleBibleRepository(database: Database): BibleRepository {
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

    async findBook(translationId: string, reference: string) {
      const rows = await database
        .select({
          id: books.id,
          translationId: books.translationId,
          code: books.code,
          slug: books.slug,
          name: books.name,
          orderNo: books.orderNo,
        })
        .from(books)
        .where(
          and(
            eq(books.translationId, translationId),
            or(eq(books.slug, reference), eq(books.code, reference)),
          ),
        )
        .orderBy(asc(books.orderNo))
        .limit(1);
      return rows.at(0) ?? null;
    },

    async listChapters(bookId: string) {
      return await database
        .select({ id: chapters.id, bookId: chapters.bookId, number: chapters.number })
        .from(chapters)
        .where(eq(chapters.bookId, bookId))
        .orderBy(asc(chapters.number));
    },

    async findChapter(bookId: string, chapterNumber: number) {
      const rows = await database
        .select({ id: chapters.id, bookId: chapters.bookId, number: chapters.number })
        .from(chapters)
        .where(and(eq(chapters.bookId, bookId), eq(chapters.number, chapterNumber)))
        .limit(1);
      return rows.at(0) ?? null;
    },

    async listChapterCounts(translationId: string) {
      return await database
        .select({ bookId: chapters.bookId, count: count(chapters.id) })
        .from(chapters)
        .innerJoin(books, eq(chapters.bookId, books.id))
        .where(eq(books.translationId, translationId))
        .groupBy(chapters.bookId);
    },

    async listVerses(chapterId: string) {
      return await database
        .select({
          id: verses.id,
          chapterId: verses.chapterId,
          number: verses.number,
          content: verses.content,
          published: verses.published,
        })
        .from(verses)
        .where(and(eq(verses.chapterId, chapterId), eq(verses.published, true)))
        .orderBy(asc(verses.number));
    },
  };
}
