import { z } from "zod";

/**
 * Contrato de leitura do corpus bíblico.
 *
 * Regras que este contrato existe para garantir:
 * - só serve texto de tradução com status `approved` e atribuição não vazia
 *   (a licença BLIVRE exige atribuição em contexto razoável);
 * - só serve versículo com `published = true`;
 * - ordenação canônica vem do contrato, não da confiança na cláusula SQL;
 * - linha inesperada ou fora do formato é descartada em vez de vazar;
 * - nenhuma mensagem de erro de banco, segredo ou connection string atravessa a
 *   fronteira: as falhas são códigos fechados.
 *
 * O repositório é injetado (ver `src/server/bible/reader.ts`), portanto o
 * contrato é testável sem banco.
 */

export type BibleTranslation = {
  readonly id: string;
  readonly name: string;
  readonly attribution: string;
};

export type BibleBook = {
  readonly id: string;
  readonly code: string;
  readonly slug: string;
  readonly name: string;
  readonly orderNo: number;
};

export type BibleChapterRef = {
  readonly id: string;
  readonly number: number;
};

export type BibleVerse = {
  readonly id: string;
  readonly number: number;
  readonly content: string;
};

/** Motivos de falha. Fechados por definição: nada aqui descreve infraestrutura. */
export type BibleFailureReason =
  | "unavailable"
  | "invalid_reference"
  | "translation_unavailable"
  | "not_found"
  | "not_published"
  | "invalid_data";

export type BibleFailure = { readonly ok: false; readonly reason: BibleFailureReason };

export type BibleResult<T> = ({ readonly ok: true } & T) | BibleFailure;

export type BookListing = BibleResult<{
  translation: BibleTranslation;
  books: readonly BibleBook[];
}>;

export type ChapterListing = BibleResult<{
  translation: BibleTranslation;
  book: BibleBook;
  chapters: readonly BibleChapterRef[];
}>;

export type ChapterReading = BibleResult<{
  translation: BibleTranslation;
  book: BibleBook;
  chapter: BibleChapterRef;
  verses: readonly BibleVerse[];
}>;

/**
 * Fonte de dados. Devolve `unknown` de propósito: quem consome valida antes de
 * usar, então uma implementação com bug ou uma coluna renomeada falha fechada em
 * vez de entregar linha arbitrária ao leitor.
 */
export interface BibleRepository {
  findTranslation(translationId: string): Promise<unknown>;
  listBooks(translationId: string): Promise<unknown>;
  findBook(translationId: string, reference: string): Promise<unknown>;
  listChapters(bookId: string): Promise<unknown>;
  findChapter(bookId: string, chapterNumber: number): Promise<unknown>;
  listVerses(chapterId: string): Promise<unknown>;
}

const translationRowSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  status: z.string().trim().min(1),
  attribution: z.string().trim().min(1),
});

const bookRowSchema = z.object({
  id: z.uuid(),
  translationId: z.uuid(),
  code: z.string().trim().min(1).max(16),
  slug: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  orderNo: z.number().int().min(1).max(66),
});

const chapterRowSchema = z.object({
  id: z.uuid(),
  bookId: z.uuid(),
  number: z.number().int().min(1).max(150),
});

const verseRowSchema = z.object({
  id: z.uuid(),
  chapterId: z.uuid(),
  number: z.number().int().min(1).max(176),
  content: z.string().trim().min(1),
  published: z.boolean(),
});

/** Remove marcas USFM que não pertencem à leitura pública. Notas de rodapé e
 * referências cruzadas são metadados; `\\add` conserva as palavras editoriais. */
export function sanitizeUsfm(value: string): string {
  return value
    .replace(/\\(?:f|x)\b[\s\S]*?\\(?:f|x)\*/g, " ")
    .replace(/\\add\*?/g, "")
    .replace(/\\[a-z0-9]+\*?(?:\s+)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Referência aceita na URL: slug ou código do livro, sem espaço nem caixa alta. */
export const bookReferenceSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9-]+$/);

export const chapterNumberSchema = z.coerce.number().int().min(1).max(150);

/**
 * Tradução aprovada e com atribuição, ou nada. Status diferente de `approved`
 * significa licença não liberada: não há leitura possível.
 */
export function projectTranslation(row: unknown): BibleTranslation | null {
  const parsed = translationRowSchema.safeParse(row);
  if (!parsed.success) return null;
  if (parsed.data.status !== "approved") return null;
  return {
    id: parsed.data.id,
    name: parsed.data.name,
    attribution: parsed.data.attribution,
  };
}

/** Livro da tradução pedida; descarta livro de outra tradição/tradução. */
export function projectBook(row: unknown, translationId: string): BibleBook | null {
  const parsed = bookRowSchema.safeParse(row);
  if (!parsed.success) return null;
  if (parsed.data.translationId !== translationId) return null;
  const { id, code, slug, name, orderNo } = parsed.data;
  return { id, code, slug, name, orderNo };
}

/** Ordem canônica pelo `order_no`, sem duplicados. */
export function projectBooks(rows: unknown, translationId: string): readonly BibleBook[] {
  if (!Array.isArray(rows)) return [];
  const byOrder = new Map<number, BibleBook>();
  for (const row of rows) {
    const book = projectBook(row, translationId);
    if (book && !byOrder.has(book.orderNo)) byOrder.set(book.orderNo, book);
  }
  return [...byOrder.values()].sort((left, right) => left.orderNo - right.orderNo);
}

export function projectChapter(row: unknown, bookId: string): BibleChapterRef | null {
  const parsed = chapterRowSchema.safeParse(row);
  if (!parsed.success) return null;
  if (parsed.data.bookId !== bookId) return null;
  return { id: parsed.data.id, number: parsed.data.number };
}

export function projectChapters(rows: unknown, bookId: string): readonly BibleChapterRef[] {
  if (!Array.isArray(rows)) return [];
  const byNumber = new Map<number, BibleChapterRef>();
  for (const row of rows) {
    const chapter = projectChapter(row, bookId);
    if (chapter && !byNumber.has(chapter.number)) byNumber.set(chapter.number, chapter);
  }
  return [...byNumber.values()].sort((left, right) => left.number - right.number);
}

/**
 * Somente versículos publicados do capítulo pedido, em ordem de número. O filtro
 * por `published` é repetido aqui de propósito: mesmo que a consulta esqueça a
 * cláusula, rascunho não chega ao leitor.
 */
export function projectVerses(rows: unknown, chapterId: string): readonly BibleVerse[] {
  if (!Array.isArray(rows)) return [];
  const byNumber = new Map<number, BibleVerse>();
  for (const row of rows) {
    const parsed = verseRowSchema.safeParse(row);
    if (!parsed.success) continue;
    if (parsed.data.chapterId !== chapterId) continue;
    if (!parsed.data.published) continue;
    if (byNumber.has(parsed.data.number)) continue;
    const content = sanitizeUsfm(parsed.data.content);
    if (!content) continue;
    byNumber.set(parsed.data.number, {
      id: parsed.data.id,
      number: parsed.data.number,
      content,
    });
  }
  return [...byNumber.values()].sort((left, right) => left.number - right.number);
}

export function bibleFailure(reason: BibleFailureReason): BibleFailure {
  return { ok: false, reason };
}
