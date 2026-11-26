import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  type WorkerEvent = { waitUntil?: (value: Promise<unknown>) => void; request?: { method: string; url: string; mode: string }; respondWith?: () => void };
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const remove = vi.fn(async (name: string) => name.length > 0);
  const caches = { keys: vi.fn(async () => ["samjoe-static-shell-v3", "samjoe-static-shell-v4", "outro-cache"]), delete: remove, match: vi.fn(), open: vi.fn() };
  const self = { location: { origin: "https://example.test" }, clients: { claim: vi.fn(async () => {}) }, addEventListener: (name: string, handler: (event: WorkerEvent) => void) => handlers.set(name, handler) };
  runInNewContext(readFileSync("public/sw.js", "utf8"), { self, caches, URL, Promise, Response, fetch: vi.fn(async () => { throw new Error("offline"); }) });
  return { handlers, remove, caches };
}

describe("service worker de leitura", () => {
  it("limpa somente versões antigas da própria casca", async () => {
    const { handlers, remove } = worker();
    let pending: Promise<unknown> | undefined;
    handlers.get("activate")?.({ waitUntil: (value: Promise<unknown>) => { pending = value; } });
    await pending;
    expect(remove.mock.calls.map((call) => call[0])).toEqual(["samjoe-static-shell-v3"]);
  });
  it("não intercepta APIs, outras origens ou escritas", () => {
    const { handlers } = worker();
    for (const request of [
      { method: "GET", url: "https://example.test/api/biblia/original", mode: "cors" },
      { method: "GET", url: "https://other.test/offline", mode: "navigate" },
      { method: "POST", url: "https://example.test/offline", mode: "cors" },
    ]) {
      const respondWith = vi.fn();
      handlers.get("fetch")?.({ request, respondWith });
      expect(respondWith).not.toHaveBeenCalled();
    }
  });
  it("recria a casca armazenada antes de responder à navegação offline", async () => {
    const { handlers, caches } = worker();
    caches.match.mockResolvedValue(new Response("<html>leitor</html>"));
    let pending: Promise<Response> | undefined;
    handlers.get("fetch")?.({
      request: { method: "GET", url: "https://example.test/biblia/joao/1", mode: "navigate" },
      respondWith: ((value: Promise<Response>) => { pending = value; }) as () => void,
    });
    const response = await pending;
    expect(await response?.text()).toBe("<html>leitor</html>");
    expect(response?.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response?.redirected).toBe(false);
  });
});
