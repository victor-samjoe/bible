import { describe, expect, it } from "vitest";
import { transliterateHebrewSurface } from "../../src/domain/transliteration/hebrew";
import { hebrewVariantWarning } from "../../src/domain/transliteration/hebrew-variants";

describe("transliteração hebraica da forma textual", () => {
  it.each([
    ["בְּרֵאשִׁית", "bereshit", "bərēʾšît"],
    ["בָּרָא", "bara", "bārāʾ"],
    ["אֱלֹהִים", "elohim", "ʾĕlōhîm"],
    ["אֵת", "et", "ʾēt"],
    ["הַשָּׁמַיִם", "hashamayim", "haššāmayīm"],
    ["וְאֵת", "ve'et", "wəʾēt"],
    ["הָאָרֶץ", "ha'aretz", "hāʾāreṣ"],
  ])("%s: simplificada e acadêmica", (word, simplified, academic) => {
    expect(transliterateHebrewSurface(word)).toEqual({ simplified, academic, needsReview: true });
  });

  it("preserva o prefixo textual e normaliza as duas ordens Unicode", () => {
    const combined = "בְּרֵאשִׁית";
    expect(transliterateHebrewSurface(combined.normalize("NFD"))).toEqual(transliterateHebrewSurface(combined.normalize("NFC")));
    expect(transliterateHebrewSurface("בְּ/רֵאשִׁית")?.simplified).toBe("bereshit");
  });

  it.each([
    ["קָדוֹשׁ", "qādôš"],
    ["הָאָרֶץ", "hāʾāreṣ"],
    ["הָלַךְ", "hālak"],
    ["יֵשְׁבוּ", "yēšəbû"],
    ["רֹמְמוּ", "rōməmû"],
  ])("confere exemplo independente da SBL: %s → %s", (word, academic) => {
    expect(transliterateHebrewSurface(word)?.academic).toBe(academic);
  });

  it("preserva no acadêmico a forma com artigo e a forma com sufixo", () => {
    expect(transliterateHebrewSurface("לַמֶּלֶךְ")?.academic).toBe("lammelek");
    expect(transliterateHebrewSurface("בְּבֵיתוֹ")?.academic).toBe("bəbêtô");
  });

  it("não inventa leitura para texto não vocalizado ou idioma errado", () => {
    expect(transliterateHebrewSurface("בראשית")).toBeNull();
    expect(transliterateHebrewSurface("λόγος")).toBeNull();
    expect(transliterateHebrewSurface("בְּ1")).toBeNull();
  });
  it("preserva o tetragrama sem sugerir pronúncia", () => {
    expect(transliterateHebrewSurface("יְהוָה")).toEqual({ academic: "yhwh", simplified: "YHWH", needsReview: true });
  });
  it("aceita shuruq como única vogal escrita, inclusive com cantilação", () => {
    expect(transliterateHebrewSurface("כּ֥וּשׁ")?.academic).toBe("kûš");
    expect(transliterateHebrewSurface("ה֣וּא")?.academic).toBe("hûʾ");
  });
  it("sinaliza ketiv e recusa edição diferente da edição auditada", () => {
    const version = "tag v.2.2 / commit 6a5db284c715c18b239422e57bb89684e6a19f00";
    expect(hebrewVariantWarning("MORPHHB", version, "Gen 8:17", 14)).toContain("ketiv");
    expect(hebrewVariantWarning("MORPHHB", version, "Gen 8:17", 15)).toContain("qere");
    expect(hebrewVariantWarning("MORPHHB", version, "Gen 1:1", 1)).toBeNull();
    expect(hebrewVariantWarning("MORPHHB", "versão futura", "Gen 1:1", 1)).toContain("não conferida");
  });
});
