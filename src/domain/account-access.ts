/**
 * Vocabulário visível do acesso por conta (frente A do plano de contas).
 *
 * Funções puras: nenhum acesso a React, rede, banco ou ambiente, para que a
 * mesma frase apareça em `/entrar`, `/criar-conta` e no teste.
 *
 * A regra que este módulo existe para cumprir: **a tela nunca revela se um
 * e-mail tem conta**. Pedir código responde sempre a mesma frase, dê ou não em
 * envio real, e nenhuma mensagem repassa texto do provedor. Também não há
 * mensagem distinta para "código errado" e "código expirado": as duas levam ao
 * mesmo caminho, pedir outro código.
 */

export type AccessStep = "request" | "verify";

export type RequestFailureReason = "unavailable" | "invalid_email" | "rate_limited" | "provider_error";
export type ConfirmFailureReason =
  | "unavailable"
  | "invalid_input"
  | "invalid_token"
  | "rate_limited"
  | "provider_error";

/**
 * Frase única do envio. Sujeito indefinido de propósito: "se este e-mail puder
 * receber acesso" não confirma nem nega a existência da conta.
 */
export const ACCESS_CODE_SENT_NOTICE =
  "Se este e-mail puder receber acesso, enviamos um código de 6 dígitos agora. Confira a caixa de entrada e a pasta de spam.";

export const ACCESS_UNAVAILABLE_NOTICE =
  "O acesso por conta ainda não está configurado neste ambiente. Nenhum e-mail foi enviado e nenhum dado foi guardado.";

const RETRY_LATER = "Não foi possível concluir agora. Tente novamente em alguns minutos.";
const TOO_MANY = "Muitas tentativas a partir deste acesso. Aguarde alguns minutos antes de pedir outro código.";

export function requestFailureMessage(reason: RequestFailureReason): string {
  switch (reason) {
    case "unavailable":
      return ACCESS_UNAVAILABLE_NOTICE;
    case "invalid_email":
      return "Confira o endereço de e-mail e tente de novo.";
    case "rate_limited":
      return TOO_MANY;
    case "provider_error":
      return RETRY_LATER;
  }
}

export function confirmFailureMessage(reason: ConfirmFailureReason): string {
  switch (reason) {
    case "unavailable":
      return ACCESS_UNAVAILABLE_NOTICE;
    case "invalid_input":
      return "O código tem 6 dígitos. Confira e digite de novo.";
    case "invalid_token":
      return "Código inválido ou expirado. Peça um novo código para continuar.";
    case "rate_limited":
      return TOO_MANY;
    case "provider_error":
      return RETRY_LATER;
  }
}

/**
 * Mascara o e-mail para a tela confirmar "para onde foi o código" sem reimprimir
 * o endereço inteiro, que ficaria em captura de tela, histórico e suporte.
 */
export function maskEmail(email: string): string {
  const value = typeof email === "string" ? email.trim() : "";
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return "•••";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  return `${local.slice(0, 1)}${"•".repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

/** Rótulo do papel para a interface. Desconhecido não vira "leitor" por conveniência. */
export function roleLabel(role: string): string {
  switch (role) {
    case "reader":
      return "Leitor";
    case "editor":
      return "Editor";
    case "admin":
      return "Administrador";
    default:
      return "Papel não reconhecido";
  }
}
