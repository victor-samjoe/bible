/**
 * Tokenização da tradução exibida (ALIGNMENT-PIPELINE-001, A1).
 *
 * O pipeline não pode tokenizar por `split(" ")`, por dois motivos concretos
 * que estão nos dados de hoje:
 *
 * 1. **A BLIVRE guarda marcação USFM no próprio versículo.** Miqueias 5:2 está
 *    persistido como `… Belém Efrata, \add ainda que\add* sejas pequena …`.
 *    Um `split` ingênuo produziria os tokens `\add` e `que\add*`, e o pipeline
 *    tentaria alinhar uma marca tipográfica a uma palavra hebraica.
 * 2. **Palavra acrescentada pelo tradutor não deve ter original.** É isso que
 *    `\add` significa. Marcá-la como `supplied` permite à fila editorial dizer
 *    "sem original porque é acréscimo da tradução", em vez de registrar uma
 *    lacuna que ninguém vai conseguir preencher.
 *
 * Notas de rodapé (`\f … \f*`) e referências cruzadas (`\x … \x*`) são
 * descartadas com conteúdo e tudo: são aparato editorial da versão, não texto
 * do versículo, e alinhá-las seria erro de categoria.
 *
 * A normalização é importada de `passage-alignment.ts` de propósito. Aquele
 * módulo serve ao mapa editorial manual que o leitor exibe hoje; se cada frente
 * tivesse a sua normalização, o mesmo versículo poderia casar num lado e não
 * casar no outro.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco.
 */

import { normalizeComparisonWord } from "../passage-alignment.ts";
import type { TranslationToken } from "./contracts.ts";

/** Marcas de caractere cujo conteúdo é acréscimo do tradutor. */
const SUPPLIED_MARKERS: ReadonlySet<string> = new Set(["add", "addpn"]);

/** Marcas cujo conteúdo é aparato, não texto do versículo. */
const DISCARDED_MARKERS: ReadonlySet<string> = new Set(["f", "fe", "x", "rq"]);

const MARKER = /^\\([a-z]+[0-9]*)(\*?)/u;

/**
 * Remove a marcação e devolve o texto com um mapa de deslocamentos: cada
 * caractere mantido sabe de que posição do texto original veio.
 *
 * O mapa existe porque `start`/`end` do token precisam apontar para o texto
 * **como está persistido**. Sem ele, destacar a palavra na interface exigiria
 * refazer a busca por string e acertaria a ocorrência errada em versículos com
 * palavras repetidas.
 */
function stripUsfm(text: string): {
  readonly plain: string;
  readonly offsets: readonly number[];
  readonly supplied: readonly boolean[];
} {
  const plain: string[] = [];
  const offsets: number[] = [];
  const supplied: boolean[] = [];
  let suppliedDepth = 0;
  let index = 0;

  while (index < text.length) {
    if (text[index] === "\\") {
      const match = MARKER.exec(text.slice(index));
      if (match) {
        const name = match[1];
        const closing = match[2] === "*";
        index += match[0].length;
        if (DISCARDED_MARKERS.has(name)) {
          if (!closing) {
            // Pula o conteúdo inteiro até o fechamento correspondente.
            const end = text.indexOf(`\\${name}*`, index);
            index = end === -1 ? text.length : end + name.length + 2;
          }
          continue;
        }
        if (SUPPLIED_MARKERS.has(name)) {
          suppliedDepth = closing ? Math.max(0, suppliedDepth - 1) : suppliedDepth + 1;
        }
        continue;
      }
    }
    plain.push(text[index]);
    offsets.push(index);
    supplied.push(suppliedDepth > 0);
    index += 1;
  }

  return { plain: plain.join(""), offsets, supplied };
}

/** Pontuação de borda: sai do token, mas não desloca o que já foi medido. */
function trimPunctuation(chunk: string): { readonly start: number; readonly end: number } {
  const isEdge = (character: string): boolean =>
    /[\p{P}\p{S}]/u.test(character) && character !== "-";
  let start = 0;
  let end = chunk.length;
  while (start < end && isEdge(chunk[start])) start += 1;
  while (end > start && isEdge(chunk[end - 1])) end -= 1;
  return { start, end };
}

/**
 * Tokeniza o versículo da tradução. Determinística e sem perda de posição: a
 * mesma entrada devolve sempre os mesmos tokens, com os mesmos deslocamentos.
 */
export function tokenizeTranslationVerse(text: string): readonly TranslationToken[] {
  const { plain, offsets, supplied } = stripUsfm(text);
  const tokens: TranslationToken[] = [];
  let position = 0;
  let cursor = 0;

  while (cursor < plain.length) {
    if (/\s/u.test(plain[cursor])) {
      cursor += 1;
      continue;
    }
    let end = cursor;
    while (end < plain.length && !/\s/u.test(plain[end])) end += 1;
    const chunk = plain.slice(cursor, end);
    const trimmed = trimPunctuation(chunk);
    if (trimmed.end > trimmed.start) {
      const from = cursor + trimmed.start;
      const to = cursor + trimmed.end;
      const surface = plain.slice(from, to);
      const normalized = normalizeComparisonWord(surface);
      if (normalized.length > 0) {
        position += 1;
        tokens.push({
          position,
          surface,
          normalized,
          start: offsets[from],
          end: offsets[to - 1] + 1,
          // Um token é acréscimo quando qualquer caractere seu está dentro de
          // `\add`: a BLIVRE abre e fecha a marca no meio de uma oração
          // ("\add ainda que\add*"), não em limite de palavra.
          supplied: supplied.slice(from, to).some(Boolean),
        });
      }
    }
    cursor = end;
  }

  return tokens;
}

/** Formas normalizadas de uma expressão em pt-BR, na ordem em que aparecem. */
export function normalizePhrase(phrase: string): readonly string[] {
  return (phrase.match(/\S+/gu) ?? [])
    .map((word) => normalizeComparisonWord(word))
    .filter((word) => word.length > 0);
}

/**
 * Todas as ocorrências da expressão na tradução, como listas de posições.
 *
 * Devolver **todas** é o ponto. Quando "princípio" aparece duas vezes no
 * versículo, escolher uma delas exigiria olhar a ordem das palavras — isto é,
 * alinhar por posição. O pipeline prefere admitir a ambiguidade e mandar as
 * duas hipóteses para revisão editorial (ver `candidates.ts`).
 */
export function findPhraseSpans(
  tokens: readonly TranslationToken[],
  phrase: string,
): readonly (readonly number[])[] {
  const wanted = normalizePhrase(phrase);
  if (wanted.length === 0) return [];
  const spans: number[][] = [];
  for (let start = 0; start + wanted.length <= tokens.length; start += 1) {
    const matches = wanted.every((word, offset) => tokens[start + offset].normalized === word);
    if (matches) {
      spans.push(wanted.map((_, offset) => tokens[start + offset].position));
    }
  }
  return spans;
}
