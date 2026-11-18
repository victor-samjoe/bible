import { describe, expect, it } from "vitest";
import { createFixedWindowLimiter, hashRateLimitKey } from "../../src/server/auth/rate-limit";

describe("limite de tentativas em janela fixa", () => {
  it("libera até o limite, bloqueia depois e reabre na janela seguinte", () => {
    const limiter = createFixedWindowLimiter({ limit: 3, windowSeconds: 900 });
    const start = 1_000_000;
    expect(limiter.check("pessoa@example.com", start)).toEqual({ allowed: true, remaining: 2 });
    expect(limiter.check("pessoa@example.com", start + 1000)).toEqual({ allowed: true, remaining: 1 });
    expect(limiter.check("pessoa@example.com", start + 2000)).toEqual({ allowed: true, remaining: 0 });
    const blocked = limiter.check("pessoa@example.com", start + 3000);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    // Janela nova: a contagem reinicia.
    expect(limiter.check("pessoa@example.com", start + 900_001).allowed).toBe(true);
  });

  it("isola chaves e normaliza caixa e espaços do e-mail", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowSeconds: 60 });
    expect(limiter.check("Pessoa@Example.com", 0).allowed).toBe(true);
    // Mesmo e-mail escrito diferente não ganha um limite novo.
    expect(limiter.check("  pessoa@example.com  ", 10).allowed).toBe(false);
    expect(limiter.check("outra@example.com", 10).allowed).toBe(true);
    expect(hashRateLimitKey(" A@B.com ")).toBe(hashRateLimitKey("a@b.com"));
    // A chave guardada não contém o endereço em texto.
    expect(hashRateLimitKey("pessoa@example.com")).not.toContain("pessoa");
  });

  it("não vira passe livre com relógio inválido e não cresce sem teto", () => {
    const limiter = createFixedWindowLimiter({ limit: 5, windowSeconds: 60, maxKeys: 4 });
    expect(limiter.check("qualquer", Number.NaN).allowed).toBe(false);
    for (let index = 0; index < 50; index += 1) limiter.check(`chave-${index}`, 0);
    // Com teto de 4 chaves, as antigas saem: a mais antiga volta a ter janela nova.
    expect(limiter.check("chave-0", 1)).toEqual({ allowed: true, remaining: 4 });
    limiter.reset();
    expect(limiter.check("chave-49", 2)).toEqual({ allowed: true, remaining: 4 });
  });
});
