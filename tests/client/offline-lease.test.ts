import { describe, expect, it } from "vitest";

import { newLeaseOwner, withInstallLease } from "../../src/client/offline/storage";

/** Arrendamento em memória, com a mesma regra de dono e prazo do real. */
function leaseStore() {
  let lease: { owner: string; expiresAt: number } | null = null;
  const chamadas: string[] = [];
  return {
    get lease() {
      return lease;
    },
    chamadas,
    async acquireInstallLease(owner: string, now: number) {
      chamadas.push(`acquire:${owner}`);
      if (lease !== null && lease.owner !== owner && lease.expiresAt > now) return false;
      lease = { owner, expiresAt: now + 600_000 };
      return true;
    },
    async releaseInstallLease(owner: string) {
      chamadas.push(`release:${owner}`);
      if (lease?.owner === owner) lease = null;
    },
  };
}

describe("withInstallLease", () => {
  it("executa e solta o arrendamento", async () => {
    const store = leaseStore();
    const result = await withInstallLease(store, async () => "feito", () => "ocupado", () => 1_000);
    expect(result).toBe("feito");
    expect(store.lease).toBeNull();
  });

  it("solta o arrendamento mesmo quando falha", async () => {
    // Sem isto, uma queda de rede deixaria o download travado até o prazo
    // vencer — dez minutos de botão que não funciona, sem explicação.
    const store = leaseStore();
    await expect(
      withInstallLease(
        store,
        async () => {
          throw new Error("rede caiu");
        },
        () => "ocupado",
        () => 1_000,
      ),
    ).rejects.toThrow(/rede caiu/u);
    expect(store.lease).toBeNull();
  });

  it("devolve ocupado sem executar quando outra aba detém o arrendamento", async () => {
    const store = leaseStore();
    await store.acquireInstallLease("outra-aba", 1_000);
    let rodou = false;
    const result = await withInstallLease(
      store,
      async () => {
        rodou = true;
        return "feito";
      },
      () => "ocupado",
      () => 1_000,
    );
    expect(result).toBe("ocupado");
    expect(rodou).toBe(false);
    // E não solta o arrendamento alheio ao desistir.
    expect(store.lease?.owner).toBe("outra-aba");
    expect(store.chamadas.filter((c) => c.startsWith("release:"))).toHaveLength(0);
  });

  it("gera donos distintos", () => {
    const donos = new Set(Array.from({ length: 50 }, () => newLeaseOwner()));
    expect(donos.size).toBe(50);
    for (const dono of donos) expect(dono).toMatch(/^[0-9a-f]{16}$/u);
  });
});
