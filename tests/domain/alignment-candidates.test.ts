import { describe, expect, it } from "vitest";
import {
  assertNoPositionalLinking,
  type AlignmentInputBundle,
  type BridgeEntry,
  type OriginalUnit,
} from "../../src/domain/alignment/contracts";
import { generateBundleCandidates } from "../../src/domain/alignment/candidates";
import { tokenizeTranslationVerse } from "../../src/domain/alignment/tokenizer";
import { runAlignmentPipeline } from "../../src/domain/alignment/pipeline";

const provenance = {
  sourceId: "editorial-bridge-fixture",
  reviewedBy: "editorial@example.test",
  reviewedAt: "2026-11-19T00:00:00.000Z",
  note: "fixture editorial revisada",
} as const;

function bridge(strongId: string, phrase: string, kind: BridgeEntry["kind"] = "approved_translation"): BridgeEntry {
  return {
    kind,
    subject: { kind: "strong", strongId },
    phrase,
    status: "approved",
    closedClass: false,
    provenance,
  };
}

function unit(wordPosition: number, strongId: string, surface: string, lemma = surface): OriginalUnit {
  return {
    unitId: `fixture:${wordPosition}:${strongId}`,
    wordPosition,
    morphemePosition: 1,
    surface,
    lemma,
    lexemeKey: `hbo:${strongId}`,
    strongId,
    gloss: null,
    morphology: null,
    partOfSpeech: null,
  };
}

function bundle(overrides: Partial<AlignmentInputBundle> = {}): AlignmentInputBundle {
  return {
    translationId: "blivre-fixture",
    translationCode: "BLIVRE",
    translationStatus: "approved",
    originalEditionId: "morphhb-fixture",
    originalEditionCode: "MORPHHB",
    originalEditionStatus: "approved",
    language: "hbo",
    lexiconIndexDigest: "fixture-digest",
    versificationMapVersion: "original-versification/1",
    bridge: [],
    verses: [],
    ...overrides,
  };
}

describe("pipeline de candidatos de alinhamento", () => {
  it("preserva 1:N em Gênesis 1:1 por evidência lexical, não por posição", () => {
    const result = generateBundleCandidates(bundle({
      bridge: [bridge("H7225", "no princípio")],
      verses: [{
        anchor: { bookCode: "GEN", chapter: 1, verse: 1 },
        originalRef: { chapter: 1, verse: 1 },
        translationText: "No princípio criou Deus os céus e a terra.",
        units: [unit(1, "H7225", "בְּרֵאשִׁית", "רֵאשִׁית")],
      }],
    }));

    const group = result[0]?.groups[0];
    expect(group).toMatchObject({
      originalWordPositions: [1],
      translationTokenPositions: [1, 2],
      cardinality: "1:2",
      method: "approved_gloss_translation",
      needsReview: false,
    });
    expect(() => assertNoPositionalLinking(result[0]?.groups ?? [])).not.toThrow();
  });

  it("preserva 2:1 e trata \\add como palavra fornecida em Miqueias 5:2", () => {
    const result = generateBundleCandidates(bundle({
      bridge: [
        bridge("H1035", "Belém", "proper_noun"),
        bridge("H4910", "governador"),
      ],
      verses: [{
        anchor: { bookCode: "MIC", chapter: 5, verse: 2 },
        originalRef: { chapter: 5, verse: 1 },
        translationText: "Porém tu, Belém Efrata, \\add ainda que\\add* sejas pequena; de ti me sairá o governador em Israel.",
        units: [
          unit(2, "H1035", "בֵּית", "בֵּית לֶחֶם"),
          unit(3, "H1035", "לֶחֶם", "בֵּית לֶחֶם"),
          unit(13, "H4910", "מוֹשֵׁל", "מָשַׁל"),
        ],
      }],
    }));

    const groups = result[0]?.groups ?? [];
    expect(groups.find((group) => group.translationForms.includes("belem"))).toMatchObject({
      originalWordPositions: [2, 3],
      cardinality: "2:1",
      method: "proper_noun_translation",
    });
    expect(groups.find((group) => group.translationForms.includes("governador"))).toMatchObject({
      originalWordPositions: [13],
      translationTokenPositions: [14],
    });
    expect(tokenizeTranslationVerse("\\add ainda que\\add* sejas").filter((token) => token.supplied).map((token) => token.normalized))
      .toEqual(["ainda", "que"]);
  });

  it("é determinístico e falha fechado para edição não aprovada", () => {
    const input = bundle({
      bridge: [bridge("H7225", "no princípio")],
      verses: [{
        anchor: { bookCode: "GEN", chapter: 1, verse: 1 },
        originalRef: { chapter: 1, verse: 1 },
        translationText: "No princípio.",
        units: [unit(1, "H7225", "בְּרֵאשִׁית")],
      }],
    });
    expect(generateBundleCandidates(input)).toEqual(generateBundleCandidates(input));
    expect(() => generateBundleCandidates({ ...input, translationStatus: "under_review" })).toThrow(/tradução não aprovada/u);
  });

  it("mantém metadados de versão e fila editorial sem publicar candidatos", () => {
    const input = bundle({ verses: [{
      anchor: { bookCode: "GEN", chapter: 1, verse: 1 },
      originalRef: { chapter: 1, verse: 1 },
      translationText: "No princípio.",
      units: [unit(1, "H7225", "בְּרֵאשִׁית")],
    }] });
    const result = runAlignmentPipeline(input);
    expect(result).toMatchObject({
      status: "candidate",
      algorithmVersion: "alignment-candidates/1.0.0",
      translationId: "blivre-fixture",
      originalEditionId: "morphhb-fixture",
      lexiconIndexDigest: "fixture-digest",
      versificationMapVersion: "original-versification/1",
    });
    expect(result.reviewQueue).toEqual(result.verses[0].groups);
    expect(result.reviewQueue[0].needsReview).toBe(true);
    expect(runAlignmentPipeline(input)).toEqual(result);
  });
});
