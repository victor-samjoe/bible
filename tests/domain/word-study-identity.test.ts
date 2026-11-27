import { describe, expect, it } from "vitest";

import {
  DEFAULT_IDENTITY_POLICY,
  IdentityPolicyError,
  applyPolicy,
  compareIdentities,
  identityOfLemma,
  identityOfStrong,
  identityPolicy,
  identitySortKey,
  parseStrong,
  strongLabel,
  withAugment,
} from "../../src/domain/word-study/identity";
import {
  compareRefs,
  decodeRefCode,
  formatRef,
  parseRef,
  parseRefWithPosition,
  refCode,
} from "../../src/domain/word-study/reference";

function strongOrThrow(language: "hbo" | "grc", raw: string) {
  const parsed = parseStrong(language, raw);
  if ("problem" in parsed) throw new Error(parsed.problem.reason);
  return parsed.strong;
}

describe("identidade lexical — Strong", () => {
  it("normaliza zero à esquerda, que as fontes grafam de três jeitos diferentes", () => {
    // MACULA grafa "0430", HebrewStrong "H0430", LexicalIndex "430". Se as três
    // produzissem chaves diferentes, a mesma palavra viraria três verbetes.
    for (const raw of ["0430", "H0430", "430", "H430"]) {
      expect(strongLabel(strongOrThrow("hbo", raw))).toBe("H430");
    }
  });

  it("preserva o sufixo de homógrafo, que distingue palavras e não grafias", () => {
    const a = strongOrThrow("hbo", "1254 a");
    const b = strongOrThrow("hbo", "1254b");
    expect(strongLabel(a)).toBe("H1254a");
    expect(strongLabel(b)).toBe("H1254b");
    expect(identityOfStrong(a).key).not.toBe(identityOfStrong(b).key);
  });

  it("recusa Strong de outro idioma em vez de normalizar em silêncio", () => {
    // É a diferença em relação a `strongLexemeKey`, que captura o prefixo e não
    // o usa: lá, ("hbo", "G1510") devolve `hbo:H1510`.
    const parsed = parseStrong("hbo", "G1510");
    expect("problem" in parsed).toBe(true);
    if ("problem" in parsed) {
      expect(parsed.problem.reason).toContain("prefixo");
    }
  });

  it("recusa forma inválida e número fora de faixa", () => {
    for (const raw of ["", "abc", "H", "12-34", "999999"]) {
      expect("problem" in parseStrong("hbo", raw)).toBe(true);
    }
  });
});

describe("identidade lexical — atributo aug do LexicalIndex", () => {
  it("junta strong e aug no homógrafo, que é o achado §3.1 do item 1", () => {
    // <xref bdb="b.cx.aa" strong="1254" aug="b"/> é H1254b ("engordar"), não o
    // H1254 de Gênesis 1:1 ("criar").
    const base = strongOrThrow("hbo", "1254");
    const merged = withAugment(base, "b");
    if ("problem" in merged) throw new Error(merged.problem.reason);
    expect(strongLabel(merged.strong)).toBe("H1254b");
    expect(identityOfStrong(merged.strong).key).toBe("hbo:H1254b");
  });

  it("aug ausente deixa o Strong intacto", () => {
    const base = strongOrThrow("hbo", "7225");
    for (const aug of [null, undefined, "", "  "]) {
      const merged = withAugment(base, aug);
      if ("problem" in merged) throw new Error(merged.problem.reason);
      expect(strongLabel(merged.strong)).toBe("H7225");
    }
  });

  it("recusa aug que discorda do sufixo já presente", () => {
    const withSuffix = strongOrThrow("hbo", "1254a");
    const merged = withAugment(withSuffix, "b");
    expect("problem" in merged).toBe(true);
  });

  it("aceita aug igual ao sufixo já presente", () => {
    const merged = withAugment(strongOrThrow("hbo", "1254a"), "a");
    expect("problem" in merged).toBe(false);
  });
});

describe("identidade lexical — ordenação", () => {
  it("ordena por número, não por texto: H9 antes de H10", () => {
    const nine = identityOfStrong(strongOrThrow("hbo", "9"));
    const ten = identityOfStrong(strongOrThrow("hbo", "10"));
    expect(compareIdentities(nine, ten)).toBeLessThan(0);
    // E a chave de ordenação precisa concordar comparada como texto, porque é
    // isso que o limite de partição faz.
    expect(identitySortKey(nine) < identitySortKey(ten)).toBe(true);
  });

  it("põe a palavra sem sufixo antes dos homógrafos", () => {
    const keys = ["1254", "1254a", "1254b"].map((raw) =>
      identitySortKey(identityOfStrong(strongOrThrow("hbo", raw))),
    );
    expect([...keys].sort()).toEqual(keys);
  });

  it("agrupa as identidades por lema depois de todas as por Strong", () => {
    const byStrong = identityOfStrong(strongOrThrow("hbo", "8674"));
    const byLemma = identityOfLemma("hbo", "בְּ");
    if ("problem" in byLemma) throw new Error(byLemma.problem.reason);
    expect(compareIdentities(byStrong, byLemma.identity)).toBeLessThan(0);
  });

  it("ordena uma lista embaralhada de forma total e estável", () => {
    const raws = ["8064", "430", "1254b", "853", "1254", "7225", "1254a", "10", "9"];
    const sorted = raws
      .map((raw) => identityOfStrong(strongOrThrow("hbo", raw)))
      .sort(compareIdentities)
      .map((identity) => identity.key);
    expect(sorted).toEqual([
      "hbo:H9",
      "hbo:H10",
      "hbo:H430",
      "hbo:H853",
      "hbo:H1254",
      "hbo:H1254a",
      "hbo:H1254b",
      "hbo:H7225",
      "hbo:H8064",
    ]);
  });
});

describe("identidade lexical — identidade por lema", () => {
  it("normaliza para NFC, porque hebraico vocalizado tem mais de uma forma Unicode", () => {
    const decomposed = "בְ"; // בְּ decomposto
    const result = identityOfLemma("hbo", decomposed);
    if ("problem" in result) throw new Error(result.problem.reason);
    expect(result.identity.key).toBe(`hbo:lemma:${decomposed.normalize("NFC")}`);
  });

  it("nunca colide com uma chave de Strong", () => {
    const result = identityOfLemma("hbo", "H430");
    if ("problem" in result) throw new Error(result.problem.reason);
    expect(result.identity.key).toBe("hbo:lemma:H430");
    expect(result.identity.key).not.toBe("hbo:H430");
  });

  it("recusa lema vazio", () => {
    expect("problem" in identityOfLemma("hbo", "   ")).toBe(true);
  });
});

describe("política de identidade", () => {
  it("nasce sem mapa de redução, e diz que não tem", () => {
    expect(DEFAULT_IDENTITY_POLICY.mode).toBe("strong-exact");
    expect(DEFAULT_IDENTITY_POLICY.foldMapSource).toBe(null);
    expect(DEFAULT_IDENTITY_POLICY.foldMap.size).toBe(0);
  });

  it("não reduz nada na política padrão: G2258 continua separado de G1510", () => {
    const form = identityOfStrong(strongOrThrow("grc", "2258"));
    expect(applyPolicy(DEFAULT_IDENTITY_POLICY, form).key).toBe("grc:G2258");
  });

  it("recusa mapa de redução sem procedência declarada", () => {
    expect(() =>
      identityPolicy({ mode: "strong-folded", foldMap: new Map([["grc:G2258", "grc:G1510"]]) }),
    ).toThrow(IdentityPolicyError);
  });

  it("recusa política de redução com mapa vazio", () => {
    expect(() => identityPolicy({ mode: "strong-folded" })).toThrow(IdentityPolicyError);
  });

  it("reduz forma ao lema quando o mapa tem fonte nomeada", () => {
    const policy = identityPolicy({
      mode: "strong-folded",
      foldMap: new Map([["grc:G2258", "grc:G1510"]]),
      foldMapSource: "TBESG, coluna dStrong (hipotético: hoje não é importada)",
    });
    const form = identityOfStrong(strongOrThrow("grc", "2258"));
    expect(applyPolicy(policy, form).key).toBe("grc:G1510");
  });
});

describe("referência canônica", () => {
  it("lê e reimprime a referência", () => {
    const parsed = parseRef("GEN 1:1");
    if ("problem" in parsed) throw new Error(parsed.problem.reason);
    expect(formatRef(parsed.ref)).toBe("GEN 1:1");
    expect(parsed.ref.bookOrder).toBe(1);
  });

  it("ordena 1:2 antes de 1:10, que é o defeito nomeado pelo item 4", () => {
    const refs = ["GEN 1:1", "GEN 1:10", "GEN 1:2", "GEN 2:1", "GEN 10:1", "GEN 1:11"].map(
      (raw) => {
        const parsed = parseRef(raw);
        if ("problem" in parsed) throw new Error(parsed.problem.reason);
        return parsed.ref;
      },
    );
    expect([...refs].sort(compareRefs).map(formatRef)).toEqual([
      "GEN 1:1",
      "GEN 1:2",
      "GEN 1:10",
      "GEN 1:11",
      "GEN 2:1",
      "GEN 10:1",
    ]);
  });

  it("ordena os livros pelo cânone, não pelo alfabeto", () => {
    const refs = ["ACT 1:1", "GEN 1:1", "REV 1:1", "PSA 1:1", "MAT 1:1", "JHN 1:1"].map((raw) => {
      const parsed = parseRef(raw);
      if ("problem" in parsed) throw new Error(parsed.problem.reason);
      return parsed.ref;
    });
    expect([...refs].sort(compareRefs).map(formatRef)).toEqual([
      "GEN 1:1",
      "PSA 1:1",
      "MAT 1:1",
      "JHN 1:1",
      "ACT 1:1",
      "REV 1:1",
    ]);
  });

  it("refCode é monotônico e reversível", () => {
    const first = parseRef("GEN 1:1");
    const last = parseRef("REV 22:21");
    if ("problem" in first || "problem" in last) throw new Error("fixture inválida");
    expect(refCode(first.ref)).toBeLessThan(refCode(last.ref));
    expect(decodeRefCode(refCode(last.ref))).toEqual(last.ref);
    expect(formatRef(decodeRefCode(refCode(first.ref))!)).toBe("GEN 1:1");
  });

  it("recusa livro fora do cânone, faixa, sufixo de versículo e versículo zero", () => {
    for (const raw of ["TOB 1:1", "GEN 1:1-3", "GEN 1:1a", "GEN 1:0", "GEN 0:1", "GEN 1"]) {
      expect("problem" in parseRef(raw)).toBe(true);
    }
  });

  it("lê a posição da palavra do sufixo !N", () => {
    const parsed = parseRefWithPosition("GEN 1:1!3");
    if ("problem" in parsed) throw new Error(parsed.problem.reason);
    expect(formatRef(parsed.ref)).toBe("GEN 1:1");
    expect(parsed.position).toBe(3);
  });

  it("referência sem sufixo tem posição nula, não zero", () => {
    const parsed = parseRefWithPosition("JHN 1:1");
    if ("problem" in parsed) throw new Error(parsed.problem.reason);
    expect(parsed.position).toBe(null);
  });

  it("recusa sufixo de posição fora de forma", () => {
    for (const raw of ["GEN 1:1!", "GEN 1:1!a", "GEN 1:1!0"]) {
      expect("problem" in parseRefWithPosition(raw)).toBe(true);
    }
  });
});
