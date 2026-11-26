import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/auth/runtime", () => ({
  confirmEmailLink: vi.fn(),
  confirmOAuthCode: vi.fn(),
}));

import { GET } from "../../app/auth/callback/route";
import { confirmEmailLink, confirmOAuthCode } from "../../src/server/auth/runtime";

beforeEach(() => vi.resetAllMocks());

describe("retorno de autenticação", () => {
  it("atribui erros ao link de e-mail quando não há tentativa OAuth", async () => {
    const response = await GET(new Request("https://example.test/auth/callback?error=expired"));
    expect(response.headers.get("location")).toBe("/entrar?erro=link");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("atribui erros ao Google quando há verificador OAuth", async () => {
    const response = await GET(new Request("https://example.test/auth/callback?error=access_denied", {
      headers: { cookie: "samjoe_oauth_verifier=abc" },
    }));
    expect(response.headers.get("location")).toBe("/entrar?erro=google");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("limpa o verificador também em desenvolvimento HTTP", async () => {
    vi.mocked(confirmOAuthCode).mockResolvedValue({ ok: false, reason: "invalid_token" });
    const response = await GET(new Request("http://localhost/auth/callback?code=abc", {
      headers: { cookie: "samjoe_oauth_verifier=verifier" },
    }));
    expect(response.headers.get("location")).toBe("/entrar?erro=google");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).not.toContain("Secure");
  });

  it("troca o código com o verificador e apaga o cookie temporário", async () => {
    vi.mocked(confirmOAuthCode).mockResolvedValue({ ok: true });
    const response = await GET(new Request("https://example.test/auth/callback?code=abc", {
      headers: { cookie: "other=1; samjoe_oauth_verifier=verifier" },
    }));
    expect(confirmOAuthCode).toHaveBeenCalledWith("abc", "verifier");
    expect(response.headers.get("location")).toBe("/conta?login=concluido");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("mantém o fluxo de confirmação por e-mail", async () => {
    vi.mocked(confirmEmailLink).mockResolvedValue({ ok: true });
    const response = await GET(new Request("https://example.test/auth/callback?token_hash=hash&type=email"));
    expect(confirmEmailLink).toHaveBeenCalledWith("hash", "email");
    expect(response.headers.get("location")).toBe("/conta?login=concluido");
  });
});
