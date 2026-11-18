import { and, eq, inArray, sql } from "drizzle-orm";
import {
  books,
  chapterReadingProgress,
  chapters,
  readingPreferences,
  verseHighlights,
  verseNotes,
  verses,
} from "@/drizzle/schema";
import { BLIVRE_TRANSLATION_ID } from "../bible/blivre";
import type { Database } from "../db/client";

/**
 * Dados pessoais de leitura: preferências, destaques, notas e capítulos lidos.
 *
 * **O isolamento entre pessoas é garantido aqui, não pelo RLS.** As políticas de
 * `drizzle/0003_reading_personal_data.sql` comparam `auth.uid()` com `user_id`,
 * e isso só vale para quem fala com o banco carregando um JWT. O app não faz
 * isso: conecta como `postgres`, que tem `rolbypassrls`, então toda política é
 * ignorada nas consultas abaixo. Por isso **nenhuma consulta deste arquivo pode
 * existir sem `eq(..., userId)`**, e o `userId` vem sempre de `getViewer()`,
 * nunca de formulário, query ou cabeçalho. O RLS continua valendo como segunda
 * tranca para o dia em que algo falar com o banco pela chave anônima.
 *
 * O leitor identifica marca por chave de texto (`genesis.1.5`), e o banco por
 * UUID de versículo. A tradução entre os dois mundos acontece neste arquivo e
 * em nenhum outro.
 */

/** Teto de marcas devolvidas por pessoa. Acompanha `MAX_MARKS` do leitor. */
const MAX_MARKS = 4000;

/**
 * O banco guarda cor em inglês, como o resto do schema; o leitor usa o
 * vocabulário do produto. O mapa é a fronteira entre os dois. `purple` existe
 * no enum e não é oferecido pelo leitor: não tem para onde traduzir.
 */
const COLOR_TO_DATABASE = {
  amarelo: "yellow",
  verde: "green",
  azul: "blue",
  rosa: "pink",
} as const;

const COLOR_FROM_DATABASE: Record<string, ReaderHighlightColor> = {
  yellow: "amarelo",
  green: "verde",
  blue: "azul",
  pink: "rosa",
};

export type ReaderHighlightColor = keyof typeof COLOR_TO_DATABASE;

export function isReaderHighlightColor(value: unknown): value is ReaderHighlightColor {
  return typeof value === "string" && value in COLOR_TO_DATABASE;
}

export interface ReaderPreferencesRecord {
  readonly theme: string;
  readonly fontFamily: string;
  readonly fontSize: string;
  readonly lineSpacing: string;
  readonly paragraphSpacing: string;
}

/** Marcas de um capítulo, como o leitor as entende: por número de versículo. */
export interface ChapterMarksInput {
  /** número do versículo -> cor do leitor */
  readonly highlights: ReadonlyArray<{ readonly verse: number; readonly color: ReaderHighlightColor }>;
  /** seleção compactada (`"3-5,9"`) -> texto da nota */
  readonly notes: ReadonlyArray<{ readonly verseList: string; readonly anchor: number; readonly body: string }>;
  readonly read: boolean;
}

/** Tudo que a pessoa marcou, com as chaves que o leitor usa. */
export interface PersonalMarks {
  /** `livro.capítulo.versículo` -> cor */
  readonly highlights: Record<string, ReaderHighlightColor>;
  /** `livro.capítulo.lista` -> texto */
  readonly notes: Record<string, string>;
  /** escopos `livro.capítulo` concluídos */
  readonly readChapters: string[];
}

export interface PersonalReadingRepository {
  findPreferences(userId: string): Promise<ReaderPreferencesRecord | null>;
  savePreferences(userId: string, preferences: ReaderPreferencesRecord): Promise<void>;
  loadMarks(userId: string): Promise<PersonalMarks>;
  /**
   * Substitui as marcas da pessoa **naquele capítulo** pelo conteúdo recebido.
   * Capítulo é a unidade porque é o que o leitor tem na tela: ele sempre manda
   * o estado completo do capítulo aberto, e nunca um delta.
   */
  replaceChapterMarks(
    userId: string,
    bookSlug: string,
    chapterNumber: number,
    marks: ChapterMarksInput,
  ): Promise<boolean>;
}

export function createDrizzlePersonalReadingRepository(database: Database): PersonalReadingRepository {
  /** Versículos do capítulo: número -> id, e o id do próprio capítulo. */
  async function resolveChapter(
    bookSlug: string,
    chapterNumber: number,
  ): Promise<{ chapterId: string; verseIds: Map<number, string> } | null> {
    const rows = await database
      .select({ chapterId: chapters.id, verseId: verses.id, number: verses.number })
      .from(verses)
      .innerJoin(chapters, eq(chapters.id, verses.chapterId))
      .innerJoin(books, eq(books.id, chapters.bookId))
      .where(
        and(
          eq(books.translationId, BLIVRE_TRANSLATION_ID),
          eq(books.slug, bookSlug),
          eq(chapters.number, chapterNumber),
        ),
      );
    const first = rows.at(0);
    if (first === undefined) return null;
    const verseIds = new Map<number, string>();
    for (const row of rows) verseIds.set(row.number, row.verseId);
    return { chapterId: first.chapterId, verseIds };
  }

  return {
    async findPreferences(userId) {
      const rows = await database
        .select({
          theme: readingPreferences.theme,
          fontFamily: readingPreferences.fontFamily,
          fontSize: readingPreferences.fontSize,
          lineSpacing: readingPreferences.lineSpacing,
          paragraphSpacing: readingPreferences.paragraphSpacing,
        })
        .from(readingPreferences)
        .where(eq(readingPreferences.userId, userId))
        .limit(1);
      return rows.at(0) ?? null;
    },

    async savePreferences(userId, preferences) {
      await database
        .insert(readingPreferences)
        .values({ userId, ...preferences, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: readingPreferences.userId,
          set: { ...preferences, updatedAt: new Date() },
        });
    },

    async loadMarks(userId) {
      const highlightRows = await database
        .select({ slug: books.slug, chapter: chapters.number, verse: verses.number, color: verseHighlights.color })
        .from(verseHighlights)
        .innerJoin(verses, eq(verses.id, verseHighlights.verseId))
        .innerJoin(chapters, eq(chapters.id, verses.chapterId))
        .innerJoin(books, eq(books.id, chapters.bookId))
        .where(eq(verseHighlights.userId, userId))
        .limit(MAX_MARKS);

      const noteRows = await database
        .select({ slug: books.slug, chapter: chapters.number, verseList: verseNotes.verseList, body: verseNotes.body })
        .from(verseNotes)
        .innerJoin(verses, eq(verses.id, verseNotes.verseId))
        .innerJoin(chapters, eq(chapters.id, verses.chapterId))
        .innerJoin(books, eq(books.id, chapters.bookId))
        .where(eq(verseNotes.userId, userId))
        .limit(MAX_MARKS);

      const readRows = await database
        .select({ slug: books.slug, chapter: chapters.number })
        .from(chapterReadingProgress)
        .innerJoin(chapters, eq(chapters.id, chapterReadingProgress.chapterId))
        .innerJoin(books, eq(books.id, chapters.bookId))
        .where(
          and(
            eq(chapterReadingProgress.userId, userId),
            sql`${chapterReadingProgress.completedAt} is not null`,
          ),
        )
        .limit(MAX_MARKS);

      const highlights: Record<string, ReaderHighlightColor> = {};
      for (const row of highlightRows) {
        const color = COLOR_FROM_DATABASE[row.color];
        // Cor sem equivalente no leitor (`purple`) é ignorada em vez de virar
        // uma cor errada na tela.
        if (color) highlights[`${row.slug}.${row.chapter}.${row.verse}`] = color;
      }

      const notes: Record<string, string> = {};
      for (const row of noteRows) notes[`${row.slug}.${row.chapter}.${row.verseList}`] = row.body;

      return {
        highlights,
        notes,
        readChapters: readRows.map((row) => `${row.slug}.${row.chapter}`),
      };
    },

    async replaceChapterMarks(userId, bookSlug, chapterNumber, marks) {
      const resolved = await resolveChapter(bookSlug, chapterNumber);
      if (resolved === null) return false;
      const { chapterId, verseIds } = resolved;
      const chapterVerseIds = [...verseIds.values()];
      if (chapterVerseIds.length === 0) return false;

      // Uma transação: o capítulo nunca fica meio apagado se a escrita falhar.
      await database.transaction(async (tx) => {
        await tx
          .delete(verseHighlights)
          .where(
            and(eq(verseHighlights.userId, userId), inArray(verseHighlights.verseId, chapterVerseIds)),
          );
        await tx
          .delete(verseNotes)
          .where(and(eq(verseNotes.userId, userId), inArray(verseNotes.verseId, chapterVerseIds)));

        // Versículo que não existe no capítulo é descartado em silêncio: a
        // marca veio de um navegador e o banco é quem sabe o que existe.
        const highlightValues = marks.highlights.flatMap((item) => {
          const verseId = verseIds.get(item.verse);
          return verseId === undefined ? [] : [{ userId, verseId, color: COLOR_TO_DATABASE[item.color] }];
        });
        if (highlightValues.length > 0) await tx.insert(verseHighlights).values(highlightValues);

        const noteValues = marks.notes.flatMap((item) => {
          const verseId = verseIds.get(item.anchor);
          return verseId === undefined
            ? []
            : [{ userId, verseId, verseList: item.verseList, body: item.body }];
        });
        if (noteValues.length > 0) await tx.insert(verseNotes).values(noteValues);

        if (marks.read) {
          await tx
            .insert(chapterReadingProgress)
            .values({ userId, chapterId, completedAt: new Date(), updatedAt: new Date() })
            .onConflictDoUpdate({
              target: [chapterReadingProgress.userId, chapterReadingProgress.chapterId],
              set: { completedAt: new Date(), updatedAt: new Date() },
            });
        } else {
          await tx
            .delete(chapterReadingProgress)
            .where(
              and(
                eq(chapterReadingProgress.userId, userId),
                eq(chapterReadingProgress.chapterId, chapterId),
              ),
            );
        }
      });
      return true;
    },
  };
}
