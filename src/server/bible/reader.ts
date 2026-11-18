import {
  bibleFailure,
  bookReferenceSchema,
  chapterNumberSchema,
  projectBook,
  projectBooks,
  projectChapterCounts,
  projectChapter,
  projectChapters,
  projectTranslation,
  projectVerses,
  type BibleRepository,
  type BookListing,
  type ChapterListing,
  type ChapterCountsListing,
  type ChapterReading,
} from "../contracts/bible";

/**
 * Serviço de leitura. Recebe o repositório por injeção e falha fechado:
 * - sem repositório (banco não configurado) → `unavailable`;
 * - exceção do repositório → `unavailable`, sem repassar a mensagem original,
 *   que poderia conter host, usuário ou connection string;
 * - tradução não aprovada → `translation_unavailable`;
 * - capítulo sem versículo publicado → `not_published`.
 *
 * Nenhuma função aqui conhece HTTP, React ou Cloudflare: a tarefa C4 consome isto.
 */

export type BibleReader = {
  readonly available: boolean;
  listBooks(): Promise<BookListing>;
  listChapters(bookReference: string): Promise<ChapterListing>;
  listChapterCounts(): Promise<ChapterCountsListing>;
  readChapter(bookReference: string, chapterNumber: number | string): Promise<ChapterReading>;
};

export function createBibleReader(
  translationId: string,
  repository: BibleRepository | null | undefined,
): BibleReader {
  const available = Boolean(repository);

  async function translation() {
    if (!repository) return null;
    return projectTranslation(await repository.findTranslation(translationId));
  }

  return {
    available,

    async listBooks(): Promise<BookListing> {
      if (!repository) return bibleFailure("unavailable");
      try {
        const approved = await translation();
        if (!approved) return bibleFailure("translation_unavailable");
        const books = projectBooks(await repository.listBooks(approved.id), approved.id);
        if (books.length === 0) return bibleFailure("not_found");
        return { ok: true, translation: approved, books };
      } catch {
        return bibleFailure("unavailable");
      }
    },

    async listChapters(bookReference: string): Promise<ChapterListing> {
      if (!repository) return bibleFailure("unavailable");
      const reference = bookReferenceSchema.safeParse(bookReference);
      if (!reference.success) return bibleFailure("invalid_reference");
      try {
        const approved = await translation();
        if (!approved) return bibleFailure("translation_unavailable");
        const book = projectBook(
          await repository.findBook(approved.id, reference.data),
          approved.id,
        );
        if (!book) return bibleFailure("not_found");
        const chapters = projectChapters(await repository.listChapters(book.id), book.id);
        if (chapters.length === 0) return bibleFailure("not_found");
        return { ok: true, translation: approved, book, chapters };
      } catch {
        return bibleFailure("unavailable");
      }
    },

    async listChapterCounts(): Promise<ChapterCountsListing> {
      if (!repository) return bibleFailure("unavailable");
      try {
        const approved = await translation();
        if (!approved) return bibleFailure("translation_unavailable");
        const counts = projectChapterCounts(await repository.listChapterCounts(approved.id));
        if (counts.length === 0) return bibleFailure("not_found");
        return { ok: true, counts };
      } catch {
        return bibleFailure("unavailable");
      }
    },

    async readChapter(
      bookReference: string,
      chapterNumber: number | string,
    ): Promise<ChapterReading> {
      if (!repository) return bibleFailure("unavailable");
      const reference = bookReferenceSchema.safeParse(bookReference);
      const number = chapterNumberSchema.safeParse(chapterNumber);
      if (!reference.success || !number.success) return bibleFailure("invalid_reference");
      try {
        const approved = await translation();
        if (!approved) return bibleFailure("translation_unavailable");
        const book = projectBook(
          await repository.findBook(approved.id, reference.data),
          approved.id,
        );
        if (!book) return bibleFailure("not_found");
        const chapter = projectChapter(
          await repository.findChapter(book.id, number.data),
          book.id,
        );
        if (!chapter) return bibleFailure("not_found");
        const verses = projectVerses(await repository.listVerses(chapter.id), chapter.id);
        if (verses.length === 0) return bibleFailure("not_published");
        return { ok: true, translation: approved, book, chapter, verses };
      } catch {
        return bibleFailure("unavailable");
      }
    },
  };
}
