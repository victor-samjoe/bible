"use server";

import type { ChapterMarksPayload } from "@/src/domain/reading-sync";
import { saveAccountChapterMarks, saveAccountPreferences } from "@/src/server/reading/runtime";

/**
 * Server Actions do leitor. São o único caminho pelo qual o navegador escreve
 * dados pessoais de leitura.
 *
 * O que **não** chega aqui: identidade. Nenhuma ação aceita `userId`. Quem
 * grava é sempre a sessão do cookie, resolvida em
 * `src/server/reading/runtime.ts`. Um POST forjado só consegue escrever na
 * própria conta de quem o enviou — e sem cookie, em conta nenhuma.
 *
 * O retorno é `boolean` de propósito: o leitor precisa saber se guardou, para
 * dizer a verdade na tela, e não precisa saber por que falhou. Motivo de falha
 * no cliente só serve para quem está sondando o servidor.
 *
 * Proteção de CSRF: Server Actions do Next só aceitam POST com Origin
 * compatível com o Host, e o cookie de sessão é `SameSite=Lax`.
 */

export async function savePreferencesAction(theme: unknown, preferences: unknown): Promise<boolean> {
  return await saveAccountPreferences(theme, preferences);
}

export async function saveChapterMarksAction(payload: ChapterMarksPayload): Promise<boolean> {
  return await saveAccountChapterMarks(payload);
}
