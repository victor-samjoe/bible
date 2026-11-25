"use client";

import { READER_SESSION_KEY, parseChapterScope } from "../../src/domain/reading-session";

/**
 * Capítulos lidos no registro **local** do navegador.
 *
 * Este é o mesmo `sessionStorage` que o leitor escreve (`reader-session-v3`),
 * e é por isso que toda escrita aqui é ler-alterar-gravar preservando o resto
 * do objeto: preferências, destaques e notas vivem na mesma chave, e sobrescrever
 * o objeto inteiro apagaria o trabalho da pessoa.
 *
 * `sessionStorage` morre quando a aba fecha. A página de progresso diz isso com
 * todas as letras e não promete sincronização.
 *
 * Por que a página autenticada também escreve aqui: ao abrir um capítulo, o
 * leitor **une** o que está na conta com o que está neste registro
 * (`src/domain/reading-sync.ts`). Se a pessoa desmarcasse um capítulo na conta e
 * o registro local continuasse com ele, o leitor o traria de volta. Corrigir uma
 * marca exige, portanto, corrigir os dois lados.
 */

/** Mesmo teto do leitor (`MAX_MARKS`), para os dois lados cortarem no mesmo ponto. */
const MAX_SCOPES = 4000;

export type LocalProgress = {
  /** O armazenamento respondeu? `false` quando está bloqueado ou ausente. */
  readonly available: boolean;
  readonly scopes: readonly string[];
};

const unavailable: LocalProgress = { available: false, scopes: [] };

function readRaw(): Record<string, unknown> | null {
  const raw = window.sessionStorage.getItem(READER_SESSION_KEY);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

function validScopes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const scopes: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (scopes.length >= MAX_SCOPES) break;
    const record = parseChapterScope(entry);
    if (record === null || seen.has(record.scope)) continue;
    seen.add(record.scope);
    scopes.push(record.scope);
  }
  return scopes;
}

/** Capítulos marcados neste navegador. Armazenamento bloqueado devolve `available: false`. */
export function readLocalProgress(): LocalProgress {
  try {
    const source = readRaw();
    if (source === null) return unavailable;
    return { available: true, scopes: validScopes(source.readChapters) };
  } catch {
    return unavailable;
  }
}

/**
 * Marca ou desmarca um capítulo no registro local, preservando todo o resto do
 * objeto. Devolve o estado resultante, ou `available: false` se não deu para
 * gravar — e aí a interface avisa em vez de fingir que guardou.
 */
export function writeLocalChapterRead(scope: string, read: boolean): LocalProgress {
  const record = parseChapterScope(scope);
  if (record === null) return readLocalProgress();
  try {
    const source = readRaw();
    if (source === null) return unavailable;
    const current = validScopes(source.readChapters);
    const next = new Set(current);
    if (read) {
      if (!next.has(record.scope) && next.size >= MAX_SCOPES) return { available: true, scopes: current };
      next.add(record.scope);
    } else {
      next.delete(record.scope);
    }
    const scopes = [...next];
    window.sessionStorage.setItem(
      READER_SESSION_KEY,
      JSON.stringify({ ...source, readChapters: scopes }),
    );
    return { available: true, scopes };
  } catch {
    return unavailable;
  }
}

/**
 * Apaga **somente** as marcas de leitura locais. Destaques, notas e
 * preferências do mesmo registro ficam onde estão: quem pede para reiniciar a
 * leitura não pediu para perder anotação.
 */
export function clearLocalChapterReads(): LocalProgress {
  try {
    const source = readRaw();
    if (source === null) return unavailable;
    window.sessionStorage.setItem(READER_SESSION_KEY, JSON.stringify({ ...source, readChapters: [] }));
    return { available: true, scopes: [] };
  } catch {
    return unavailable;
  }
}
