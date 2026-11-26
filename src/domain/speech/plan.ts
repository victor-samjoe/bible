/**
 * Plano de leitura em voz alta (LEITURA-VOZ-001).
 *
 * Parte pura: escolhe a voz, decide o que é falável e quebra o texto em trechos
 * curtos (navegadores cortam falas longas). Nada aqui toca o DOM.
 *
 * Honestidade sobre o áudio: o navegador oferece voz do hebraico e do grego
 * **modernos**. Não existe voz de hebraico bíblico nem de grego koiné, então
 * toda fala de texto original é marcada como aproximada, e sem voz do idioma o
 * botão não aparece. Nunca se lê hebraico com voz de outro idioma.
 */

export type SpeechTarget = "hbo" | "grc" | "pt";

export type VoiceLike = { readonly lang: string; readonly name?: string };

const PREFIX: Readonly<Record<SpeechTarget, RegExp>> = {
  hbo: /^(?:he|iw)(?:[-_]|$)/iu,
  grc: /^el(?:[-_]|$)/iu,
  pt: /^pt(?:[-_]|$)/iu,
};

export type VoicePick<T extends VoiceLike> = {
  readonly voice: T;
  /** Verdadeiro para hebraico e grego: voz moderna lendo texto antigo. */
  readonly approximate: boolean;
};

/** Voz do idioma, ou `null`. Para português, prefere pt-BR. */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], target: SpeechTarget): VoicePick<T> | null {
  const matching = voices.filter((voice) => PREFIX[target].test(voice.lang));
  if (!matching.length) return null;
  const voice = target === "pt" ? (matching.find((item) => /^pt[-_]BR$/iu.test(item.lang)) ?? matching[0]) : matching[0];
  return { voice, approximate: target !== "pt" };
}

/** Texto seguro para falar: vazio ou com marcação USFM crua não é falado. */
export function speakable(text: string): string | null {
  if (text.includes("\\")) return null;
  const clean = text.replace(/\s+/gu, " ").trim();
  return clean.length ? clean : null;
}

/** Quebra em trechos de até `max` caracteres, preferindo fim de frase. */
export function chunkText(text: string, max = 200): string[] {
  const clean = speakable(text);
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?;:׃·])\s+/u);
  const chunks: string[] = [];
  let current = "";
  const push = () => { if (current) chunks.push(current); current = ""; };
  for (const sentence of sentences) {
    if (sentence.length > max) {
      push();
      let rest = sentence;
      while (rest.length > max) {
        const cut = rest.lastIndexOf(" ", max);
        const at = cut > 0 ? cut : max;
        chunks.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      current = rest;
    } else if (current && current.length + 1 + sentence.length > max) {
      push();
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  push();
  return chunks;
}

export type Utterance = { readonly verse: number; readonly text: string };

/**
 * Capítulo inteiro como fila de falas, na ordem. Versículo sem texto falável
 * é pulado, nunca preenchido. `from` começa de um versículo (retomada).
 */
export function chapterUtterances(
  verses: readonly { readonly number: number; readonly content: string }[],
  options: { readonly from?: number; readonly max?: number } = {},
): Utterance[] {
  const out: Utterance[] = [];
  for (const verse of [...verses].sort((a, b) => a.number - b.number)) {
    if (options.from !== undefined && verse.number < options.from) continue;
    for (const text of chunkText(verse.content, options.max)) out.push({ verse: verse.number, text });
  }
  return out;
}
