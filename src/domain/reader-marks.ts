/**
 * Chaves e rótulos das marcas de leitura (tarefa C13). Funções puras: nenhum
 * acesso a React, banco, rede ou armazenamento.
 *
 * O leitor navega por qualquer livro e capítulo, então toda marca carrega o
 * capítulo na própria chave. Sem isso, um destaque de Gênesis 1:5 reapareceria
 * em João 1:5.
 *
 * - destaque é por versículo:            `genesis.1.5`
 * - nota é da seleção que a originou:    `genesis.1.3-5`, `genesis.1.3,7`
 * - capítulo lido é só o escopo:         `genesis.1`
 *
 * A lista de versículos da nota é compactada e **precisa**: uma seleção de 3 e 5,
 * sem o 4, vira `3,5` e não `3-5`. A chave não pode afirmar mais do que foi
 * selecionado.
 */

export type HighlightColor = "amarelo" | "verde" | "azul" | "rosa";

export const highlightColors: readonly HighlightColor[] = ["amarelo", "verde", "azul", "rosa"];

export function isHighlightColor(value: unknown): value is HighlightColor {
  return typeof value === "string" && (highlightColors as readonly string[]).includes(value);
}

const SCOPE = "[a-z0-9-]{1,64}";
const VERSE_PART = "\\d{1,3}(?:-\\d{1,3})?(?:,\\d{1,3}(?:-\\d{1,3})?)*";
const MAX_VERSE_PART = 64;

export const chapterScopeSchema = new RegExp(`^${SCOPE}\\.\\d{1,3}$`);
export const verseMarkKeySchema = new RegExp(`^${SCOPE}\\.\\d{1,3}\\.${VERSE_PART}$`);

/** Escopo do capítulo: prefixo de todas as marcas dele. */
export function chapterScope(bookSlug: string, chapter: number): string {
  return `${bookSlug}.${chapter}`;
}

/** Ordena, remove repetidos e descarta número inválido. */
export function normalizeVerses(verses: Iterable<number>): number[] {
  const unique = new Set<number>();
  for (const verse of verses) {
    if (Number.isSafeInteger(verse) && verse >= 1 && verse <= 176) unique.add(verse);
  }
  return [...unique].sort((left, right) => left - right);
}

/** `[3,4,5,9]` vira `"3-5,9"`. Vazio devolve string vazia. */
export function compactVerseList(verses: Iterable<number>): string {
  const ordered = normalizeVerses(verses);
  const parts: string[] = [];
  let index = 0;
  while (index < ordered.length) {
    const start = ordered[index] as number;
    let end = start;
    while (index + 1 < ordered.length && ordered[index + 1] === end + 1) {
      index += 1;
      end = ordered[index] as number;
    }
    parts.push(start === end ? `${start}` : `${start}-${end}`);
    index += 1;
  }
  return parts.join(",");
}

/** `"3-5,9"` vira `[3,4,5,9]`. Formato inválido devolve vazio. */
export function expandVerseList(value: string): number[] {
  if (value.length === 0 || value.length > MAX_VERSE_PART) return [];
  if (!new RegExp(`^${VERSE_PART}$`).test(value)) return [];
  const verses = new Set<number>();
  for (const part of value.split(",")) {
    const [rawStart, rawEnd] = part.split("-");
    const start = Number(rawStart);
    const end = rawEnd === undefined ? start : Number(rawEnd);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return [];
    if (start < 1 || end < start || end > 176) return [];
    for (let verse = start; verse <= end; verse += 1) verses.add(verse);
  }
  return normalizeVerses(verses);
}

/** Chave de marca. Seleção vazia não gera chave. */
export function verseMarkKey(scope: string, verses: Iterable<number>): string | null {
  if (!chapterScopeSchema.test(scope)) return null;
  const compact = compactVerseList(verses);
  if (compact.length === 0 || compact.length > MAX_VERSE_PART) return null;
  return `${scope}.${compact}`;
}

export type ParsedMarkKey = { readonly scope: string; readonly verses: readonly number[] };

export function parseMarkKey(key: string): ParsedMarkKey | null {
  if (!verseMarkKeySchema.test(key)) return null;
  const separator = key.lastIndexOf(".");
  const scope = key.slice(0, separator);
  const verses = expandVerseList(key.slice(separator + 1));
  if (!chapterScopeSchema.test(scope) || verses.length === 0) return null;
  return { scope, verses };
}

/** A marca pertence a este capítulo? Comparação por escopo completo, não por prefixo solto. */
export function isMarkInScope(key: string, scope: string): boolean {
  const parsed = parseMarkKey(key);
  return parsed !== null && parsed.scope === scope;
}

/** Primeiro versículo da marca: onde o indicador aparece no texto. */
export function markAnchor(key: string): number | null {
  const parsed = parseMarkKey(key);
  return parsed ? (parsed.verses[0] as number) : null;
}

/** `"Gênesis 1"` + `[3,4,5,9]` vira `"Gênesis 1:3-5,9"`. */
export function selectionLabel(reference: string, verses: Iterable<number>): string {
  const compact = compactVerseList(verses);
  return compact.length === 0 ? reference : `${reference}:${compact}`;
}

/** Alterna um versículo na seleção, devolvendo um conjunto novo. */
export function toggleVerseIn(
  selection: ReadonlySet<number>,
  verse: number,
): ReadonlySet<number> {
  if (!Number.isSafeInteger(verse) || verse < 1 || verse > 176) return selection;
  const next = new Set(selection);
  if (next.has(verse)) next.delete(verse);
  else next.add(verse);
  return next;
}
