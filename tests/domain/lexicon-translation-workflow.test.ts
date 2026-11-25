import { describe, expect, it } from "vitest";
import {
  TRANSLATION_STATUSES,
  TranslationWorkflowError,
  assertNoTranslationsProduced,
  assertTranslationIsCoherent,
  canPublishTranslation,
  nextTranslationStatus,
  publishableText,
  type EditorialTranslation,
} from "../../src/domain/lexicon/translation-workflow";
import type { FieldProvenance } from "../../src/domain/lexicon/records";

const provenance: FieldProvenance = {
  sourceId: "stepbible-tbesg",
  assetPath: "TBESG.txt",
  pin: "commit " + "0".repeat(40),
  assetSha256: "a".repeat(64),
  licenseDeclared: "CC BY 4.0",
  attribution: "STEPBible TBESG — Tyndale House, Cambridge",
  sourceField: "Gloss",
};

function draft(overrides: Partial<EditorialTranslation> = {}): EditorialTranslation {
  return {
    target: "entry.gloss",
    sourceText: "glossa-fixture-G3056",
    sourceLanguage: "en",
    targetLanguage: "pt-BR",
    text: "rascunho de maquina",
    status: "machine_draft",
    reviewedBy: null,
    reviewedAt: null,
    provenance,
    draftMethod: "fixture de teste",
    ...overrides,
  };
}

describe("fluxo editorial da tradução para português", () => {
  it("tem exatamente os três estados previstos", () => {
    expect([...TRANSLATION_STATUSES]).toEqual(["machine_draft", "human_reviewed", "approved"]);
  });

  it("não permite pular a revisão humana", () => {
    expect(() => nextTranslationStatus("machine_draft", "approve")).toThrow(TranslationWorkflowError);
    expect(nextTranslationStatus("machine_draft", "submit_review")).toBe("human_reviewed");
    expect(nextTranslationStatus("human_reviewed", "approve")).toBe("approved");
    expect(nextTranslationStatus("human_reviewed", "reject")).toBe("machine_draft");
    // Reabrir um aprovado o devolve à revisão, nunca direto ao rascunho publicado.
    expect(nextTranslationStatus("approved", "reopen")).toBe("human_reviewed");
    expect(() => nextTranslationStatus("approved", "submit_review")).toThrow(/transição inválida/u);
  });

  it("só considera publicável o texto aprovado com revisor e data", () => {
    expect(canPublishTranslation(draft())).toBe(false);
    expect(canPublishTranslation(draft({ status: "human_reviewed" }))).toBe(false);
    expect(canPublishTranslation(draft({ status: "approved" }))).toBe(false);
    expect(
      canPublishTranslation(
        draft({ status: "approved", reviewedBy: "revisor", reviewedAt: "2026-11-19T12:00:00.000Z" }),
      ),
    ).toBe(true);
  });

  it("mostra a glossa original enquanto não houver tradução aprovada", () => {
    expect(publishableText(draft(), null)).toEqual({
      kind: "source_fallback",
      text: "glossa-fixture-G3056",
      language: "en",
    });
    expect(
      publishableText(
        draft({ status: "approved", reviewedBy: "revisor", reviewedAt: "2026-11-19T12:00:00.000Z" }),
        null,
      ),
    ).toEqual({ kind: "translation", text: "rascunho de maquina", language: "pt-BR" });
    expect(publishableText(null, null)).toEqual({ kind: "unavailable" });
    expect(publishableText(null, "glossa original")).toEqual({
      kind: "source_fallback",
      text: "glossa original",
      language: "en",
    });
  });

  it("exige revisor nomeado, data válida, texto-fonte e método declarado", () => {
    expect(() => assertTranslationIsCoherent(draft())).not.toThrow();
    expect(() => assertTranslationIsCoherent(draft({ sourceText: "   " }))).toThrow(/texto-fonte/u);
    expect(() => assertTranslationIsCoherent(draft({ draftMethod: "" }))).toThrow(/método/u);
    expect(() => assertTranslationIsCoherent(draft({ status: "human_reviewed" }))).toThrow(/revisor/u);
    expect(() =>
      assertTranslationIsCoherent(draft({ status: "approved", reviewedBy: "r", reviewedAt: "ontem" })),
    ).toThrow(/data de revisão/u);
    expect(() =>
      assertTranslationIsCoherent(
        draft({ status: "approved", reviewedBy: "r", reviewedAt: "2026-11-19T12:00:00.000Z" }),
      ),
    ).not.toThrow();
  });

  it("proíbe que a fase de preparação produza qualquer tradução", () => {
    expect(() => assertNoTranslationsProduced([])).not.toThrow();
    expect(() => assertNoTranslationsProduced([draft()])).toThrow(/não gera tradução/u);
  });
});
