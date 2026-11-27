import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { lexiconSourceById } from "../../src/domain/lexicon/source-registry";
import {
  identityOfStrong,
  identitySortKey,
  parseStrong,
} from "../../src/domain/word-study/identity";
import {
  buildInvertedIndex,
  decodeOccurrences,
  encodeOccurrences,
  partitionForIdentity,
  partitionLines,
  planPartitions,
  postingRefs,
  type OccurrenceInput,
  type PartitionStat,
} from "../../src/domain/word-study/inverted-index";
import { readMaculaOccurrences } from "../../src/domain/word-study/macula-source";
import { parseRef } from "../../src/domain/word-study/reference";

function ref(raw: string) {
  const parsed = parseRef(raw);
  if ("problem" in parsed) throw new Error(parsed.problem.reason);
  return parsed.ref;
}

function identity(language: "hbo" | "grc", raw: string) {
  const parsed = parseStrong(language, raw);
  if ("problem" in parsed) throw new Error(parsed.problem.reason);
  return identityOfStrong(parsed.strong);
}

function input(
  strong: string,
  rawRef: string,
  position: number | null,
  sourceWordId: string,
  language: "hbo" | "grc" = "hbo",
): OccurrenceInput {
  return { identity: identity(language, strong), ref: ref(rawRef), position, sourceWordId };
}

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/lexicons/${name}`, import.meta.url), "utf8");
}

describe("índice invertido — construção", () => {
  it("agrupa ocorrências do mesmo versículo sem perder as posições", () => {
    // אֵת aparece duas vezes em Gênesis 1:1, posições 4 e 6.
    const built = buildInvertedIndex([
      input("853", "GEN 1:1", 4, "w1"),
      input("853", "GEN 1:1", 6, "w2"),
    ]);
    expect(built.postings).toHaveLength(1);
    expect(built.postings[0]?.occurrences).toHaveLength(2);
    expect(postingRefs(built.postings[0]!)).toEqual(["GEN 1:1!4", "GEN 1:1!6"]);
  });

  it("ordena as ocorrências canonicamente, e por posição dentro do versículo", () => {
    const built = buildInvertedIndex([
      input("1", "GEN 1:10", 1, "d"),
      input("1", "GEN 1:2", 2, "b"),
      input("1", "GEN 1:2", 1, "a"),
      input("1", "ACT 1:1", 1, "e"),
      input("1", "GEN 2:1", 1, "c"),
    ]);
    expect(postingRefs(built.postings[0]!)).toEqual([
      "GEN 1:2!1",
      "GEN 1:2!2",
      "GEN 1:10!1",
      "GEN 2:1!1",
      "ACT 1:1!1",
    ]);
  });

  it("mantém homógrafos separados", () => {
    const built = buildInvertedIndex([
      input("1254", "GEN 1:1", 2, "w1"),
      input("1254b", "1SA 2:29", 9, "w2"),
    ]);
    expect(built.postings.map((posting) => posting.identity.key)).toEqual([
      "hbo:H1254",
      "hbo:H1254b",
    ]);
  });

  it("deduplica por identificador da fonte e relata a duplicata", () => {
    const built = buildInvertedIndex([
      input("853", "GEN 1:1", 4, "w1"),
      input("853", "GEN 1:1", 4, "w1"),
    ]);
    expect(built.coverage.occurrences).toBe(1);
    expect(built.problems).toHaveLength(1);
    expect(built.problems[0]?.reason).toContain("repetido");
  });

  it("conta cobertura e nomeia os livros ausentes", () => {
    const built = buildInvertedIndex([input("853", "GEN 1:1", 4, "w1")]);
    expect(built.coverage.booksPresent).toEqual(["GEN"]);
    expect(built.coverage.booksAbsent).toHaveLength(65);
    expect(built.coverage.booksAbsent[0]).toBe("EXO");
    expect(built.coverage.refsPresent).toBe(1);
  });

  it("é determinístico: ordem de entrada não muda a saída", () => {
    const rows = [
      input("8064", "GEN 1:1", 5, "a"),
      input("430", "GEN 1:1", 3, "b"),
      input("853", "GEN 1:1", 6, "c"),
      input("853", "GEN 1:1", 4, "d"),
    ];
    const forward = [...partitionLines(planPartitions(buildInvertedIndex(rows).postings, { occurrenceBudget: 10 })[0]!)].join("");
    const backward = [...partitionLines(planPartitions(buildInvertedIndex([...rows].reverse()).postings, { occurrenceBudget: 10 })[0]!)].join("");
    expect(forward).toBe(backward);
  });
});

describe("índice invertido — codificação por delta", () => {
  it("vai e volta sem perda", () => {
    const occurrences = [
      { ref: ref("GEN 1:1"), position: 4 },
      { ref: ref("GEN 1:1"), position: 6 },
      { ref: ref("GEN 1:10"), position: null },
      { ref: ref("REV 22:21"), position: 3 },
    ];
    const encoded = encodeOccurrences(occurrences);
    expect(decodeOccurrences(encoded)).toEqual(occurrences);
  });

  it("usa delta zero para duas ocorrências no mesmo versículo", () => {
    const encoded = encodeOccurrences([
      { ref: ref("GEN 1:1"), position: 4 },
      { ref: ref("GEN 1:1"), position: 6 },
    ]);
    // [refCode absoluto, 4, delta 0, 6]
    expect(encoded).toEqual([1_001_001, 4, 0, 6]);
  });

  it("posição nula vira zero, que é inequívoco porque posição real começa em 1", () => {
    const encoded = encodeOccurrences([{ ref: ref("GEN 1:1"), position: null }]);
    expect(encoded).toEqual([1_001_001, 0]);
    expect(decodeOccurrences(encoded)?.[0]?.position).toBe(null);
  });

  it("recusa vetor de comprimento ímpar", () => {
    expect(decodeOccurrences([1_001_001, 4, 0])).toBe(null);
  });
});

describe("índice invertido — partição", () => {
  function many(strong: string, count: number, offset: number): readonly OccurrenceInput[] {
    return Array.from({ length: count }, (_unused, index) =>
      input(strong, `GEN 1:${index + 1}`, 1, `w${offset + index}`),
    );
  }

  it("nunca parte uma postagem entre partições", () => {
    const built = buildInvertedIndex([
      ...many("1", 4, 0),
      ...many("2", 4, 100),
      ...many("3", 4, 200),
    ]);
    const plans = planPartitions(built.postings, { occurrenceBudget: 5 });
    expect(plans.length).toBeGreaterThan(1);
    for (const plan of plans) {
      const total = plan.postings.reduce((sum, posting) => sum + posting.occurrences.length, 0);
      expect(total).toBe(plan.occurrences);
    }
    // Cada identidade aparece em exatamente uma partição.
    const keys = plans.flatMap((plan) => plan.postings.map((posting) => posting.identity.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(3);
  });

  it("dá partição própria, declarada, à postagem maior que o orçamento", () => {
    const built = buildInvertedIndex([...many("1", 2, 0), ...many("2", 9, 100)]);
    const plans = planPartitions(built.postings, { occurrenceBudget: 5 });
    const oversized = plans.filter((plan) => plan.oversized);
    expect(oversized).toHaveLength(1);
    expect(oversized[0]?.postings).toHaveLength(1);
    expect(oversized[0]?.postings[0]?.identity.key).toBe("hbo:H2");
  });

  it("recusa orçamento inválido", () => {
    expect(() => planPartitions([], { occurrenceBudget: 0 })).toThrow();
    expect(() => planPartitions([], { occurrenceBudget: -1 })).toThrow();
  });

  it("encontra a partição certa de H9 e H10, que uma busca por texto erraria", () => {
    const built = buildInvertedIndex([
      input("9", "GEN 1:1", 1, "a"),
      input("10", "GEN 1:2", 1, "b"),
      input("8064", "GEN 1:3", 1, "c"),
    ]);
    const plans = planPartitions(built.postings, { occurrenceBudget: 1 });
    const stats: PartitionStat[] = plans.map((plan) => ({
      ordinal: plan.ordinal,
      file: `p${plan.ordinal}.ndjson`,
      firstKey: plan.firstKey,
      lastKey: plan.lastKey,
      firstSortKey: plan.firstSortKey,
      lastSortKey: plan.lastSortKey,
      postings: plan.postings.length,
      occurrences: plan.occurrences,
      oversized: plan.oversized,
      bytes: 0,
      gzipBytes: 0,
      sha256: "",
    }));
    const nine = partitionForIdentity(stats, identity("hbo", "9"));
    const ten = partitionForIdentity(stats, identity("hbo", "10"));
    expect(nine?.firstKey).toBe("hbo:H9");
    expect(ten?.firstKey).toBe("hbo:H10");
    expect(nine?.ordinal).not.toBe(ten?.ordinal);
  });

  it("devolve nulo para identidade fora do índice, que é resposta e não erro", () => {
    const built = buildInvertedIndex([input("853", "GEN 1:1", 4, "a")]);
    const plan = planPartitions(built.postings, { occurrenceBudget: 10 })[0]!;
    const stats: PartitionStat[] = [
      {
        ordinal: 0,
        file: "p0.ndjson",
        firstKey: plan.firstKey,
        lastKey: plan.lastKey,
        firstSortKey: plan.firstSortKey,
        lastSortKey: plan.lastSortKey,
        postings: 1,
        occurrences: 1,
        oversized: false,
        bytes: 0,
        gzipBytes: 0,
        sha256: "",
      },
    ];
    expect(partitionForIdentity(stats, identity("hbo", "7225"))).toBe(null);
  });

  it("os limites de ordenação cobrem o intervalo das chaves da partição", () => {
    const built = buildInvertedIndex([
      input("9", "GEN 1:1", 1, "a"),
      input("430", "GEN 1:2", 1, "b"),
      input("8064", "GEN 1:3", 1, "c"),
    ]);
    const plan = planPartitions(built.postings, { occurrenceBudget: 10 })[0]!;
    for (const posting of plan.postings) {
      const sortKey = identitySortKey(posting.identity);
      expect(sortKey >= plan.firstSortKey).toBe(true);
      expect(sortKey <= plan.lastSortKey).toBe(true);
    }
  });
});

describe("leitura do MACULA — fixtures reais de Gênesis 1:1 e João 1:1", () => {
  const hebrew = readMaculaOccurrences({
    source: lexiconSourceById("macula-hebrew"),
    assetPath: "macula-hebrew-gen1-1.sample.tsv",
    assetSha256: "0".repeat(64),
    content: fixture("macula-hebrew-gen1-1.sample.tsv"),
  });
  const greek = readMaculaOccurrences({
    source: lexiconSourceById("macula-greek"),
    assetPath: "macula-greek-jhn1-1.sample.tsv",
    assetSha256: "1".repeat(64),
    content: fixture("macula-greek-jhn1-1.sample.tsv"),
  });

  it("lê as 11 linhas morfêmicas de Gênesis 1:1 sem perder nenhuma", () => {
    expect(hebrew.tally.accepted).toBe(11);
    expect(hebrew.tally.badRef).toBe(0);
    expect(hebrew.tally.badStrong).toBe(0);
    expect(hebrew.language).toBe("hbo");
  });

  it("lê as 17 palavras de João 1:1", () => {
    expect(greek.tally.accepted).toBe(17);
    expect(greek.language).toBe("grc");
  });

  it("preserva o Strong aumentado dos morfemas funcionais", () => {
    const keys = hebrew.occurrences.map((occurrence) => occurrence.identity.key);
    // Preposição בְּ, artigo הַ e conjunção וְ: sufixo preservado.
    expect(keys).toContain("hbo:H871a");
    expect(keys).toContain("hbo:H1886a");
    expect(keys).toContain("hbo:H2050b");
  });

  it("devolve duas posições para a palavra 1 de Gênesis 1:1, porque a fonte é morfêmica", () => {
    const first = hebrew.occurrences.filter((occurrence) => occurrence.position === 1);
    expect(first).toHaveLength(2);
    expect(first.map((occurrence) => occurrence.identity.key).sort()).toEqual([
      "hbo:H7225",
      "hbo:H871a",
    ]);
  });

  it("credita a fonte com licença, pino e atribuição", () => {
    expect(hebrew.attribution.sourceId).toBe("macula-hebrew");
    expect(hebrew.attribution.licenseDeclared).toContain("CC BY 4.0");
    expect(hebrew.attribution.pin).toContain("commit");
    expect(hebrew.attribution.attribution).toContain("Clear Bible");
  });

  it("relata as colunas que o registro não declara, em vez de sumir com elas", () => {
    // O MACULA Hebrew traz 32 colunas e o registro declara 13.
    expect(hebrew.ignoredFields.length).toBeGreaterThan(0);
    expect(hebrew.ignoredFields).toContain("lang");
  });

  it("no índice, as três ocorrências de ἦν ficam sob G2258, separadas de εἰμί", () => {
    // É a limitação §3.2 tornada visível: o lema εἰμί é G1510 e não aparece.
    const built = buildInvertedIndex([...greek.occurrences]);
    const byKey = new Map(built.postings.map((posting) => [posting.identity.key, posting]));
    expect(byKey.get("grc:G2258")?.occurrences).toHaveLength(3);
    expect(byKey.has("grc:G1510")).toBe(false);
  });

  it("o índice reunido cobre os dois livros e nenhum outro", () => {
    const built = buildInvertedIndex([...hebrew.occurrences, ...greek.occurrences]);
    expect(built.coverage.booksPresent).toEqual(["GEN", "JHN"]);
    expect(built.coverage.occurrences).toBe(28);
    expect(built.coverage.languages).toEqual(["grc", "hbo"]);
    expect(built.problems).toEqual([]);
  });
});
