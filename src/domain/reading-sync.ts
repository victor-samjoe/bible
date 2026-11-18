/**
 * Conciliação entre o que está no navegador e o que está na conta. Funções
 * puras: nenhum acesso a React, banco, rede ou `window`.
 *
 * O problema que este módulo resolve: a pessoa lê sem conta, marca versículos,
 * escreve notas, e só então entra. Nesse instante existem duas verdades
 * parciais. Descartar a do navegador perderia trabalho real; descartar a da
 * conta perderia o que ela anotou em outro aparelho.
 *
 * A regra é **a conta ganha no conflito, e o navegador contribui o que a conta
 * não tem**. Conflito aqui é a mesma chave com valor diferente — o mesmo
 * versículo destacado em duas cores, a mesma seleção com duas notas. Nesse
 * caso vale a conta, porque é o que sobreviveu a fechar o navegador, e porque
 * a alternativa seria uma aba antiga sobrescrever a anotação nova feita em
 * outro aparelho.
 *
 * Marca que só existe no navegador sobe para a conta. É o único caminho pelo
 * qual o trabalho feito antes de entrar não se perde.
 */

import {
  expandVerseList,
  isHighlightColor,
  isMarkInScope,
  parseMarkKey,
  type HighlightColor,
} from "./reader-marks";

export type MarkSnapshot = {
  /** `livro.capítulo.versículo` -> cor */
  readonly highlights: Readonly<Record<string, HighlightColor>>;
  /** `livro.capítulo.lista` -> texto */
  readonly notes: Readonly<Record<string, string>>;
  /** escopos `livro.capítulo` lidos */
  readonly readChapters: readonly string[];
};

/**
 * Carga de um capítulo, do navegador para o servidor. Os valores são `string`
 * e não `HighlightColor` de propósito: isto atravessa a rede, e tipar como cor
 * válida aqui seria afirmar no compilador algo que só a validação em
 * `parseChapterMarksPayload` pode garantir.
 */
export type ChapterMarksPayload = {
  readonly scope: string;
  readonly highlights: Readonly<Record<string, string>>;
  readonly notes: Readonly<Record<string, string>>;
  readonly read: boolean;
};

export const emptySnapshot: MarkSnapshot = { highlights: {}, notes: {}, readChapters: [] };

/** Une os dois lados. Em chave repetida vale `account`. */
export function mergeMarks(account: MarkSnapshot, local: MarkSnapshot): MarkSnapshot {
  return {
    highlights: { ...local.highlights, ...account.highlights },
    notes: { ...local.notes, ...account.notes },
    readChapters: [...new Set([...local.readChapters, ...account.readChapters])],
  };
}

/** Escopo (`livro.capítulo`) de uma chave de marca, ou `null` se inválida. */
function scopeOf(key: string): string | null {
  return parseMarkKey(key)?.scope ?? null;
}

/**
 * Capítulos em que o navegador tem algo que a conta não tem. São esses, e
 * somente esses, que precisam subir no primeiro acesso autenticado — reenviar
 * capítulo já sincronizado seria escrita à toa.
 *
 * `limit` existe para que um navegador com muita marca não vire uma rajada de
 * gravações; o resto sobe quando a pessoa abrir aquele capítulo.
 */
export function scopesToUpload(account: MarkSnapshot, local: MarkSnapshot, limit: number): string[] {
  const pending = new Set<string>();

  for (const [key, color] of Object.entries(local.highlights)) {
    if (account.highlights[key] === color) continue;
    const scope = scopeOf(key);
    if (scope !== null) pending.add(scope);
  }
  for (const [key, text] of Object.entries(local.notes)) {
    if (account.notes[key] === text) continue;
    const scope = scopeOf(key);
    if (scope !== null) pending.add(scope);
  }
  const accountRead = new Set(account.readChapters);
  for (const scope of local.readChapters) {
    if (!accountRead.has(scope)) pending.add(scope);
  }

  return [...pending].slice(0, Math.max(0, limit));
}

/**
 * Recorta de um conjunto de marcas apenas o capítulo pedido, no formato que o
 * Server Action grava. As chaves perdem o prefixo do escopo: o servidor já
 * sabe de que capítulo se trata e repetir o prefixo em cada chave seria
 * convite a divergência entre o prefixo e o escopo declarado.
 */
export function chapterMarksPayload(scope: string, marks: MarkSnapshot): ChapterMarksPayload {
  const highlights: Record<string, HighlightColor> = {};
  for (const [key, color] of Object.entries(marks.highlights)) {
    if (!isMarkInScope(key, scope)) continue;
    const verses = parseMarkKey(key)?.verses ?? [];
    // Destaque é sempre de um versículo só; chave com intervalo não é destaque.
    if (verses.length !== 1) continue;
    highlights[String(verses[0])] = color;
  }

  const notes: Record<string, string> = {};
  for (const [key, text] of Object.entries(marks.notes)) {
    if (!isMarkInScope(key, scope)) continue;
    notes[key.slice(scope.length + 1)] = text;
  }

  return { scope, highlights, notes, read: marks.readChapters.includes(scope) };
}

// ---------------------------------------------------------------------------
// Entrada do servidor
// ---------------------------------------------------------------------------

/** Teto por capítulo, para uma requisição não virar escrita sem fim. */
const MAX_HIGHLIGHTS_PER_CHAPTER = 200;
const MAX_NOTES_PER_CHAPTER = 100;
const MAX_NOTE_LENGTH = 10000;

export type ParsedChapterMarks = {
  readonly bookSlug: string;
  readonly chapterNumber: number;
  readonly marks: {
    readonly highlights: ReadonlyArray<{ readonly verse: number; readonly color: HighlightColor }>;
    readonly notes: ReadonlyArray<{ readonly verseList: string; readonly anchor: number; readonly body: string }>;
    readonly read: boolean;
  };
};

/**
 * Lê a carga que veio do navegador. Vive aqui, e não no servidor, por dois
 * motivos: é função pura, e o servidor que a usaria arrasta o banco junto,
 * o que a tornaria impossível de testar sem subir Postgres.
 *
 * Devolve `null` apenas quando o escopo não serve — sem capítulo não há o que
 * gravar. Marca individual inválida é **descartada em silêncio**: quem está
 * lendo não deve perder uma nota boa porque outra veio torta, e recusar a
 * carga inteira por causa de uma chave estragada entregaria isso.
 */
export function parseChapterMarksPayload(payload: ChapterMarksPayload): ParsedChapterMarks | null {
  const scope = typeof payload?.scope === "string" ? payload.scope : "";
  // `parseMarkKey` valida `livro.capítulo.versículos`; o escopo é o mesmo
  // formato sem a parte final, então acrescentamos uma só para conferir.
  if (parseMarkKey(`${scope}.1`) === null) return null;
  const separator = scope.lastIndexOf(".");
  const bookSlug = scope.slice(0, separator);
  const chapterNumber = Number(scope.slice(separator + 1));
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 1) return null;

  const highlights: { verse: number; color: HighlightColor }[] = [];
  for (const [rawVerse, rawColor] of Object.entries(payload.highlights ?? {})) {
    if (highlights.length >= MAX_HIGHLIGHTS_PER_CHAPTER) break;
    // `Number("")` é 0 e `Number(" 7 ")` é 7: a checagem de faixa descarta o
    // primeiro, e o segundo nunca chega aqui porque a chave vem de `String(n)`.
    const verse = Number(rawVerse);
    if (!Number.isSafeInteger(verse) || verse < 1 || verse > 176) continue;
    if (!isHighlightColor(rawColor)) continue;
    highlights.push({ verse, color: rawColor });
  }

  const notes: { verseList: string; anchor: number; body: string }[] = [];
  for (const [verseList, rawBody] of Object.entries(payload.notes ?? {})) {
    if (notes.length >= MAX_NOTES_PER_CHAPTER) break;
    const anchor = expandVerseList(verseList).at(0);
    if (anchor === undefined) continue;
    if (typeof rawBody !== "string") continue;
    const body = rawBody.trim().slice(0, MAX_NOTE_LENGTH);
    if (body.length === 0) continue;
    notes.push({ verseList, anchor, body });
  }

  return { bookSlug, chapterNumber, marks: { highlights, notes, read: payload.read === true } };
}
