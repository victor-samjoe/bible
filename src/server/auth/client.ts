import type { ProviderSession } from "./session";

/**
 * Contrato do cliente de autenticação, por requisição.
 *
 * Fica em arquivo próprio para que `./gotrue` (implementação HTTP) e `./index`
 * (regras) dependam do mesmo tipo sem importar um ao outro.
 *
 * Os métodos de sessão são opcionais de propósito: um duplo de teste que só
 * precisa de `signInWithOtp` continua satisfazendo o contrato, e as regras em
 * `./index` tratam a capacidade ausente como indisponibilidade — nunca como
 * permissão.
 */

/**
 * Tipos de verificação aceitos no acesso por e-mail. `recovery`, `invite` e
 * `email_change` existem no provedor e estão fora desta lista porque não fazem
 * parte deste fluxo: aceitá-los permitiria entrar por um link emitido para
 * outra finalidade.
 */
export const VERIFICATION_TYPES = ["email", "magiclink", "signup"] as const;
export type VerificationType = (typeof VERIFICATION_TYPES)[number];

export type VerifyOtpInput =
  | { readonly type: VerificationType; readonly email: string; readonly token: string }
  | { readonly type: VerificationType; readonly tokenHash: string };

/** Erro do provedor como opaco: existe, mas não carrega texto para a interface. */
export type ProviderError = { readonly status?: number } | null;

export interface SupabaseAuthClient {
  auth: {
    signInWithOtp(input: { email: string; createUser?: boolean }): Promise<{ error: unknown }>;
    getUser(): Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: unknown;
    }>;
    verifyOtp?(
      input: VerifyOtpInput,
    ): Promise<{ data: { session: ProviderSession | null }; error: unknown }>;
    refreshSession?(input: {
      refreshToken: string;
    }): Promise<{ data: { session: ProviderSession | null }; error: unknown }>;
    exchangeCodeForSession?(input: {
      authCode: string;
      codeVerifier: string;
    }): Promise<{ data: { session: ProviderSession | null }; error: unknown }>;
    signOut?(): Promise<{ error: unknown }>;
  };
}
