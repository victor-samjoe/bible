import { describe, expect, it } from "vitest";
import {
  buildWordViews,
  wordMeaning,
  type OccurrenceRow,
} from "../../src/domain/lexicon/word-analysis-view";
import { wordAnalysisFor } from "../../src/domain/word-analysis";
import type { EditorialTranslation } from "../../src/domain/lexicon/translation-workflow";
import type { FieldProvenance } from "../../src/domain/lexicon/records";

const PROVENANCE: FieldProvenance = {
  sourceId: "macula-hebrew",
  assetPath: "macula-hebrew.tsv",
  pin: `commit ${"0".repeat(40)}`,
  assetSha256: "a".repeat(64),
  licenseDeclared: "CC BY 4.0",
  attribution: "MACULA Hebrew, Clear Bible, Inc.",
  sourceField: "gloss",
};

function translation(
  text: string,
  status: EditorialTranslation["status"],
  sourceText: string,
): EditorialTranslation {
  const reviewed = status !== "machine_draft";
  return {
    target: "occurrence.gloss",
    sourceText,
    sourceLanguage: "en",
    targetLanguage: "pt-BR",
    text,
    status,
    reviewedBy: reviewed ? "revisor editorial" : null,
    reviewedAt: reviewed ? "2026-11-19T12:00:00.000Z" : null,
    provenance: PROVENANCE,
    draftMethod: "rascunho de máquina, teste",
  };
}

function row(partial: Partial<OccurrenceRow> & Pick<OccurrenceRow, "sourceWordId">): OccurrenceRow {
  return {
    language: "hbo",
    canonicalRef: "GEN 1:1",
    wordPosition: 1,
    surface: "x",
    lexemeKey: "hbo:H1",
    lemma: "x",
    morphology: null,
    partOfSpeech: null,
    semanticDomain: null,
    gloss: null,
    entryTransliteration: null,
    entryStrongId: null,
    translation: null,
    bdb: [],
    ...partial,
  };
}

/** Os dois primeiros morfemas reais de Gênesis 1:1, que são uma só palavra. */
const bereshit: readonly OccurrenceRow[] = [
  row({
    sourceWordId: "o010010010011",
    wordPosition: 1,
    surface: "בְּ",
    lexemeKey: "hbo:H871a",
    lemma: "בְּ",
    morphology: "R",
    gloss: "in",
    translation: translation("em", "machine_draft", "in"),
  }),
  row({
    sourceWordId: "o010010010012",
    wordPosition: 1,
    surface: "רֵאשִׁית",
    lexemeKey: "hbo:H7225",
    lemma: "רֵאשִׁית",
    morphology: "Ncfsa",
    gloss: "beginning",
    entryStrongId: "H7225",
    entryTransliteration: "rêʼshîyth",
    translation: translation("princípio", "machine_draft", "beginning"),
  }),
];

const semNota = (): null => null;

describe("agrupamento de morfemas em palavras", () => {
  it("junta os morfemas que a fonte publica na mesma posição", () => {
    const views = buildWordViews(bereshit, semNota);
    // Duas linhas, uma palavra: é a diferença de granularidade entre o MACULA,
    // que é morfêmico, e o leitor, que é indexado por palavra.
    expect(views).toHaveLength(1);
    expect(views[0]?.position).toBe(1);
    expect(views[0]?.morphemes.map((item) => item.surface)).toEqual(["בְּ", "רֵאשִׁית"]);
  });

  it("ordena por posição, não pela ordem em que as linhas chegaram", () => {
    const views = buildWordViews(
      [
        row({ sourceWordId: "c", wordPosition: 3, gloss: "God" }),
        row({ sourceWordId: "a", wordPosition: 1, gloss: "in" }),
        row({ sourceWordId: "b", wordPosition: 2, gloss: "he.created" }),
      ],
      semNota,
    );
    expect(views.map((view) => view.position)).toEqual([1, 2, 3]);
  });

  it("descarta ocorrência sem posição em vez de inventar uma", () => {
    const views = buildWordViews(
      [row({ sourceWordId: "sem", wordPosition: null, gloss: "in" })],
      semNota,
    );
    // Sem a posição não há como dizer a que palavra do leitor o morfema
    // pertence, e chutar faria o painel mostrar o morfema errado.
    expect(views).toEqual([]);
  });
});

describe("precedência do significado exibido", () => {
  it("em produção mostra a glossa original, nunca o rascunho", () => {
    const views = buildWordViews(bereshit, semNota);
    const meaning = wordMeaning(views[0]!);
    expect(meaning.source).toBe("source_gloss");
    expect(meaning.text).toBe("in beginning");
  });

  it("em pré-visualização mostra o rascunho e entrega o método para rotular", () => {
    const views = buildWordViews(bereshit, semNota, { allowMachineDraft: true });
    const meaning = wordMeaning(views[0]!);
    expect(meaning.source).toBe("machine_draft");
    expect(meaning.text).toBe("em princípio");
    expect(meaning.draftMethod).toMatch(/rascunho/u);
  });

  it("tradução aprovada aparece em produção, sem rótulo de rascunho", () => {
    const approved = bereshit.map((item) => ({
      ...item,
      translation: translation(
        item.gloss === "in" ? "em" : "princípio",
        "approved",
        item.gloss ?? "",
      ),
    }));
    const meaning = wordMeaning(buildWordViews(approved, semNota)[0]!);
    expect(meaning.source).toBe("approved_translation");
    expect(meaning.text).toBe("em princípio");
    expect(meaning.draftMethod).toBeNull();
  });

  it("uma parte em rascunho rotula a palavra inteira como rascunho", () => {
    const misto = [
      { ...bereshit[0]!, translation: translation("em", "approved", "in") },
      { ...bereshit[1]!, translation: translation("princípio", "machine_draft", "beginning") },
    ];
    const meaning = wordMeaning(buildWordViews(misto, semNota, { allowMachineDraft: true })[0]!);
    // Se metade do significado não passou por revisão, a palavra toda precisa
    // carregar o aviso: o leitor vê um texto só, não duas procedências.
    expect(meaning.source).toBe("machine_draft");
  });

  it("uma parte sem tradução rebaixa a palavra para a glossa original", () => {
    const parcial = [
      { ...bereshit[0]!, translation: translation("em", "approved", "in") },
      { ...bereshit[1]!, translation: null },
    ];
    const meaning = wordMeaning(buildWordViews(parcial, semNota)[0]!);
    expect(meaning.source).toBe("source_gloss");
    expect(meaning.text).toBe("em beginning");
  });

  it("a nota editorial revisada vence tudo, inclusive a tradução aprovada", () => {
    const approved = bereshit.map((item) => ({
      ...item,
      translation: translation("rascunho qualquer", "approved", item.gloss ?? ""),
    }));
    const views = buildWordViews(approved, (position) =>
      wordAnalysisFor("genesis", 1, 1, position),
    );
    const meaning = wordMeaning(views[0]!);
    // As sete notas de Gênesis 1:1 passaram por revisão humana e dizem mais do
    // que uma glossa de uma palavra. O índice cobre os outros versículos; não
    // apaga os que já estavam prontos.
    expect(meaning.source).toBe("reviewed_note");
    expect(meaning.text).toBe("no princípio");
    expect(views[0]?.reviewedNote?.lemmaId).toBe("H7225");
  });

  it("sem glossa na fonte e sem nota, não há significado a mostrar", () => {
    const views = buildWordViews([row({ sourceWordId: "n", gloss: null })], semNota);
    const meaning = wordMeaning(views[0]!);
    expect(meaning.text).toBeNull();
    expect(meaning.source).toBeNull();
  });

  it("preserva a morfologia e o verbete de cada morfema", () => {
    const views = buildWordViews(bereshit, semNota);
    const [prefixo, substantivo] = views[0]!.morphemes;
    expect(prefixo?.morphology).toBe("R");
    // Prefixo com Strong aumentado não tem verbete: o campo fica nulo em vez
    // de ser preenchido com o verbete de outra palavra.
    expect(prefixo?.strongId).toBeNull();
    expect(prefixo?.transliteration).toBeNull();
    expect(substantivo?.strongId).toBe("H7225");
    expect(substantivo?.transliteration).toBe("rêʼshîyth");
    expect(substantivo?.morphology).toBe("Ncfsa");
  });
});
