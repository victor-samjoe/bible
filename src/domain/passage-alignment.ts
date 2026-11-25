export type AlignmentGroup = {
  readonly id: string;
  readonly translationTerms: readonly string[];
  readonly originalPositions: readonly number[];
};

export type DisplayWord = { readonly display: string; readonly normalized: string };

/**
 * Alinhamentos editoriais versionados. Não são inferidos por posição: línguas
 * diferentes não preservam a mesma quantidade nem a mesma ordem de palavras.
 * A prova vertical começa em Gênesis 1:1 e será substituída pelo repositório de
 * alinhamentos revisados quando ALIGNMENT-001 for executada.
 */
const curated: Readonly<Record<string, readonly AlignmentGroup[]>> = {
  "genesis.1.1": [
    { id: "inicio", translationTerms: ["no", "principio"], originalPositions: [1] },
    { id: "criar", translationTerms: ["criou"], originalPositions: [2] },
    { id: "deus", translationTerms: ["deus"], originalPositions: [3] },
    { id: "ceus", translationTerms: ["os", "ceus"], originalPositions: [4, 5] },
    { id: "terra", translationTerms: ["e", "a", "terra"], originalPositions: [6, 7] },
  ],
  "miqueias.5.2": [
    { id: "belem", translationTerms: ["belem", "efrata"], originalPositions: [2, 3, 4] },
    { id: "pequena", translationTerms: ["pequena"], originalPositions: [5] },
    { id: "familias", translationTerms: ["familias"], originalPositions: [7] },
    { id: "juda", translationTerms: ["juda"], originalPositions: [8] },
    { id: "ti", translationTerms: ["ti"], originalPositions: [9] },
    { id: "saira", translationTerms: ["saira"], originalPositions: [11] },
    { id: "governador", translationTerms: ["governador"], originalPositions: [13] },
    { id: "israel", translationTerms: ["israel"], originalPositions: [14] },
    { id: "saidas", translationTerms: ["saidas"], originalPositions: [15] },
    { id: "principio", translationTerms: ["principio"], originalPositions: [16] },
    { id: "dias", translationTerms: ["dias"], originalPositions: [17] },
    { id: "antigos", translationTerms: ["antigos"], originalPositions: [18] },
  ],
};

export function normalizeComparisonWord(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "")
    .toLowerCase();
}

export function tokenizeDisplayText(text: string): readonly DisplayWord[] {
  return (text.match(/\S+/gu) ?? []).map((display) => ({
    display,
    normalized: normalizeComparisonWord(display),
  }));
}

export function alignmentFor(bookSlug: string, chapter: number, verse: number): readonly AlignmentGroup[] {
  return curated[`${bookSlug}.${chapter}.${verse}`] ?? [];
}

export function translationGroupAt(words: readonly DisplayWord[], index: number, groups: readonly AlignmentGroup[]): AlignmentGroup | null {
  for (const group of groups) {
    for (let start = 0; start <= words.length - group.translationTerms.length; start += 1) {
      if (!group.translationTerms.every((term, offset) => words[start + offset]?.normalized === term)) continue;
      if (index >= start && index < start + group.translationTerms.length) return group;
    }
  }
  return null;
}

export function originalGroupAt(position: number, groups: readonly AlignmentGroup[]): AlignmentGroup | null {
  return groups.find((group) => group.originalPositions.includes(position)) ?? null;
}
