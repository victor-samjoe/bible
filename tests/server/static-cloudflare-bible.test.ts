import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createStaticCloudflareReader } from "../../src/server/bible/static-cloudflare";

describe("leitura pública estática na Cloudflare", () => {
  it("lê Gênesis 1 pelo pacote publicado, sem chamar banco e sem recriar identificadores", async () => {
    const calls: string[] = [];
    const reader = createStaticCloudflareReader(async (path) => {
      calls.push(path);
      return new Response(await readFile(`public${path}`));
    });
    const chapter = await reader.readChapter("genesis", 1);
    expect(chapter.ok).toBe(true);
    if (!chapter.ok) throw new Error(chapter.reason);
    expect(chapter.chapter.verses).toHaveLength(31);
    expect(chapter.chapter.verses[0]?.content).toBe("No princípio criou Deus os céus e a terra.");
    expect(chapter.chapter.attribution).toContain("Bíblia Livre");
    expect(chapter.chapter.book).not.toHaveProperty("id");
    expect(chapter.chapter.verses[0]).not.toHaveProperty("id");
    expect((await reader.readChapter("genesis", 2)).ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("falha sem servir texto alterado e rejeita referências inválidas", async () => {
    const reader = createStaticCloudflareReader(async (path) => {
      const bytes = await readFile(`public${path}`);
      if (path.endsWith("/GEN.json")) bytes[bytes.length - 2] = (bytes[bytes.length - 2] ?? 0) ^ 1;
      return new Response(bytes);
    });
    expect(await reader.readChapter("genesis", 1)).toEqual({ ok: false, reason: "unavailable" });
    expect(await reader.readChapter("../genesis", 1)).toEqual({ ok: false, reason: "invalid_reference" });
    expect(await reader.readChapter("genesis", 51)).toEqual({ ok: false, reason: "not_found" });
  });
});
