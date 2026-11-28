/** Destaques pontuais conferidos para o recorte publicado; não inferir por Strong em outros versículos. */
export function knownWordHighlights(verse: number, strong: string, text: string, occurrences: number): readonly { start: number; end: number }[] {
  if (strong !== "H7121" || ![5, 8, 10].includes(verse) || !occurrences) return [];
  const matches = [...text.matchAll(/\bchamou\b/giu)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
  return matches.length === occurrences ? matches : [];
}
