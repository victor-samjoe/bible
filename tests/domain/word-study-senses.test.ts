import { describe, expect, it } from "vitest";
import type { BdbSense } from "../../src/domain/lexicon/records";
import { flattenSenses, senseOriginal, senseTreeProblems } from "../../src/domain/word-study/senses";

const hash = (text: string) => `h:${text}`;
const s = (over: Partial<BdbSense>): BdbSense => ({ number: null, stem: null, definitions: [], note: null, children: [], ...over });

const tree: BdbSense[] = [
  s({ stem: "Qal", children: [
    s({ number: "1.", definitions: ["call", "cry"], children: [s({ number: "a.", definitions: ["call"] }), s({ number: "b.", definitions: ["call"] })] }),
    s({ number: "2.", definitions: ["read"] }),
  ] }),
  s({ stem: "Niph.", children: [s({ number: "1.", definitions: ["be called"] })] }),
];

describe("acepções BDB — caminhos", () => {
  const records = flattenSenses("s.cy.aa", tree, hash);

  it("usa a posição na árvore, não o rótulo impresso", () => {
    expect(records.map((r) => r.path)).toEqual(["1", "1.1", "1.1.1", "1.1.2", "1.2", "2", "2.1"]);
  });
  it("o mesmo rótulo '1.' em troncos diferentes recebe caminhos diferentes", () => {
    expect(records.filter((r) => r.label === "1").map((r) => r.path)).toEqual(["1.1", "2.1"]);
  });
  it("acepções com o mesmo inglês em caminhos diferentes ficam separadas", () => {
    const calls = records.filter((r) => r.original === "call");
    expect(calls.map((r) => r.path)).toEqual(["1.1.1", "1.1.2"]);
  });
  it("guarda pai, profundidade, rótulo, verbete e hash do texto", () => {
    const leaf = records.find((r) => r.path === "1.1.2");
    expect(leaf).toMatchObject({ bdbId: "s.cy.aa", parent: "1.1", depth: 3, label: "b", original: "call", hash: "h:call" });
  });
  it("nível que só agrupa (tronco verbal) fica com texto vazio, sem inventar", () => {
    expect(records[0]).toMatchObject({ label: "Qal", original: "" });
  });
  it("a mesma árvore em outro verbete mantém os caminhos mas não o verbete", () => {
    const other = flattenSenses("s.cy.ab", tree, hash);
    expect(other.map((r) => r.path)).toEqual(records.map((r) => r.path));
    expect(other.every((r) => r.bdbId === "s.cy.ab")).toBe(true);
  });
  it("texto-fonte alterado muda o hash do mesmo caminho", () => {
    const changed = flattenSenses("s.cy.aa", [s({ definitions: ["call out"] })], hash);
    const before = flattenSenses("s.cy.aa", [s({ definitions: ["call"] })], hash);
    expect(changed[0].path).toBe(before[0].path);
    expect(changed[0].hash).not.toBe(before[0].hash);
  });
  it("sem árvore, sem registros", () => {
    expect(flattenSenses("x", [], hash)).toEqual([]);
  });
  it("usa a nota só quando não há definição nem filhos", () => {
    expect(senseOriginal(s({ note: "  prose   here " }))).toBe("prose here");
    expect(senseOriginal(s({ note: "prose", children: [s({})] }))).toBe("");
    expect(senseOriginal(s({ definitions: ["a", "b"], note: "n" }))).toBe("a; b");
  });
  it("detecta árvore incoerente", () => {
    expect(senseTreeProblems(records)).toEqual([]);
    expect(senseTreeProblems([records[0], records[0]])).toHaveLength(1);
    expect(senseTreeProblems([{ ...records[1], parent: "9" }])).toContain("pai ausente: s.cy.aa 1.1");
    expect(senseTreeProblems([{ ...records[0], depth: 2 }])).toContain("profundidade incoerente: 1");
  });
});
