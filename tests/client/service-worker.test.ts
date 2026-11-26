import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  type WorkerEvent = { waitUntil?: (value: Promise<unknown>) => void; request?: { method: string; url: string; mode: string }; respondWith?: () => void };
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const remove = vi.fn(async (name: string) => name.length > 0);
  const caches = { keys: vi.fn(async () => ["samjoe-static-shell-v2", "samjoe-static-shell-v3", "outro-cache"]), delete: remove, match: vi.fn(), open: vi.fn() };
  const self = { location: { origin: "https://example.test" }, clients: { claim: vi.fn(async () => {}) }, addEventListener: (name: string, handler: (event: WorkerEvent) => void) => handlers.set(name, handler) };
  runInNewContext(readFileSync("public/sw.js", "utf8"), { self, caches, URL, Promise, Response, fetch: vi.fn() });
  return { handlers, remove };
}

describe("service worker de leitura", () => {
  it("limpa somente versões antigas da própria casca", async () => {
    const { handlers, remove } = worker();
    let pending: Promise<unknown> | undefined;
    handlers.get("activate")?.({ waitUntil: (value: Promise<unknown>) => { pending = value; } });
    await pending;
    expect(remove.mock.calls.map((call) => call[0])).toEqual(["samjoe-static-shell-v2"]);
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
});
