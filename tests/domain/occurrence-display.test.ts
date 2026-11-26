import { describe, expect, it } from "vitest";
import { contextualExcerpt, occurrenceMatchesSurface } from "../../src/domain/lexicon/occurrence-display";

describe("ocorrências e trechos da Bíblia Livre", () => {
  it("confere a parte lexical contra a palavra vocalizada completa", () => {
    expect(occurrenceMatchesSurface("פְּנֵי", "פְּנֵ֣י")).toBe(true);
    expect(occurrenceMatchesSurface("פְּנֵי", "וְהָאָ֗רֶץ")).toBe(false);
    expect(occurrenceMatchesSurface("", "פְּנֵ֣י")).toBe(false);
  });
  it("usa o texto efetivo do versículo e respeita a posição", () => {
    const text = "E a terra estava desordenada e vazia, e as trevas estavam sobre a face do abismo, e o Espírito de Deus se movia sobre a face das águas.";
    expect(contextualExcerpt(2, 7, "H6440", text)).toBe("face");
    expect(contextualExcerpt(2, 13, "H6440", text)).toBe("face");
    expect(contextualExcerpt(2, 8, "H6440", text)).toBeNull();
    expect(contextualExcerpt(2, 7, "H6440", "texto diferente")).toBeNull();
  });
  it("identifica o trecho mais amplo quando a tradução não é palavra por palavra", () => {
    const text = "e aves que voem sobre a terra, na expansão aberta dos céus.";
    expect(contextualExcerpt(20, 13, "H6440", text)).toBe("na expansão aberta dos céus");
    expect(contextualExcerpt(20, 13, "H6440", "outra tradução")).toBeNull();
  });
  it("reaproveita o alinhamento existente quando a frase é única", () => {
    expect(contextualExcerpt(1, 1, "H7225", "No princípio criou Deus os céus e a terra.")).toBe("No princípio");
    expect(contextualExcerpt(1, 1, "H7225", "No princípio e no princípio")).toBeNull();
  });
});
