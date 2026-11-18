import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Viewer } from "../../domain/access";
import { getDatabaseAsync } from "../db/client";
import { createAuth, looksLikeEmail, toViewer, type AuthResult, type SessionResult } from "./index";
import { parseAuthConfig, usesSecureCookies, type AuthConfig } from "./config";
import { createGoTrueClient } from "./gotrue";
import { createDrizzleProfileRepository, type ProfileRecord } from "./profiles";
import {
  SESSION_COOKIE,
  clearedSessionCookieOptions,
  decodeSession,
  encodeSession,
  needsRefresh,
  sessionCookieOptions,
  type ProviderSession,
  type StoredSession,
} from "./session";
import { createFixedWindowLimiter } from "./rate-limit";
import type { VerificationType } from "./client";

/**
 * Fiação da conta com ambiente, cookie, provedor e banco. Único módulo desta
 * frente que toca infraestrutura — tudo acima dele é testável sem servidor.
 *
 * Falha fechada em três camadas: sem configuração de identidade a conta é
 * declarada indisponível e nenhuma requisição sai; sem sessão válida a pessoa é
 * anônima; com sessão válida mas sem a tabela de perfis acessível, não existe
 * papel — e sem papel não há autorização, só uma explicação honesta na tela.
 */

export type AccountSession =
  | { readonly state: "unconfigured"; readonly reason: "missing_configuration" | "invalid_configuration" }
  | { readonly state: "anonymous" }
  /** Identidade confirmada no provedor, mas a fonte confiável de papel não respondeu. */
  | { readonly state: "degraded"; readonly email: string | null }
  | {
      readonly state: "authenticated";
      readonly viewer: Viewer;
      readonly email: string | null;
      readonly profile: ProfileRecord;
      readonly deletionRequested: boolean;
    };

/**
 * Limites por isolate. Ver a ressalva em `./rate-limit`: isto contém repetição,
 * não substitui limite global compartilhado. Três códigos por e-mail em quinze
 * minutos e dez tentativas de verificação na mesma janela cobrem uso legítimo
 * (errar o código, pedir de novo) sem servir de canal de envio em massa.
 */
const otpRequestLimiter = createFixedWindowLimiter({ limit: 3, windowSeconds: 900 });
const otpVerifyLimiter = createFixedWindowLimiter({ limit: 10, windowSeconds: 900 });
const originRequestLimiter = createFixedWindowLimiter({ limit: 20, windowSeconds: 900 });

async function cloudflareEnvironment(): Promise<Record<string, unknown>> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as unknown as Record<string, unknown>;
  } catch {
    // Fora do Worker (build, testes, scripts) não existe contexto: não é erro.
    return {};
  }
}

/**
 * Secret do Worker tem precedência sobre `process.env`, que em produção não
 * carrega as chaves. Só as chaves conhecidas são lidas: nada de espalhar o
 * ambiente inteiro por um objeto que depois vai para validação.
 */
export const getAuthConfig = cache(async (): Promise<AuthConfig> => {
  const workerEnvironment = await cloudflareEnvironment();
  const read = (key: string): string | undefined => {
    const fromWorker = workerEnvironment[key];
    if (typeof fromWorker === "string" && fromWorker.trim().length > 0) return fromWorker;
    const fromProcess = process.env[key];
    return typeof fromProcess === "string" && fromProcess.trim().length > 0 ? fromProcess : undefined;
  };
  return parseAuthConfig({
    SUPABASE_URL: read("SUPABASE_URL"),
    SUPABASE_PUBLISHABLE_KEY: read("SUPABASE_PUBLISHABLE_KEY"),
    SUPABASE_ANON_KEY: read("SUPABASE_ANON_KEY"),
    PUBLIC_SITE_URL: read("PUBLIC_SITE_URL"),
  });
});

async function readStoredSession(): Promise<StoredSession | null> {
  try {
    const store = await cookies();
    return decodeSession(store.get(SESSION_COOKIE)?.value ?? null);
  } catch {
    return null;
  }
}

/**
 * Grava o cookie. Em render de página o Next proíbe escrever cookie e lança;
 * engolir aqui é deliberado, porque a alternativa seria derrubar a página por
 * causa de uma renovação que a próxima Server Action faria de novo.
 */
async function persistSession(session: StoredSession, secure: boolean): Promise<void> {
  const value = encodeSession(session);
  if (value === null) return;
  try {
    const store = await cookies();
    store.set(SESSION_COOKIE, value, sessionCookieOptions(secure));
  } catch {
    /* fora de Server Action/Route Handler: a renovação persiste na próxima. */
  }
}

async function dropSessionCookie(secure: boolean): Promise<void> {
  try {
    const store = await cookies();
    store.set(SESSION_COOKIE, "", clearedSessionCookieOptions(secure));
  } catch {
    /* mesmo motivo de `persistSession`. */
  }
}

/** Cliente anônimo: pedir código, verificar código, renovar sessão. */
function anonymousAuth(config: AuthConfig) {
  return createAuth(config, createGoTrueClient(config) ?? undefined);
}

/** Cliente da sessão: ler identidade e encerrar sessão. */
function sessionAuth(config: AuthConfig, accessToken: string) {
  return createAuth(config, createGoTrueClient(config, { accessToken }) ?? undefined);
}

/**
 * Identificador da origem para o limite por IP. `cf-connecting-ip` é posto pela
 * Cloudflare e não é falsificável na borda; os demais são palpite e por isso o
 * valor cai para `desconhecido` em vez de virar chave manipulável de bypass.
 */
async function originKey(): Promise<string> {
  try {
    const header = await headers();
    const direct = header.get("cf-connecting-ip");
    if (direct) return direct;
    const forwarded = header.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded && forwarded.length > 0 ? forwarded : "desconhecido";
  } catch {
    return "desconhecido";
  }
}

export type RequestCodeOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "unavailable" | "invalid_email" | "rate_limited" | "provider_error" };

/**
 * Pede o código. O resultado é propositalmente pobre: `ok: true` não afirma que
 * um e-mail existe nem que a mensagem saiu, e o erro do provedor é achatado em
 * um motivo só. A tela mostra a mesma frase nos dois casos.
 */
export async function requestAccessCode(email: string, createUser: boolean): Promise<RequestCodeOutcome> {
  const config = await getAuthConfig();
  if (!config.available) return { ok: false, reason: "unavailable" };
  // Endereço malformado é recusado antes do limite: digitar errado três vezes
  // não pode travar o próprio acesso, e nada disso chega ao provedor.
  if (!looksLikeEmail(email)) return { ok: false, reason: "invalid_email" };
  if (!originRequestLimiter.check(await originKey()).allowed) return { ok: false, reason: "rate_limited" };
  if (!otpRequestLimiter.check(email).allowed) return { ok: false, reason: "rate_limited" };
  const result: AuthResult = await anonymousAuth(config).requestOtp(email, { createUser });
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}

export type ConfirmOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "unavailable" | "invalid_input" | "invalid_token" | "rate_limited" | "provider_error";
    };

/** Verifica o código digitado e, só então, grava o cookie de sessão. */
export async function confirmAccessCode(email: string, code: string): Promise<ConfirmOutcome> {
  const config = await getAuthConfig();
  if (!config.available) return { ok: false, reason: "unavailable" };
  if (!looksLikeEmail(email)) return { ok: false, reason: "invalid_input" };
  if (!originRequestLimiter.check(await originKey()).allowed) return { ok: false, reason: "rate_limited" };
  if (!otpVerifyLimiter.check(email).allowed) return { ok: false, reason: "rate_limited" };
  const result: SessionResult = await anonymousAuth(config).verifyOtpCode(email, code);
  if (!result.ok) return { ok: false, reason: result.reason };
  await persistSession(result.session, usesSecureCookies(config));
  return { ok: true };
}

/** Verifica o `token_hash` do link do e-mail (rota `/auth/callback`). */
export async function confirmEmailLink(tokenHash: string, type: VerificationType | string): Promise<ConfirmOutcome> {
  const config = await getAuthConfig();
  if (!config.available) return { ok: false, reason: "unavailable" };
  if (!originRequestLimiter.check(await originKey()).allowed) return { ok: false, reason: "rate_limited" };
  const result: SessionResult = await anonymousAuth(config).verifyEmailLink(tokenHash, type);
  if (!result.ok) return { ok: false, reason: result.reason };
  await persistSession(result.session, usesSecureCookies(config));
  return { ok: true };
}

/**
 * Encerra a sessão. O cookie é apagado mesmo quando o provedor não responde:
  * pedir para sair sempre resulta em sair deste navegador.
 */
export async function endSession(): Promise<void> {
  const config = await getAuthConfig();
  const secure = usesSecureCookies(config);
  const stored = await readStoredSession();
  if (config.available && stored !== null) await sessionAuth(config, stored.accessToken).signOut();
  await dropSessionCookie(secure);
}

/**
 * Renova a sessão quando o access token está no fim. Devolve a sessão utilizável
 * ou `null` — e nesse caso o cookie já foi apagado, porque refresh recusado é
 * sessão revogada ou expirada.
 */
async function usableSession(config: AuthConfig, secure: boolean): Promise<ProviderSession | StoredSession | null> {
  const stored = await readStoredSession();
  if (stored === null) return null;
  if (!needsRefresh(stored, Math.floor(Date.now() / 1000))) return stored;
  const refreshed = await anonymousAuth(config).refreshSession(stored.refreshToken);
  if (!refreshed.ok) {
    await dropSessionCookie(secure);
    return null;
  }
  await persistSession(refreshed.session, secure);
  return refreshed.session;
}

/**
 * Estado da conta para esta requisição.
 *
 * Caro de propósito: confirma a identidade no provedor em vez de confiar no
 * cookie, e lê o papel do banco em vez de confiar no provedor. `cache` mantém
 * isso em uma vez por requisição.
 */
export const getAccountSession = cache(async (): Promise<AccountSession> => {
  const config = await getAuthConfig();
  if (!config.available) return { state: "unconfigured", reason: config.reason };
  const secure = usesSecureCookies(config);

  const session = await usableSession(config, secure);
  if (session === null) return { state: "anonymous" };

  const identity = await sessionAuth(config, session.accessToken).getIdentity();
  if (identity === null) {
    // Token recusado mesmo dentro da validade: revogado no provedor.
    await dropSessionCookie(secure);
    return { state: "anonymous" };
  }

  const database = await getDatabaseAsync();
  if (database === null) return { state: "degraded", email: identity.email };
  const profiles = createDrizzleProfileRepository(database);
  try {
    const profile = await profiles.ensureProfile(identity.id);
    if (profile === null) return { state: "degraded", email: identity.email };
    // Identidade já confirmada acima e papel já vindo da tabela confiável: o
    // `Viewer` é montado sem uma segunda ida ao provedor.
    const viewer = toViewer(identity.id, profile.role);
    if (viewer === null) return { state: "degraded", email: identity.email };
    return {
      state: "authenticated",
      viewer,
      email: identity.email,
      profile,
      deletionRequested: await profiles.hasOpenDeletionRequest(viewer.id),
    };
  } catch {
    // Banco indisponível ou papel fora do enum: sem papel confiável, sem acesso.
    return { state: "degraded", email: identity.email };
  }
});

/** Atalho para guardas de rota: `null` sempre que não há identidade **e** papel confiáveis. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await getAccountSession();
  return session.state === "authenticated" ? session.viewer : null;
}

/** Registra o pedido de exclusão e encerra a sessão. */
export type DeletionOutcome = { readonly ok: true } | { readonly ok: false; readonly reason: "unauthenticated" | "unavailable" };

export async function requestAccountDeletion(): Promise<DeletionOutcome> {
  const session = await getAccountSession();
  if (session.state !== "authenticated") return { ok: false, reason: "unauthenticated" };
  const database = await getDatabaseAsync();
  if (database === null) return { ok: false, reason: "unavailable" };
  try {
    const recorded = await createDrizzleProfileRepository(database).requestDeletion(session.viewer.id);
    if (!recorded) return { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  // Pedir exclusão encerra o acesso imediatamente: a conta fica inacessível
  // enquanto a remoção aprovada é executada pelo operador.
  await endSession();
  return { ok: true };
}
