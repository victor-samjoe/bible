import { describe, expect, it } from "vitest";
import { wordAnalysisFor } from "../../src/domain/word-analysis";

describe("wordAnalysisFor", () => {
  it("expõe análise editorial da primeira palavra de Gênesis 1:1", () => {
    const analysis = wordAnalysisFor("genesis", 1, 1, 1);
    expect(analysis?.transliteration).toBe("bereshit");
    expect(analysis?.contextualTranslation).toBe("no princípio");
    expect(analysis?.semanticRange).toContain("começo");
  });

  it("não inventa análise para posição ainda não revisada", () => {
    expect(wordAnalysisFor("genesis", 1, 2, 1)).toBeNull();
  });
});
