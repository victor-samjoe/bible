import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { books, chapterReadingProgress, chapters } from "@/drizzle/schema";
import { BLIVRE_TRANSLATION_ID } from "../bible/blivre";
import type { Database } from "../db/client";
import type { ReadingProgressRepository } from "./progress";

/**
 * Leitura e escrita das marcas de capítulo lido, em Postgres.
 *
 * **Isolamento entre pessoas.** Igual a `./personal.ts`, e pelo mesmo motivo: o
 * app conecta como `postgres`, que tem `rolbypassrls`, então as políticas de
 * `drizzle/0003_reading_personal_data.sql` são ignoradas nestas consultas.
 * Nenhuma consulta deste arquivo existe sem `eq(chapterReadingProgress.userId,
 * userId)`, e o `userId` vem sempre da sessão resolvida em
 * `./progress-runtime.ts` — nunca de formulário, query ou cabeçalho.
 *
 * **Só `chapter_reading_progress`.** Destaques e notas não são alcançáveis por
 * aqui; ver o cabeçalho de `./progress.ts` para o porquê.
 *
 * **`last_verse_id`.** A tabela guarda, além de `completed_at`, o ponteiro do
 * último versículo. Hoje nada o escreve, mas desmarcar um capítulo não pode
 * descartá-lo: quando a linha tem ponteiro, apenas `completed_at` volta a
 * `null`; quando não tem, a linha é removida para a tabela não crescer com
 * registros vazios.
 */

/** Teto de escopos devolvidos. Acompanha `MAX_MARKS` de `./personal.ts`. */
const MAX_SCOPES = 4000;

export function createDrizzleReadingProgressRepository(database: Database): ReadingProgressRepository {
  async function findChapterId(bookSlug: string, chapterNumber: number): Promise<string | null> {
    const rows = await database
      .select({ id: chapters.id })
      .from(chapters)
      .innerJoin(books, eq(books.id, chapters.bookId))
      .where(
        and(
          eq(books.translationId, BLIVRE_TRANSLATION_ID),
          eq(books.slug, bookSlug),
          eq(chapters.number, chapterNumber),
        ),
      )
      .limit(1);
    return rows.at(0)?.id ?? null;
  }

  return {
    async listReadScopes(userId) {
      const rows = await database
        .select({ slug: books.slug, chapter: chapters.number })
        .from(chapterReadingProgress)
        .innerJoin(chapters, eq(chapters.id, chapterReadingProgress.chapterId))
        .innerJoin(books, eq(books.id, chapters.bookId))
        .where(
          and(
            eq(chapterReadingProgress.userId, userId),
            eq(books.translationId, BLIVRE_TRANSLATION_ID),
            isNotNull(chapterReadingProgress.completedAt),
          ),
        )
        .limit(MAX_SCOPES);
      return rows.map((row) => `${row.slug}.${row.chapter}`);
    },

    async setChapterRead(userId, bookSlug, chapterNumber, read) {
      const chapterId = await findChapterId(bookSlug, chapterNumber);
      if (chapterId === null) return false;
      const now = new Date();
      if (read) {
        await database
          .insert(chapterReadingProgress)
          .values({ userId, chapterId, completedAt: now, updatedAt: now })
          .onConflictDoUpdate({
            target: [chapterReadingProgress.userId, chapterReadingProgress.chapterId],
            set: { completedAt: now, updatedAt: now },
          });
        return true;
      }
      // Desmarcar preserva o ponteiro de leitura quando ele existe.
      await database
        .update(chapterReadingProgress)
        .set({ completedAt: null, updatedAt: now })
        .where(
          and(
            eq(chapterReadingProgress.userId, userId),
            eq(chapterReadingProgress.chapterId, chapterId),
            isNotNull(chapterReadingProgress.lastVerseId),
          ),
        );
      await database
        .delete(chapterReadingProgress)
        .where(
          and(
            eq(chapterReadingProgress.userId, userId),
            eq(chapterReadingProgress.chapterId, chapterId),
            isNull(chapterReadingProgress.lastVerseId),
          ),
        );
      return true;
    },

    async clearReadScopes(userId) {
      const marked = await database
        .select({ chapterId: chapterReadingProgress.chapterId, lastVerseId: chapterReadingProgress.lastVerseId })
        .from(chapterReadingProgress)
        .where(
          and(eq(chapterReadingProgress.userId, userId), isNotNull(chapterReadingProgress.completedAt)),
        )
        .limit(MAX_SCOPES);
      if (marked.length === 0) return 0;

      const withPointer = marked.flatMap((row) => (row.lastVerseId === null ? [] : [row.chapterId]));
      const withoutPointer = marked.flatMap((row) => (row.lastVerseId === null ? [row.chapterId] : []));
      const now = new Date();
      await database.transaction(async (tx) => {
        if (withPointer.length > 0) {
          await tx
            .update(chapterReadingProgress)
            .set({ completedAt: null, updatedAt: now })
            .where(
              and(
                eq(chapterReadingProgress.userId, userId),
                inArray(chapterReadingProgress.chapterId, withPointer),
              ),
            );
        }
        if (withoutPointer.length > 0) {
          await tx
            .delete(chapterReadingProgress)
            .where(
              and(
                eq(chapterReadingProgress.userId, userId),
                inArray(chapterReadingProgress.chapterId, withoutPointer),
                isNotNull(chapterReadingProgress.completedAt),
              ),
            );
        }
      });
      return marked.length;
    },
  };
}
