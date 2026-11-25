import { describe, expect, it, vi } from "vitest";
import { createLexiconReader } from "../../src/server/lexicon/reader";
import type { LexiconRepository } from "../../src/server/lexicon/repository";
import { reviewStateOf } from "../../src/domain/lexicon/word-analysis-view";
import type { BdbEntryView, OccurrenceRow, SourceCredit } from "../../src/domain/lexicon/word-analysis-view";
import type { EditorialTranslation } from "../../src/domain/lexicon/translation-workflow";

const PROVENANCE = {
  sourceId: "",
  assetPath: "",
  pin: "",
  assetSha256: "",
  licenseDeclared: "",
  attribution: "",
  sourceField: "gloss",
};

/**
 * Dois morfemas da posição 1: a preposição e o substantivo.
 *
 * O versículo é parâmetro porque Gênesis 1:1 **tem** nota editorial revisada, e
 * ela vence qualquer tradução por projeto. Para exercitar o caminho da tradução
 * é preciso um versículo sem nota — 1:2 serve.
 */
function occurrences(verse = 1): readonly OccurrenceRow[] {
  return [
    {
      sourceWordId: "o1",
      language: "hbo",
      canonicalRef: `GEN 1:${verse}`,
      wordPosition: 1,
      surface: "בְּ",
      lexemeKey: "hbo:H871a",
      lemma: "בְּ",
      morphology: "R",
      partOfSpeech: "preposition",
      semanticDomain: null,
      gloss: "in",
      entryTransliteration: null,
      entryStrongId: null,
      translation: null,
      bdb: [],
    },
    {
      sourceWordId: "o2",
      language: "hbo",
      canonicalRef: `GEN 1:${verse}`,
      wordPosition: 1,
      surface: "רֵאשִׁית",
      lexemeKey: "hbo:H7225",
      lemma: "רֵאשִׁית",
      morphology: "Ncfsa",
      partOfSpeech: "noun",
      semanticDomain: "168",
      gloss: "beginning",
      entryTransliteration: "rêʼshîyth",
      entryStrongId: "H7225",
      translation: null,
      bdb: [],
    },
  ];
}

const BDB_RESHIT: BdbEntryView = {
  bdbId: "t.ad.ag",
  lemma: "רֵאשִׁית",
  partOfSpeech: "n.f",
  isRoot: false,
  definitions: ["beginning", "chief"],
  senseCount: 4,
  maxDepth: 2,
  senses: [
    { number: "1", stem: null, definitions: ["beginning"], note: null, children: [] },
    {
      number: "2",
      stem: null,
      definitions: ["first"],
      note: "of time",
      children: [
        { number: "a", stem: null, definitions: ["first fruits"], note: null, children: [] },
      ],
    },
  ],
};

const SOURCES: ReadonlyMap<string, Omit<SourceCredit, "fields">> = new Map([
  ["macula-hebrew", { sourceId: "macula-hebrew", name: "MACULA Hebrew", licenseDeclared: "CC BY 4.0", attribution: "Clear Bible, Inc." }],
  ["oshb-hebrewlexicon", { sourceId: "oshb-hebrewlexicon", name: "Open Scriptures HebrewLexicon", licenseDeclared: "CC BY 4.0", attribution: "Open Scriptures" }],
  ["oshb-bdb", { sourceId: "oshb-bdb", name: "Brown-Driver-Briggs", licenseDeclared: "CC BY 4.0", attribution: "BDB; edição digital Open Scriptures" }],
]);

function draft(text: string, sourceText = "beginning"): EditorialTranslation {
  return {
    target: "occurrence.gloss",
    sourceText,
    sourceLanguage: "en",
    targetLanguage: "pt-BR",
    text,
    status: "machine_draft",
    reviewedBy: null,
    reviewedAt: null,
    provenance: PROVENANCE,
    draftMethod: "rascunho de máquina, teste",
  };
}

function repository(overrides: Partial<LexiconRepository> = {}): LexiconRepository {
  return {
    listOccurrences: vi.fn().mockResolvedValue(occurrences()),
    listTranslations: vi.fn().mockResolvedValue(new Map()),
    listBdbEntries: vi.fn().mockResolvedValue(new Map([["hbo:H7225", [BDB_RESHIT]]])),
    listSources: vi.fn().mockResolvedValue(SOURCES),
    ...overrides,
  };
}

async function readGenesis(repo: LexiconRepository, previewDrafts = false, verse = 1) {
  return await createLexiconReader(repo, { previewDrafts }).read({
    book: "genesis",
    chapter: 1,
    verses: [verse],
  });
}

describe("acepções do BDB no painel", () => {
  it("entrega a árvore do verbete alcançado pelo morfema, com a hierarquia intacta", async () => {
    const result = await readGenesis(repository());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const word = result.verses[0]?.words[0];
    expect(word?.morphemes).toHaveLength(2);

    // A preposição não tem verbete no BDB: Strong aumentado "0871a" não é
    // definido pelo dicionário, e a lista vem vazia em vez de receber o
    // verbete do vizinho.
    expect(word?.morphemes[0]?.bdb).toEqual([]);

    const substantivo = word?.morphemes[1];
    expect(substantivo?.bdb).toHaveLength(1);
    expect(substantivo?.bdb[0]?.senseCount).toBe(4);
    expect(substantivo?.bdb[0]?.senses[1]?.number).toBe("2");
    // O subsentido continua filho, e não irmão: é o aninhamento que distingue
    // "primeiro" de "primícias".
    expect(substantivo?.bdb[0]?.senses[1]?.children[0]?.definitions).toEqual(["first fruits"]);
  });

  it("consulta o BDB pelas chaves de lema das ocorrências, não por grafia", async () => {
    const repo = repository();
    await readGenesis(repo);
    expect(repo.listBdbEntries).toHaveBeenCalledWith(["hbo:H871a", "hbo:H7225"]);
  });

  it("não derruba a análise quando a consulta de acepções falha", async () => {
    const repo = repository({
      listBdbEntries: vi.fn().mockRejectedValue(new Error("connection secret")),
    });
    const result = await readGenesis(repo);
    // Forma, lema e morfologia são o essencial e continuam de pé.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verses[0]?.words[0]?.morphemes[1]?.morphology).toBe("Ncfsa");
    expect(result.verses[0]?.words[0]?.morphemes[1]?.bdb).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/connection secret/u);
  });
});

describe("estado de revisão do que está na tela", () => {
  it("traduz procedência em estado, e separa revisado de texto da fonte", () => {
    expect(reviewStateOf("reviewed_note")).toBe("editorial_reviewed");
    expect(reviewStateOf("approved_translation")).toBe("approved");
    expect(reviewStateOf("machine_draft")).toBe("unreviewed_draft");
    expect(reviewStateOf("source_gloss")).toBe("source_text");
    expect(reviewStateOf(null)).toBeNull();
  });

  it("em produção não expõe rascunho nem o método que o gerou", async () => {
    const repo = repository({
      listOccurrences: vi.fn().mockResolvedValue(occurrences(2)),
      listTranslations: vi
        .fn()
        .mockResolvedValue(
          new Map([
            ["gloss:hbo:in", draft("em", "in")],
            ["gloss:hbo:beginning", draft("princípio")],
          ]),
        ),
    });
    const result = await readGenesis(repo, false, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const word = result.verses[0]?.words[0];
    expect(word?.reviewState).toBe("source_text");
    expect(word?.draftMethod).toBeNull();
    // O texto do rascunho não pode aparecer em lugar nenhum da resposta.
    expect(JSON.stringify(result)).not.toMatch(/princípio/u);
  });

  it("em pré-visualização rotula o rascunho e entrega o método", async () => {
    const repo = repository({
      listOccurrences: vi.fn().mockResolvedValue(occurrences(2)),
      listTranslations: vi
        .fn()
        .mockResolvedValue(
          new Map([
            ["gloss:hbo:in", draft("em", "in")],
            ["gloss:hbo:beginning", draft("princípio")],
          ]),
        ),
    });
    const result = await readGenesis(repo, true, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const word = result.verses[0]?.words[0];
    expect(word?.reviewState).toBe("unreviewed_draft");
    expect(word?.draftMethod).toMatch(/rascunho/u);
    expect(word?.meaning).toContain("princípio");
  });

  it("uma parte sem tradução rebaixa a palavra inteira para a glossa da fonte", async () => {
    const repo = repository({
      listOccurrences: vi.fn().mockResolvedValue(occurrences(2)),
      // Só o substantivo tem tradução; a preposição não.
      listTranslations: vi
        .fn()
        .mockResolvedValue(new Map([["gloss:hbo:beginning", draft("princípio")]])),
    });
    const result = await readGenesis(repo, true, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // O leitor vê um texto só, não duas procedências: se metade vem da fonte em
    // inglês, a palavra inteira é rotulada como texto da fonte.
    expect(result.verses[0]?.words[0]?.reviewState).toBe("source_text");
    expect(result.verses[0]?.words[0]?.morphemes[1]?.reviewState).toBe("unreviewed_draft");
  });

  it("busca a tradução pelo texto da glossa, no idioma da ocorrência", async () => {
    const repo = repository();
    await readGenesis(repo);
    expect(repo.listTranslations).toHaveBeenCalledWith(["gloss:hbo:in", "gloss:hbo:beginning"]);
  });
});

describe("crédito das fontes", () => {
  it("credita só o que entrou na palavra, dizendo quais campos vieram de cada fonte", async () => {
    const result = await readGenesis(repository());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sources = result.verses[0]?.words[0]?.sources ?? [];
    expect(sources.map((source) => source.sourceId)).toEqual([
      "macula-hebrew",
      "oshb-bdb",
      "oshb-hebrewlexicon",
    ]);
    const bdb = sources.find((source) => source.sourceId === "oshb-bdb");
    expect(bdb?.fields).toEqual(["acepções"]);
    expect(bdb?.licenseDeclared).toBe("CC BY 4.0");
    const macula = sources.find((source) => source.sourceId === "macula-hebrew");
    expect(macula?.fields).toContain("morfologia");
    expect(macula?.fields).toContain("glossa contextual");
  });

  it("não credita o léxico de verbete quando nada dele foi usado", async () => {
    // Sem transliteração e sem Strong, o verbete não contribuiu com nada; e sem
    // acepção, o BDB também não. Creditá-los seria atribuir obra que não entrou.
    const repo = repository({
      listOccurrences: vi.fn().mockResolvedValue([occurrences()[0]]),
      listBdbEntries: vi.fn().mockResolvedValue(new Map()),
    });
    const result = await readGenesis(repo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verses[0]?.words[0]?.sources.map((item) => item.sourceId)).toEqual([
      "macula-hebrew",
    ]);
  });

  it("não inventa crédito para fonte que a importação não registrou", async () => {
    const repo = repository({ listSources: vi.fn().mockResolvedValue(new Map()) });
    const result = await readGenesis(repo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Sem linha na tabela de fontes não há atribuição exibível, e a lista vem
    // vazia em vez de trazer nome e licença escritos no código.
    expect(result.verses[0]?.words[0]?.sources).toEqual([]);
  });
});

describe("dados parciais: cada consulta acessória degrada por si", () => {
  /** As três consultas, com tradução e acepções presentes por padrão. */
  function completo(overrides: Partial<LexiconRepository> = {}): LexiconRepository {
    return repository({
      listOccurrences: vi.fn().mockResolvedValue(occurrences(2)),
      listTranslations: vi
        .fn()
        .mockResolvedValue(
          new Map([
            ["gloss:hbo:in", draft("em", "in")],
            ["gloss:hbo:beginning", draft("princípio")],
          ]),
        ),
      ...overrides,
    });
  }

  it("falha nas acepções não apaga a tradução nem os créditos", async () => {
    const result = await readGenesis(
      completo({ listBdbEntries: vi.fn().mockRejectedValue(new Error("bdb caiu")) }),
      true,
      2,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const word = result.verses[0]?.words[0];
    // Com `Promise.all` e um só catch, a tradução que já estava em mãos ia
    // embora junto com as acepções. São consultas independentes.
    expect(word?.meaning).toContain("princípio");
    expect(word?.reviewState).toBe("unreviewed_draft");
    expect(word?.sources.map((source) => source.sourceId)).toContain("macula-hebrew");
    expect(word?.morphemes[1]?.bdb).toEqual([]);
    expect(word?.sources.map((source) => source.sourceId)).not.toContain("oshb-bdb");
  });

  it("falha na tradução não apaga as acepções nem o texto da fonte", async () => {
    const result = await readGenesis(
      completo({ listTranslations: vi.fn().mockRejectedValue(new Error("traducao caiu")) }),
      true,
      2,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const word = result.verses[0]?.words[0];
    expect(word?.morphemes[1]?.bdb).toHaveLength(1);
    expect(word?.reviewState).toBe("source_text");
    expect(word?.draftMethod).toBeNull();
    // O texto original continua de pé: é ele o essencial.
    expect(word?.morphemes[1]?.surface).toBe("רֵאשִׁית");
    expect(word?.morphemes[1]?.morphology).toBe("Ncfsa");
  });

  it("falha nas fontes não apaga tradução nem acepções", async () => {
    const result = await readGenesis(
      completo({ listSources: vi.fn().mockRejectedValue(new Error("fontes caiu")) }),
      true,
      2,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const word = result.verses[0]?.words[0];
    expect(word?.meaning).toContain("princípio");
    expect(word?.morphemes[1]?.bdb).toHaveLength(1);
    // Sem a tabela de fontes não há atribuição exibível, e nada é inventado.
    expect(word?.sources).toEqual([]);
  });

  it("nenhuma mensagem de erro interna vaza na resposta", async () => {
    const result = await readGenesis(
      completo({
        listBdbEntries: vi.fn().mockRejectedValue(new Error("connection string secreta")),
        listSources: vi.fn().mockRejectedValue(new Error("senha do banco")),
      }),
      true,
      2,
    );
    expect(JSON.stringify(result)).not.toMatch(/secreta|senha/u);
  });

  it("capítulo com shard mas sem nenhuma ponte do BDB não é erro", async () => {
    const result = await readGenesis(
      completo({ listBdbEntries: vi.fn().mockResolvedValue(new Map()) }),
      true,
      2,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const word = result.verses[0]?.words[0];
    expect(word?.morphemes.every((morpheme) => morpheme.bdb.length === 0)).toBe(true);
    expect(word?.meaning).toContain("princípio");
    // Creditar o BDB sem acepção alguma seria atribuir obra que não entrou.
    expect(word?.sources.map((source) => source.sourceId)).not.toContain("oshb-bdb");
  });
});
