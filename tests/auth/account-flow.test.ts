import { describe, expect, it, vi } from "vitest";
import { authorize, createAuth, parseAuthConfig, toViewer, usesSecureCookies } from "../../src/server/auth";
import type { SupabaseAuthClient } from "../../src/server/auth";

/**
 * Regras do fluxo de conta acima do provedor: verificar código, verificar link,
 * renovar, sair e decidir autorização. Nenhum teste aqui fala com rede ou banco.
 */

const userId = "b4627467-c03c-4dd6-9ba4-a4267758332f";
const config = parseAuthConfig({
  SUPABASE_URL: "https://projeto.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_exemplo",
});
const session = {
  accessToken: "aaaaaaaa.bbbbbbbb.cccccccc",
  refreshToken: "refresh-token-abcdefgh",
  expiresAt: 1_900_000_000,
  userId,
};

function client(overrides: Partial<SupabaseAuthClient["auth"]> = {}): SupabaseAuthClient {
  return {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId, email: "pessoa@example.com" } }, error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      ...overrides,
    },
  };
}

describe("verificação do código de acesso", () => {
  it("exige e-mail e código válidos antes de falar com o provedor", async () => {
    const provider = client();
    const auth = createAuth(config, provider);
    for (const [email, code] of [
      ["não-e-mail", "123456"],
      ["pessoa@example.com", "12345"],
      ["pessoa@example.com", "12 34 56"],
      ["pessoa@example.com", "abcdef"],
      ["pessoa@example.com", ""],
    ] as const) {
      expect(await auth.verifyOtpCode(email, code)).toEqual({ ok: false, reason: "invalid_input" });
    }
    expect(provider.auth.verifyOtp).not.toHaveBeenCalled();
    expect(await auth.verifyOtpCode(" pessoa@example.com ", " 123456 ")).toEqual({ ok: true, session });
    expect(provider.auth.verifyOtp).toHaveBeenCalledWith({
      type: "email",
      email: "pessoa@example.com",
      token: "123456",
    });
  });

  it("trata código recusado, sessão ausente e exceção como falhas distintas e opacas", async () => {
    const recusado = client({ verifyOtp: vi.fn().mockResolvedValue({ data: { session: null }, error: { status: 403 } }) });
    expect(await createAuth(config, recusado).verifyOtpCode("pessoa@example.com", "123456")).toEqual({
      ok: false,
      reason: "invalid_token",
    });
    const quebrado = client({ verifyOtp: vi.fn().mockRejectedValue(new Error("pessoa@example.com não existe")) });
    const result = await createAuth(config, quebrado).verifyOtpCode("pessoa@example.com", "123456");
    expect(result).toEqual({ ok: false, reason: "provider_error" });
    expect(JSON.stringify(result)).not.toContain("example.com");
  });

  it("aceita só os tipos de link deste fluxo e um `token_hash` com forma de token", async () => {
    const provider = client();
    const auth = createAuth(config, provider);
    // `recovery`, `invite` e `email_change` existem no provedor e não valem aqui:
    // entrar por link emitido para outra finalidade seria desvio de finalidade.
    for (const type of ["recovery", "invite", "email_change", "", null, 7]) {
      expect(await auth.verifyEmailLink("hash-abcdefgh12345678", type)).toEqual({
        ok: false,
        reason: "invalid_input",
      });
    }
    expect(await auth.verifyEmailLink("curto", "email")).toEqual({ ok: false, reason: "invalid_input" });
    expect(provider.auth.verifyOtp).not.toHaveBeenCalled();
    expect(await auth.verifyEmailLink("hash-abcdefgh12345678", "signup")).toEqual({ ok: true, session });
  });

  it("renova apenas com refresh token presente e devolve sessão nova", async () => {
    const provider = client();
    const auth = createAuth(config, provider);
    expect(await auth.refreshSession("   ")).toEqual({ ok: false, reason: "invalid_input" });
    expect(provider.auth.refreshSession).not.toHaveBeenCalled();
    expect(await auth.refreshSession(" refresh-token-abcdefgh ")).toEqual({ ok: true, session });
  });

  it("declara indisponível a capacidade que o cliente não tem, em vez de assumir sucesso", async () => {
    const magro: SupabaseAuthClient = {
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    };
    const auth = createAuth(config, magro);
    expect(await auth.verifyOtpCode("pessoa@example.com", "123456")).toEqual({ ok: false, reason: "unavailable" });
    expect(await auth.verifyEmailLink("hash-abcdefgh12345678", "email")).toEqual({ ok: false, reason: "unavailable" });
    expect(await auth.refreshSession("refresh-token-abcdefgh")).toEqual({ ok: false, reason: "unavailable" });
    expect(await auth.signOut()).toBe(false);
  });

  it("não cria conta ao entrar e cria só quando o cadastro pede", async () => {
    const provider = client();
    const auth = createAuth(config, provider);
    await auth.requestOtp("pessoa@example.com", { createUser: false });
    await auth.requestOtp("pessoa@example.com", { createUser: true });
    expect(provider.auth.signInWithOtp).toHaveBeenNthCalledWith(1, {
      email: "pessoa@example.com",
      createUser: false,
    });
    expect(provider.auth.signInWithOtp).toHaveBeenNthCalledWith(2, {
      email: "pessoa@example.com",
      createUser: true,
    });
  });

  it("lê a identidade verificada e recusa e-mail inválido vindo do provedor", async () => {
    expect(await createAuth(config, client()).getIdentity()).toEqual({ id: userId, email: "pessoa@example.com" });
    const semEmail = client({
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId, email: "não-e-mail" } }, error: null }),
    });
    expect(await createAuth(config, semEmail).getIdentity()).toEqual({ id: userId, email: null });
    const semId = client({
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "1" }, error: null } }),
    });
    expect(await createAuth(config, semId).getIdentity()).toBeNull();
  });
});

describe("autorização", () => {
  it("separa anônimo de sem permissão e trata papel desconhecido como anônimo", () => {
    expect(authorize(null, "reader")).toEqual({ ok: false, reason: "unauthenticated" });
    expect(authorize({ id: "não-uuid", role: "admin" }, "reader")).toEqual({
      ok: false,
      reason: "unauthenticated",
    });
    expect(authorize({ id: userId, role: "superadmin" as "admin" }, "reader")).toEqual({
      ok: false,
      reason: "unauthenticated",
    });
    expect(authorize({ id: userId, role: "reader" }, "editor")).toEqual({ ok: false, reason: "forbidden" });
    expect(authorize({ id: userId, role: "editor" }, "reader")).toEqual({
      ok: true,
      viewer: { id: userId, role: "editor" },
    });
  });

  it("monta o viewer só com id e papel válidos", () => {
    expect(toViewer(userId, "admin")).toEqual({ id: userId, role: "admin" });
    expect(toViewer(userId, "dono")).toBeNull();
    expect(toViewer(userId, undefined)).toBeNull();
    expect(toViewer("1", "reader")).toBeNull();
  });
});

describe("configuração de ambiente", () => {
  it("recusa Site URL quebrada, aceita https e aceita http só em localhost", () => {
    const base = { SUPABASE_URL: "https://projeto.supabase.co", SUPABASE_ANON_KEY: "chave" };
    expect(parseAuthConfig({ ...base, PUBLIC_SITE_URL: "https://bereana.example" })).toEqual({
      available: true,
      url: base.SUPABASE_URL,
      anonKey: "chave",
      siteUrl: "https://bereana.example",
    });
    for (const siteUrl of ["http://bereana.example", "não-url", "https://u:p@bereana.example", "https://x.example/?a=1"]) {
      expect(parseAuthConfig({ ...base, PUBLIC_SITE_URL: siteUrl })).toEqual({
        available: false,
        reason: "invalid_configuration",
      });
    }
    const local = parseAuthConfig({ ...base, PUBLIC_SITE_URL: "http://localhost:3000" });
    expect(local.available).toBe(true);
    // Cookie `Secure` em http://localhost seria descartado pelo navegador.
    expect(usesSecureCookies(local)).toBe(false);
    expect(usesSecureCookies(parseAuthConfig({ ...base, PUBLIC_SITE_URL: "https://bereana.example" }))).toBe(true);
    // Sem Site URL declarada, o padrão continua o seguro.
    expect(usesSecureCookies(parseAuthConfig(base))).toBe(true);
    expect(usesSecureCookies(parseAuthConfig({}))).toBe(true);
  });
});
