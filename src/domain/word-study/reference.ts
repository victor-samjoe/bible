/**
 * Referência canônica e ordenação do índice de estudo de palavras
 * (fila Claude 3, item 2).
 *
 * Existe por causa do achado §3.3 do item 1: o índice lexical atual ordena
 * referências com `canonicalRef.localeCompare(...)`, o que devolve Atos antes
 * de Gênesis e `1:10` antes de `1:2`. Para uma tela de "usos em toda a Bíblia"
 * isso não é um detalhe de apresentação — a ordem é a chave de partição e de
 * paginação, então um comparador errado contamina o arquivo gravado, e não só a
 * tela.
 *
 * A peça central é `refCode`: um inteiro `LLCCCVVV` (livro, capítulo,
 * versículo) que torna a comparação numérica, a partição por intervalo trivial
 * e a lista de ocorrências compressível por delta. Ordenar inteiros também
 * elimina a classe inteira de erro de ordenar número como texto.
 *
 * A ordem dos livros vem de `CANON` (`src/domain/lexicon/canon.ts`), que já
 * existia com os 66 livros corretos e não era usada como ordenador em lugar
 * nenhum. Nada aqui redefine o cânone.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco, sem relógio.
 */

import { CANON } from "../lexicon/canon.ts";

/** Teto de capítulo e versículo embutido no `refCode`. */
const CHAPTER_SPAN = 1_000;
const VERSE_SPAN = 1_000;

/** Salmo 119 tem 176 versículos e Salmos tem 150 capítulos; 999 cobre com folga. */
const MAX_CHAPTER = CHAPTER_SPAN - 1;
const MAX_VERSE = VERSE_SPAN - 1;

export type CanonicalRef = {
  /** Código USFM, como as fontes publicam: `GEN`, `JHN`. */
  readonly book: string;
  /** Posição no cânone, 1-based: Gênesis = 1, Apocalipse = 66. */
  readonly bookOrder: number;
  readonly chapter: number;
  readonly verse: number;
};

const BOOK_ORDER: ReadonlyMap<string, number> = new Map(
  CANON.map((book, index) => [book.code, index + 1]),
);

const BOOK_BY_ORDER: readonly string[] = CANON.map((book) => book.code);

export type RefProblem = { readonly raw: string; readonly reason: string };

const REF_SHAPE = /^([A-Z0-9]{3})\s+(\d{1,3}):(\d{1,3})$/u;

/**
 * Lê `GEN 1:1`. Recusa — sem consertar — livro fora do cânone de 66, número
 * fora de faixa, sufixo de versículo (`1:1a`) e faixa (`1:1-3`).
 *
 * Sufixo e faixa são recusados de propósito: as fontes aprovadas não os
 * publicam, e aceitá-los sem um mapa de versificação declarado (item 3) seria
 * inventar correspondência. A recusa é informação para o relatório, não um
 * defeito a silenciar.
 */
export function parseRef(raw: string): { readonly ref: CanonicalRef } | { readonly problem: RefProblem } {
  const trimmed = raw.trim();
  const match = REF_SHAPE.exec(trimmed);
  if (!match) {
    return { problem: { raw, reason: `referência fora da forma 'XXX C:V': '${trimmed}'` } };
  }
  const book = match[1] ?? "";
  const bookOrder = BOOK_ORDER.get(book);
  if (bookOrder === undefined) {
    return { problem: { raw, reason: `livro fora do cânone de 66: '${book}'` } };
  }
  const chapter = Number.parseInt(match[2] ?? "", 10);
  const verse = Number.parseInt(match[3] ?? "", 10);
  if (chapter < 1 || chapter > MAX_CHAPTER) {
    return { problem: { raw, reason: `capítulo fora de faixa: ${chapter}` } };
  }
  // Versículo 0 é recusado: a tradição que conta o título do salmo como
  // versículo 0 existe, mas tratá-la exige o mapa versionado do item 3, e
  // aceitá-la aqui produziria âncora que o leitor não sabe exibir.
  if (verse < 1 || verse > MAX_VERSE) {
    return { problem: { raw, reason: `versículo fora de faixa: ${verse}` } };
  }
  return { ref: { book, bookOrder, chapter, verse } };
}

/**
 * Inteiro canônico `LLCCCVVV`. Monotônico na ordem do cânone, então comparar
 * `refCode` **é** comparar canonicamente — o que torna a partição por intervalo
 * e a compressão por delta corretas por construção.
 *
 * Gênesis 1:1 = 1_001_001; Apocalipse 22:21 = 66_022_021. O maior valor
 * possível é 66_999_999, bem dentro do inteiro seguro.
 */
export function refCode(ref: CanonicalRef): number {
  return ref.bookOrder * CHAPTER_SPAN * VERSE_SPAN + ref.chapter * VERSE_SPAN + ref.verse;
}

export function decodeRefCode(code: number): CanonicalRef | null {
  if (!Number.isSafeInteger(code) || code <= 0) return null;
  const bookOrder = Math.floor(code / (CHAPTER_SPAN * VERSE_SPAN));
  const rest = code - bookOrder * CHAPTER_SPAN * VERSE_SPAN;
  const chapter = Math.floor(rest / VERSE_SPAN);
  const verse = rest - chapter * VERSE_SPAN;
  const book = BOOK_BY_ORDER[bookOrder - 1];
  if (book === undefined || chapter < 1 || verse < 1) return null;
  return { book, bookOrder, chapter, verse };
}

export function formatRef(ref: CanonicalRef): string {
  return `${ref.book} ${ref.chapter}:${ref.verse}`;
}

/** Ordem canônica: livro pelo cânone, depois capítulo e versículo numéricos. */
export function compareRefs(left: CanonicalRef, right: CanonicalRef): number {
  return refCode(left) - refCode(right);
}

/**
 * Posição da palavra dentro do versículo, tirada do sufixo `!N` que o MACULA
 * publica (`GEN 1:1!1`). Vale repetir por que ela importa: o lado hebraico é
 * morfêmico, então `GEN 1:1!1` aparece duas vezes — preposição e substantivo —
 * e sem a posição não há como devolver "os morfemas da palavra 1".
 */
export function parseRefWithPosition(
  raw: string,
): { readonly ref: CanonicalRef; readonly position: number | null } | { readonly problem: RefProblem } {
  const [base = "", suffix] = raw.split("!");
  const parsed = parseRef(base);
  if ("problem" in parsed) return parsed;
  if (suffix === undefined) return { ref: parsed.ref, position: null };
  const trimmed = suffix.trim();
  if (!/^\d{1,3}$/u.test(trimmed)) {
    return { problem: { raw, reason: `posição de palavra fora da forma '!N': '${suffix}'` } };
  }
  const position = Number.parseInt(trimmed, 10);
  if (position < 1) {
    return { problem: { raw, reason: `posição de palavra inválida: ${position}` } };
  }
  return { ref: parsed.ref, position };
}
