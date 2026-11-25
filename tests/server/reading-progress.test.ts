import { describe, expect, it, vi } from "vitest";
import {
  createReadingProgressService,
  type ReadingProgressRepository,
} from "../../src/server/reading/progress";

/**
 * O serviço de progresso é a fronteira entre o navegador e as marcas de
 * leitura. Estes testes descrevem três coisas:
 *
 *  1. escopo inválido não chega ao banco;
 *  2. toda operação carrega o `userId` recebido, e nunca lê o de outra pessoa;
 *  3. corrigir um capítulo mexe só naquele capítulo.
 */

const ALICE = "11111111-1111-4111-8111-111111111111";
const BRUNO = "22222222-2222-4222-8222-222222222222";

/** Repositório de mentira com dados de duas pessoas, para provar o isolamento. */
function repository(
  data: Record<string, string[]> = { [ALICE]: ["genesis.1", "genesis.2"], [BRUNO]: ["mateus.5"] },
  existing: ReadonlySet<string> = new Set(["genesis.1", "genesis.2", "genesis.3", "mateus.5"]),
) {
  const store = new Map(Object.entries(data).map(([user, scopes]) => [user, new Set(scopes)]));
  const calls: { method: string; userId: string; scope?: string; read?: boolean }[] = [];

  const repo: ReadingProgressRepository = {
    listReadScopes: vi.fn(async (userId: string) => {
      calls.push({ method: "list", userId });
      return [...(store.get(userId) ?? new Set<string>())];
    }),
    setChapterRead: vi.fn(async (userId: string, bookSlug: string, chapterNumber: number, read: boolean) => {
      const scope = `${bookSlug}.${chapterNumber}`;
      calls.push({ method: "set", userId, scope, read });
      if (!existing.has(scope)) return false;
      const scopes = store.get(userId) ?? new Set<string>();
      if (read) scopes.add(scope);
      else scopes.delete(scope);
      store.set(userId, scopes);
      return true;
    }),
    clearReadScopes: vi.fn(async (userId: string) => {
      calls.push({ method: "clear", userId });
      const scopes = store.get(userId) ?? new Set<string>();
      const total = scopes.size;
      store.set(userId, new Set());
      return total;
    }),
  };

  return { repo, store, calls, service: createReadingProgressService(repo) };
}

describe("serviço de progresso de leitura", () => {
  it("lê somente os capítulos da pessoa pedida", async () => {
    const { service } = repository();
    expect(await service.listReadScopes(ALICE)).toEqual(["genesis.1", "genesis.2"]);
    expect(await service.listReadScopes(BRUNO)).toEqual(["mateus.5"]);
  });

  it("recusa escopo malformado antes de tocar no banco", async () => {
    const { service, repo } = repository();
    for (const scope of ["", "genesis", "genesis.", ".1", "Genesis.1", "genesis.1.2", "../etc.1", null, 7, {}]) {
      const result = await service.setChapterRead(ALICE, scope, true);
      expect(result).toEqual({ ok: false, reason: "invalid_scope" });
    }
    expect(repo.setChapterRead).not.toHaveBeenCalled();
  });

  it("responde not_found quando o capítulo não existe no corpus", async () => {
    const { service, store } = repository();
    const result = await service.setChapterRead(ALICE, "genesis.99", true);
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect([...(store.get(ALICE) ?? [])]).toEqual(["genesis.1", "genesis.2"]);
  });

  it("marca e desmarca somente o capítulo pedido", async () => {
    const { service, store } = repository();
    expect(await service.setChapterRead(ALICE, "genesis.3", true)).toEqual({ ok: true, read: true });
    expect([...(store.get(ALICE) ?? [])]).toEqual(["genesis.1", "genesis.2", "genesis.3"]);

    expect(await service.setChapterRead(ALICE, "genesis.1", false)).toEqual({ ok: true, read: false });
    expect([...(store.get(ALICE) ?? [])]).toEqual(["genesis.2", "genesis.3"]);
  });

  it("escreve sempre com o userId recebido e não mexe no de outra pessoa", async () => {
    const { service, store, calls } = repository();
    await service.setChapterRead(ALICE, "genesis.3", true);
    await service.clearReadScopes(ALICE);

    expect(calls.every((call) => call.userId === ALICE)).toBe(true);
    expect([...(store.get(ALICE) ?? [])]).toEqual([]);
    // Bruno continua intacto: nada no serviço permite alcançar outra conta.
    expect([...(store.get(BRUNO) ?? [])]).toEqual(["mateus.5"]);
  });

  it("devolve quantas marcas havia no reinício total", async () => {
    const { service } = repository();
    expect(await service.clearReadScopes(ALICE)).toEqual({ ok: true, cleared: 2 });
    expect(await service.clearReadScopes(ALICE)).toEqual({ ok: true, cleared: 0 });
  });

  it("não devolve nada para quem não tem marca", async () => {
    const { service } = repository({});
    expect(await service.listReadScopes(ALICE)).toEqual([]);
  });
});
