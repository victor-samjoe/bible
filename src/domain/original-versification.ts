/**
 * Ponte entre a numeração adotada pelo leitor em português e a numeração
 * impressa no texto hebraico da WLC/MorphHB. A maior parte do cânon coincide;
 * as exceções ficam explícitas aqui, em vez de deslocar silenciosamente a
 * consulta lexical.
 *
 * Miqueias 5 ilustra o caso: a Bíblia em português começa o capítulo no que
 * a tradição hebraica enumera como 4:14. A partir do versículo 2, a numeração
 * hebraica do capítulo 5 fica uma unidade atrás da portuguesa.
 */
export function sourceVerseForOriginal(
  bookSlug: string,
  chapter: number,
  verse: number,
): { readonly chapter: number; readonly verse: number } {
  if (bookSlug === "miqueias" && chapter === 5) {
    if (verse === 1) return { chapter: 4, verse: 14 };
    return { chapter: 5, verse: verse - 1 };
  }
  return { chapter, verse };
}

/** O inverso só é usado para devolver ao cliente o número que ele selecionou. */
export function displayVerseForOriginal(
  bookSlug: string,
  requestedChapter: number,
  sourceChapter: number,
  sourceVerse: number,
): number {
  if (bookSlug === "miqueias" && requestedChapter === 5) {
    if (sourceChapter === 4 && sourceVerse === 14) return 1;
    if (sourceChapter === 5) return sourceVerse + 1;
  }
  return sourceVerse;
}
