import { describe, expect, it } from "vitest";
import { transliterateGreekSurface } from "../../src/domain/transliteration/greek";

describe("transliteração grega por forma textual (ALA-LC)", () => {
  it.each([["λόγος", "logos"], ["λόγον", "logon"], ["λόγου", "logou"], ["λόγοι", "logoi"]])("%s → %s", (word, expected) => {
    expect(transliterateGreekSurface(word)?.simplified).toBe(expected);
  });
  it("distingue espírito áspero, rô e mantém ditongo unido", () => {
    expect(transliterateGreekSurface("Ἡ")?.academic).toBe("Hē");
    expect(transliterateGreekSurface("Ῥοδον")?.academic).toBe("Rhodon");
    expect(transliterateGreekSurface("αὑτός")?.academic).toBe("hautos");
  });
  it("trata gama nasal e a convenção de iota subscrito", () => {
    expect(transliterateGreekSurface("ἄγγελος")?.academic).toBe("angelos");
    expect(transliterateGreekSurface("θεῷ")?.academic).toBe("theō");
    expect(transliterateGreekSurface("θεῷ")?.notes[0]).toContain("iota subscrito");
  });
  it.each([
    ["Ἡσιόδου", "Hēsiodou"],
    ["θεῷ", "theō"],
    ["αὔπνους", "aupnous"],
    ["ἄλαστα", "alasta"],
  ])("confere exemplo ALA-LC: %s → %s", (word, expected) => {
    // Exemplos independentes da Library of Congress, tabela Greek Ancient.
    expect(transliterateGreekSurface(word)?.academic).toBe(expected);
  });
  it("normaliza Unicode e recusa entrada não suportada", () => {
    expect(transliterateGreekSurface("λόγος".normalize("NFD"))).toEqual(transliterateGreekSurface("λόγος"));
    expect(transliterateGreekSurface("בְּרֵאשִׁית")).toBeNull();
    expect(transliterateGreekSurface("λογος1")).toBeNull();
    expect(transliterateGreekSurface("⸀λόγος·")?.academic).toBe("logos");
    expect(transliterateGreekSurface("⸂[τὸ")?.academic).toBe("to");
    expect(transliterateGreekSurface("αὐτοῦ;")?.academic).toBe("autou");
    expect(transliterateGreekSurface("λαλῆσαι.⸃")?.academic).toBe("lalēsai");
    expect(transliterateGreekSurface("⸂δ᾽")?.academic).toBe("d᾽");
    expect(transliterateGreekSurface("λό⸀γος")).toBeNull();
  });
});
