import { describe, expect, it, vi } from "vitest";
import { createGoTrueClient } from "../../src/server/auth/gotrue";
import { parseAuthConfig } from "../../src/server/auth/config";

/**
 * Cliente HTTP do provedor. Nenhum teste aqui toca a rede: `fetch` é um duplo,
 * e o que se verifica é o que sai desta aplicação (cabeçalhos, corpo, destino) e
 * o que ela aceita de volta.
 */

const userId = "b4627467-c03c-4dd6-9ba4-a4267758332f";
const config = parseAuthConfig({
  SUPABASE_URL: "https://projeto.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_exemplo",
  PUBLIC_SITE_URL: "https://bereana.example",
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const session = {
  access_token: "aaaaaaaa.bbbbbbbb.cccccccc",
  refresh_token: "refresh-token-abcdefgh",
  expires_in: 3600,
  user: { id: userId, email: "pessoa@example.com" },
};

describe("cliente Supabase Auth por requisição", () => {
  it("troca o código OAuth via PKCE sem usar token de outro usuário", async () => {
    const call = vi.fn().mockResolvedValue(jsonResponse(session));
    const client = createGoTrueClient(config, { fetchImpl: call as unknown as typeof fetch });
    const result = await client?.auth.exchangeCodeForSession?.({ authCode: "codigo", codeVerifier: "verificador" });
    expect(result?.data.session?.userId).toBe(userId);
    const [url, init] = call.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://projeto.supabase.co/auth/v1/token?grant_type=pkce");
    expect(JSON.parse(String(init.body))).toEqual({ auth_code: "codigo", code_verifier: "verificador" });
    expect(init.headers.Authorization).toBe("Bearer sb_publishable_exemplo");
  });
  it("não existe sem configuração válida", () => {
    expect(createGoTrueClient(parseAuthConfig({}))).toBeNull();
  });

  it("pede o código com a chave publicável e o retorno próprio", async () => {
    const call = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = createGoTrueClient(config, { fetchImpl: call as unknown as typeof fetch });
    const result = await client?.auth.signInWithOtp({ email: "pessoa@example.com", createUser: false });
    expect(result?.error).toBeNull();

    const [url, init] = call.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(
      "https://projeto.supabase.co/auth/v1/otp?redirect_to=https%3A%2F%2Fbereana.example%2Fauth%2Fcallback",
    );
    expect(init.headers.apikey).toBe("sb_publishable_exemplo");
    // Pedido anônimo: nunca manda token de sessão de outra pessoa.
    expect(init.headers.Authorization).toBe("Bearer sb_publishable_exemplo");
    expect(JSON.parse(String(init.body))).toEqual({ email: "pessoa@example.com", create_user: false });
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("manual");
  });

  it("verifica código e `token_hash` e normaliza o prazo da sessão", async () => {
    // `Response` tem corpo de uso único: cada chamada recebe uma resposta nova.
    const call = vi.fn().mockImplementation(async () => jsonResponse(session));
    const client = createGoTrueClient(config, { fetchImpl: call as unknown as typeof fetch });

    const byCode = await client?.auth.verifyOtp?.({ type: "email", email: "pessoa@example.com", token: "123456" });
    expect(byCode?.data.session?.userId).toBe(userId);
    expect(byCode?.data.session?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(JSON.parse(String(call.mock.calls[0]?.[1]?.body))).toEqual({
      type: "email",
      email: "pessoa@example.com",
      token: "123456",
    });

    const byHash = await client?.auth.verifyOtp?.({ type: "magiclink", tokenHash: "hash-abcdefgh12345678" });
    expect(byHash?.data.session?.userId).toBe(userId);
    expect(JSON.parse(String(call.mock.calls[1]?.[1]?.body))).toEqual({
      type: "magiclink",
      token_hash: "hash-abcdefgh12345678",
    });
  });

  it("não deixa mensagem nem corpo do provedor atravessar", async () => {
    const call = vi
      .fn()
      .mockImplementation(async () =>
        jsonResponse({ error: "User not found", error_description: "pessoa@example.com" }, 400),
      );
    const client = createGoTrueClient(config, { fetchImpl: call as unknown as typeof fetch });

    const otp = await client?.auth.signInWithOtp({ email: "pessoa@example.com" });
    const verify = await client?.auth.verifyOtp?.({ type: "email", email: "pessoa@example.com", token: "000000" });
    // O único dado que sobra é o status; nada de texto, e nada de e-mail.
    expect(otp?.error).toEqual({ status: 400 });
    expect(JSON.stringify(otp?.error)).not.toContain("User not found");
    expect(verify?.data.session).toBeNull();
    expect(JSON.stringify(verify?.error)).not.toContain("example.com");
  });

  it("recusa identidade sem UUID e sessão sem token, mesmo com HTTP 200", async () => {
    const call = vi.fn().mockResolvedValue(jsonResponse({ id: "não-uuid", email: "pessoa@example.com" }));
    const comToken = createGoTrueClient(config, {
      accessToken: "aaaaaaaa.bbbbbbbb.cccccccc",
      fetchImpl: call as unknown as typeof fetch,
    });
    expect((await comToken?.auth.getUser())?.data.user).toBeNull();

    const semSessao = vi.fn().mockResolvedValue(jsonResponse({ access_token: "a.b.c" }));
    const outro = createGoTrueClient(config, { fetchImpl: semSessao as unknown as typeof fetch });
    expect((await outro?.auth.verifyOtp?.({ type: "email", email: "a@b.co", token: "123456" }))?.data.session)
      .toBeNull();
  });

  it("sem token de sessão não consulta o provedor por identidade nem encerra sessão", async () => {
    const call = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = createGoTrueClient(config, { fetchImpl: call as unknown as typeof fetch });
    expect((await client?.auth.getUser())?.data.user).toBeNull();
    expect((await client?.auth.signOut?.())?.error).toBeNull();
    expect(call).not.toHaveBeenCalled();
  });

  it("encerra a sessão em escopo global e usa o token da sessão", async () => {
    const call = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createGoTrueClient(config, {
      accessToken: "aaaaaaaa.bbbbbbbb.cccccccc",
      fetchImpl: call as unknown as typeof fetch,
    });
    expect((await client?.auth.signOut?.())?.error).toBeNull();
    const [url, init] = call.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://projeto.supabase.co/auth/v1/logout?scope=global");
    expect(init.headers.Authorization).toBe("Bearer aaaaaaaa.bbbbbbbb.cccccccc");
  });

  it("renova a sessão pelo refresh token", async () => {
    const call = vi.fn().mockResolvedValue(jsonResponse({ ...session, expires_at: 1_900_000_000 }));
    const client = createGoTrueClient(config, { fetchImpl: call as unknown as typeof fetch });
    const result = await client?.auth.refreshSession?.({ refreshToken: "refresh-token-abcdefgh" });
    expect(result?.data.session?.expiresAt).toBe(1_900_000_000);
    expect(String(call.mock.calls[0]?.[0])).toContain("/token?grant_type=refresh_token");
  });
});
