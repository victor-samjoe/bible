import { isResetConfirmed } from "../../domain/reading-progress";
import { getViewer } from "../auth/runtime";
import { getDatabaseAsync } from "../db/client";
import { createReadingProgressService, type ChapterReadOutcome, type ReadingProgressService } from "./progress";
import { createDrizzleReadingProgressRepository } from "./progress-repository";

/**
 * Entrada autenticada do progresso de leitura. Mesma disciplina de
 * `./runtime.ts`, e pelos mesmos dois motivos:
 *
 *  1. **Quem é a pessoa sai de `getViewer()`.** Nenhuma função exportada daqui
 *     aceita `userId`. Se aceitasse, um campo escondido no formulário leria ou
 *     apagaria o progresso de outra pessoa.
 *  2. **O que o navegador manda é suspeito.** O escopo do capítulo é validado
 *     em `./progress.ts` antes de virar escrita, e o reinício total exige a
 *     palavra de confirmação conferida aqui, no servidor — a confirmação da
 *     tela é cortesia, não tranca.
 *
 * Nada aqui lança para o chamador: banco fora do ar ou sessão ausente devolvem
 * um estado explícito, e a página diz a verdade em vez de quebrar.
 */

export type AccountProgressState =
  /** Sem sessão: o progresso que existe é o do navegador. */
  | { readonly status: "anonymous" }
  /** Com sessão, mas sem banco: não há como ler nem gravar agora. */
  | { readonly status: "unavailable" }
  | { readonly status: "ready"; readonly scopes: readonly string[] };

async function service(): Promise<ReadingProgressService | null> {
  const database = await getDatabaseAsync();
  return database === null
    ? null
    : createReadingProgressService(createDrizzleReadingProgressRepository(database));
}

/** Capítulos lidos na conta. Nunca devolve dado de outra pessoa: o `userId` é o da sessão. */
export async function loadAccountProgress(): Promise<AccountProgressState> {
  const viewer = await getViewer();
  if (viewer === null) return { status: "anonymous" };
  const progress = await service();
  if (progress === null) return { status: "unavailable" };
  try {
    return { status: "ready", scopes: await progress.listReadScopes(viewer.id) };
  } catch {
    return { status: "unavailable" };
  }
}

export type SetChapterReadResult =
  | ChapterReadOutcome
  | { readonly ok: false; readonly reason: "unauthenticated" };

/**
 * Corrige a marca de **um** capítulo na conta. Não toca destaque nem nota —
 * ver o cabeçalho de `./progress.ts` para o porquê.
 */
export async function setAccountChapterRead(scope: unknown, read: unknown): Promise<SetChapterReadResult> {
  const viewer = await getViewer();
  if (viewer === null) return { ok: false, reason: "unauthenticated" };
  const progress = await service();
  if (progress === null) return { ok: false, reason: "unavailable" };
  try {
    return await progress.setChapterRead(viewer.id, scope, read === true);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export type ResetProgressResult =
  | { readonly ok: true; readonly cleared: number }
  | { readonly ok: false; readonly reason: "unauthenticated" | "unavailable" | "not_confirmed" };

/**
 * Apaga **todas** as marcas de leitura da conta. Exige a palavra de
 * confirmação; sem ela, nada é apagado e o motivo volta para a tela. Destaques
 * e notas continuam intactos: este reinício é só de leitura.
 */
export async function resetAccountProgress(confirmation: unknown): Promise<ResetProgressResult> {
  const viewer = await getViewer();
  if (viewer === null) return { ok: false, reason: "unauthenticated" };
  if (!isResetConfirmed(confirmation)) return { ok: false, reason: "not_confirmed" };
  const progress = await service();
  if (progress === null) return { ok: false, reason: "unavailable" };
  try {
    return await progress.clearReadScopes(viewer.id);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
