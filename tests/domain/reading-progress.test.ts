import { describe, expect, it } from "vitest";
import {
  RESET_CONFIRMATION,
  bookProgressPath,
  buildBookChapterProgress,
  buildReadingProgress,
  formatProgressPercent,
  isResetConfirmed,
  normalizeReadScopes,
  progressRatio,
  testamentOfCode,
  type ProgressBook,
} from "../../src/domain/reading-progress";

/**
 * O que estes testes protegem: a página de progresso só pode afirmar o que os
 * dados sustentam. Total vem do corpus, marca fora do corpus não entra em
 * contagem nenhuma, e percentual não existe sem total.
 */

const BOOK = (id: string, code: string, slug: string, name: string, orderNo: number): ProgressBook => ({
  id,
  code,
  slug,
  name,
  orderNo,
});

const genesis = BOOK("b-gen", "GEN", "genesis", "Gênesis", 1);
const malaquias = BOOK("b-mal", "MAL", "malaquias", "Malaquias", 39);
const mateus = BOOK("b-mat", "MAT", "mateus", "Mateus", 40);
const apocalipse = BOOK("b-rev", "REV", "apocalipse", "Apocalipse", 66);

const books = [genesis, malaquias, mateus, apocalipse];
const chapterCounts = [
  { bookId: "b-gen", count: 50 },
  { bookId: "b-mal", count: 4 },
  { bookId: "b-mat", count: 28 },
  { bookId: "b-rev", count: 22 },
];

describe("testamento pelo código do livro", () => {
  it("classifica os limites dos dois testamentos", () => {
    expect(testamentOfCode("GEN")).toBe("antigo");
    expect(testamentOfCode("MAL")).toBe("antigo");
    expect(testamentOfCode("MAT")).toBe("novo");
    expect(testamentOfCode("REV")).toBe("novo");
  });

  it("aceita o código de Naum como o importador o grava", () => {
    // O corpus usa NAM, não NAH: classificar pelo código exige o código real.
    expect(testamentOfCode("NAM")).toBe("antigo");
  });

  it("não adivinha livro fora da lista de 66", () => {
    for (const code of ["TOB", "SIR", "", "  ", "1EN"]) {
      expect(testamentOfCode(code)).toBe("outro");
    }
    expect(testamentOfCode(undefined)).toBe("outro");
    expect(testamentOfCode(40)).toBe("outro");
  });
});

describe("escopos lidos", () => {
  it("descarta escopo inválido e repetido", () => {
    const scopes = normalizeReadScopes([
      "genesis.1",
      "genesis.1",
      "genesis",
      "genesis.0",
      "Genesis.1",
      "../etc.1",
      "genesis.1.2",
      42,
      null,
    ]);
    expect([...scopes]).toEqual(["genesis.1"]);
  });
});

describe("visão geral do progresso", () => {
  it("deriva totais dos livros e contagens reais", () => {
    const overview = buildReadingProgress({
      books,
      chapterCounts,
      readScopes: ["genesis.1", "genesis.2", "mateus.5"],
    });

    expect(overview.totalChapters).toBe(104);
    expect(overview.readChapters).toBe(3);
    expect(overview.unknownTotal).toBe(false);
    expect(overview.testaments.map((group) => group.group)).toEqual(["antigo", "novo"]);

    const antigo = overview.testaments[0];
    expect(antigo?.totalChapters).toBe(54);
    expect(antigo?.readChapters).toBe(2);
    expect(antigo?.books.map((book) => book.slug)).toEqual(["genesis", "malaquias"]);
    expect(antigo?.books[0]?.readChapters).toBe(2);
    expect(antigo?.books[0]?.totalChapters).toBe(50);
    expect(antigo?.books[1]?.readChapters).toBe(0);
    expect(overview.booksStarted).toBe(2);
    expect(overview.booksComplete).toBe(0);
  });

  it("ordena os livros pelo order_no, não pela ordem recebida", () => {
    const overview = buildReadingProgress({
      books: [apocalipse, genesis, mateus, malaquias],
      chapterCounts,
      readScopes: [],
    });
    expect(overview.testaments[0]?.books.map((book) => book.slug)).toEqual(["genesis", "malaquias"]);
    expect(overview.testaments[1]?.books.map((book) => book.slug)).toEqual(["mateus", "apocalipse"]);
  });

  it("marca livro completo somente quando todos os capítulos estão lidos", () => {
    const parcial = buildReadingProgress({
      books: [malaquias],
      chapterCounts: [{ bookId: "b-mal", count: 4 }],
      readScopes: ["malaquias.1", "malaquias.2", "malaquias.3"],
    });
    expect(parcial.testaments[0]?.books[0]?.complete).toBe(false);
    expect(parcial.booksComplete).toBe(0);

    const completo = buildReadingProgress({
      books: [malaquias],
      chapterCounts: [{ bookId: "b-mal", count: 4 }],
      readScopes: ["malaquias.1", "malaquias.2", "malaquias.3", "malaquias.4"],
    });
    expect(completo.testaments[0]?.books[0]?.complete).toBe(true);
    expect(completo.booksComplete).toBe(1);
  });

  it("não soma marca de livro inexistente nem de capítulo além do fim do livro", () => {
    const overview = buildReadingProgress({
      books,
      chapterCounts,
      readScopes: ["genesis.1", "genesis.51", "jubileus.3", "malaquias.4"],
    });

    expect(overview.readChapters).toBe(2);
    expect(overview.unmatchedCount).toBe(2);
    expect(overview.unmatched.map((record) => record.scope)).toEqual(["genesis.51", "jubileus.3"]);
    // A marca órfã continua apontando para uma rota de leitura utilizável.
    expect(overview.unmatched[0]?.path).toBe("/biblia/genesis/51");
  });

  it("declara total desconhecido quando o corpus não informou a contagem", () => {
    const overview = buildReadingProgress({
      books: [genesis],
      chapterCounts: [],
      readScopes: ["genesis.1", "genesis.900"],
    });
    const book = overview.testaments[0]?.books[0];
    expect(book?.unknownTotal).toBe(true);
    expect(book?.totalChapters).toBe(0);
    expect(book?.complete).toBe(false);
    // Sem total, conta o que foi marcado e não há capítulo "fora da faixa".
    expect(book?.readChapters).toBe(2);
    expect(overview.unknownTotal).toBe(true);
    expect(overview.unmatchedCount).toBe(0);
  });

  it("sem livros não devolve testamento nem total", () => {
    const overview = buildReadingProgress({ books: [], chapterCounts: [], readScopes: ["genesis.1"] });
    expect(overview.testaments).toEqual([]);
    expect(overview.totalChapters).toBe(0);
    expect(overview.readChapters).toBe(0);
    expect(overview.unknownTotal).toBe(true);
    expect(overview.unmatchedCount).toBe(1);
  });

  it("agrupa livro de código desconhecido em separado, sem chamá-lo de testamento", () => {
    const overview = buildReadingProgress({
      books: [genesis, BOOK("b-tob", "TOB", "tobias", "Tobias", 65)],
      chapterCounts: [...chapterCounts, { bookId: "b-tob", count: 14 }],
      readScopes: ["tobias.1"],
    });
    const grupos = overview.testaments.map((group) => group.group);
    expect(grupos).toEqual(["antigo", "outro"]);
    expect(overview.testaments[1]?.label).toBe("Fora da lista de 66 livros");
  });

  it("aponta para a página de capítulos e para o leitor", () => {
    const overview = buildReadingProgress({ books: [genesis], chapterCounts, readScopes: [] });
    const book = overview.testaments[0]?.books[0];
    expect(book?.progressPath).toBe("/progresso/genesis");
    expect(book?.readerPath).toBe("/biblia/genesis/1");
    expect(bookProgressPath("mateus")).toBe("/progresso/mateus");
  });
});

describe("capítulos de um livro", () => {
  it("usa os números que o corpus devolveu, sem presumir 1..n", () => {
    const progress = buildBookChapterProgress({
      book: { code: "GEN", name: "Gênesis", slug: "genesis" },
      chapterNumbers: [3, 1, 2, 2],
      readScopes: ["genesis.2", "mateus.1"],
    });

    expect(progress.chapters.map((chapter) => chapter.number)).toEqual([1, 2, 3]);
    expect(progress.totalChapters).toBe(3);
    expect(progress.readChapters).toBe(1);
    expect(progress.chapters[1]?.read).toBe(true);
    expect(progress.chapters[1]?.scope).toBe("genesis.2");
    expect(progress.chapters[1]?.readerPath).toBe("/biblia/genesis/2");
    expect(progress.groupLabel).toBe("Antigo Testamento");
  });

  it("descarta número de capítulo impossível", () => {
    const progress = buildBookChapterProgress({
      book: { code: "MAT", name: "Mateus", slug: "mateus" },
      chapterNumbers: [1, 0, -4, 151, 2.5, Number.NaN],
      readScopes: [],
    });
    expect(progress.chapters.map((chapter) => chapter.number)).toEqual([1]);
  });
});

describe("percentual", () => {
  it("não existe sem total conhecido", () => {
    expect(progressRatio(3, 0)).toBeNull();
    expect(progressRatio(3, -1)).toBeNull();
    expect(progressRatio(-1, 10)).toBeNull();
    expect(formatProgressPercent(3, 0)).toBeNull();
  });

  it("arredonda para baixo, então 100% só aparece completo", () => {
    expect(formatProgressPercent(49, 50)).toBe("98%");
    expect(formatProgressPercent(1188, 1189)).toBe("99%");
    expect(formatProgressPercent(1189, 1189)).toBe("100%");
  });

  it("mostra 1% para quem leu pouco e 0% só para quem não leu nada", () => {
    expect(formatProgressPercent(0, 1189)).toBe("0%");
    expect(formatProgressPercent(1, 1189)).toBe("1%");
  });

  it("não passa de 100% se houver mais marcas que capítulos", () => {
    expect(progressRatio(60, 50)).toBe(1);
    expect(formatProgressPercent(60, 50)).toBe("100%");
  });
});

describe("confirmação do reinício total", () => {
  it("exige a palavra exata", () => {
    expect(isResetConfirmed(RESET_CONFIRMATION)).toBe(true);
    expect(isResetConfirmed(" reiniciar ")).toBe(true);
    for (const value of ["", "sim", "REINICIA", "REINICIAR TUDO", "ok", null, undefined, 1]) {
      expect(isResetConfirmed(value)).toBe(false);
    }
  });
});
