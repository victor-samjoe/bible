import { describe, expect, it } from "vitest";
import {
  alignmentFor,
  originalGroupAt,
  tokenizeDisplayText,
  translationGroupAt,
} from "../../src/domain/passage-alignment";

describe("alinhamento editorial por passagem", () => {
  it("liga No princípio ao mesmo token hebraico sem usar posição automática", () => {
    const words = tokenizeDisplayText("No princípio criou Deus os céus e a terra.");
    const groups = alignmentFor("genesis", 1, 1);
    expect(translationGroupAt(words, 0, groups)?.id).toBe("inicio");
    expect(translationGroupAt(words, 1, groups)?.id).toBe("inicio");
    expect(originalGroupAt(1, groups)?.id).toBe("inicio");
  });

  it("preserva grupos que incluem marcador hebraico sem equivalente isolado", () => {
    const groups = alignmentFor("genesis", 1, 1);
    expect(originalGroupAt(4, groups)?.id).toBe("ceus");
    expect(originalGroupAt(5, groups)?.id).toBe("ceus");
    expect(originalGroupAt(6, groups)?.id).toBe("terra");
    expect(originalGroupAt(7, groups)?.id).toBe("terra");
  });

  it("não inventa alinhamento para passagem ainda não revisada", () => {
    expect(alignmentFor("joao", 3, 16)).toEqual([]);
  });
});
