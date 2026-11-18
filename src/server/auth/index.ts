import { z } from "zod";
import type { Role, Viewer } from "../../domain/access";
import type { AuthConfig } from "./config";
import type { SupabaseAuthClient, VerificationType } from "./client";
import type { ProviderSession } from "./session";

export { parseAuthConfig, usesSecureCookies } from "./config";
export type { AuthConfig } from "./config";
export { VERIFICATION_TYPES } from "./client";
export type { SupabaseAuthClient, VerificationType, VerifyOtpInput } from "./client";
export { createGoTrueClient } from "./gotrue";
export {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  clearedSessionCookieOptions,
  decodeSession,
  encodeSession,
  needsRefresh,
  sessionCookieOptions,
  storedSessionSchema,
} from "./session";
export type { ProviderSession, SessionCookieOptions, StoredSession } from "./session";
export { createFixedWindowLimiter, hashRateLimitKey } from "./rate-limit";
export type { RateLimitDecision, RateLimiter } from "./rate-limit";
// `./profiles` não é reexportado aqui de propósito: ele importa o schema
// Drizzle, e este módulo precisa continuar carregável sem banco. Quem precisa do
// repositório importa `./profiles` direto — hoje só `./runtime`.

/** This lookup must read server-controlled profiles, never user-editable metadata. */
export type RoleLookup = (userId: string) => Promise<unknown>;
export type AuthResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "invalid_email" | "rate_limited" | "provider_error" };

/**
 * Motivos de falha de sessão. São o vocabulário que a interface pode mostrar:
 * nenhum deles diz se a conta existe, se o e-mail foi enviado ou o que o
 * provedor respondeu.
 */
export type SessionFailureReason = "unavailable" | "invalid_input" | "invalid_token" | "provider_error";
export type SessionResult =
  | { ok: true; session: ProviderSession }
  | { ok: false; reason: SessionFailureReason };

/** Autorização como resultado explícito, para a rota não confundir "anônimo" com "sem permissão". */
export type AuthorizationResult =
  | { ok: true; viewer: Viewer }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

const emailSchema = z.email().max(254);
const roleSchema = z.enum(["reader", "editor", "admin"]);
const idSchema = z.uuid();
// Código do e-mail: o GoTrue emite 6 dígitos por padrão e aceita até 10 em
// configurações antigas. Só dígitos, para o campo não virar canal de injeção.
const otpCodeSchema = z.string().regex(/^\d{6,10}$/);
// `token_hash` do link de e-mail: base64url/hex, tamanho limitado.
const tokenHashSchema = z.string().regex(/^[A-Za-z0-9_-]{16,512}$/);
const verificationTypeSchema = z.enum(["email", "magiclink", "signup"]);

function providerStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error)) return null;
  const { status } = error as { status?: unknown };
  return typeof status === "number" ? status : null;
}

/**
 * Mesma validação que `requestOtp` aplica, exposta para quem precisa decidir
 * antes de gastar cota de limite de tentativas com um endereço que nem chegaria
 * ao provedor. Fonte única: o schema abaixo é o de `requestOtp`.
 */
export function looksLikeEmail(value: string): boolean {
  return emailSchema.safeParse(typeof value === "string" ? value.trim() : "").success;
}

export function createAuth(config: AuthConfig, client?: SupabaseAuthClient, lookupRole?: RoleLookup) {
  const enabled = config.available && client !== undefined;
  return {
    available: enabled,

    async requestOtp(email: string, options?: { createUser?: boolean }): Promise<AuthResult> {
      if (!enabled || !client) return { ok: false, reason: "unavailable" };
      const parsed = emailSchema.safeParse(email.trim());
      if (!parsed.success) return { ok: false, reason: "invalid_email" };
      try {
        const result = await client.auth.signInWithOtp(
          options?.createUser === undefined
            ? { email: parsed.data }
            : { email: parsed.data, createUser: options.createUser },
        );
        if (!result.error) return { ok: true };
        // O status é suficiente para diferenciar a cota do provedor, sem
        // registrar o endereço, a resposta ou qualquer credencial.
        const status = providerStatus(result.error);
        console.error("auth.otp_request_failed", {
          status,
          createUser: options?.createUser ?? null,
        });
        return { ok: false, reason: status === 429 ? "rate_limited" : "provider_error" };
      } catch (error) {
        // Classe da exceção é telemetria suficiente para rede/runtime. A
        // mensagem pode conter detalhes do provedor e deliberadamente não é
        // enviada aos logs.
        console.error("auth.otp_request_failed", {
          status: "network_or_runtime",
          exception: error instanceof Error ? error.name : typeof error,
          createUser: options?.createUser ?? null,
        });
        return { ok: false, reason: "provider_error" };
      }
    },

    /** Código digitado pela pessoa, sempre casado com o e-mail que o pediu. */
    async verifyOtpCode(email: string, code: string, type: VerificationType = "email"): Promise<SessionResult> {
      if (!enabled || !client?.auth.verifyOtp) return { ok: false, reason: "unavailable" };
      const parsedEmail = emailSchema.safeParse(email.trim());
      const parsedCode = otpCodeSchema.safeParse(code.trim());
      const parsedType = verificationTypeSchema.safeParse(type);
      if (!parsedEmail.success || !parsedCode.success || !parsedType.success) {
        return { ok: false, reason: "invalid_input" };
      }
      try {
        const result = await client.auth.verifyOtp({
          type: parsedType.data,
          email: parsedEmail.data,
          token: parsedCode.data,
        });
        if (result.error || !result.data.session) return { ok: false, reason: "invalid_token" };
        return { ok: true, session: result.data.session };
      } catch {
        return { ok: false, reason: "provider_error" };
      }
    },

    /** `token_hash` do link clicado no e-mail. Expirado ou já usado é `invalid_token`. */
    async verifyEmailLink(tokenHash: string, type: unknown): Promise<SessionResult> {
      if (!enabled || !client?.auth.verifyOtp) return { ok: false, reason: "unavailable" };
      const parsedHash = tokenHashSchema.safeParse(tokenHash.trim());
      const parsedType = verificationTypeSchema.safeParse(type);
      if (!parsedHash.success || !parsedType.success) return { ok: false, reason: "invalid_input" };
      try {
        const result = await client.auth.verifyOtp({ type: parsedType.data, tokenHash: parsedHash.data });
        if (result.error || !result.data.session) return { ok: false, reason: "invalid_token" };
        return { ok: true, session: result.data.session };
      } catch {
        return { ok: false, reason: "provider_error" };
      }
    },

    async refreshSession(refreshToken: string): Promise<SessionResult> {
      if (!enabled || !client?.auth.refreshSession) return { ok: false, reason: "unavailable" };
      if (typeof refreshToken !== "string" || refreshToken.trim().length === 0) {
        return { ok: false, reason: "invalid_input" };
      }
      try {
        const result = await client.auth.refreshSession({ refreshToken: refreshToken.trim() });
        if (result.error || !result.data.session) return { ok: false, reason: "invalid_token" };
        return { ok: true, session: result.data.session };
      } catch {
        return { ok: false, reason: "provider_error" };
      }
    },

    /**
     * Encerra no provedor. Devolve `true` apenas quando a revogação foi aceita —
     * mas quem chama precisa apagar o cookie de qualquer forma, porque uma falha
     * de rede não pode deixar a pessoa presa numa sessão que ela pediu encerrar.
     */
    async signOut(): Promise<boolean> {
      if (!enabled || !client?.auth.signOut) return false;
      try {
        const result = await client.auth.signOut();
        return !result.error;
      } catch {
        return false;
      }
    },

    async getViewer(): Promise<Viewer | null> {
      if (!enabled || !client || !lookupRole) return null;
      try {
        const result = await client.auth.getUser();
        if (result.error || !result.data.user) return null;
        const id = idSchema.safeParse(result.data.user.id);
        if (!id.success) return null;
        const role = roleSchema.safeParse(await lookupRole(id.data));
        return role.success ? { id: id.data, role: role.data } : null;
      } catch {
        return null;
      }
    },

    /** Identidade verificada com o e-mail, para `/conta` mostrar o endereço da própria pessoa. */
    async getIdentity(): Promise<{ id: string; email: string | null } | null> {
      if (!enabled || !client) return null;
      try {
        const result = await client.auth.getUser();
        if (result.error || !result.data.user) return null;
        const id = idSchema.safeParse(result.data.user.id);
        if (!id.success) return null;
        const email = emailSchema.safeParse(result.data.user.email ?? "");
        return { id: id.data, email: email.success ? email.data : null };
      } catch {
        return null;
      }
    },
  };
}

/**
 * Monta o `Viewer` a partir da identidade já verificada no provedor e do papel
 * já lido da tabela confiável. Devolve `null` se qualquer um dos dois não passar
 * pelo schema — papel desconhecido não vira `reader` por conveniência.
 */
export function toViewer(userId: string, role: unknown): Viewer | null {
  const id = idSchema.safeParse(userId);
  const parsedRole = roleSchema.safeParse(role);
  return id.success && parsedRole.success ? { id: id.data, role: parsedRole.data } : null;
}

export function hasRole(viewer: Viewer | null, required: Role): boolean {
  if (!viewer || !idSchema.safeParse(viewer.id).success) return false;
  const actual = roleSchema.safeParse(viewer.role);
  const target = roleSchema.safeParse(required);
  if (!actual.success || !target.success) return false;
  const rank: Record<Role, number> = { reader: 0, editor: 1, admin: 2 };
  return rank[actual.data] >= rank[target.data];
}

/**
 * Porta única de autorização. Separa "não autenticado" de "sem permissão" para a
 * rota responder 401 ou 403 sem adivinhar, e trata papel inválido como ausência
 * de identidade: um papel que não está no enum não é motivo para liberar nada.
 */
export function authorize(viewer: Viewer | null, required: Role): AuthorizationResult {
  if (!viewer || !idSchema.safeParse(viewer.id).success || !roleSchema.safeParse(viewer.role).success) {
    return { ok: false, reason: "unauthenticated" };
  }
  return hasRole(viewer, required) ? { ok: true, viewer } : { ok: false, reason: "forbidden" };
}
