import { describe, expect, it } from "vitest";
import { parseChapterMarksPayload } from "../../src/domain/reading-sync";

/**
 * O que chega no Server Action é JSON vindo de um navegador. Estes testes
 * descrevem o que o servidor aceita e, principalmente, o que ele recusa sem
 * derrubar a gravação inteira.
 */

const base = { scope: "genesis.1", highlights: {}, notes: {}, read: false };

describe("validação da carga de marcas", () => {
  it("lê um capítulo válido", () => {
    const parsed = parseChapterMarksPayload({
      ...base,
      highlights: { "3": "amarelo" },
      notes: { "3-5": "  minha nota  " },
      read: true,
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.bookSlug).toBe("genesis");
    expect(parsed?.chapterNumber).toBe(1);
    expect(parsed?.marks.highlights).toEqual([{ verse: 3, color: "amarelo" }]);
    expect(parsed?.marks.notes).toEqual([{ verseList: "3-5", anchor: 3, body: "minha nota" }]);
    expect(parsed?.marks.read).toBe(true);
  });

  it("recusa escopo malformado", () => {
    for (const scope of ["", "genesis", "genesis.", ".1", "Genesis.1", "genesis.1.2", "../etc.1"]) {
      expect(parseChapterMarksPayload({ ...base, scope })).toBeNull();
    }
  });

  it("descarta marca inválida e mantém o resto", () => {
    const parsed = parseChapterMarksPayload({
      ...base,
      highlights: { "3": "roxo", "0": "verde", "999": "verde", abc: "azul", "7": "rosa" },
      notes: { "3-5": "boa", "": "sem versículo", "9": "   ", "2-1": "intervalo invertido" },
    });
    // Só o destaque 7 e a nota 3-5 sobrevivem: cor inexistente, versículo fora
    // da faixa, chave não numérica, nota vazia e intervalo invertido caem.
    expect(parsed?.marks.highlights).toEqual([{ verse: 7, color: "rosa" }]);
    expect(parsed?.marks.notes).toEqual([{ verseList: "3-5", anchor: 3, body: "boa" }]);
  });

  it("a âncora da nota é o primeiro versículo da seleção, mesmo com buraco", () => {
    const parsed = parseChapterMarksPayload({ ...base, notes: { "4-6,9": "texto" } });
    expect(parsed?.marks.notes.at(0)).toEqual({ verseList: "4-6,9", anchor: 4, body: "texto" });
  });

  it("corta nota gigante em vez de recusar a gravação", () => {
    const parsed = parseChapterMarksPayload({ ...base, notes: { "1": "a".repeat(20000) } });
    expect(parsed?.marks.notes.at(0)?.body).toHaveLength(10000);
  });

  it("limita quantas marcas uma só requisição grava", () => {
    const highlights: Record<string, string> = {};
    for (let verse = 1; verse <= 176; verse += 1) highlights[String(verse)] = "amarelo";
    const notes: Record<string, string> = {};
    for (let verse = 1; verse <= 176; verse += 1) notes[String(verse)] = "nota";
    const parsed = parseChapterMarksPayload({ ...base, highlights, notes });
    expect(parsed?.marks.highlights.length).toBeLessThanOrEqual(176);
    expect(parsed?.marks.notes).toHaveLength(100);
  });

  it("read só é verdadeiro com o booleano verdadeiro", () => {
    for (const read of [false, "true", 1, null, undefined] as unknown[]) {
      expect(parseChapterMarksPayload({ ...base, read: read as boolean })?.marks.read).toBe(false);
    }
  });
});
