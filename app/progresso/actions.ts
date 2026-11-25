"use server";

import {
  loadAccountProgress,
  resetAccountProgress,
  setAccountChapterRead,
  type AccountProgressState,
  type ResetProgressResult,
  type SetChapterReadResult,
} from "@/src/server/reading/progress-runtime";

/**
 * Server Actions da página de progresso. São o único caminho pelo qual esta
 * página escreve na conta.
 *
 * O que **não** chega aqui: identidade. Nenhuma ação aceita `userId` — quem
 * grava é sempre a sessão do cookie, resolvida em
 * `src/server/reading/progress-runtime.ts`. Um POST forjado só altera o
 * progresso de quem o enviou, e sem cookie não altera nada.
 *
 * Estas ações mexem apenas em `chapter_reading_progress`. Destaques e notas não
 * passam por aqui — e é de propósito: a página de progresso não tem o conteúdo
 * do capítulo na mão, então não pode substituir marcas que não conhece
 * (ver `src/server/reading/progress.ts`).
 *
 * Proteção de CSRF: Server Actions do Next só aceitam POST com Origin
 * compatível com o Host, e o cookie de sessão é `SameSite=Lax`.
 */

/** Corrige a marca de um capítulo. O motivo da falha volta para a tela explicar. */
export async function setChapterReadAction(scope: string, read: boolean): Promise<SetChapterReadResult> {
  return await setAccountChapterRead(scope, read);
}

/**
 * Reinício total. A palavra de confirmação é conferida no servidor, não na
 * tela: sem ela, nada é apagado.
 */
export async function resetProgressAction(confirmation: string): Promise<ResetProgressResult> {
  return await resetAccountProgress(confirmation);
}

/** Relê o progresso da conta, para a tela se corrigir depois de uma falha. */
export async function refreshAccountProgressAction(): Promise<AccountProgressState> {
  return await loadAccountProgress();
}
