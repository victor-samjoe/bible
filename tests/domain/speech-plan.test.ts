import { describe, expect, it } from "vitest";
import { chapterUtterances, chunkText, pickVoice, speakable } from "../../src/domain/speech/plan";

const v = (lang: string) => ({ lang, name: lang });

describe("voz — escolha", () => {
  it("hebraico só com voz hebraica, sempre aproximada", () => {
    expect(pickVoice([v("pt-BR"), v("en-US")], "hbo")).toBeNull();
    expect(pickVoice([v("en-US"), v("he-IL")], "hbo")).toEqual({ voice: v("he-IL"), approximate: true });
    expect(pickVoice([v("iw")], "hbo")?.approximate).toBe(true);
  });
  it("grego só com voz grega (moderna), aproximada; sem ela, nada", () => {
    expect(pickVoice([v("en-US"), v("pt-BR")], "grc")).toBeNull();
    expect(pickVoice([v("el-GR")], "grc")?.approximate).toBe(true);
  });
  it("português prefere pt-BR e não é aproximado", () => {
    expect(pickVoice([v("pt-PT"), v("pt-BR")], "pt")).toEqual({ voice: v("pt-BR"), approximate: false });
    expect(pickVoice([v("pt-PT")], "pt")?.voice.lang).toBe("pt-PT");
  });
  it("não confunde idiomas de prefixo parecido", () => {
    expect(pickVoice([v("hel-XX"), v("ell")], "hbo")).toBeNull();
    expect(pickVoice([v("elx")], "grc")).toBeNull();
  });
});

describe("voz — texto falável", () => {
  it("recusa vazio e marcação USFM crua", () => {
    expect(speakable("   ")).toBeNull();
    expect(speakable("\\p texto")).toBeNull();
    expect(speakable("  No   princípio ")).toBe("No princípio");
  });
});

describe("voz — trechos", () => {
  it("texto curto fica inteiro", () => {
    expect(chunkText("No princípio, Deus criou os céus e a terra.")).toEqual(["No princípio, Deus criou os céus e a terra."]);
  });
  it("junta frases até o limite e não passa dele", () => {
    const chunks = chunkText("Um dois três. Quatro cinco seis. Sete oito nove.", 20);
    expect(chunks.every((c) => c.length <= 20)).toBe(true);
    expect(chunks.join(" ")).toBe("Um dois três. Quatro cinco seis. Sete oito nove.");
  });
  it("frase sem pontuação maior que o limite é cortada em espaço", () => {
    const text = "aaaa bbbb cccc dddd eeee ffff";
    const chunks = chunkText(text, 10);
    expect(chunks.every((c) => c.length <= 10)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
  });
  it("palavra gigante sem espaço também é cortada", () => {
    expect(chunkText("x".repeat(25), 10).every((c) => c.length <= 10)).toBe(true);
  });
  it("hebraico com sof pasuq (׃) quebra no fim do versículo", () => {
    expect(chunkText("בראשית ברא אלהים׃ את השמים", 20)).toEqual(["בראשית ברא אלהים׃", "את השמים"]);
  });
});

describe("voz — capítulo", () => {
  const verses = [
    { number: 2, content: "Segundo." },
    { number: 1, content: "Primeiro." },
    { number: 3, content: "\\p marca" },
    { number: 4, content: "" },
    { number: 5, content: "Quinto." },
  ];
  it("na ordem, pulando o que não é falável, sem preencher lacuna", () => {
    expect(chapterUtterances(verses).map((u) => u.verse)).toEqual([1, 2, 5]);
  });
  it("retoma de um versículo", () => {
    expect(chapterUtterances(verses, { from: 2 }).map((u) => u.verse)).toEqual([2, 5]);
  });
  it("cada fala guarda o versículo de origem", () => {
    const out = chapterUtterances([{ number: 7, content: "Aaa bbb. Ccc ddd." }], { max: 8 });
    expect(out.every((u) => u.verse === 7)).toBe(true);
    expect(out.length).toBe(2);
  });
  it("capítulo vazio não gera falas", () => {
    expect(chapterUtterances([])).toEqual([]);
  });
});
