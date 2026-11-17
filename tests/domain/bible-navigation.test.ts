import { describe, expect, it } from "vitest";
import {
  canonicalReference,
  chapterNeighbours,
  chapterPath,
  chapterRange,
  previousBookOf,
  type NavigationBook,
} from "../../src/domain/bible-navigation";

// Livros sintéticos: a regra de navegação não depende do conteúdo do corpus.
const genesis: NavigationBook = { slug: "genesis", name: "Gênesis", orderNo: 1 };
const exodo: NavigationBook = { slug: "exodo", name: "Êxodo", orderNo: 2 };
const levitico: NavigationBook = { slug: "levitico", name: "Levítico", orderNo: 3 };
const books = [exodo, levitico, genesis]; // fora de ordem de propósito

describe("navegação canônica entre capítulos", () => {
  it("monta caminho e referência", () => {
    expect(chapterPath("genesis", 1)).toBe("/biblia/genesis/1");
    expect(canonicalReference("Gênesis", 50)).toBe("Gênesis 50");
  });

  it("anda dentro do livro", () => {
    const { previous, next } = chapterNeighbours({
      books,
      currentBookSlug: "exodo",
      currentChapter: 5,
      chaptersInBook: 40,
    });
    expect(previous).toEqual({ book: exodo, chapter: 4 });
    expect(next).toEqual({ book: exodo, chapter: 6 });
  });

  it("atravessa a fronteira de livro usando a ordem canônica, não a ordem recebida", () => {
    const first = chapterNeighbours({
      books,
      currentBookSlug: "exodo",
      currentChapter: 1,
      chaptersInBook: 40,
      chaptersInPreviousBook: 50,
    });
    expect(first.previous).toEqual({ book: genesis, chapter: 50 });

    const last = chapterNeighbours({
      books,
      currentBookSlug: "exodo",
      currentChapter: 40,
      chaptersInBook: 40,
    });
    expect(last.next).toEqual({ book: levitico, chapter: 1 });
  });

  it("aponta para o capítulo 1 quando o tamanho do livro anterior é desconhecido", () => {
    for (const chaptersInPreviousBook of [undefined, 0, -3]) {
      const { previous } = chapterNeighbours({
        books,
        currentBookSlug: "exodo",
        currentChapter: 1,
        chaptersInBook: 40,
        chaptersInPreviousBook,
      });
      expect(previous).toEqual({ book: genesis, chapter: 1 });
    }
  });

  it("não inventa vizinho nas pontas do canon", () => {
    expect(
      chapterNeighbours({
        books,
        currentBookSlug: "genesis",
        currentChapter: 1,
        chaptersInBook: 50,
      }).previous,
    ).toBeNull();
    expect(
      chapterNeighbours({
        books,
        currentBookSlug: "levitico",
        currentChapter: 27,
        chaptersInBook: 27,
      }).next,
    ).toBeNull();
  });

  it("não navega para livro ausente da lista nem além do fim do livro", () => {
    expect(
      chapterNeighbours({ books, currentBookSlug: "intruso", currentChapter: 1, chaptersInBook: 9 }),
    ).toEqual({ previous: null, next: null });
    expect(
      chapterNeighbours({
        books: [genesis],
        currentBookSlug: "genesis",
        currentChapter: 50,
        chaptersInBook: 50,
      }).next,
    ).toBeNull();
  });

  it("encontra o livro anterior na ordem canônica", () => {
    expect(previousBookOf(books, "exodo")).toEqual(genesis);
    expect(previousBookOf(books, "levitico")).toEqual(exodo);
    expect(previousBookOf(books, "genesis")).toBeNull();
    expect(previousBookOf(books, "intruso")).toBeNull();
    expect(previousBookOf([], "genesis")).toBeNull();
  });

  it("gera a faixa de capítulos e recusa total inválido", () => {
    expect(chapterRange(3)).toEqual([1, 2, 3]);
    expect(chapterRange(1)).toEqual([1]);
    for (const invalid of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(chapterRange(invalid)).toEqual([]);
    }
  });
});
