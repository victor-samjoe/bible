/**
 * Capítulos lidos: contrato e correção individual (`READING-PROGRESS-001`).
 *
 * **Por que este módulo existe, se `./personal.ts` já grava "lido".** O caminho
 * do leitor é `replaceChapterMarks`, que substitui o capítulo inteiro —
 * destaques, notas e marca de leitura. É o certo para o leitor, que sempre tem
 * o capítulo completo na tela. A página de progresso **não tem** os destaques
 * nem as notas daquele capítulo: se usasse o mesmo caminho para desmarcar um
 * capítulo, apagaria em silêncio tudo que a pessoa anotou nele. Nada aqui, nem
 * em `./progress-repository.ts`, toca `verse_highlights` ou `verse_notes`.
 *
 * Este arquivo é puro: nenhuma linha conhece Drizzle, Postgres, HTTP ou React.
 * O repositório entra por injeção, então o serviço é testável sem banco
 * (`tests/server/reading-progress.test.ts`). A implementação com Drizzle vive em
 * `./progress-repository.ts`, e a fiação com a sessão em `./progress-runtime.ts`.
 */

import { parseChapterScope } from "../../domain/reading-session";

export type ChapterReadOutcome =
  | { readonly ok: true; readonly read: boolean }
  | { readonly ok: false; readonly reason: "invalid_scope" | "not_found" | "unavailable" };

export type ResetOutcome =
  | { readonly ok: true; readonly cleared: number }
  | { readonly ok: false; readonly reason: "unavailable" };

export interface ReadingProgressRepository {
  /** Escopos `livro.capítulo` concluídos pela pessoa. */
  listReadScopes(userId: string): Promise<readonly string[]>;
  /** Marca ou desmarca **um** capítulo. `false` quando o capítulo não existe. */
  setChapterRead(
    userId: string,
    bookSlug: string,
    chapterNumber: number,
    read: boolean,
  ): Promise<boolean>;
  /** Apaga todas as marcas de leitura da pessoa. Devolve quantas havia. */
  clearReadScopes(userId: string): Promise<number>;
}

/**
 * Serviço de correção de marcas. Recebe o repositório por injeção, então é
 * testável sem Postgres, e valida o escopo antes de qualquer escrita.
 *
 * O `userId` é parâmetro aqui porque este serviço é interno; quem garante que
 * ele vem da sessão — e não do navegador — é `./progress-runtime.ts`, o único
 * módulo que o app chama.
 */
export function createReadingProgressService(repository: ReadingProgressRepository) {
  return {
    async listReadScopes(userId: string): Promise<readonly string[]> {
      return await repository.listReadScopes(userId);
    },

    async setChapterRead(userId: string, scope: unknown, read: boolean): Promise<ChapterReadOutcome> {
      const record = parseChapterScope(scope);
      if (record === null) return { ok: false, reason: "invalid_scope" };
      const applied = await repository.setChapterRead(userId, record.book, record.chapter, read);
      return applied ? { ok: true, read } : { ok: false, reason: "not_found" };
    },

    async clearReadScopes(userId: string): Promise<ResetOutcome> {
      return { ok: true, cleared: await repository.clearReadScopes(userId) };
    },
  };
}

export type ReadingProgressService = ReturnType<typeof createReadingProgressService>;
