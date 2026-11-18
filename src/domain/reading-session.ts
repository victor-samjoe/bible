/**
 * Leitura do registro local de leitura (tarefa C15). Funções puras: recebem
 * strings cruas e devolvem dados validados. Nenhum acesso a React, banco, rede
 * ou `window` acontece aqui — quem lê o armazenamento é a interface.
 *
 * De onde vêm os dados:
 *
 * - `reader-session-v3` é escrito pelo leitor (`app/biblia/reader-state.tsx`) e
 *   guarda preferências, destaques, notas e capítulos marcados como lidos;
 * - `reader-last-chapter-v1` é escrito por `app/biblia/reading-pointer.tsx` e
 *   guarda apenas o último capítulo aberto, para o painel oferecer "retomar".
 *
 * Os dois vivem em `sessionStorage`: somem quando a aba fecha e não são conta,
 * nuvem nem banco. O painel precisa dizer isso, porque a sincronização só existe
 * depois do Auth real (C5). Chave, marca ou contagem inválida é descartada: o
 * painel não mostra número que não veio do registro.
 */

import { chapterScopeSchema, parseMarkKey } from "./reader-marks";

/** Chave do estado do leitor. Precisa acompanhar `SESSION_KEY` do leitor. */
export const READER_SESSION_KEY = "reader-session-v3";
/** Chave do ponteiro de "última leitura", criada pela tarefa C15. */
export const READING_POINTER_KEY = "reader-last-chapter-v1";

const MAX_CHAPTERS = 4000;
const MAX_LABEL_LENGTH = 48;
const MAX_LABEL_WORDS = 5;

export type ChapterRecord = {
  /** Slug do livro, como está na URL do leitor. */
  readonly book: string;
  readonly chapter: number;
  /** Escopo do leitor, no formato `livro.capítulo`. */
  readonly scope: string;
  /** Caminho canônico do capítulo. */
  readonly path: string;
};

export type ResumePoint = ChapterRecord & {
  /** Referência exibível capturada do próprio capítulo, ou `null`. */
  readonly label: string | null;
  /** Instante ISO em que o capítulo foi aberto, ou `null` se inválido. */
  readonly at: string | null;
};

export type LocalReadingSnapshot = {
  readonly resume: ResumePoint | null;
  readonly completed: readonly ChapterRecord[];
  readonly completedCount: number;
  readonly noteCount: number;
  readonly highlightCount: number;
  /** Existe algum registro local? Falso significa "nada para mostrar". */
  readonly hasLocalData: boolean;
};

export const emptySnapshot: LocalReadingSnapshot = {
  resume: null,
  completed: [],
  completedCount: 0,
  noteCount: 0,
  highlightCount: 0,
  hasLocalData: false,
};

function chapterPathOf(book: string, chapter: number): string {
  return `/biblia/${book}/${chapter}`;
}

function recordOf(book: string, chapter: number): ChapterRecord | null {
  const scope = `${book}.${chapter}`;
  if (!chapterScopeSchema.test(scope)) return null;
  if (!Number.isSafeInteger(chapter) || chapter < 1) return null;
  return { book, chapter, scope, path: chapterPathOf(book, chapter) };
}

/** `"genesis.1"` vira um registro de capítulo. Formato inválido devolve `null`. */
export function parseChapterScope(scope: unknown): ChapterRecord | null {
  if (typeof scope !== "string" || !chapterScopeSchema.test(scope)) return null;
  const separator = scope.lastIndexOf(".");
  const book = scope.slice(0, separator);
  const chapter = Number(scope.slice(separator + 1));
  return recordOf(book, chapter);
}

/**
 * Capítulo da rota do leitor. `/biblia` sozinho não é capítulo: lá o leitor
 * ainda vai redirecionar para o primeiro livro do corpus.
 */
export function parseReaderPath(pathname: unknown): ChapterRecord | null {
  if (typeof pathname !== "string") return null;
  const parts = pathname.split(/[?#]/)[0]?.split("/").filter((part) => part.length > 0) ?? [];
  if (parts.length !== 3 || parts[0] !== "biblia") return null;
  const book = parts[1] as string;
  const raw = parts[2] as string;
  if (!/^\d{1,3}$/.test(raw)) return null;
  return recordOf(book, Number(raw));
}

function sanitizeLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim();
  if (label.length === 0 || label.length > MAX_LABEL_LENGTH) return null;
  return label;
}

function sanitizeInstant(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 40) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? value : null;
}

/**
 * Referência exibível a partir do título da página do capítulo, que o servidor
 * monta com o nome real do livro vindo do corpus. O número do capítulo da rota é
 * a prova: sem ele no título, nenhum rótulo é aceito, e o painel mostra o
 * caminho em vez de inventar um nome de livro.
 */
export function chapterLabelFromTitle(title: unknown, chapter: number): string | null {
  if (typeof title !== "string" || !Number.isSafeInteger(chapter) || chapter < 1) return null;
  const head = (title.split("|")[0] ?? "").trim();
  if (head.length === 0) return null;
  const words = head.split(/\s+/);
  const target = String(chapter);
  const index = words.lastIndexOf(target);
  if (index < 0 || index + 1 > MAX_LABEL_WORDS) return null;
  const label = words.slice(0, index + 1).join(" ");
  return sanitizeLabel(label);
}

/** Ponteiro gravado pelo leitor. JSON inválido ou rota inválida devolve `null`. */
export function parseReadingPointer(raw: unknown): ResumePoint | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const source = parsed as Record<string, unknown>;
  const chapter = typeof source.chapter === "number" ? source.chapter : Number.NaN;
  const record =
    typeof source.book === "string" && Number.isSafeInteger(chapter)
      ? recordOf(source.book, chapter)
      : null;
  if (!record) return null;
  return { ...record, label: sanitizeLabel(source.label), at: sanitizeInstant(source.at) };
}

/**
 * Retrato do que existe localmente. Contagens vêm das chaves válidas, nunca de
 * um total declarado pelo armazenamento.
 */
export function parseLocalReadingSnapshot(input: {
  readonly session: unknown;
  readonly pointer: unknown;
}): LocalReadingSnapshot {
  const resume = parseReadingPointer(input.pointer);
  let session: unknown = null;
  if (typeof input.session === "string" && input.session.length > 0) {
    try {
      session = JSON.parse(input.session);
    } catch {
      session = null;
    }
  }

  const source =
    typeof session === "object" && session !== null ? (session as Record<string, unknown>) : {};

  const completed: ChapterRecord[] = [];
  const seen = new Set<string>();
  if (Array.isArray(source.readChapters)) {
    for (const entry of source.readChapters) {
      if (completed.length >= MAX_CHAPTERS) break;
      const record = parseChapterScope(entry);
      if (!record || seen.has(record.scope)) continue;
      seen.add(record.scope);
      completed.push(record);
    }
  }

  const noteCount = countMarkKeys(source.notes, (value) => typeof value === "string" && value.trim().length > 0);
  const highlightCount = countMarkKeys(source.highlights, (value) => typeof value === "string" && value.length > 0);

  return {
    resume,
    completed,
    completedCount: completed.length,
    noteCount,
    highlightCount,
    hasLocalData:
      resume !== null || completed.length > 0 || noteCount > 0 || highlightCount > 0,
  };
}

function countMarkKeys(value: unknown, isValidValue: (value: unknown) => boolean): number {
  if (typeof value !== "object" || value === null) return 0;
  let total = 0;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (total >= MAX_CHAPTERS) break;
    if (parseMarkKey(key) !== null && isValidValue(entry)) total += 1;
  }
  return total;
}
