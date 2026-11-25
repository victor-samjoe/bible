import { afterEach, describe, expect, it, vi } from "vitest";
import { READER_SESSION_KEY } from "../../src/domain/reading-session";
import {
  clearLocalChapterReads,
  readLocalProgress,
  writeLocalChapterRead,
} from "../../app/progresso/local-progress";

function installStorage(initial: Record<string, unknown>) {
  let value = JSON.stringify(initial);
  const storage = {
    getItem: vi.fn((key: string) => key === READER_SESSION_KEY ? value : null),
    setItem: vi.fn((key: string, next: string) => {
      if (key === READER_SESSION_KEY) value = next;
    }),
  };
  vi.stubGlobal("window", { sessionStorage: storage });
  return { storage, saved: () => JSON.parse(value) as Record<string, unknown> };
}

afterEach(() => vi.unstubAllGlobals());

describe("progresso local", () => {
  it("corrige apenas o capítulo pedido e preserva notas e destaques", () => {
    const local = installStorage({
      readChapters: ["genesis.1", "joao.3"],
      notes: { "joao.3.1": "nota" },
      highlights: { "joao.3.1": "yellow" },
    });
    expect(writeLocalChapterRead("genesis.1", false).scopes).toEqual(["joao.3"]);
    expect(local.saved()).toMatchObject({
      readChapters: ["joao.3"],
      notes: { "joao.3.1": "nota" },
      highlights: { "joao.3.1": "yellow" },
    });
    clearLocalChapterReads();
    expect(local.saved()).toMatchObject({ readChapters: [], notes: { "joao.3.1": "nota" } });
  });

  it("informa indisponibilidade se o navegador recusar o armazenamento", () => {
    vi.stubGlobal("window", { sessionStorage: { getItem: () => { throw new Error("blocked"); } } });
    expect(readLocalProgress()).toEqual({ available: false, scopes: [] });
    expect(writeLocalChapterRead("genesis.1", true).available).toBe(false);
  });
});
