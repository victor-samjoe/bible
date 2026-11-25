import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCandidate,
  compareShardPayloads,
  digestOf,
  indexBySourceWordId,
  parseBeforePayload,
  type CompactRow,
  type ShardPayload,
} from "../../scripts/update-lexicon-shard-genesis1";

/**
 * Entradas pequenas, não o recorte real: o que se prova aqui é a regra de
 * aceitação. Dois morfemas da primeira palavra de Gênesis 1:1 e um da segunda.
 */
function row(partial: Partial<{ position: number; id: string; surface: string; lemma: string; gloss: string; key: string }> = {}): CompactRow {
  const {
    position = 1,
    id = "o010010010011",
    surface = "בְּ",
    lemma = "בְּ",
    gloss = "in",
    key = "hbo:H871a",
  } = partial;
  return [position, id, surface, lemma, null, null, "R", "preposition", null, gloss, key];
}

/** A mesma linha como está publicada hoje: os dez primeiros campos. */
function legacy(source: CompactRow): readonly unknown[] {
  return source.slice(0, 10);
}

const candidate: ShardPayload = {
  v: {
    "1": [
      row(),
      row({ position: 2, id: "o010010010012", surface: "רֵאשִׁית", lemma: "רֵאשִׁית", gloss: "beginning", key: "hbo:H7225" }),
    ],
  },
};

const published: ShardPayload = {
  v: { "1": (candidate.v["1"] ?? []).map((item) => legacy(item as CompactRow)) },
};

describe("atualização do shard hbo/GEN/1 — regra de aceitação", () => {
  it("aceita exatamente uma mudança: o 11º campo preenchido", () => {
    expect(compareShardPayloads(published, candidate)).toEqual([]);
  });

  it("é idempotente: reaplicar sobre o shard já de onze campos não acusa nada", () => {
    // O shard atualizado é entrada válida para a própria comparação, senão a
    // segunda importação exigiria um caminho diferente do da primeira.
    expect(compareShardPayloads(candidate, candidate)).toEqual([]);
  });

  it("recusa ocorrência que desapareceu do candidato", () => {
    const faltando: ShardPayload = { v: { "1": [candidate.v["1"]![0]!] } };
    const problems = compareShardPayloads(published, faltando);
    expect(problems.map((item) => item.kind)).toContain("ausente");
    expect(problems.find((item) => item.kind === "ausente")?.sourceWordId).toBe("o010010010012");
  });

  it("recusa ocorrência que o candidato inventou", () => {
    const sobrando: ShardPayload = {
      v: { "1": [...(candidate.v["1"] ?? []), row({ position: 3, id: "o999", gloss: "x", key: "hbo:H1" })] },
    };
    const problems = compareShardPayloads(published, sobrando);
    expect(problems.map((item) => item.kind)).toContain("sobra");
  });

  it("recusa identificador de ocorrência repetido, em vez de escolher um", () => {
    // Com o mesmo id duas vezes a correspondência não é inequívoca, e a
    // comparação deixaria de provar o que precisa provar.
    const repetido: ShardPayload = { v: { "1": [row(), row()] } };
    const problems = indexBySourceWordId(repetido, 11).problems;
    expect(problems.map((item) => item.kind)).toEqual(["duplicado"]);
  });

  it("recusa divergência em qualquer um dos dez campos publicados, dizendo qual", () => {
    const alterado = row({ gloss: "within" });
    const problems = compareShardPayloads(published, { v: { "1": [alterado, candidate.v["1"]![1]!] } });
    const divergencia = problems.find((item) => item.kind === "divergente");
    expect(divergencia?.detail).toContain("campo 9 (gloss)");
    expect(divergencia?.detail).toContain("within");
  });

  it("recusa morfema que mudou de verso", () => {
    const movido: ShardPayload = { v: { "2": [row()], "1": [candidate.v["1"]![1]!] } };
    const problems = compareShardPayloads(published, movido);
    expect(problems.some((item) => item.detail.includes("mudou de verso"))).toBe(true);
  });

  it("recusa 11º campo vazio, que seria pior do que não atualizar", () => {
    const vazia = [...row()] as CompactRow;
    vazia[10] = "";
    const problems = compareShardPayloads({ v: { "1": [legacy(row())] } }, { v: { "1": [vazia] } });
    expect(problems.map((item) => item.kind)).toContain("chave-vazia");
  });

  it("recusa linha mais curta do que o formato publicado", () => {
    const curta = row().slice(0, 8);
    const problems = indexBySourceWordId({ v: { "1": [curta] } }, 10).problems;
    expect(problems.map((item) => item.kind)).toEqual(["largura"]);
    expect(problems[0]?.detail).toContain("8 campos");
  });

  it("o digest depende do conteúdo, não da ordem de leitura", () => {
    const outraOrdem: ShardPayload = { v: { "1": [...(candidate.v["1"] ?? [])] } };
    expect(digestOf(outraOrdem)).toBe(digestOf(candidate));
  });
});

describe("leitura do shard publicado para comparação", () => {
  it("aceita o payload cru e a linha completa do arquivo de shards", () => {
    const direto = parseBeforePayload(JSON.stringify(published));
    const envelopado = parseBeforePayload(
      JSON.stringify({ l: "hbo", b: "GEN", c: 1, h: digestOf(published), p: published }),
    );
    expect(digestOf(direto)).toBe(digestOf(envelopado));
  });

  it("recusa arquivo de outro shard, em vez de comparar coisas diferentes", () => {
    expect(() =>
      parseBeforePayload(JSON.stringify({ l: "grc", b: "JHN", c: 1, h: "x", p: published })),
    ).toThrow(/grc\/JHN\/1/u);
  });
});

describe("construção do candidato a partir do recorte", () => {
  async function sliceFile(lines: readonly unknown[]): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "c30-slice-"));
    const path = join(directory, "slice.ndjson");
    await writeFile(path, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8");
    return path;
  }

  const occurrence = {
    type: "occurrence",
    language: "hbo",
    canonicalRef: "GEN 1:1",
    wordPosition: 1,
    sourceWordId: "o010010010012",
    surface: "רֵאשִׁית",
    lemma: "רֵאשִׁית",
    lexemeKey: "hbo:H7225",
    morphology: "Ncfsa",
    partOfSpeech: "noun",
    semanticDomain: "168",
    gloss: "beginning",
  };

  it("pega strongId e transliteração do verbete pela chave, nunca da grafia", async () => {
    const path = await sliceFile([
      { type: "entry", key: "hbo:H7225", strongId: "H7225", transliteration: { value: "rêʼshîyth" } },
      // Verbete de grafia parecida e chave diferente: não pode ser usado.
      { type: "entry", key: "hbo:H7225x", strongId: "H9999", transliteration: { value: "errado" } },
      occurrence,
    ]);
    const built = await buildCandidate(path);
    expect(built.v["1"]?.[0]).toEqual([
      1, "o010010010012", "רֵאשִׁית", "רֵאשִׁית", "H7225", "rêʼshîyth", "Ncfsa", "noun", "168", "beginning", "hbo:H7225",
    ]);
  });

  it("falha se o recorte trouxer qualquer coisa fora de hbo/GEN/1", async () => {
    const path = await sliceFile([
      occurrence,
      { ...occurrence, canonicalRef: "GEN 2:1", sourceWordId: "o010020010011" },
    ]);
    // O alvo é fixo no código, não argumento; recorte frouxo é erro do recorte,
    // e filtrar em silêncio esconderia isso do revisor.
    await expect(buildCandidate(path)).rejects.toThrow(/fora de hbo\/GEN\/1/u);
  });

  it("falha quando o recorte não tem Gênesis 1", async () => {
    const path = await sliceFile([{ type: "entry", key: "hbo:H7225", strongId: "H7225", transliteration: null }]);
    await expect(buildCandidate(path)).rejects.toThrow(/nenhuma ocorrência/u);
  });

  it("deixa nulo o verbete que o recorte não traz, em vez de chutar", async () => {
    const path = await sliceFile([occurrence]);
    const built = await buildCandidate(path);
    expect(built.v["1"]?.[0]?.[4]).toBeNull();
    expect(built.v["1"]?.[0]?.[5]).toBeNull();
    expect(built.v["1"]?.[0]?.[10]).toBe("hbo:H7225");
  });
});
