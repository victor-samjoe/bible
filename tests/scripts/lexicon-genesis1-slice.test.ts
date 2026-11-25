import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SCOPE,
  glossSubject,
  inScope,
  isAugmentedStrongKey,
  ndjson,
  selectionFor,
  validateSlice,
} from "../../scripts/build-lexicon-genesis1-slice.mjs";
import { glossSubjectKey } from "../../src/domain/lexicon/translation-store";

async function ndjsonFile(lines: readonly unknown[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "c30-recorte-"));
  const path = join(directory, "entrada.ndjson");
  await writeFile(path, `${lines.map((line) => (typeof line === "string" ? line : JSON.stringify(line))).join("\n")}\n`, "utf8");
  return path;
}

async function collect(path: string): Promise<unknown[]> {
  const found: unknown[] = [];
  for await (const [record] of ndjson(path)) found.push(record);
  return found;
}

describe("limite do recorte", () => {
  it("aceita só o capítulo alvo, e não confunde capítulo com verso", () => {
    expect(inScope("GEN 1:1")).toBe(true);
    expect(inScope("GEN 1:31")).toBe(true);
    // GEN 12:1 começa com os mesmos caracteres que "GEN 1"; um recorte por
    // prefixo de texto levaria o capítulo 12 inteiro.
    expect(inScope("GEN 12:1")).toBe(false);
    expect(inScope("GEN 2:1")).toBe(false);
    expect(inScope("EXO 1:1")).toBe(false);
    expect(inScope("GEN 1:1a")).toBe(false);
    expect(inScope(undefined as unknown as string)).toBe(false);
  });

  it("distingue Strong aumentado, que legitimamente não tem verbete", () => {
    expect(isAugmentedStrongKey("hbo:H871a")).toBe(true);
    expect(isAugmentedStrongKey("grc:G1234b")).toBe(true);
    expect(isAugmentedStrongKey("hbo:H7225")).toBe(false);
    expect(isAugmentedStrongKey("hbo:H871ab")).toBe(false);
  });

  it("o formato do sujeito de glossa é o mesmo do domínio", () => {
    // Este arquivo é .mjs e não importa TypeScript, então o formato está
    // duplicado. Se as duas implementações divergirem, a tradução deixa de ser
    // encontrada em silêncio — e este teste falha antes disso.
    for (const [language, gloss] of [
      ["hbo", "in"],
      ["hbo", "  beginning  "],
      ["grc", "ἐν"],
      ["hbo", "the earth"],
    ] as const) {
      expect(glossSubject(language, gloss)).toBe(glossSubjectKey(language, gloss));
    }
  });

  it("seleciona verbete, BDB e ponte por alcance, não por tipo", () => {
    const include = selectionFor({ lexemeKeys: new Set(["hbo:H7225"]), bdbIds: new Set(["t.ad.ag"]) });
    expect(include({ type: "occurrence", canonicalRef: "GEN 1:1" })).toBe(true);
    expect(include({ type: "occurrence", canonicalRef: "GEN 2:1" })).toBe(false);
    expect(include({ type: "entry", key: "hbo:H7225" })).toBe(true);
    expect(include({ type: "entry", key: "hbo:H9999" })).toBe(false);
    expect(include({ type: "bdb", bdbId: "t.ad.ag" })).toBe(true);
    expect(include({ type: "bdb", bdbId: "b.cx.aa" })).toBe(false);
    // A ponte exige as duas pontas dentro do recorte.
    expect(include({ type: "bdb_link", lexemeKey: "hbo:H7225", bdbId: "t.ad.ag" })).toBe(true);
    expect(include({ type: "bdb_link", lexemeKey: "hbo:H7225", bdbId: "b.cx.aa" })).toBe(false);
    expect(include({ type: "bdb_link", lexemeKey: "hbo:H1", bdbId: "t.ad.ag" })).toBe(false);
    // Tipo desconhecido não entra por omissão.
    expect(include({ type: "sdbh_domain", id: "x" })).toBe(false);
  });
});

describe("validação do recorte", () => {
  const base = {
    occurrences: 2,
    lexemeKeys: new Set(["hbo:H7225", "hbo:H871a"]),
    entryKeys: new Set(["hbo:H7225"]),
    bdbIds: new Set(["t.ad.ag"]),
    linkPairs: [["hbo:H7225", "t.ad.ag"]] as [string, string][],
    subjects: new Set(["gloss:hbo:beginning"]),
    translationSubjects: ["gloss:hbo:beginning"],
  };

  it("aprova o caso bom, com chave aumentada sem verbete", () => {
    // hbo:H871a não tem verbete e isso é esperado, não defeito.
    expect(validateSlice(base)).toEqual([]);
  });

  it("reprova recorte vazio em vez de produzir arquivo vazio", () => {
    expect(validateSlice({ ...base, occurrences: 0 })[0]).toMatch(/nenhuma ocorrência/u);
  });

  it("reprova chave sem verbete quando o Strong não é aumentado", () => {
    const problems = validateSlice({
      ...base,
      lexemeKeys: new Set(["hbo:H7225", "hbo:H9999"]),
    });
    expect(problems.join(" ")).toMatch(/sem verbete e sem Strong aumentado/u);
    expect(problems.join(" ")).toContain("hbo:H9999");
  });

  it("reprova ponte do BDB apontando para verbete ausente", () => {
    const problems = validateSlice({ ...base, linkPairs: [["hbo:H7225", "x.yz.aa"]] });
    expect(problems.join(" ")).toMatch(/verbete do BDB ausente/u);
  });

  it("reprova ponte que parte de lema fora do recorte", () => {
    const problems = validateSlice({
      ...base,
      bdbIds: new Set(["t.ad.ag", "b.cx.aa"]),
      linkPairs: [["hbo:H5000", "b.cx.aa"]],
    });
    expect(problems.join(" ")).toMatch(/não ocorre em GEN 1/u);
  });

  it("reprova tradução de sujeito inalcançável", () => {
    // Levaria para o banco texto que nenhuma palavra do recorte exibe.
    const problems = validateSlice({ ...base, translationSubjects: ["gloss:hbo:nowhere"] });
    expect(problems.join(" ")).toMatch(/sujeito inalcançável/u);
    expect(problems.join(" ")).toContain("gloss:hbo:nowhere");
  });

  it("aceita tradução cujo sujeito é a própria chave de lema", () => {
    expect(validateSlice({ ...base, translationSubjects: ["hbo:H7225"] })).toEqual([]);
  });

  it("acumula os problemas em vez de parar no primeiro", () => {
    const problems = validateSlice({
      ...base,
      occurrences: 0,
      lexemeKeys: new Set(["hbo:H9999"]),
      linkPairs: [["hbo:H7225", "x.yz.aa"]],
      translationSubjects: ["gloss:hbo:nowhere"],
    });
    expect(problems.length).toBeGreaterThanOrEqual(4);
  });
});

describe("leitura de NDJSON", () => {
  it("diz em qual linha o JSON é inválido", async () => {
    const path = await ndjsonFile([
      { type: "entry", key: "hbo:H7225" },
      "{ isto não é json",
    ]);
    // Sem o número da linha, um índice de 564 MB com um byte ruim é
    // praticamente indepurável.
    await expect(collect(path)).rejects.toThrow(/linha 2/u);
  });

  it("ignora linha em branco sem contá-la como registro", async () => {
    const path = await ndjsonFile([{ type: "entry", key: "a" }, "", "   ", { type: "entry", key: "b" }]);
    expect(await collect(path)).toHaveLength(2);
  });
});

describe("alvo do recorte", () => {
  it("é definido em um só lugar", () => {
    expect(SCOPE).toEqual({ bookCode: "GEN", chapter: 1 });
  });
});

describe("o importador confere o arquivo contra o recorte declarado", () => {
  it("conta as ocorrências de dentro e recusa as de fora, com exemplos", async () => {
    const path = await ndjsonFile([
      { type: "occurrence", canonicalRef: "GEN 1:1" },
      { type: "occurrence", canonicalRef: "GEN 1:2" },
      { type: "occurrence", canonicalRef: "GEN 2:1" },
      { type: "entry", key: "hbo:H7225" },
    ]);
    const { occurrencesOutsideScope } = await import("../../scripts/import-lexicon-index");
    const result = await occurrencesOutsideScope(path, "GEN 1:");
    expect(result.inScope).toBe(2);
    expect(result.total).toBe(1);
    expect(result.examples).toEqual(["GEN 2:1"]);
  });

  it("aprova o arquivo que só tem o recorte", async () => {
    const path = await ndjsonFile([{ type: "occurrence", canonicalRef: "GEN 1:31" }]);
    const { occurrencesOutsideScope } = await import("../../scripts/import-lexicon-index");
    expect((await occurrencesOutsideScope(path, "GEN 1:")).total).toBe(0);
  });

  it("os dois-pontos do recorte são o que separa o capítulo 1 do 12", async () => {
    const path = await ndjsonFile([{ type: "occurrence", canonicalRef: "GEN 12:1" }]);
    const { occurrencesOutsideScope } = await import("../../scripts/import-lexicon-index");
    // "GEN 1:" rejeita GEN 12:1; "GEN 1" sem os dois-pontos o aceitaria, e é
    // por isso que o recorte é escrito com eles.
    expect((await occurrencesOutsideScope(path, "GEN 1:")).total).toBe(1);
    expect((await occurrencesOutsideScope(path, "GEN 1")).total).toBe(0);
  });
});
