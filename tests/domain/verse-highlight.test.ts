import { describe, expect, it } from "vitest";
import { knownWordHighlights } from "../../src/domain/lexicon/verse-highlight";

describe("destaques das ocorrências identificadas", () => {
  it("marca as duas ocorrências de chamou em Gênesis 1:5", () => {
    const text = "E chamou Deus à luz Dia, e às trevas chamou Noite.";
    const parts = knownWordHighlights(5, "H7121", text, 2);
    expect(parts.map((part) => text.slice(part.start, part.end))).toEqual(["chamou", "chamou"]);
  });
  it("marca as ocorrências de Gênesis 1:8 e 1:10", () => {
    const eighth = "E chamou Deus à expansão Céus: e foi a tarde e a manhã, o dia segundo.";
    const tenth = "E chamou Deus à porção seca Terra, e à reunião das águas chamou Mares; e viu Deus que era bom.";
    expect(knownWordHighlights(8, "H7121", eighth, 1).map((part) => eighth.slice(part.start, part.end))).toEqual(["chamou"]);
    expect(knownWordHighlights(10, "H7121", tenth, 2).map((part) => tenth.slice(part.start, part.end))).toEqual(["chamou", "chamou"]);
  });
  it("não arrisca destaque quando há dúvida de contagem, capítulo ou palavra", () => {
    const text = "E chamou Deus à luz Dia, e às trevas chamou Noite.";
    expect(knownWordHighlights(5, "H7121", text, 1)).toEqual([]);
    expect(knownWordHighlights(6, "H7121", text, 2)).toEqual([]);
    expect(knownWordHighlights(5, "H216", text, 2)).toEqual([]);
  });
});
