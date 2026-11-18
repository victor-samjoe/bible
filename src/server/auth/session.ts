import { z } from "zod";

/**
 * Sessão do lado do servidor: formato, validação e opções do cookie.
 *
 * Módulo puro de propósito. Não importa `next/headers`, banco nem rede, para
 * poder ser testado sem servidor e para que o custo de ler uma sessão seja
 * decodificar uma string.
 *
 * Decisão de segurança registrada aqui porque é fácil de esquecer: o cookie
 * guarda os tokens emitidos pelo provedor e **não é assinado por nós**. Isso é
 * deliberado — não existe segredo próprio configurado no projeto e inventar um
 * seria pior. A integridade não depende do cookie: o access token é um JWT
 * assinado pelo Supabase e toda requisição que decide autorização chama
 * `GET /auth/v1/user`, que rejeita token forjado, alterado ou revogado. O cookie
 * é, portanto, portador de credencial — e por isso `httpOnly`, `SameSite=Lax`,
 * `Secure` fora de localhost e `Path=/`, sem nada legível por JavaScript.
 */

/** Nome único; prefixo do projeto para não colidir com cookie de outro app no mesmo domínio. */
export const SESSION_COOKIE = "samjoe_session";

/**
 * Janela máxima de inatividade. O access token vive cerca de uma hora e é
 * renovado pelo refresh token; sete dias é o tempo que a credencial pode ficar
 * parada no navegador antes de a pessoa ter de pedir um novo código.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** Renova com folga para não usar um token que expira no meio da requisição. */
export const REFRESH_SKEW_SECONDS = 60;

/** Limite de tamanho do cookie no navegador (4 KB) com margem para atributos. */
const MAX_COOKIE_VALUE_BYTES = 3800;

// JWT compacto: três segmentos base64url. Validar o formato antes de enviar ao
// provedor evita gastar requisição com lixo vindo de cookie manipulado.
const JWT = /^[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{2,}$/;
const OPAQUE_TOKEN = /^[A-Za-z0-9._-]{8,512}$/;
// 4102444800 = 2100-01-01T00:00:00Z. Acima disso é relógio quebrado, não sessão.
const MAX_EPOCH_SECONDS = 4_102_444_800;

export const storedSessionSchema = z.object({
  accessToken: z.string().regex(JWT),
  refreshToken: z.string().regex(OPAQUE_TOKEN),
  expiresAt: z.number().int().positive().max(MAX_EPOCH_SECONDS),
});

export type StoredSession = z.infer<typeof storedSessionSchema>;

/** Sessão como o provedor a devolve, já normalizada e com a identidade verificada. */
export interface ProviderSession extends StoredSession {
  readonly userId: string;
}

export interface SessionCookieOptions {
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly secure: boolean;
  readonly path: "/";
  readonly maxAge: number;
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** `null` quando o resultado não caberia no cookie — melhor não ter sessão que ter sessão truncada. */
export function encodeSession(session: StoredSession): string | null {
  const parsed = storedSessionSchema.safeParse(session);
  if (!parsed.success) return null;
  const encoded = toBase64Url(
    JSON.stringify({
      accessToken: parsed.data.accessToken,
      refreshToken: parsed.data.refreshToken,
      expiresAt: parsed.data.expiresAt,
    }),
  );
  return encoded.length > MAX_COOKIE_VALUE_BYTES ? null : encoded;
}

/** Falha fechada: qualquer desvio de formato devolve `null` e a requisição segue anônima. */
export function decodeSession(raw: string | null | undefined): StoredSession | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_COOKIE_VALUE_BYTES) return null;
  const json = fromBase64Url(raw);
  if (json === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = storedSessionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function sessionCookieOptions(secure: boolean): SessionCookieOptions {
  return { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE_SECONDS };
}

/** Opções para apagar o cookie. `maxAge: 0` remove em qualquer navegador atual. */
export function clearedSessionCookieOptions(secure: boolean): SessionCookieOptions & { maxAge: 0 } {
  return { ...sessionCookieOptions(secure), maxAge: 0 };
}

export function needsRefresh(session: StoredSession, nowSeconds: number): boolean {
  if (!Number.isFinite(nowSeconds)) return true;
  return session.expiresAt - nowSeconds <= REFRESH_SKEW_SECONDS;
}
