import { describe, expect, it } from "vitest";
import {
  chapterScope,
  compactVerseList,
  expandVerseList,
  highlightColors,
  isHighlightColor,
  isMarkInScope,
  markAnchor,
  normalizeVerses,
  parseMarkKey,
  selectionLabel,
  toggleVerseIn,
  verseMarkKey,
} from "../../src/domain/reader-marks";

describe("marcas de leitura: cores", () => {
  it("aceita só as quatro cores do contrato", () => {
    expect(highlightColors).toEqual(["amarelo", "verde", "azul", "rosa"]);
    for (const color of highlightColors) expect(isHighlightColor(color)).toBe(true);
    for (const invalid of ["roxo", "", "AMARELO", null, 1, undefined]) {
      expect(isHighlightColor(invalid)).toBe(false);
    }
  });
});

describe("marcas de leitura: lista de versículos", () => {
  it("ordena, remove repetidos e descarta número inválido", () => {
    expect(normalizeVerses([5, 3, 5, 4])).toEqual([3, 4, 5]);
    expect(normalizeVerses([0, -1, 1.5, 177, Number.NaN, 2])).toEqual([2]);
    expect(normalizeVerses([])).toEqual([]);
  });

  it("compacta sequência em faixa e preserva descontinuidade", () => {
    expect(compactVerseList([3, 4, 5, 9])).toBe("3-5,9");
    expect(compactVerseList([3])).toBe("3");
    expect(compactVerseList([3, 5])).toBe("3,5");
    expect(compactVerseList([9, 3, 4, 5])).toBe("3-5,9");
    expect(compactVerseList([1, 2])).toBe("1-2");
    expect(compactVerseList([])).toBe("");
  });

  it("não afirma faixa que não foi selecionada", () => {
    // 3 e 5 sem o 4 não podem virar "3-5".
    expect(compactVerseList([3, 5])).not.toBe("3-5");
    expect(expandVerseList(compactVerseList([3, 5]))).toEqual([3, 5]);
  });

  it("expande de volta e recusa formato inválido", () => {
    expect(expandVerseList("3-5,9")).toEqual([3, 4, 5, 9]);
    expect(expandVerseList("7")).toEqual([7]);
    for (const invalid of ["", "0", "5-3", "3-", "-3", "a", "3,,5", "1-200", "3 5", "9999"]) {
      expect(expandVerseList(invalid), invalid).toEqual([]);
    }
  });

  it("ida e volta preserva a seleção", () => {
    for (const verses of [[1], [1, 2, 3], [3, 5], [2, 3, 7, 8, 9, 40]]) {
      expect(expandVerseList(compactVerseList(verses))).toEqual(verses);
    }
  });
});

describe("marcas de leitura: chaves", () => {
  it("monta escopo e chave de marca", () => {
    expect(chapterScope("genesis", 1)).toBe("genesis.1");
    expect(verseMarkKey("genesis.1", [3])).toBe("genesis.1.3");
    expect(verseMarkKey("genesis.1", [3, 4, 5, 9])).toBe("genesis.1.3-5,9");
    expect(verseMarkKey("1-corintios.13", [4, 5])).toBe("1-corintios.13.4-5");
  });

  it("recusa escopo inválido e seleção vazia", () => {
    expect(verseMarkKey("genesis.1", [])).toBeNull();
    expect(verseMarkKey("genesis", [3])).toBeNull();
    expect(verseMarkKey("Genesis.1", [3])).toBeNull();
    expect(verseMarkKey("genesis.1.2", [3])).toBeNull();
    expect(verseMarkKey("", [3])).toBeNull();
    expect(verseMarkKey("genesis.1", [0])).toBeNull();
  });

  it("interpreta a chave de volta", () => {
    expect(parseMarkKey("genesis.1.3-5,9")).toEqual({
      scope: "genesis.1",
      verses: [3, 4, 5, 9],
    });
    expect(parseMarkKey("joao.3.16")).toEqual({ scope: "joao.3", verses: [16] });
    for (const invalid of [
      "genesis.1",
      "genesis.1.",
      "genesis.1.0",
      "genesis.1.5-3",
      "genesis..3",
      "GENESIS.1.3",
      "genesis.1.3;5",
      "",
    ]) {
      expect(parseMarkKey(invalid), invalid).toBeNull();
    }
  });

  it("escopo é comparado inteiro, não por prefixo", () => {
    expect(isMarkInScope("genesis.1.3", "genesis.1")).toBe(true);
    // genesis.1 não pode casar com genesis.11, nem genesis com genesis-2.
    expect(isMarkInScope("genesis.11.3", "genesis.1")).toBe(false);
    expect(isMarkInScope("genesis.1.3", "genesis.11")).toBe(false);
    expect(isMarkInScope("joao.3.16", "genesis.1")).toBe(false);
    expect(isMarkInScope("lixo", "genesis.1")).toBe(false);
  });

  it("ancora a marca no primeiro versículo", () => {
    expect(markAnchor("genesis.1.3-5,9")).toBe(3);
    expect(markAnchor("genesis.1.9,3")).toBe(3);
    expect(markAnchor("joao.3.16")).toBe(16);
    expect(markAnchor("invalida")).toBeNull();
  });
});

describe("marcas de leitura: rótulo e seleção", () => {
  it("rotula a seleção com a referência canônica", () => {
    expect(selectionLabel("Gênesis 1", [3, 4, 5, 9])).toBe("Gênesis 1:3-5,9");
    expect(selectionLabel("João 3", [16])).toBe("João 3:16");
    expect(selectionLabel("Gênesis 1", [])).toBe("Gênesis 1");
  });

  it("alterna versículo na seleção sem mutar o conjunto recebido", () => {
    const original = new Set([3, 4]);
    const added = toggleVerseIn(original, 5);
    expect([...added]).toEqual([3, 4, 5]);
    expect([...original]).toEqual([3, 4]);

    const removed = toggleVerseIn(added, 4);
    expect([...removed].sort((a, b) => a - b)).toEqual([3, 5]);

    // Número fora da faixa não entra nem quebra a seleção.
    expect(toggleVerseIn(original, 0)).toBe(original);
    expect(toggleVerseIn(original, 1.5)).toBe(original);
    expect(toggleVerseIn(original, 999)).toBe(original);
  });
});
