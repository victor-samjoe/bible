/**
 * Navegação canônica entre capítulos. Funções puras: nenhum acesso a banco,
 * rede ou React, para que o leitor e os testes usem a mesma regra.
 *
 * A ordem vem do `order_no` do livro e do número do capítulo, exatamente como o
 * contrato de leitura (`src/server/contracts/bible.ts`) entrega. Nada aqui
 * inventa livro, capítulo ou quantidade: o que não existe na lista recebida não
 * é alcançável.
 */

export type NavigationBook = {
  readonly slug: string;
  readonly name: string;
  readonly orderNo: number;
};

export type ChapterLocation = {
  readonly book: NavigationBook;
  readonly chapter: number;
};

export type ChapterNeighbours = {
  readonly previous: ChapterLocation | null;
  readonly next: ChapterLocation | null;
};

/** Caminho canônico de um capítulo. Slug e número já vêm validados do contrato. */
export function chapterPath(bookSlug: string, chapter: number): string {
  return `/biblia/${bookSlug}/${chapter}`;
}

export function canonicalReference(bookName: string, chapter: number): string {
  return `${bookName} ${chapter}`;
}

function sortedBooks(books: readonly NavigationBook[]): NavigationBook[] {
  return [...books].sort((left, right) => left.orderNo - right.orderNo);
}

/**
 * Livro imediatamente anterior na ordem canônica, ou `null` no começo do canon.
 * Usado para descobrir em que capítulo o livro anterior termina antes de montar
 * o link de "anterior".
 */
export function previousBookOf(
  books: readonly NavigationBook[],
  currentBookSlug: string,
): NavigationBook | null {
  const ordered = sortedBooks(books);
  const index = ordered.findIndex((book) => book.slug === currentBookSlug);
  if (index <= 0) return null;
  return ordered[index - 1] ?? null;
}

/**
 * Capítulo anterior e seguinte, atravessando a fronteira de livro.
 *
 * `chaptersInBook` é a quantidade de capítulos do livro atual e
 * `chaptersInBookBefore`/`chaptersInBookAfter` são as dos livros vizinhos, quando
 * conhecidas. Sem a quantidade do livro anterior não há como saber em que
 * capítulo ele termina, então o anterior aponta para o capítulo 1 desse livro —
 * nunca para um número inventado.
 */
export function chapterNeighbours(input: {
  books: readonly NavigationBook[];
  currentBookSlug: string;
  currentChapter: number;
  chaptersInBook: number;
  chaptersInPreviousBook?: number;
}): ChapterNeighbours {
  const books = sortedBooks(input.books);
  const index = books.findIndex((book) => book.slug === input.currentBookSlug);
  if (index < 0) return { previous: null, next: null };
  const current = books[index];
  if (!current) return { previous: null, next: null };

  const previousBook = index > 0 ? books[index - 1] : undefined;
  const nextBook = index < books.length - 1 ? books[index + 1] : undefined;

  const previous: ChapterLocation | null =
    input.currentChapter > 1
      ? { book: current, chapter: input.currentChapter - 1 }
      : previousBook
        ? {
            book: previousBook,
            chapter:
              input.chaptersInPreviousBook && input.chaptersInPreviousBook > 0
                ? input.chaptersInPreviousBook
                : 1,
          }
        : null;

  const next: ChapterLocation | null =
    input.currentChapter < input.chaptersInBook
      ? { book: current, chapter: input.currentChapter + 1 }
      : nextBook
        ? { book: nextBook, chapter: 1 }
        : null;

  return { previous, next };
}

/** Lista 1..total para o seletor de capítulos. Total inválido devolve vazio. */
export function chapterRange(total: number): number[] {
  if (!Number.isSafeInteger(total) || total < 1) return [];
  return Array.from({ length: total }, (_, index) => index + 1);
}
