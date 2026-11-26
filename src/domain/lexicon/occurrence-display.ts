import { alignmentFor, originalGroupAt, tokenizeDisplayText } from "../passage-alignment";

/** A anotação lexical pode representar apenas um morfema do token original. */
export function occurrenceMatchesSurface(lexical: string, original: string): boolean {
  const letters = (value: string) => value.normalize("NFD").replace(/[^\u05d0-\u05ea]/gu, "");
  const part = letters(lexical);
  return part.length > 0 && letters(original).includes(part);
}

/** Trechos explícitos conferidos na Bíblia Livre; não são equivalências universais. */
export function contextualExcerpt(verse: number, position: number, strong: string, text: string): string | null {
  if (verse === 20 && strong === "H6440" && position === 13) {
    const words = tokenizeDisplayText(text);
    const terms = ["na", "expansao", "aberta", "dos", "ceus"];
    for (let i = 0; i <= words.length - terms.length; i += 1) {
      if (terms.every((term, offset) => words[i + offset]?.normalized === term)) {
        return words.slice(i, i + terms.length).map((word) => word.display).join(" ").replace(/[\p{P}]+$/gu, "");
      }
    }
    return null;
  }
  const pilot = verse === 2 && strong === "H6440" && (position === 7 || position === 13)
    ? "face" : verse === 29 && strong === "H6440" && position === 13 ? "face" : null;
  if (pilot && tokenizeDisplayText(text).some((word) => word.normalized === pilot)) return pilot;
  const group = originalGroupAt(position, alignmentFor("genesis", 1, verse));
  if (!group) return null;
  const words = tokenizeDisplayText(text);
  const matches: string[] = [];
  for (let i = 0; i <= words.length - group.translationTerms.length; i += 1) {
    if (group.translationTerms.every((term, offset) => words[i + offset]?.normalized === term)) {
      matches.push(words.slice(i, i + group.translationTerms.length).map((word) => word.display).join(" ").replace(/[\p{P}]+$/gu, ""));
    }
  }
  return matches.length === 1 ? matches[0]! : null;
}
