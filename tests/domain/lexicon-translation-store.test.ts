import { describe, expect, it } from "vitest";
import {
  CANON,
  TRANSLATION_BOOK_ORDER,
  TRANSLATION_PRIORITY,
  bookName,
  bookOfRef,
  canonBook,
} from "../../src/domain/lexicon/canon";
import {
  TRANSLATABLE_TARGETS,
  glossSubjectKey,
  ingestDrafts,
  isGlossSubject,
  parseStore,
  serializeStore,
  storeProgress,
  translationKey,
  type StoredTranslation,
} from "../../src/domain/lexicon/translation-store";
import { publishableText } from "../../src/domain/lexicon/translation-workflow";
import type { FieldProvenance } from "../../src/domain/lexicon/records";

const PROVENANCE: FieldProvenance = {
  sourceId: "macula-hebrew",
  assetPath: "macula-hebrew.tsv",
  pin: `commit ${"0".repeat(40)}`,
  assetSha256: "a".repeat(64),
  licenseDeclared: "CC BY 4.0",
  attribution: "MACULA Hebrew, Clear Bible, Inc., CC BY 4.0",
  sourceField: "gloss",
};

function draft(subject: string, text: string): StoredTranslation {
  return {
    lexemeKey: subject,
    target: "occurrence.gloss",
    sourceText: "in",
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

describe("ordem canônica dos livros", () => {
  it("tem os 66 livros, sem código repetido", () => {
    expect(CANON).toHaveLength(66);
    expect(new Set(CANON.map((book) => book.code)).size).toBe(66);
    expect(CANON.filter((book) => book.testament === "ot")).toHaveLength(39);
    expect(CANON.filter((book) => book.testament === "nt")).toHaveLength(27);
  });

  it("começa o trabalho por Gênesis e João, e só depois segue o cânone", () => {
    expect(TRANSLATION_PRIORITY).toEqual(["GEN", "JHN"]);
    expect(TRANSLATION_BOOK_ORDER.slice(0, 2)).toEqual(["GEN", "JHN"]);
    // Nenhum livro aparece duas vezes por estar também na prioridade.
    expect(TRANSLATION_BOOK_ORDER).toHaveLength(66);
    expect(new Set(TRANSLATION_BOOK_ORDER).size).toBe(66);
    // Depois dos dois prioritários, a ordem é a canônica.
    expect(TRANSLATION_BOOK_ORDER[2]).toBe("EXO");
  });

  it("lê o livro de uma referência e recusa o que não reconhece", () => {
    expect(bookOfRef("GEN 1:1")).toBe("GEN");
    expect(bookOfRef("JHN 1:14")).toBe("JHN");
    expect(bookOfRef("Gen 1:1")).toBeNull();
    expect(bookOfRef("")).toBeNull();
    expect(canonBook("GEN")?.name).toBe("Gênesis");
    expect(bookName("ZZZ")).toBe("ZZZ");
  });
});

describe("sujeito da tradução", () => {
  it("usa o texto da glossa, não o lema, para a mesma palavra sair igual em todo o texto", () => {
    expect(glossSubjectKey("hbo", " in ")).toBe("gloss:hbo:in");
    expect(glossSubjectKey("grc", "in")).toBe("gloss:grc:in");
    // Idiomas distintos não compartilham tradução: o "in" grego e o hebraico
    // são registros separados, revisáveis em separado.
    expect(glossSubjectKey("hbo", "in")).not.toBe(glossSubjectKey("grc", "in"));
    expect(isGlossSubject(glossSubjectKey("hbo", "in"))).toBe(true);
    expect(isGlossSubject("hbo:H7225")).toBe(false);
  });

  it("prevê a glossa de ocorrência antes dos campos do verbete", () => {
    expect(TRANSLATABLE_TARGETS[0]).toBe("occurrence.gloss");
  });
});

describe("ingestão de rascunhos", () => {
  it("grava o que é novo e conta o que já estava igual", () => {
    const first = ingestDrafts(new Map(), [draft("gloss:hbo:in", "em")]);
    expect(first.added).toBe(1);
    expect(first.store.size).toBe(1);

    const again = ingestDrafts(first.store, [draft("gloss:hbo:in", "em")]);
    expect(again.added).toBe(0);
    expect(again.unchanged).toBe(1);
    expect(again.store.size).toBe(1);
  });

  it("é idempotente: ingerir o mesmo lote duas vezes dá o mesmo armazém", () => {
    const batch = [draft("gloss:hbo:in", "em"), draft("gloss:hbo:and", "e")];
    const once = ingestDrafts(new Map(), batch).store;
    const twice = ingestDrafts(once, batch).store;
    expect(serializeStore(twice)).toBe(serializeStore(once));
  });

  it("nunca sobrescreve texto que passou por revisão humana", () => {
    const reviewed: StoredTranslation = {
      ...draft("gloss:hbo:in", "em, dentro de"),
      status: "approved",
      reviewedBy: "revisor editorial",
      reviewedAt: "2026-11-19T12:00:00.000Z",
    };
    const store = new Map([[translationKey("gloss:hbo:in", "occurrence.gloss"), reviewed]]);

    // Reprocessar o livro inteiro depois da revisão não pode apagar o
    // trabalho humano — é a falha mais fácil de cometer num pipeline que
    // roda sozinho, e a mais cara de descobrir depois.
    const outcome = ingestDrafts(store, [draft("gloss:hbo:in", "em")]);
    expect(outcome.added).toBe(0);
    expect(outcome.protected).toHaveLength(1);
    expect(outcome.store.get(translationKey("gloss:hbo:in", "occurrence.gloss"))?.text).toBe(
      "em, dentro de",
    );
  });

  it("recusa rascunho incoerente em vez de gravar pela metade", () => {
    const outcome = ingestDrafts(new Map(), [
      { ...draft("gloss:hbo:in", "   ") },
      { ...draft("gloss:hbo:and", "e"), sourceText: "  " },
      { ...draft("gloss:hbo:the", "o"), draftMethod: "" },
    ]);
    expect(outcome.added).toBe(0);
    expect(outcome.rejected).toHaveLength(3);
    expect(outcome.rejected.map((item) => item.reason)).toEqual([
      "tradução vazia",
      "tradução sem texto-fonte: o original é obrigatório",
      "tradução sem método de rascunho declarado",
    ]);
  });

  it("serializa de forma determinística e volta igual na leitura", () => {
    const store = ingestDrafts(new Map(), [
      draft("gloss:hbo:the", "o"),
      draft("gloss:hbo:and", "e"),
      draft("gloss:hbo:in", "em"),
    ]).store;
    const serialized = serializeStore(store);
    // Ordem de inserção não muda os bytes.
    const reordered = ingestDrafts(new Map(), [
      draft("gloss:hbo:in", "em"),
      draft("gloss:hbo:the", "o"),
      draft("gloss:hbo:and", "e"),
    ]).store;
    expect(serializeStore(reordered)).toBe(serialized);
    expect(serializeStore(parseStore(serialized))).toBe(serialized);
  });

  it("conta o progresso por estado", () => {
    const store = ingestDrafts(new Map(), [
      draft("gloss:hbo:in", "em"),
      draft("gloss:hbo:and", "e"),
    ]).store;
    expect(storeProgress(store)).toEqual({
      total: 2,
      machineDraft: 2,
      humanReviewed: 0,
      approved: 0,
    });
  });
});

describe("o que o leitor pode mostrar", () => {
  const machineDraft = draft("gloss:hbo:in", "em");

  it("em produção nunca mostra rascunho, mesmo havendo um", () => {
    const shown = publishableText(machineDraft, null);
    // Cai no original em inglês, com aviso, em vez de exibir texto sem revisor.
    expect(shown.kind).toBe("source_fallback");
    if (shown.kind === "source_fallback") {
      expect(shown.text).toBe("in");
      expect(shown.language).toBe("en");
    }
  });

  it("esquecer a opção dá o comportamento de produção, não o de pré-visualização", () => {
    expect(publishableText(machineDraft, null, {}).kind).toBe("source_fallback");
    expect(publishableText(machineDraft, null, { allowMachineDraft: false }).kind).toBe(
      "source_fallback",
    );
  });

  it("em pré-visualização devolve o rascunho num tipo próprio, com o método declarado", () => {
    const shown = publishableText(machineDraft, null, { allowMachineDraft: true });
    // Tipo próprio, e não `translation`: a interface é obrigada a tratá-lo à
    // parte e rotulá-lo. Se viesse no mesmo formato do texto aprovado,
    // bastaria um descuido para publicá-lo sem aviso.
    expect(shown.kind).toBe("machine_draft");
    if (shown.kind === "machine_draft") {
      expect(shown.text).toBe("em");
      expect(shown.language).toBe("pt-BR");
      expect(shown.draftMethod).toMatch(/rascunho/u);
    }
  });

  it("texto aprovado vence o rascunho mesmo em pré-visualização", () => {
    const approved: StoredTranslation = {
      ...machineDraft,
      text: "em, dentro de",
      status: "approved",
      reviewedBy: "revisor editorial",
      reviewedAt: "2026-11-19T12:00:00.000Z",
    };
    const shown = publishableText(approved, null, { allowMachineDraft: true });
    expect(shown.kind).toBe("translation");
    if (shown.kind === "translation") expect(shown.text).toBe("em, dentro de");
  });

  it("rascunho vazio não aparece nem em pré-visualização", () => {
    const empty = { ...machineDraft, text: "   " };
    expect(publishableText(empty, null, { allowMachineDraft: true }).kind).toBe("source_fallback");
  });
});
