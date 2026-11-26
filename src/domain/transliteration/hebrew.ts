import { transliterate } from "hebrew-transliteration";

/**
 * Saída calculada sobre a forma textual vocalizada, não sobre o lema ou Strong.
 * A modalidade acadêmica usa a biblioteca MIT `hebrew-transliteration` 2.11.0,
 * baseada na convenção SBL. A simplificação editorial deriva da acadêmica para
 * leitura em português: não é transcrição fonética nem revisão filológica.
 */
export type HebrewTransliteration = { readonly academic: string; readonly simplified: string; readonly needsReview: boolean };

function simpleFromSbl(value: string): string {
  // A biblioteca preserva o tetragrama sem vocalização reconstruída. A forma
  // simplificada também não deve sugerir pronúncia ou transformar W em V.
  if (value.toLowerCase() === "yhwh") return "YHWH";
  return value
    // Simplificação de consoantes geminadas e sinais que não existem em português.
    .replace(/šš/gu, "sh").replace(/š/gu, "sh").replace(/ś/gu, "s")
    .replace(/ṣ/gu, "tz").replace(/ḥ/gu, "ch").replace(/ḫ/gu, "ch")
    .replace(/ṯ/gu, "t").replace(/ḏ/gu, "d").replace(/ḵ/gu, "ch")
    .replace(/ḡ/gu, "g").replace(/ḇ/gu, "v").replace(/p̄/gu, "f")
    .replace(/w/gu, "v").replace(/ə/gu, "e")
    .normalize("NFD").replace(/[\u0300-\u036f]/gu, "").normalize("NFC")
    // Na leitura simplificada, conservar a pausa glotal somente entre vogais.
    .replace(/([aeiou])[ʾʿ](?=[aeiou])/giu, "$1'")
    .replace(/[ʾʿ]/gu, "");
}

export function transliterateHebrewSurface(surface: string): HebrewTransliteration | null {
  const form = surface.trim().replace(/\//gu, "");
  if (!form || !/^[\u0591-\u05c7\u05d0-\u05ea\u05f0-\u05f4]+$/u.test(form)) return null;
  // Palavras sem vogais não permitem inferir uma leitura vocalizada confiável.
  const withoutCantillation = form.normalize("NFD").replace(/[\u0591-\u05af]/gu, "");
  // Shuruq is written as waw + dagesh and may be the only vowel in a word.
  if (!/[\u05b0-\u05bb\u05c7]/u.test(form) && !/ו\u05bc/u.test(withoutCantillation)) return null;
  try {
    const academic = transliterate(form);
    if (!academic || /[\u0590-\u05ff]/u.test(academic)) return null;
    return { academic, simplified: simpleFromSbl(academic), needsReview: true };
  } catch {
    return null;
  }
}
