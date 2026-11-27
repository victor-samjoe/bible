import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { lexiconSourceById } from "../../src/domain/lexicon/source-registry";
import {
  type IndexHeader,
  type OccurrenceInput,
  type PartitionStat,
  WORD_STUDY_INDEX_FORMAT,
  buildInvertedIndex,
  partitionLines,
  planPartitions,
  postingRefs,
} from "../../src/domain/word-study/inverted-index";
import { readMaculaOccurrences } from "../../src/domain/word-study/macula-source";
import { WORD_STUDY_VERSIFICATION } from "../../src/domain/word-study/versification";
import { createWordStudyService } from "../../src/server/word-study/service";
import { sha256Digest } from "../../src/server/word-study/runtime";
import {
  REAL_GENESIS_1_1,
  REAL_JOHN_1_1_SELECTED,
  SYNTHETIC_H853_CANONICAL_ORDER,
  SYNTHETIC_MULTIBOOK,
} from "./word-study-fixtures";

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/lexicons/${name}`, import.meta.url), "utf8");
}

/** Índice em memória, pelos módulos reais, pronto para consulta. */
function serviceFor(
  rows: readonly OccurrenceInput[],
  options: {
    readonly budget?: number;
    readonly tamper?: (body: string) => string;
    readonly digest?: boolean;
  } = {},
) {
  const built = buildInvertedIndex(rows);
  const plans = planPartitions(built.postings, { occurrenceBudget: options.budget ?? 1000 });
  const bodies = new Map<string, string>();
  const partitions: PartitionStat[] = plans.map((plan) => {
    const body = [...partitionLines(plan)].join("");
    const file = `postings-${String(plan.ordinal).padStart(4, "0")}.ndjson`;
    bodies.set(file, options.tamper ? options.tamper(body) : body);
    return {
      ordinal: plan.ordinal,
      file,
      firstKey: plan.firstKey,
      lastKey: plan.lastKey,
      firstSortKey: plan.firstSortKey,
      lastSortKey: plan.lastSortKey,
      postings: plan.postings.length,
      occurrences: plan.occurrences,
      oversized: plan.oversized,
      bytes: Buffer.byteLength(body, "utf8"),
      gzipBytes: 0,
      // Hash do corpo ORIGINAL: se `tamper` mexeu, a integridade deve falhar.
      sha256: createHash("sha256").update(body, "utf8").digest("hex"),
    };
  });
  const header: IndexHeader = {
    format: WORD_STUDY_INDEX_FORMAT,
    indexVersion: "adv01",
    identityVersion: "adv",
    identityMode: "strong-exact",
    foldMapSource: null,
    sources: [],
    coverage: built.coverage,
    limitations: [],
  };
  return createWordStudyService({
    manifest: { read: async () => ({ header, partitions }) },
    partitions: {
      read: async (file) => {
        const body = bodies.get(file);
        if (body === undefined) throw new Error(`partição desconhecida: ${file}`);
        return body;
      },
    },
    versification: WORD_STUDY_VERSIFICATION,
    digest: options.digest === false ? null : sha256Digest,
  });
}

describe("adversarial — comparação direta com a fonte (Gênesis 1:1)", () => {
  const read = readMaculaOccurrences({
    source: lexiconSourceById("macula-hebrew"),
    assetPath: "macula-hebrew-gen1-1.sample.tsv",
    assetSha256: "0".repeat(64),
    content: fixture("macula-hebrew-gen1-1.sample.tsv"),
  });

  it("lê exatamente as 11 linhas que a fonte publica, na ordem do arquivo", () => {
    expect(read.occurrences).toHaveLength(REAL_GENESIS_1_1.length);
    expect(read.occurrences.map((item) => item.sourceWordId)).toEqual(
      REAL_GENESIS_1_1.map((row) => row.sourceWordId),
    );
  });

  it("cada linha produz a chave, a referência e a posição que a fonte sustenta", () => {
    // Comparação item a item com o que o TSV literalmente traz. Nada de
    // tradução: o índice não guarda tradução, e inventar uma aqui criaria o
    // dado que o produto não pode exibir.
    read.occurrences.forEach((occurrence, index) => {
      const expected = REAL_GENESIS_1_1[index];
      if (!expected) throw new Error("fixture mais curta que a leitura");
      expect(occurrence.identity.key).toBe(expected.expectedKey);
      expect(occurrence.position).toBe(expected.position);
      expect(`${occurrence.ref.book} ${occurrence.ref.chapter}:${occurrence.ref.verse}`).toBe(
        expected.ref,
      );
    });
  });

  it("os morfemas funcionais da fonte chegam com sufixo, não arredondados", () => {
    const functional = REAL_GENESIS_1_1.filter((row) =>
      ["0871a", "1886a", "2050b"].includes(row.strongnumberx),
    );
    expect(functional).toHaveLength(4);
    for (const row of functional) {
      expect(read.occurrences.find((item) => item.sourceWordId === row.sourceWordId)?.identity.key)
        .toBe(row.expectedKey);
    }
  });
});

describe("adversarial — comparação direta com a fonte (João 1:1)", () => {
  const read = readMaculaOccurrences({
    source: lexiconSourceById("macula-greek"),
    assetPath: "macula-greek-jhn1-1.sample.tsv",
    assetSha256: "1".repeat(64),
    content: fixture("macula-greek-jhn1-1.sample.tsv"),
  });

  it("as linhas selecionadas batem com a fonte, inclusive o Strong de forma", () => {
    for (const row of REAL_JOHN_1_1_SELECTED) {
      const found = read.occurrences.find((item) => item.sourceWordId === row.sourceWordId);
      expect(found?.identity.key).toBe(row.expectedKey);
      expect(found?.position).toBe(row.position);
    }
  });

  it("os três ἦν compartilham G2258 e nenhum deles cai em G1510", () => {
    // Prova direta da cisão forma/lema: a fonte dá lemma=εἰμί e strong=2258.
    const en = REAL_JOHN_1_1_SELECTED.filter((row) => row.surface === "ἦν");
    expect(en).toHaveLength(3);
    for (const row of en) {
      expect(row.expectedKey).toBe("grc:G2258");
    }
    expect(read.occurrences.some((item) => item.identity.key === "grc:G1510")).toBe(false);
  });
});

describe("adversarial — ordem canônica em vários livros e capítulos", () => {
  it("ordena livro pelo cânone e capítulo/versículo numericamente", () => {
    const built = buildInvertedIndex(SYNTHETIC_MULTIBOOK);
    const h853 = built.postings.find((posting) => posting.identity.key === "hbo:H853");
    if (!h853) throw new Error("postagem H853 ausente");
    const refs = postingRefs(h853).map((ref) => ref.split("!")[0] ?? ref);
    expect([...new Set(refs)]).toEqual(SYNTHETIC_H853_CANONICAL_ORDER);
  });

  it("a mesma ordem sobrevive à consulta e à paginação", async () => {
    const service = serviceFor(SYNTHETIC_MULTIBOOK);
    const collected: string[] = [];
    let cursor: string | null = null;
    // Páginas de 3, até o fim: a concatenação tem de dar a ordem canônica.
    for (let guard = 0; guard < 20; guard += 1) {
      const result = await service.findUses({
        language: "hbo",
        strong: "853",
        limit: 3,
        cursor,
      });
      if (result.status !== "partial") throw new Error(`estado inesperado: ${result.status}`);
      collected.push(...result.page.groups.map((group) => group.sourceRef));
      cursor = result.page.nextCursor;
      if (cursor === null) break;
    }
    expect(collected).toEqual(SYNTHETIC_H853_CANONICAL_ORDER);
  });

  it("não repete nem perde versículo ao paginar", async () => {
    const service = serviceFor(SYNTHETIC_MULTIBOOK);
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 30; guard += 1) {
      const result = await service.findUses({ language: "hbo", strong: "853", limit: 2, cursor });
      if (result.status !== "partial") throw new Error("estado inesperado");
      seen.push(...result.page.groups.map((group) => group.sourceRef));
      cursor = result.page.nextCursor;
      if (cursor === null) break;
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(SYNTHETIC_H853_CANONICAL_ORDER.length);
  });
});

describe("adversarial — homógrafos e morfemas", () => {
  it("H1254, H1254a e H1254b não se contaminam na consulta", async () => {
    const service = serviceFor(SYNTHETIC_MULTIBOOK);
    const plain = await service.findUses({ language: "hbo", strong: "1254" });
    const withA = await service.findUses({ language: "hbo", strong: "1254a" });
    const withB = await service.findUses({ language: "hbo", strong: "1254b" });
    if (plain.status !== "partial" || withA.status !== "partial" || withB.status !== "partial") {
      throw new Error("estado inesperado");
    }
    expect(plain.page.groups.map((group) => group.sourceRef)).toEqual(["GEN 1:1"]);
    expect(withA.page.groups.map((group) => group.sourceRef)).toEqual(["GEN 1:21"]);
    expect(withB.page.groups.map((group) => group.sourceRef)).toEqual(["1SA 2:29"]);
    expect(plain.identityKey).toBe("hbo:H1254");
    expect(withA.identityKey).toBe("hbo:H1254a");
    expect(withB.identityKey).toBe("hbo:H1254b");
  });

  it("dois morfemas na mesma posição do mesmo versículo ficam ambos alcançáveis", async () => {
    const service = serviceFor(SYNTHETIC_MULTIBOOK);
    const prefix = await service.findUses({ language: "hbo", strong: "871a" });
    const stem = await service.findUses({ language: "hbo", strong: "7225" });
    if (prefix.status !== "partial" || stem.status !== "partial") {
      throw new Error("estado inesperado");
    }
    const prefixAt = prefix.page.groups.find((group) => group.sourceRef === "EXO 1:1");
    const stemAt = stem.page.groups.find((group) => group.sourceRef === "EXO 1:1");
    expect(prefixAt?.positions).toEqual([1]);
    expect(stemAt?.positions).toEqual([1]);
  });

  it("repetição no mesmo versículo preserva as duas posições num grupo só", async () => {
    const service = serviceFor(SYNTHETIC_MULTIBOOK);
    const result = await service.findUses({ language: "hbo", strong: "853" });
    if (result.status !== "partial") throw new Error("estado inesperado");
    const gen11 = result.page.groups.find((group) => group.sourceRef === "GEN 1:1");
    expect(gen11?.positions).toEqual([4, 6]);
    expect(gen11?.occurrences).toBe(2);
  });

  it("ocorrência sem posição publicada não inventa zero", async () => {
    const service = serviceFor(SYNTHETIC_MULTIBOOK);
    const result = await service.findUses({ language: "hbo", strong: "853" });
    if (result.status !== "partial") throw new Error("estado inesperado");
    const rev = result.page.groups.find((group) => group.sourceRef === "REV 22:21");
    expect(rev?.positionsUnknown).toBe(true);
    expect(rev?.positions).toEqual([]);
  });

  it("chave que é prefixo de outra não devolve a postagem errada", async () => {
    // H8, H85 e H853 convivem. O filtro textual do serviço precisa casar a
    // chave inteira, não o prefixo.
    const service = serviceFor(SYNTHETIC_MULTIBOOK);
    const h8 = await service.findUses({ language: "hbo", strong: "8" });
    const h85 = await service.findUses({ language: "hbo", strong: "85" });
    if (h8.status !== "partial" || h85.status !== "partial") throw new Error("estado inesperado");
    expect(h8.identityKey).toBe("hbo:H8");
    expect(h8.page.groups.map((group) => group.sourceRef)).toEqual(["LEV 1:2"]);
    expect(h85.identityKey).toBe("hbo:H85");
    expect(h85.page.groups.map((group) => group.sourceRef)).toEqual(["LEV 1:1"]);
  });
});

describe("adversarial — versificação divergente no caminho completo", () => {
  it("livro com regra conferida devolve a referência do leitor", async () => {
    const service = serviceFor(SYNTHETIC_MULTIBOOK);
    const result = await service.findUses({ language: "hbo", strong: "853" });
    if (result.status !== "partial") throw new Error("estado inesperado");
    const micah = result.page.groups.find((group) => group.sourceRef === "MIC 4:14");
    expect(micah?.readerRef).toBe("MIC 5:1");
    expect(micah?.versification).toBe("mapped");
  });

  it("livro com divergência declarada e sem regra volta 'unverified' e avisa", async () => {
    const service = serviceFor(SYNTHETIC_MULTIBOOK);
    const result = await service.findUses({ language: "hbo", strong: "853" });
    if (result.status !== "partial") throw new Error("estado inesperado");
    const psalm = result.page.groups.find((group) => group.sourceRef === "PSA 3:1");
    expect(psalm?.versification).toBe("unverified");
    expect(psalm?.readerRef).toBe("PSA 3:1");
    expect(result.warnings.join(" ")).toContain("PSA");
  });

  it("livro sem divergência é 'identical', que é afirmação positiva", async () => {
    const service = serviceFor(SYNTHETIC_MULTIBOOK);
    const result = await service.findUses({ language: "hbo", strong: "853" });
    if (result.status !== "partial") throw new Error("estado inesperado");
    expect(
      result.page.groups.find((group) => group.sourceRef === "GEN 1:1")?.versification,
    ).toBe("identical");
  });
});

describe("adversarial — falhas de integridade", () => {
  it("partição alterada após o hash falha fechada", async () => {
    const service = serviceFor(SYNTHETIC_MULTIBOOK, {
      tamper: (body) => body.replace("1001001", "1001002"),
    });
    const result = await service.findUses({ language: "hbo", strong: "853" });
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.reason).toContain("integridade");
  });

  it("linha que não é JSON é erro, não vazio", async () => {
    const service = serviceFor(SYNTHETIC_MULTIBOOK, {
      digest: false,
      tamper: (body) => body.replace('{"k":"hbo:H853"', '{"k":"hbo:H853"NAO-JSON'),
    });
    const result = await service.findUses({ language: "hbo", strong: "853" });
    expect(result.status).toBe("error");
  });

  it("vetor de ocorrências com valor não numérico é erro", async () => {
    const service = serviceFor(SYNTHETIC_MULTIBOOK, {
      digest: false,
      tamper: (body) =>
        body.replace(/("k":"hbo:H853","n":\d+,"r":\[)\d+/u, '$1"x"'),
    });
    const result = await service.findUses({ language: "hbo", strong: "853" });
    expect(result.status).toBe("error");
  });

  it("partição vazia devolve vazio, não erro", async () => {
    const service = serviceFor(SYNTHETIC_MULTIBOOK, { digest: false, tamper: () => "" });
    const result = await service.findUses({ language: "hbo", strong: "853" });
    expect(result.status).toBe("empty");
  });
});

describe("adversarial — reprocessar os mesmos bytes dá os mesmos hashes", () => {
  it("duas montagens da mesma entrada produzem bytes e hashes idênticos", () => {
    const hashesOf = (rows: readonly OccurrenceInput[]): readonly string[] => {
      const built = buildInvertedIndex(rows);
      return planPartitions(built.postings, { occurrenceBudget: 5 }).map((plan) =>
        createHash("sha256").update([...partitionLines(plan)].join(""), "utf8").digest("hex"),
      );
    };
    const first = hashesOf(SYNTHETIC_MULTIBOOK);
    const second = hashesOf(SYNTHETIC_MULTIBOOK);
    const shuffled = hashesOf([...SYNTHETIC_MULTIBOOK].reverse());
    expect(second).toEqual(first);
    // E a ordem de entrada não pode mudar a saída, senão o hash não versiona
    // o conteúdo, só a sorte da leitura.
    expect(shuffled).toEqual(first);
    expect(first.length).toBeGreaterThan(1);
  });

  it("o índice lido das fixtures reais tem hash estável entre execuções", () => {
    const rows = [
      ...readMaculaOccurrences({
        source: lexiconSourceById("macula-hebrew"),
        assetPath: "macula-hebrew-gen1-1.sample.tsv",
        assetSha256: "0".repeat(64),
        content: fixture("macula-hebrew-gen1-1.sample.tsv"),
      }).occurrences,
      ...readMaculaOccurrences({
        source: lexiconSourceById("macula-greek"),
        assetPath: "macula-greek-jhn1-1.sample.tsv",
        assetSha256: "1".repeat(64),
        content: fixture("macula-greek-jhn1-1.sample.tsv"),
      }).occurrences,
    ];
    const body = () =>
      planPartitions(buildInvertedIndex(rows).postings, { occurrenceBudget: 10_000 })
        .map((plan) => [...partitionLines(plan)].join(""))
        .join("");
    expect(createHash("sha256").update(body(), "utf8").digest("hex")).toBe(
      createHash("sha256").update(body(), "utf8").digest("hex"),
    );
    // Hash congelado do índice das fixtures: muda se o formato ou a leitura
    // mudarem, o que é exatamente quando se quer ser avisado.
    expect(createHash("sha256").update(body(), "utf8").digest("hex")).toBe(
      "494873b88b43c55d14773da38181793a2f9ec8147bc094aac8264524c09e899e",
    );
  });
});
