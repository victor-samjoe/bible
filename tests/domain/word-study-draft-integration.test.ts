import { describe, expect, it } from "vitest";
import { draftSense, hasDraftEntry } from "../../app/palavra/draft-translations";
import { strongLexemeKey } from "../../src/domain/lexicon/records";
import first from "../../data/word-study/gen1-lote-001.translations.json";
import second from "../../data/word-study/gen1-lote-002.translations.json";

describe("rascunhos de acepções ligados ao texto da fonte", () => {
  it("apresenta tradução do verbete e sentido correspondentes", () => {
    expect(draftSense("H1254", "b.cw.aa", "1", "shape; fashion; create")).toBe("formar; moldar; criar");
    expect(draftSense("H7549", "r.x.aa", "1", "expanse")).toBeNull();
    expect(hasDraftEntry("H1254", "b.cw.aa")).toBe(true);
  });
  it("não transfere tradução para outro homógrafo, caminho ou fonte alterada", () => {
    expect(draftSense("H1254", "b.cx.aa", "1", "shape; fashion; create")).toBeNull();
    expect(draftSense("H1254", "b.cw.aa", "2", "shape; fashion; create")).toBeNull();
    expect(draftSense("H1254", "b.cw.aa", "1", "shape; fashion; change")).toBeNull();
    expect(draftSense("H1254", "b.cw.aa", "1", "shape;  fashion; create")).toBe("formar; moldar; criar");
  });
  it("normaliza a chave de homógrafo recebida pela página", () => {
    expect(strongLexemeKey("hbo", "H1254A")).toBe("hbo:H1254a");
    expect(strongLexemeKey("grc", "G00123B")).toBe("grc:G123b");
  });
  it("conecta os 72 rascunhos aos respectivos verbetes e caminhos", () => {
    let count = 0;
    for (const [key, entry] of Object.entries({ ...first.entries, ...second.entries })) {
      for (const sense of entry.senses) {
        expect(draftSense(key.slice(4), entry.bdbId, sense.path, sense.original)).toBe(sense.pt);
        count += 1;
      }
    }
    expect(count).toBe(72);
  });
});
