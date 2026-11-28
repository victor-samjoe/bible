import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  identityOfStrong,
  parseStrong,
} from "../../src/domain/word-study/identity";
import {
  type IndexHeader,
  type OccurrenceInput,
  type PartitionStat,
  WORD_STUDY_INDEX_FORMAT,
  buildInvertedIndex,
  partitionLines,
  planPartitions,
} from "../../src/domain/word-study/inverted-index";
import { parseRef } from "../../src/domain/word-study/reference";
import { WORD_STUDY_VERSIFICATION } from "../../src/domain/word-study/versification";
import {
  type IndexManifest,
  type ManifestPort,
  type PartitionPort,
  createWordStudyService,
} from "../../src/server/word-study/service";
import {
  PartitionAccessError,
  createFileManifestPort,
  createFilePartitionPort,
  sha256Digest,
} from "../../src/server/word-study/runtime";

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

function occurrence(
  strong: string,
  rawRef: string,
  position: number | null,
  id: string,
  language: "hbo" | "grc" = "hbo",
): OccurrenceInput {
  return { identity: identity(language, strong), ref: ref(rawRef), position, sourceWordId: id };
}

/** Constrói manifesto e partições em memória, com os módulos reais. */
function buildIndex(
  rows: readonly OccurrenceInput[],
  options: { readonly budget?: number; readonly limitations?: readonly string[] } = {},
): { readonly manifest: IndexManifest; readonly bodies: ReadonlyMap<string, string> } {
  const built = buildInvertedIndex(rows);
  const plans = planPartitions(built.postings, { occurrenceBudget: options.budget ?? 1000 });
  const bodies = new Map<string, string>();
  const partitions: PartitionStat[] = plans.map((plan) => {
    const body = [...partitionLines(plan)].join("");
    const file = `postings-${String(plan.ordinal).padStart(4, "0")}.ndjson`;
    bodies.set(file, body);
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
      sha256: createHash("sha256").update(body, "utf8").digest("hex"),
    };
  });
  const header: IndexHeader = {
    format: WORD_STUDY_INDEX_FORMAT,
    indexVersion: "teste01",
    identityVersion: "teste",
    identityMode: "strong-exact",
    foldMapSource: null,
    sources: [
      {
        sourceId: "macula-hebrew",
        assetPath: "macula-hebrew.tsv",
        assetSha256: "a".repeat(64),
        pin: "commit abc",
        licenseDeclared: "CC BY 4.0",
        attribution: "Clear Bible, Inc.",
      },
    ],
    coverage: built.coverage,
    limitations: options.limitations ?? [],
  };
  return { manifest: { header, partitions }, bodies };
}

function portsFor(index: { manifest: IndexManifest; bodies: ReadonlyMap<string, string> }): {
  manifest: ManifestPort;
  partitions: PartitionPort;
} {
  return {
    manifest: { read: async () => index.manifest },
    partitions: {
      read: async (file) => {
        const body = index.bodies.get(file);
        if (body === undefined) throw new Error(`partição desconhecida: ${file}`);
        return body;
      },
    },
  };
}

/** Índice que cobre os 66 livros, para que `exhaustive` seja verdadeiro. */
function wholeCanonRows(): readonly OccurrenceInput[] {
  const books = [
    "GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI","1CH","2CH","EZR",
    "NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER","LAM","EZK","DAN","HOS","JOL","AMO",
    "OBA","JON","MIC","NAM","HAB","ZEP","HAG","ZEC","MAL","MAT","MRK","LUK","JHN","ACT","ROM",
    "1CO","2CO","GAL","EPH","PHP","COL","1TH","2TH","1TI","2TI","TIT","PHM","HEB","JAS","1PE",
    "2PE","1JN","2JN","3JN","JUD","REV",
  ];
  return books.map((book, index) => occurrence("1", `${book} 1:1`, 1, `canon${index}`));
}

describe("serviço de usos — entrada inválida é estado próprio", () => {
  const service = createWordStudyService({
    ...portsFor(buildIndex([occurrence("853", "GEN 1:1", 4, "a")])),
    versification: WORD_STUDY_VERSIFICATION,
    digest: sha256Digest,
  });

  it("recusa idioma não suportado", async () => {
    const result = await service.findUses({ language: "lat", strong: "1" });
    expect(result.status).toBe("invalid_query");
  });

  it("recusa Strong e lema ao mesmo tempo, e nenhum dos dois", async () => {
    expect((await service.findUses({ language: "hbo", strong: "1", lemma: "x" })).status).toBe(
      "invalid_query",
    );
    expect((await service.findUses({ language: "hbo" })).status).toBe("invalid_query");
  });

  it("recusa Strong de outro idioma, limite acima do máximo e cursor inválido", async () => {
    expect((await service.findUses({ language: "hbo", strong: "G1510" })).status).toBe(
      "invalid_query",
    );
    expect((await service.findUses({ language: "hbo", strong: "853", limit: 500 })).status).toBe(
      "invalid_query",
    );
    expect(
      (await service.findUses({ language: "hbo", strong: "853", cursor: "xyz" })).status,
    ).toBe("invalid_query");
  });
});

describe("serviço de usos — os quatro estados que o item 3 manda distinguir", () => {
  it("sem índice: manifesto ausente não é lista vazia", async () => {
    const service = createWordStudyService({
      manifest: { read: async () => null },
      partitions: { read: async () => "" },
      versification: WORD_STUDY_VERSIFICATION,
    });
    const result = await service.findUses({ language: "hbo", strong: "853" });
    expect(result.status).toBe("no_index");
  });

  it("erro: falha de leitura não vira vazio", async () => {
    const service = createWordStudyService({
      manifest: {
        read: async () => {
          throw new Error("disco fora");
        },
      },
      partitions: { read: async () => "" },
      versification: WORD_STUDY_VERSIFICATION,
    });
    const result = await service.findUses({ language: "hbo", strong: "853" });
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.reason).toContain("disco fora");
  });

  it("erro: partição ilegível", async () => {
    const index = buildIndex([occurrence("853", "GEN 1:1", 4, "a")]);
    const service = createWordStudyService({
      manifest: { read: async () => index.manifest },
      partitions: {
        read: async () => {
          throw new Error("arquivo truncado");
        },
      },
      versification: WORD_STUDY_VERSIFICATION,
    });
    const result = await service.findUses({ language: "hbo", strong: "853" });
    expect(result.status).toBe("error");
  });

  it("erro: hash divergente falha fechado em vez de servir versão desconhecida", async () => {
    const index = buildIndex([occurrence("853", "GEN 1:1", 4, "a")]);
    const tampered = new Map(index.bodies);
    for (const [file, body] of tampered) {
      tampered.set(file, body.replace('"n":1', '"n":1 '));
    }
    const service = createWordStudyService({
      manifest: { read: async () => index.manifest },
      partitions: { read: async (file) => tampered.get(file) ?? "" },
      versification: WORD_STUDY_VERSIFICATION,
      digest: sha256Digest,
    });
    const result = await service.findUses({ language: "hbo", strong: "853" });
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.reason).toContain("integridade");
  });

  it("erro: contagem declarada que discorda do vetor denuncia truncamento", async () => {
    const index = buildIndex([occurrence("853", "GEN 1:1", 4, "a")]);
    const broken = new Map<string, string>();
    for (const [file, body] of index.bodies) {
      broken.set(file, body.replace('"n":1', '"n":7'));
    }
    const service = createWordStudyService({
      manifest: { read: async () => index.manifest },
      partitions: { read: async (file) => broken.get(file) ?? "" },
      versification: WORD_STUDY_VERSIFICATION,
      // Sem digest de propósito: é a conferência de `n` que precisa pegar.
    });
    const result = await service.findUses({ language: "hbo", strong: "853" });
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.reason).toContain("difere");
  });

  it("verifica hash assíncrono e rejeita falha na função de hash", async () => {
    const index = buildIndex([occurrence("853", "GEN 1:1", 4, "a")]);
    const service = createWordStudyService({ ...portsFor(index), versification: WORD_STUDY_VERSIFICATION,
      digest: async (body) => createHash("sha256").update(body).digest("hex") });
    expect((await service.findUses({ language: "hbo", strong: "853" })).status).toBe("partial");
    const failed = createWordStudyService({ ...portsFor(index), versification: WORD_STUDY_VERSIFICATION,
      digest: async () => { throw new Error("falha no navegador"); } });
    expect((await failed.findUses({ language: "hbo", strong: "853" })).status).toBe("error");
  });

  it("recusa posição negativa mesmo se o JSON for válido", async () => {
    const index = buildIndex([occurrence("853", "GEN 1:1", 4, "a")]);
    const service = createWordStudyService({ manifest: { read: async () => index.manifest },
      partitions: { read: async (file) => (index.bodies.get(file) ?? "").replace(",4]", ",-4]") },
      versification: WORD_STUDY_VERSIFICATION });
    expect((await service.findUses({ language: "hbo", strong: "853" })).status).toBe("error");
  });

  it("vazio NÃO exaustivo: cobertura parcial não autoriza dizer que a palavra não ocorre", async () => {
    const index = buildIndex([occurrence("853", "GEN 1:1", 4, "a")]);
    const service = createWordStudyService({
      ...portsFor(index),
      versification: WORD_STUDY_VERSIFICATION,
      digest: sha256Digest,
    });
    const result = await service.findUses({ language: "hbo", strong: "7225" });
    expect(result.status).toBe("empty");
    if (result.status === "empty") {
      expect(result.exhaustive).toBe(false);
      expect(result.warnings.join(" ")).toContain("não exaustivo");
    }
  });

  it("66 livros com registros não provam ausência exaustiva", async () => {
    const index = buildIndex(wholeCanonRows());
    const service = createWordStudyService({
      ...portsFor(index),
      versification: WORD_STUDY_VERSIFICATION,
      digest: sha256Digest,
    });
    const result = await service.findUses({ language: "hbo", strong: "8064" });
    expect(result.status).toBe("empty");
    if (result.status === "empty") {
      expect(result.exhaustive).toBe(false);
      expect(result.warnings.join(" ")).toContain("não exaustivo");
    }
  });

  it("parcial: tem usos, mas a lista não é 'todos os usos'", async () => {
    const index = buildIndex([
      occurrence("853", "GEN 1:1", 4, "a"),
      occurrence("853", "GEN 1:1", 6, "b"),
    ]);
    const service = createWordStudyService({
      ...portsFor(index),
      versification: WORD_STUDY_VERSIFICATION,
      digest: sha256Digest,
    });
    const result = await service.findUses({ language: "hbo", strong: "853" });
    expect(result.status).toBe("partial");
    if (result.status === "partial") {
      expect(result.warnings.join(" ")).toContain("não é 'todos os usos na Bíblia'");
    }
  });

  it("um registro em cada livro não comprova completude", async () => {
    const index = buildIndex(wholeCanonRows());
    const service = createWordStudyService({
      ...portsFor(index),
      versification: WORD_STUDY_VERSIFICATION,
      digest: sha256Digest,
    });
    const result = await service.findUses({ language: "hbo", strong: "1" });
    expect(result.status).toBe("partial");
    if (result.status === "partial") expect(result.warnings.join(" ")).toContain("ingestão completa não foi comprovada");
  });

  it("índice sem partição é vazio, não ausente", async () => {
    const index = buildIndex([occurrence("853", "GEN 1:1", 4, "a")]);
    const empty = createWordStudyService({
      manifest: { read: async () => ({ header: index.manifest.header, partitions: [] }) },
      partitions: { read: async () => "" },
      versification: WORD_STUDY_VERSIFICATION,
    });
    const result = await empty.findUses({ language: "hbo", strong: "853" });
    expect(result.status).toBe("empty");
    if (result.status === "empty") {
      expect(result.warnings.join(" ")).toContain("nenhuma partição");
    }
  });
});

describe("serviço de usos — agrupamento e paginação", () => {
  it("diz a referência uma vez e preserva as posições da fonte", async () => {
    const index = buildIndex([
      occurrence("853", "GEN 1:1", 6, "b"),
      occurrence("853", "GEN 1:1", 4, "a"),
    ]);
    const service = createWordStudyService({
      ...portsFor(index),
      versification: WORD_STUDY_VERSIFICATION,
      digest: sha256Digest,
    });
    const result = await service.findUses({ language: "hbo", strong: "853" });
    if (result.status !== "partial") throw new Error(`estado inesperado: ${result.status}`);
    expect(result.page.groups).toHaveLength(1);
    expect(result.page.groups[0]?.sourceRef).toBe("GEN 1:1");
    expect(result.page.groups[0]?.positions).toEqual([4, 6]);
    expect(result.page.groups[0]?.occurrences).toBe(2);
    expect(result.page.totalOccurrences).toBe(2);
    expect(result.page.totalVerses).toBe(1);
  });

  it("marca posição desconhecida em vez de inventar zero", async () => {
    const index = buildIndex([occurrence("853", "GEN 1:1", null, "a")]);
    const service = createWordStudyService({
      ...portsFor(index),
      versification: WORD_STUDY_VERSIFICATION,
      digest: sha256Digest,
    });
    const result = await service.findUses({ language: "hbo", strong: "853" });
    if (result.status !== "partial") throw new Error("estado inesperado");
    expect(result.page.groups[0]?.positionsUnknown).toBe(true);
    expect(result.page.groups[0]?.positions).toEqual([]);
  });

  it("pagina por versículo e o cursor atravessa livros sem colidir", async () => {
    // Gênesis 1:1 e Êxodo 1:1 têm o mesmo capítulo:versículo. Um cursor que
    // ignorasse o livro pararia no livro errado.
    const index = buildIndex([
      occurrence("853", "GEN 1:1", 1, "a"),
      occurrence("853", "EXO 1:1", 1, "b"),
      occurrence("853", "LEV 1:1", 1, "c"),
    ]);
    const service = createWordStudyService({
      ...portsFor(index),
      versification: WORD_STUDY_VERSIFICATION,
      digest: sha256Digest,
    });
    const first = await service.findUses({ language: "hbo", strong: "853", limit: 1 });
    if (first.status !== "partial") throw new Error("estado inesperado");
    expect(first.page.groups.map((group) => group.sourceRef)).toEqual(["GEN 1:1"]);
    expect(first.page.nextCursor).not.toBe(null);

    const second = await service.findUses({
      language: "hbo",
      strong: "853",
      limit: 1,
      cursor: first.page.nextCursor,
    });
    if (second.status !== "partial") throw new Error("estado inesperado");
    expect(second.page.groups.map((group) => group.sourceRef)).toEqual(["EXO 1:1"]);

    const third = await service.findUses({
      language: "hbo",
      strong: "853",
      limit: 1,
      cursor: second.page.nextCursor,
    });
    if (third.status !== "partial") throw new Error("estado inesperado");
    expect(third.page.groups.map((group) => group.sourceRef)).toEqual(["LEV 1:1"]);
    expect(third.page.nextCursor).toBe(null);
  });

  it("recusa cursor de outra palavra ou versão", async () => {
    const index = buildIndex([occurrence("853", "GEN 1:1", 1, "a"), occurrence("853", "EXO 1:1", 1, "b")]);
    const service = createWordStudyService({ ...portsFor(index), versification: WORD_STUDY_VERSIFICATION });
    const first = await service.findUses({ language: "hbo", strong: "853", limit: 1 });
    if (first.status !== "partial" || !first.page.nextCursor) throw new Error("cursor ausente");
    const otherWord = await service.findUses({ language: "hbo", strong: "1", cursor: first.page.nextCursor });
    expect(otherWord.status).toBe("invalid_query");
    const changed = { ...index.manifest, header: { ...index.manifest.header, indexVersion: "versao-nova" } };
    const newer = createWordStudyService({ manifest: { read: async () => changed }, partitions: portsFor(index).partitions, versification: WORD_STUDY_VERSIFICATION });
    const otherVersion = await newer.findUses({ language: "hbo", strong: "853", cursor: first.page.nextCursor });
    expect(otherVersion.status).toBe("invalid_query");
  });

  it("totais são da postagem inteira, não da página", async () => {
    const index = buildIndex([
      occurrence("853", "GEN 1:1", 1, "a"),
      occurrence("853", "EXO 1:1", 1, "b"),
      occurrence("853", "LEV 1:1", 1, "c"),
    ]);
    const service = createWordStudyService({
      ...portsFor(index),
      versification: WORD_STUDY_VERSIFICATION,
      digest: sha256Digest,
    });
    const page = await service.findUses({ language: "hbo", strong: "853", limit: 1 });
    if (page.status !== "partial") throw new Error("estado inesperado");
    expect(page.page.groups).toHaveLength(1);
    expect(page.page.totalVerses).toBe(3);
    expect(page.page.totalOccurrences).toBe(3);
  });
});

describe("serviço de usos — camadas, procedência e versificação", () => {
  const index = buildIndex([occurrence("853", "GEN 1:1", 4, "a")]);
  const service = createWordStudyService({
    ...portsFor(index),
    versification: WORD_STUDY_VERSIFICATION,
    digest: sha256Digest,
  });

  it("serve uso e declara indisponíveis sentido, tradução e alinhamento", async () => {
    const result = await service.findUses({ language: "hbo", strong: "853" });
    if (result.status !== "partial") throw new Error("estado inesperado");
    expect(result.layers.uses.available).toBe(true);
    expect(result.layers.contextualSense.available).toBe(false);
    expect(result.layers.translation.available).toBe(false);
    expect(result.layers.editorialAlignment.available).toBe(false);
    // Indisponível carrega motivo e origem, para a tela não dizer "sem sentido".
    if (!result.layers.translation.available) {
      expect(result.layers.translation.reason.length).toBeGreaterThan(0);
      expect(result.layers.translation.wouldComeFrom.length).toBeGreaterThan(0);
    }
  });

  it("credita fonte, licença e versões sem expor caminho privado", async () => {
    const result = await service.findUses({ language: "hbo", strong: "853" });
    if (result.status !== "partial") throw new Error("estado inesperado");
    expect(result.provenance.sources[0]?.attribution).toContain("Clear Bible");
    expect(result.provenance.sources[0]?.licenseDeclared).toContain("CC BY 4.0");
    expect(result.provenance.indexVersion).toBe("teste01");
    expect(result.provenance.versificationVersion).toBe(WORD_STUDY_VERSIFICATION.version);
    // Nenhum caminho de partição ou diretório no resultado inteiro.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("postings-");
    expect(serialized).not.toContain(".ndjson");
  });

  it("avisa quando a integridade não foi conferida", async () => {
    const withoutDigest = createWordStudyService({
      ...portsFor(index),
      versification: WORD_STUDY_VERSIFICATION,
    });
    const result = await withoutDigest.findUses({ language: "hbo", strong: "853" });
    if (result.status !== "partial") throw new Error("estado inesperado");
    expect(result.warnings.join(" ")).toContain("Integridade da partição não foi conferida");
  });

  it("propaga as limitações declaradas pelo índice", async () => {
    const limited = buildIndex([occurrence("853", "GEN 1:1", 4, "a")], {
      limitations: ["Formas gregas não reunidas ao lema."],
    });
    const service2 = createWordStudyService({
      ...portsFor(limited),
      versification: WORD_STUDY_VERSIFICATION,
      digest: sha256Digest,
    });
    const result = await service2.findUses({ language: "hbo", strong: "853" });
    if (result.status !== "partial") throw new Error("estado inesperado");
    expect(result.warnings.join(" ")).toContain("Formas gregas não reunidas");
  });

  it("avisa sobre versificação não conferida no livro consultado", async () => {
    const psalms = buildIndex([occurrence("853", "PSA 3:1", 1, "a")]);
    const service3 = createWordStudyService({
      ...portsFor(psalms),
      versification: WORD_STUDY_VERSIFICATION,
      digest: sha256Digest,
    });
    const result = await service3.findUses({ language: "hbo", strong: "853" });
    if (result.status !== "partial") throw new Error("estado inesperado");
    expect(result.page.groups[0]?.versification).toBe("unverified");
    expect(result.warnings.join(" ")).toContain("PSA");
  });

  it("devolve a referência do leitor quando uma regra conferida se aplica", async () => {
    const micah = buildIndex([occurrence("853", "MIC 4:14", 1, "a")]);
    const service4 = createWordStudyService({
      ...portsFor(micah),
      versification: WORD_STUDY_VERSIFICATION,
      digest: sha256Digest,
    });
    const result = await service4.findUses({ language: "hbo", strong: "853" });
    if (result.status !== "partial") throw new Error("estado inesperado");
    expect(result.page.groups[0]?.sourceRef).toBe("MIC 4:14");
    expect(result.page.groups[0]?.readerRef).toBe("MIC 5:1");
    expect(result.page.groups[0]?.versification).toBe("mapped");
  });
});

describe("portas de arquivo — não expor arquivo privado", () => {
  it("manifesto ausente é ausência de índice, não erro", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ws-empty-"));
    const port = createFileManifestPort(dir);
    expect(await port.read()).toBe(null);
  });

  it("recusa partição que o manifesto não declara", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ws-port-"));
    await writeFile(join(dir, "postings-0000.ndjson"), "{}\n", "utf8");
    await writeFile(join(dir, "segredo.txt"), "conteúdo privado", "utf8");
    const port = createFilePartitionPort(dir, ["postings-0000.ndjson"]);
    await expect(port.read("segredo.txt")).rejects.toThrow(PartitionAccessError);
    expect(await port.read("postings-0000.ndjson")).toBe("{}\n");
  });

  it("recusa travessia de caminho mesmo se o nome estiver na lista", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ws-trav-"));
    const port = createFilePartitionPort(dir, ["../../etc/passwd", "sub/x.ndjson"]);
    await expect(port.read("../../etc/passwd")).rejects.toThrow(PartitionAccessError);
    await expect(port.read("sub/x.ndjson")).rejects.toThrow(PartitionAccessError);
  });

  it("manifesto malformado é erro com motivo, não undefined adiante", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ws-bad-"));
    await writeFile(join(dir, "manifest.json"), JSON.stringify({ header: {} }), "utf8");
    const port = createFileManifestPort(dir);
    await expect(port.read()).rejects.toThrow(PartitionAccessError);
  });
  it("aceita manifesto válido e recusa totais ou partições adulterados", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ws-schema-"));
    const index = buildIndex([occurrence("853", "GEN 1:1", 1, "a"), occurrence("1", "GEN 1:2", 1, "b")], { budget: 1 });
    const file = join(dir, "manifest.json");
    await writeFile(file, JSON.stringify(index.manifest));
    expect(await createFileManifestPort(dir).read()).toEqual(index.manifest);
    await writeFile(file, JSON.stringify({ ...index.manifest, partitions: [index.manifest.partitions[0], index.manifest.partitions[0]] }));
    await expect(createFileManifestPort(dir).read()).rejects.toThrow(PartitionAccessError);
    await writeFile(file, JSON.stringify({ ...index.manifest, header: { ...index.manifest.header, coverage: { ...index.manifest.header.coverage, occurrences: 99 } } }));
    await expect(createFileManifestPort(dir).read()).rejects.toThrow(PartitionAccessError);
  });
});
