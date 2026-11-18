"use server";

import { redirect } from "next/navigation";
import {
  ACCESS_CODE_SENT_NOTICE,
  confirmFailureMessage,
  maskEmail,
  requestFailureMessage,
} from "@/src/domain/account-access";
import {
  confirmAccessCode,
  endSession,
  requestAccessCode,
  requestAccountDeletion,
} from "@/src/server/auth/runtime";
import type { AccessFormState } from "../_components/access-form";

/**
 * Server Actions da conta. Toda decisão fica no servidor: o formulário manda
 * e-mail e código, nunca identidade, papel ou sessão. Arquivo `"use server"`, em
 * que só função assíncrona pode ser exportada — por isso o estado inicial do
 * formulário vive no componente, não aqui.
 *
 * O modo (`entrar` ou `criar-conta`) é **argumento vinculado** pelo componente
 * de servidor, não campo do formulário. Isso importa: como campo, um POST
 * forjado poderia pedir `createUser: true` na tela de entrar e criar conta com
 * um e-mail digitado errado. Argumento vinculado é selado pelo Next e não pode
 * ser trocado pelo cliente.
 *
 * Proteção de CSRF: Server Actions do Next só aceitam POST com Origin
 * compatível com o Host, e o cookie de sessão é `SameSite=Lax`.
 */

export type AccessMode = "sign_in" | "sign_up";

function requestStep(email: string, error: string | null, notice: string | null): AccessFormState {
  return { step: "request", email, maskedEmail: "", notice, error };
}

export async function submitAccess(
  mode: AccessMode,
  _previous: AccessFormState,
  formData: FormData,
): Promise<AccessFormState> {
  const intent = formData.get("intent");
  const email = (formData.get("email") ?? "").toString().trim().slice(0, 254);

  // Voltar para o passo do e-mail descarta o código e não fala com o provedor.
  if (intent === "restart") return requestStep(email, null, null);

  if (intent === "verify") {
    const code = (formData.get("code") ?? "").toString().trim().slice(0, 10);
    const confirmed = await confirmAccessCode(email, code);
    if (confirmed.ok) redirect("/conta");
    return {
      step: "verify",
      email,
      maskedEmail: maskEmail(email),
      notice: null,
      error: confirmFailureMessage(confirmed.reason),
    };
  }

  const requested = await requestAccessCode(email, mode === "sign_up");
  if (!requested.ok) return requestStep(email, requestFailureMessage(requested.reason), null);
  // Avança para a digitação do código com a mesma frase neutra em qualquer caso.
  return { step: "verify", email, maskedEmail: maskEmail(email), notice: ACCESS_CODE_SENT_NOTICE, error: null };
}

/** Sair deste navegador. Apaga o cookie mesmo se o provedor não responder. */
export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/entrar");
}

/**
 * Solicita a exclusão da conta: registra o pedido, revoga a sessão e manda a
 * pessoa para uma tela que confirma o pedido. A remoção efetiva dos dados é ato
 * do operador, segundo a política de retenção aprovada — a interface não promete
 * apagamento imediato porque ele não acontece aqui.
 */
export async function requestDeletionAction(): Promise<void> {
  const result = await requestAccountDeletion();
  redirect(result.ok ? "/conta?exclusao=solicitada" : "/conta?exclusao=indisponivel");
}
