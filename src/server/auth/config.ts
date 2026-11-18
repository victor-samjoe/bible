import { z } from "zod";

const environmentSchema = z.object({
  SUPABASE_URL: z.string().trim().optional().default(""),
  SUPABASE_PUBLISHABLE_KEY: z.string().trim().optional().default(""),
  SUPABASE_ANON_KEY: z.string().trim().optional().default(""),
  // Origem pública usada para montar o link do e-mail (`redirect_to`). Sem ela o
  // Supabase usa a Site URL do projeto; é por isso que a ausência não derruba a
  // autenticação, mas um valor inválido derruba — ver `parseAuthConfig`.
  PUBLIC_SITE_URL: z.string().trim().optional().default(""),
});

export type AuthConfig =
  | { available: false; reason: "missing_configuration" | "invalid_configuration" }
  | { available: true; url: string; anonKey: string; siteUrl: string | null };

/**
 * Aceita apenas origem absoluta, sem credencial embutida, sem query e sem
 * fragmento. `https` é exigido fora de `localhost`/`127.0.0.1`, para que um
 * ambiente de desenvolvimento continue possível sem abrir brecha em produção.
 */
function parseOrigin(value: string): string | null {
  if (!z.url().safeParse(value).success) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) return null;
  return parsed.origin;
}

/** Validate without exposing values or throwing when configuration is absent. */
export function parseAuthConfig(environment: unknown): AuthConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) return { available: false, reason: "invalid_configuration" };
  const { SUPABASE_URL: url } = result.data;
  // Prefer the current publishable key, retaining legacy anon-key compatibility.
  const anonKey = result.data.SUPABASE_PUBLISHABLE_KEY || result.data.SUPABASE_ANON_KEY;
  if (!url && !anonKey) return { available: false, reason: "missing_configuration" };
  if (!url || !anonKey) return { available: false, reason: "invalid_configuration" };
  const validUrl = z.url().safeParse(url);
  if (!validUrl.success) return { available: false, reason: "invalid_configuration" };
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
    return { available: false, reason: "invalid_configuration" };
  }
  // Site URL é opcional, mas quando declarada precisa ser utilizável: uma origem
  // quebrada viraria link de e-mail quebrado ou, pior, redirecionamento aberto.
  const rawSiteUrl = result.data.PUBLIC_SITE_URL;
  const siteUrl = rawSiteUrl ? parseOrigin(rawSiteUrl) : null;
  if (rawSiteUrl && !siteUrl) return { available: false, reason: "invalid_configuration" };
  return { available: true, url, anonKey, siteUrl };
}

/**
 * Cookie de sessão só pode ser `Secure` quando a origem é https; em `http://localhost`
 * o navegador descartaria o cookie e o login local nunca completaria.
 */
export function usesSecureCookies(config: AuthConfig): boolean {
  if (!config.available || config.siteUrl === null) return true;
  return config.siteUrl.startsWith("https:");
}
