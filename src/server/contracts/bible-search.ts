import { z } from "zod";
import { bookReferenceSchema, type BibleBook } from "./bible";

/**
 * Contrato de busca no corpus (tarefa C9).
 *
 * Regras que este contrato existe para garantir:
 * - busca só na tradução aprovada e só em versículo `published`;
 * - nenhuma tradução bloqueada é consultada — não existe parâmetro de tradução,
 *   justamente para que a API não possa ser apontada para texto sem licença;
 * - limite e paginação sempre aplicados, para não devolver o corpus inteiro nem
 *   permitir reconstrução cumulativa por varredura;
 * - ordenação canônica por livro, capítulo e versículo;
 * - curinga de `LIKE` digitado pelo usuário é escapado: `%` procura o caractere
 *   `%`, não "qualquer coisa".
 */

export const SEARCH_MAX_LIMIT = 50;
export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_OFFSET = 1000;
export const SEARCH_MAX_TERMS = 6;
export const SEARCH_MIN_TERM_LENGTH = 2;

export const searchInputSchema = z
  .object({
    q: z.string().trim().min(1).max(120),
    book: bookReferenceSchema.optional(),
    limit: z.coerce.number().int().min(1).max(SEARCH_MAX_LIMIT).default(SEARCH_DEFAULT_LIMIT),
    offset: z.coerce.number().int().min(0).max(SEARCH_MAX_OFFSET).default(0),
  })
  .strict();

export type SearchInput = z.input<typeof searchInputSchema>;

export type SearchHit = {
  readonly reference: string;
  readonly bookSlug: string;
  readonly bookName: string;
  readonly chapter: number;
  readonly verse: number;
  readonly content: string;
};

export type SearchFailureReason =
  | "unavailable"
  | "invalid_query"
  | "translation_unavailable"
  | "invalid_data";

export type SearchFailure = { readonly ok: false; readonly reason: SearchFailureReason };

export type SearchSuccess = {
  readonly ok: true;
  /** `reference` quando a consulta é uma referência canônica; `terms` quando é texto. */
  readonly kind: "reference" | "terms";
  readonly terms: readonly string[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hits: readonly SearchHit[];
  readonly truncated: boolean;
};

export type SearchResult = SearchSuccess | SearchFailure;

/** Remove acento e caixa, só para comparar nome de livro — nunca para buscar texto. */
export function foldForMatching(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Escapa os curingas de `LIKE`. O padrão vai como parâmetro ligado, então não há
 * injeção de SQL; o risco aqui é semântico: um `%` digitado casaria com tudo.
 */
export function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Termos de busca. O acento é preservado, porque o corpus é acentuado e a
 * comparação acontece no banco com `ILIKE`; só a caixa é ignorada por ele.
 */
export function searchTerms(raw: string): readonly string[] {
  const parts = raw
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((part) => part.length >= SEARCH_MIN_TERM_LENGTH);
  return [...new Set(parts)].slice(0, SEARCH_MAX_TERMS);
}

export type ParsedReference = {
  readonly book: BibleBook;
  readonly chapter: number;
  readonly verse: number | null;
};

/**
 * Interpreta "João 3", "joao 3:16", "1 Coríntios 13:4" ou "gen 1" usando a lista
 * de livros vinda do corpus. Nome que não está na lista não é resolvido — nenhum
 * livro é inventado nem adivinhado por aproximação fonética.
 */
export function parseReference(
  raw: string,
  books: readonly BibleBook[],
): ParsedReference | null {
  const match = /^(.+?)\s+(\d{1,3})(?:\s*[:.\s]\s*(\d{1,3}))?$/u.exec(raw.trim());
  if (!match) return null;
  const [, rawBook, rawChapter, rawVerse] = match;
  if (!rawBook || !rawChapter) return null;

  const chapter = Number(rawChapter);
  if (!Number.isSafeInteger(chapter) || chapter < 1 || chapter > 150) return null;
  const verse = rawVerse === undefined ? null : Number(rawVerse);
  if (verse !== null && (!Number.isSafeInteger(verse) || verse < 1 || verse > 176)) return null;

  const needle = foldForMatching(rawBook);
  if (needle.length === 0) return null;

  const candidates = books.filter((book) => {
    const name = foldForMatching(book.name);
    const slug = foldForMatching(book.slug);
    const code = foldForMatching(book.code);
    return name === needle || slug === needle || code === needle;
  });
  const exact = candidates[0];
  if (exact) return { book: exact, chapter, verse };

  // Prefixo só resolve quando é inequívoco: "jo" não pode virar João ou Jonas.
  const prefixed = books.filter((book) => {
    const name = foldForMatching(book.name);
    const slug = foldForMatching(book.slug);
    return name.startsWith(needle) || slug.startsWith(needle);
  });
  if (prefixed.length === 1 && prefixed[0]) {
    return { book: prefixed[0], chapter, verse };
  }
  return null;
}

const hitRowSchema = z.object({
  bookSlug: z.string().trim().min(1),
  bookName: z.string().trim().min(1),
  bookOrder: z.number().int().min(1).max(66),
  chapter: z.number().int().min(1).max(150),
  verse: z.number().int().min(1).max(176),
  content: z.string().trim().min(1),
  published: z.boolean(),
});

/**
 * Valida e ordena os resultados. `published = false` é descartado aqui também,
 * mesmo que a consulta tenha esquecido a cláusula.
 */
export function projectHits(rows: unknown): readonly SearchHit[] {
  if (!Array.isArray(rows)) return [];
  const parsed = rows
    .map((row) => hitRowSchema.safeParse(row))
    .filter((result) => result.success)
    .map((result) => result.data)
    .filter((row) => row.published);

  parsed.sort(
    (left, right) =>
      left.bookOrder - right.bookOrder ||
      left.chapter - right.chapter ||
      left.verse - right.verse,
  );

  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const row of parsed) {
    const reference = `${row.bookName} ${row.chapter}:${row.verse}`;
    if (seen.has(reference)) continue;
    seen.add(reference);
    hits.push({
      reference,
      bookSlug: row.bookSlug,
      bookName: row.bookName,
      chapter: row.chapter,
      verse: row.verse,
      content: row.content,
    });
  }
  return hits;
}

export interface BibleSearchRepository {
  findTranslation(translationId: string): Promise<unknown>;
  listBooks(translationId: string): Promise<unknown>;
  searchVerses(input: {
    translationId: string;
    patterns: readonly string[];
    bookSlug?: string;
    limit: number;
    offset: number;
  }): Promise<unknown>;
  countVerses(input: {
    translationId: string;
    patterns: readonly string[];
    bookSlug?: string;
  }): Promise<unknown>;
  findVerseByReference(input: {
    translationId: string;
    bookSlug: string;
    chapter: number;
    verse: number | null;
    limit: number;
  }): Promise<unknown>;
}
