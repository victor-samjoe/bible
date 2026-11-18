import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  clearedSessionCookieOptions,
  decodeSession,
  encodeSession,
  needsRefresh,
  sessionCookieOptions,
} from "../../src/server/auth/session";

/**
 * O cookie de sessão não é assinado por nós (ver o cabeçalho de
 * `src/server/auth/session.ts`), então o que estes testes cobrem é o contrato que
 * sustenta essa decisão: nada que não tenha forma de sessão vira sessão, e o
 * cookie sai sempre com os atributos que impedem leitura por JavaScript e envio
 * em requisição de terceiro.
 */

const session = {
  accessToken: "aaaaaaaa.bbbbbbbb.cccccccc",
  refreshToken: "refresh-token-abcdefgh",
  expiresAt: 1_800_000_000,
};

describe("cookie de sessão", () => {
  it("fecha o ciclo codificar/decodificar sem alterar os valores", () => {
    const encoded = encodeSession(session);
    expect(encoded).not.toBeNull();
    // Nada legível a olho nu, e nada de `=` para quebrar o cookie.
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSession(encoded)).toEqual(session);
  });

  it("recusa ausência, lixo, base64 inválida e sessão fora de formato", () => {
    for (const value of [null, undefined, "", "não-base64url!", "YWJj", "e30"]) {
      expect(decodeSession(value)).toBeNull();
    }
    // JSON válido, campos errados: token sem três segmentos e prazo negativo.
    const broken = Buffer.from(
      JSON.stringify({ accessToken: "x", refreshToken: "y", expiresAt: -1 }),
      "utf-8",
    )
      .toString("base64url");
    expect(decodeSession(broken)).toBeNull();
  });

  it("recusa gravar sessão que não passa pelo próprio schema", () => {
    expect(encodeSession({ ...session, accessToken: "sem-pontos" })).toBeNull();
    expect(encodeSession({ ...session, expiresAt: 0 })).toBeNull();
    // Refresh token gigante estouraria o limite do cookie no navegador.
    expect(encodeSession({ ...session, refreshToken: "a".repeat(600) })).toBeNull();
  });

  it("emite cookie httpOnly, SameSite=Lax e com caminho único", () => {
    const options = sessionCookieOptions(true);
    expect(options).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    // Em http://localhost o cookie `Secure` seria descartado pelo navegador.
    expect(sessionCookieOptions(false).secure).toBe(false);
    expect(clearedSessionCookieOptions(true).maxAge).toBe(0);
    expect(SESSION_COOKIE).toBe("samjoe_session");
  });

  it("renova com folga e trata relógio inválido como vencido", () => {
    expect(needsRefresh(session, session.expiresAt - 3600)).toBe(false);
    expect(needsRefresh(session, session.expiresAt - 60)).toBe(true);
    expect(needsRefresh(session, session.expiresAt + 10)).toBe(true);
    expect(needsRefresh(session, Number.NaN)).toBe(true);
  });
});
