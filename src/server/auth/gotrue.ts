import { z } from "zod";
import type { AuthConfig } from "./config";
import type { ProviderSession } from "./session";
import { storedSessionSchema } from "./session";
import type { SupabaseAuthClient, VerificationType } from "./client";

/**
 * Cliente HTTP do Supabase Auth (GoTrue), por requisição.
 *
 * Por que escrito à mão em vez de `@supabase/supabase-js`: a dependência não
 * está instalada no projeto e instalá-la não faz parte desta frente. A API usada
 * aqui é a REST pública do GoTrue, estável e documentada, e o recorte é pequeno:
 * pedir código, verificar código, renovar sessão, ler usuário e encerrar sessão.
 *
 * Regras que este módulo não quebra:
 *
 * - nenhuma mensagem, corpo ou cabeçalho do provedor atravessa a fronteira: o
 *   chamador recebe `ok: false` com um motivo do nosso vocabulário, porque o
 *   texto do GoTrue distingue "e-mail não existe" de "senha errada" e isso
 *   enumeraria contas;
 * - `apikey` é a chave publicável; a chave secreta nunca é lida aqui;
 * - toda chamada tem prazo, para uma indisponibilidade do provedor não prender
 *   a requisição do usuário;
 * - a identidade só é aceita depois de `GET /auth/v1/user`, que valida a
 *   assinatura do JWT no provedor. O servidor nunca decodifica o JWT por conta
 *   própria para decidir quem é a pessoa.
 */

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_ACCESS_TOKEN_LIFETIME_SECONDS = 3600;

const sessionPayloadSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number().int().positive().optional(),
  expires_in: z.number().int().positive().optional(),
  user: z.object({ id: z.string(), email: z.string().optional().nullable() }).optional().nullable(),
});

const userPayloadSchema = z.object({ id: z.string(), email: z.string().optional().nullable() });

export interface GoTrueClientOptions {
  /** Token da sessão atual; ausente em fluxos anônimos (pedir código, verificar). */
  readonly accessToken?: string | null;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

function timeoutSignal(timeoutMs: number): AbortSignal | undefined {
  try {
    return AbortSignal.timeout(timeoutMs);
  } catch {
    // Runtime sem `AbortSignal.timeout`: segue sem prazo em vez de falhar o login.
    return undefined;
  }
}

/**
 * Normaliza a sessão do provedor. Devolve `null` quando falta token, quando o
 * formato não passa pelo mesmo schema do cookie ou quando o id não é um UUID —
 * assim um provedor mal configurado não vira sessão meio válida.
 */
function normalizeSession(payload: unknown, nowSeconds: number): ProviderSession | null {
  const parsed = sessionPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;
  const { access_token: accessToken, refresh_token: refreshToken, user } = parsed.data;
  const expiresAt =
    parsed.data.expires_at ??
    nowSeconds + (parsed.data.expires_in ?? DEFAULT_ACCESS_TOKEN_LIFETIME_SECONDS);
  const session = storedSessionSchema.safeParse({ accessToken, refreshToken, expiresAt });
  if (!session.success) return null;
  const userId = z.uuid().safeParse(user?.id ?? "");
  if (!userId.success) return null;
  return { ...session.data, userId: userId.data };
}

export function createGoTrueClient(
  config: AuthConfig,
  options: GoTrueClientOptions = {},
): SupabaseAuthClient | null {
  if (!config.available) return null;
  // Cópia constante: TypeScript não mantém o estreitamento de um parâmetro
  // dentro das funções abaixo, e as funções precisam das chaves já validadas.
  const settings = config;
  const base = `${config.url.replace(/\/+$/, "")}/auth/v1`;
  const call = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const accessToken = options.accessToken ?? null;

  function headers(bearer: string | null): Record<string, string> {
    return {
      apikey: settings.anonKey,
      Authorization: `Bearer ${bearer ?? settings.anonKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async function request(
    path: string,
    init: { method: "GET" | "POST"; body?: unknown; bearer?: string | null },
  ): Promise<{ ok: boolean; status: number; payload: unknown }> {
    const signal = timeoutSignal(timeoutMs);
    const response = await call(`${base}${path}`, {
      method: init.method,
      headers: headers(init.bearer === undefined ? accessToken : init.bearer),
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      ...(signal ? { signal } : {}),
      cache: "no-store",
      // O runtime do Cloudflare Workers não implementa `redirect: "error"` e
      // lança TypeError antes da subrequisição. `manual` preserva a resposta
      // 3xx para que o mesmo tratamento por status continue seguro.
      redirect: "manual",
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Resposta sem JSON (204 do logout, por exemplo) não é erro por si.
      payload = null;
    }
    return { ok: response.ok, status: response.status, payload };
  }

  return {
    auth: {
      async signInWithOtp(input) {
        // `create_user: false` em `/entrar` impede que digitar um e-mail errado
        // crie conta silenciosamente; `true` é o fluxo explícito de cadastro.
        const body: Record<string, unknown> = { email: input.email };
        if (input.createUser !== undefined) body.create_user = input.createUser;
        const query =
          settings.siteUrl === null
            ? ""
            : `?redirect_to=${encodeURIComponent(`${settings.siteUrl}/auth/callback`)}`;
        const result = await request(`/otp${query}`, { method: "POST", body, bearer: null });
        // O motivo volta opaco: 400 "user not found" e 429 "over_email_send_rate_limit"
        // precisam ser indistinguíveis para quem está do lado de fora.
        return { error: result.ok ? null : { status: result.status } };
      },

      async getUser() {
        if (accessToken === null) return { data: { user: null }, error: { status: 401 } };
        const result = await request("/user", { method: "GET" });
        if (!result.ok) return { data: { user: null }, error: { status: result.status } };
        const parsed = userPayloadSchema.safeParse(result.payload);
        const id = z.uuid().safeParse(parsed.success ? parsed.data.id : "");
        if (!parsed.success || !id.success) return { data: { user: null }, error: { status: 502 } };
        return {
          data: { user: { id: id.data, email: parsed.data.email ?? null } },
          error: null,
        };
      },

      async verifyOtp(input) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const body =
          "tokenHash" in input
            ? { type: input.type, token_hash: input.tokenHash }
            : { type: input.type, email: input.email, token: input.token };
        const result = await request("/verify", { method: "POST", body, bearer: null });
        if (!result.ok) return { data: { session: null }, error: { status: result.status } };
        const session = normalizeSession(result.payload, nowSeconds);
        return session === null
          ? { data: { session: null }, error: { status: 502 } }
          : { data: { session }, error: null };
      },

      async refreshSession(input) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const result = await request("/token?grant_type=refresh_token", {
          method: "POST",
          body: { refresh_token: input.refreshToken },
          bearer: null,
        });
        if (!result.ok) return { data: { session: null }, error: { status: result.status } };
        const session = normalizeSession(result.payload, nowSeconds);
        return session === null
          ? { data: { session: null }, error: { status: 502 } }
          : { data: { session }, error: null };
      },

      async exchangeCodeForSession(input) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const result = await request("/token?grant_type=pkce", {
          method: "POST",
          body: { auth_code: input.authCode, code_verifier: input.codeVerifier },
          bearer: null,
        });
        if (!result.ok) return { data: { session: null }, error: { status: result.status } };
        const session = normalizeSession(result.payload, nowSeconds);
        return session === null
          ? { data: { session: null }, error: { status: 502 } }
          : { data: { session }, error: null };
      },

      async signOut() {
        if (accessToken === null) return { error: null };
        // `scope=global` revoga todos os refresh tokens da pessoa: sair aqui não
        // pode deixar uma sessão viva em outro dispositivo roubado.
        const result = await request("/logout?scope=global", { method: "POST" });
        return { error: result.ok ? null : { status: result.status } };
      },
    },
  };
}

export type { VerificationType };
