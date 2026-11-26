/**
 * Romanização da forma grega em alfabeto latino, segundo as regras de letras
 * e ditongos ALA-LC para grego antigo: https://www.loc.gov/catdir/cpso/romanization/greeka.pdf
 *
 * Recebe a forma da ocorrência, nunca Strong ou lema. A convenção ALA-LC
 * omite acentos, espírito brando e iota subscrito; ela não é uma reconstrução
 * de pronúncia. Entradas com sinais ou letras não reconhecidos retornam null.
 */
export type GreekTransliteration = { readonly academic: string; readonly simplified: string; readonly notes: readonly string[] };

type Letter = { readonly base: string; readonly marks: string[]; readonly upper: boolean };

const ROMAN: Readonly<Record<string, string>> = {
  α: "a", β: "b", γ: "g", δ: "d", ε: "e", ζ: "z", η: "ē", θ: "th",
  ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
  ρ: "r", σ: "s", ς: "s", ϲ: "s", τ: "t", υ: "y", φ: "ph", χ: "ch",
  ψ: "ps", ω: "ō", ϝ: "w", ϙ: "ḳ",
};
const KNOWN_MARKS = new Set(["\u0300", "\u0301", "\u0342", "\u0313", "\u0314", "\u0308", "\u0345", "\u0304", "\u0306", "\u0344"]);
const VOWELS = new Set(["α", "ε", "η", "ι", "ο", "υ", "ω"]);
const DIPHTHONGS = new Set(["αι", "ει", "οι", "υι", "αυ", "ευ", "ηυ", "ου", "ωυ"]);

function clusters(word: string): Letter[] | null {
  const result: Letter[] = [];
  for (const char of word.normalize("NFD")) {
    if (/\p{M}/u.test(char)) {
      if (!KNOWN_MARKS.has(char) || result.length === 0) return null;
      result[result.length - 1]!.marks.push(char);
      continue;
    }
    const base = char.toLowerCase();
    if (!(base in ROMAN)) return null;
    result.push({ base, marks: [], upper: char !== base });
  }
  return result.length ? result : null;
}

function greekCase(text: string, upper: boolean): string {
  return upper ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function transliterateGreekSurface(surface: string): GreekTransliteration | null {
  // Marcas editoriais SBLGNT e pontuação de borda não são letras; conservam-se
  // na fonte exibida, mas não se convertem em sons. Dentro da palavra, recusamos.
  const input = surface.trim().replace(/^[⸀⸁⸂⸃⸄⸅⸆⸇\[\]]+|[⸀⸁⸂⸃⸄⸅⸆⸇\[\].,;·;]+$/gu, "");
  // Elision apostrophe is retained, not interpreted as a missing vowel.
  const elision = /['’ʼ᾽]$/u.test(input) ? input.slice(-1) : "";
  const letters = clusters(elision ? input.slice(0, -1) : input);
  if (!letters) return null;
  let output = "";
  for (let i = 0; i < letters.length; i += 1) {
    const current = letters[i]!;
    const next = letters[i + 1];
    const diphthong = next && DIPHTHONGS.has(current.base + next.base) && !next.marks.includes("\u0308");
    const secondInDiphthong = i > 0 && DIPHTHONGS.has(letters[i - 1]!.base + current.base) && !current.marks.includes("\u0308");
    const rough = (!secondInDiphthong && current.marks.includes("\u0314")) || Boolean(diphthong && next?.marks.includes("\u0314"));
    if (rough && !VOWELS.has(current.base) && current.base !== "ρ") return null;
    let roman = ROMAN[current.base]!;
    if (current.base === "γ" && next && ["γ", "κ", "ξ", "χ"].includes(next.base)) roman = "n";
    if (current.base === "υ" && secondInDiphthong) roman = "u";
    if (rough && current.base === "ρ") roman += "h";
    else if (rough) roman = `h${roman}`;
    output += greekCase(roman, current.upper);
  }
  const academic = output + elision;
  const simplified = academic.normalize("NFD").replace(/[\u0304\u0323]/gu, "").normalize("NFC");
  const notes = letters.some((letter) => letter.marks.includes("\u0345"))
    ? ["A convenção ALA-LC não representa o iota subscrito; consulte o texto grego para essa distinção."]
    : [];
  return { academic, simplified, notes };
}
