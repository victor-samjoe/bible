/**
 * Progresso de leitura por testamento, livro e capítulo (`READING-PROGRESS-001`).
 * Funções puras: nenhum acesso a React, banco, rede ou `window`.
 *
 * Três regras governam este arquivo, e existem para que a página de progresso
 * não afirme nada que os dados não sustentem:
 *
 *  1. **Total vem do corpus, nunca de tabela interna.** A quantidade de
 *     capítulos de cada livro é a que o banco respondeu (`listChapterCounts`).
 *     Livro sem contagem conhecida fica com `unknownTotal`, e a interface mostra
 *     "—" em vez de 0 — que leria como "zero capítulos".
 *  2. **Percentual é razão de contagens reais ou não existe.** `progressRatio`
 *     devolve `null` sem total; `formatProgressPercent` arredonda para baixo,
 *     então 99% nunca significa capítulo faltando zero.
 *  3. **Marca que não casa com o corpus não é somada em silêncio.** Um escopo
 *     `jubileus.3` ou `genesis.99` não entra na conta de nenhum livro: sai em
 *     `unmatched`, para a pessoa ver e corrigir.
 *
 * O testamento **não existe como coluna** no banco: `books` tem apenas
 * `code` e `order_no`. A divisão abaixo é a lista canônica de 66 livros da
 * própria tradução (`translations.canon = "66 livros"`), com os códigos exatos
 * que o importador grava (`src/importers/blivre.ts`) — inclusive `NAM` para
 * Naum. Código fora dessa lista não é adivinhado por posição: vira grupo
 * `outro`, com rótulo que diz o que aconteceu.
 */

import { parseChapterScope, type ChapterRecord } from "./reading-session";

export type TestamentGroup = "antigo" | "novo" | "outro";

/** 39 códigos, na ordem canônica gravada pelo importador. */
const OLD_TESTAMENT_CODES: readonly string[] =
  "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL".split(
    " ",
  );

/** 27 códigos, na mesma ordem. */
const NEW_TESTAMENT_CODES: readonly string[] =
  "MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split(
    " ",
  );

const OLD = new Set(OLD_TESTAMENT_CODES);
const NEW = new Set(NEW_TESTAMENT_CODES);

export const testamentLabels: Readonly<Record<TestamentGroup, string>> = {
  antigo: "Antigo Testamento",
  novo: "Novo Testamento",
  outro: "Fora da lista de 66 livros",
};

/** Ordem de exibição dos grupos. `outro` aparece por último e só se existir. */
const GROUP_ORDER: readonly TestamentGroup[] = ["antigo", "novo", "outro"];

/**
 * Testamento pelo código do livro. Nunca por posição na lista: se o corpus
 * mudar de canon, um livro novo apareceria como "Antigo" só por vir antes.
 */
export function testamentOfCode(code: unknown): TestamentGroup {
  if (typeof code !== "string") return "outro";
  const normalized = code.trim().toUpperCase();
  if (OLD.has(normalized)) return "antigo";
  if (NEW.has(normalized)) return "novo";
  return "outro";
}

export type ProgressBook = {
  /** `id` do livro no corpus; é o que casa com as contagens de capítulo. */
  readonly id: string;
  readonly code: string;
  readonly slug: string;
  readonly name: string;
  readonly orderNo: number;
};

export type ProgressChapterCount = { readonly bookId: string; readonly count: number };

export type BookProgress = {
  readonly slug: string;
  readonly name: string;
  readonly code: string;
  readonly orderNo: number;
  readonly group: TestamentGroup;
  /** Capítulos do livro no corpus. `0` só aparece junto de `unknownTotal`. */
  readonly totalChapters: number;
  readonly readChapters: number;
  /** O corpus não informou a quantidade de capítulos deste livro. */
  readonly unknownTotal: boolean;
  readonly complete: boolean;
  /** Página de capítulos deste livro. */
  readonly progressPath: string;
  /** Leitor, no primeiro capítulo. */
  readonly readerPath: string;
};

export type TestamentProgress = {
  readonly group: TestamentGroup;
  readonly label: string;
  readonly books: readonly BookProgress[];
  readonly totalChapters: number;
  readonly readChapters: number;
  readonly booksStarted: number;
  readonly booksComplete: number;
  /** Algum livro do grupo está sem contagem de capítulos. */
  readonly unknownTotal: boolean;
};

export type ReadingProgressOverview = {
  readonly testaments: readonly TestamentProgress[];
  readonly totalChapters: number;
  readonly readChapters: number;
  readonly booksStarted: number;
  readonly booksComplete: number;
  readonly unknownTotal: boolean;
  /** Marcas válidas que não correspondem a capítulo conhecido do corpus. */
  readonly unmatched: readonly ChapterRecord[];
  readonly unmatchedCount: number;
};

/** Teto da lista de marcas órfãs exibidas; a contagem total continua honesta. */
const MAX_UNMATCHED_SHOWN = 20;

/**
 * Escopos (`genesis.1`) válidos, sem repetição. Entrada inválida é descartada:
 * a página não conta uma marca que não sabe ler.
 */
export function normalizeReadScopes(values: Iterable<unknown>): ReadonlySet<string> {
  const scopes = new Set<string>();
  for (const value of values) {
    const record = parseChapterScope(value);
    if (record !== null) scopes.add(record.scope);
  }
  return scopes;
}

/** Capítulos lidos por slug de livro, a partir dos escopos válidos. */
function groupByBook(scopes: Iterable<string>): Map<string, Set<number>> {
  const byBook = new Map<string, Set<number>>();
  for (const scope of scopes) {
    const record = parseChapterScope(scope);
    if (record === null) continue;
    const chapters = byBook.get(record.book) ?? new Set<number>();
    chapters.add(record.chapter);
    byBook.set(record.book, chapters);
  }
  return byBook;
}

export function bookProgressPath(bookSlug: string): string {
  return `/progresso/${bookSlug}`;
}

/**
 * Retrato completo: grupos, livros e totais, todos derivados dos livros e das
 * contagens que o corpus devolveu. Livro que o corpus não listou não aparece,
 * e capítulo fora da faixa do livro não é somado.
 */
export function buildReadingProgress(input: {
  readonly books: readonly ProgressBook[];
  readonly chapterCounts: readonly ProgressChapterCount[];
  readonly readScopes: Iterable<unknown>;
}): ReadingProgressOverview {
  const counts = new Map<string, number>();
  for (const entry of input.chapterCounts) {
    if (typeof entry?.bookId !== "string") continue;
    if (!Number.isSafeInteger(entry.count) || entry.count < 1) continue;
    counts.set(entry.bookId, entry.count);
  }

  const scopes = normalizeReadScopes(input.readScopes);
  const byBook = groupByBook(scopes);
  const knownSlugs = new Set<string>();

  const grouped = new Map<TestamentGroup, BookProgress[]>();
  const totalBySlug = new Map<string, number>();
  for (const book of [...input.books].sort((left, right) => left.orderNo - right.orderNo)) {
    knownSlugs.add(book.slug);
    const total = counts.get(book.id) ?? 0;
    const unknownTotal = total < 1;
    const readChapterNumbers = byBook.get(book.slug) ?? new Set<number>();
    // Com total conhecido, só conta capítulo que existe no livro. Sem total,
    // conta o que a pessoa marcou — e o grupo inteiro é declarado incompleto.
    const read = unknownTotal
      ? readChapterNumbers.size
      : [...readChapterNumbers].filter((chapter) => chapter >= 1 && chapter <= total).length;
    totalBySlug.set(book.slug, total);
    const group = testamentOfCode(book.code);
    const list = grouped.get(group) ?? [];
    list.push({
      slug: book.slug,
      name: book.name,
      code: book.code,
      orderNo: book.orderNo,
      group,
      totalChapters: total,
      readChapters: read,
      unknownTotal,
      complete: !unknownTotal && read >= total,
      progressPath: bookProgressPath(book.slug),
      readerPath: `/biblia/${book.slug}/1`,
    });
    grouped.set(group, list);
  }

  const testaments: TestamentProgress[] = [];
  for (const group of GROUP_ORDER) {
    const books = grouped.get(group);
    if (books === undefined || books.length === 0) continue;
    testaments.push({
      group,
      label: testamentLabels[group],
      books,
      totalChapters: books.reduce((sum, book) => sum + book.totalChapters, 0),
      readChapters: books.reduce((sum, book) => sum + book.readChapters, 0),
      booksStarted: books.filter((book) => book.readChapters > 0).length,
      booksComplete: books.filter((book) => book.complete).length,
      unknownTotal: books.some((book) => book.unknownTotal),
    });
  }

  // Marca órfã: livro que o corpus não tem, ou capítulo além do fim do livro.
  const unmatched: ChapterRecord[] = [];
  let unmatchedCount = 0;
  for (const scope of scopes) {
    const record = parseChapterScope(scope);
    if (record === null) continue;
    if (knownSlugs.has(record.book)) {
      const total = totalBySlug.get(record.book) ?? 0;
      if (total < 1 || record.chapter <= total) continue;
    }
    unmatchedCount += 1;
    if (unmatched.length < MAX_UNMATCHED_SHOWN) unmatched.push(record);
  }
  unmatched.sort((left, right) => left.book.localeCompare(right.book, "pt-BR") || left.chapter - right.chapter);

  const allBooks = testaments.flatMap((testament) => testament.books);
  return {
    testaments,
    totalChapters: allBooks.reduce((sum, book) => sum + book.totalChapters, 0),
    readChapters: allBooks.reduce((sum, book) => sum + book.readChapters, 0),
    booksStarted: allBooks.filter((book) => book.readChapters > 0).length,
    booksComplete: allBooks.filter((book) => book.complete).length,
    unknownTotal: allBooks.length === 0 || allBooks.some((book) => book.unknownTotal),
    unmatched,
    unmatchedCount,
  };
}

export type ChapterProgress = {
  readonly number: number;
  readonly scope: string;
  readonly read: boolean;
  /** Capítulo no leitor: a página de progresso sempre devolve ao texto. */
  readonly readerPath: string;
};

export type BookChapterProgress = {
  readonly slug: string;
  readonly name: string;
  readonly code: string;
  readonly group: TestamentGroup;
  readonly groupLabel: string;
  readonly chapters: readonly ChapterProgress[];
  readonly totalChapters: number;
  readonly readChapters: number;
};

/**
 * Capítulos de um livro, com a marca de cada um. `chapterNumbers` são os
 * números que o corpus devolveu — não `1..n` presumido, porque presumir
 * contiguidade inventaria capítulo em livro que não o tenha.
 */
export function buildBookChapterProgress(input: {
  readonly book: Pick<ProgressBook, "code" | "name" | "slug">;
  readonly chapterNumbers: Iterable<number>;
  readonly readScopes: Iterable<unknown>;
}): BookChapterProgress {
  const scopes = normalizeReadScopes(input.readScopes);
  const numbers = [
    ...new Set(
      [...input.chapterNumbers].filter((number) => Number.isSafeInteger(number) && number >= 1 && number <= 150),
    ),
  ].sort((left, right) => left - right);

  const chapters: ChapterProgress[] = numbers.map((number) => {
    const scope = `${input.book.slug}.${number}`;
    return {
      number,
      scope,
      read: scopes.has(scope),
      readerPath: `/biblia/${input.book.slug}/${number}`,
    };
  });

  const group = testamentOfCode(input.book.code);
  return {
    slug: input.book.slug,
    name: input.book.name,
    code: input.book.code,
    group,
    groupLabel: testamentLabels[group],
    chapters,
    totalChapters: chapters.length,
    readChapters: chapters.filter((chapter) => chapter.read).length,
  };
}

/**
 * Razão entre lidos e total. `null` quando não há total conhecido — e aí a
 * interface não mostra percentual nenhum, em vez de mostrar 0%.
 */
export function progressRatio(read: number, total: number): number | null {
  if (!Number.isSafeInteger(read) || !Number.isSafeInteger(total)) return null;
  if (total < 1 || read < 0) return null;
  return Math.min(1, read / total);
}

/**
 * Percentual exibível. Arredonda **para baixo**, então "99%" nunca é um livro
 * terminado e "100%" só aparece quando todos os capítulos estão marcados.
 * Também não devolve "0%" para quem já leu algo: o mínimo visível é 1%.
 */
export function formatProgressPercent(read: number, total: number): string | null {
  const ratio = progressRatio(read, total);
  if (ratio === null) return null;
  if (ratio >= 1) return "100%";
  const floored = Math.floor(ratio * 100);
  if (floored === 0) return read > 0 ? "1%" : "0%";
  return `${floored}%`;
}

/**
 * Palavra que a pessoa precisa digitar para apagar **todas** as marcas de
 * leitura. O reinício total não pode acontecer por um toque: perde trabalho
 * real e não tem desfazer. A mesma constante é conferida no servidor.
 */
export const RESET_CONFIRMATION = "REINICIAR";

/** Confirmação válida: a palavra exata, ignorando espaços e caixa. */
export function isResetConfirmed(value: unknown): boolean {
  return typeof value === "string" && value.trim().toUpperCase() === RESET_CONFIRMATION;
}
