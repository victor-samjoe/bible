import { describe, expect, it, vi } from "vitest";
import { createOriginalReader } from "../../src/server/originals/reader";
import { parseOriginalQuery, type OriginalRepository } from "../../src/server/contracts/originals";

const EDITION_ID = "11111111-1111-4111-8111-111111111111";
const VERSE_ID = "22222222-2222-4222-8222-222222222222";
const TOKEN_ID = "33333333-3333-4333-8333-333333333333";
const REVIEWER_ID = "44444444-4444-4444-8444-444444444444";

function repository(overrides: Partial<OriginalRepository> = {}): OriginalRepository {
  return {
    findApprovedEdition: vi.fn().mockResolvedValue({
      id: EDITION_ID, code: "TEST-GRC", language: "grc", version: "Edição de teste",
      sourceUrl: "https://example.test/source", licenseDeclared: "CC BY 4.0",
      attribution: "Atribuição sintética de teste.", status: "approved",
      approvedBy: REVIEWER_ID, approvedAt: new Date("2026-11-19T00:00:00Z"),
    }),
    listVerses: vi.fn().mockResolvedValue([{ id: VERSE_ID, editionId: EDITION_ID, canonBook: "Jn", chapter: 3, verse: 16, canonicalRef: "Jn 3:16", text: "texto grego sintético" }]),
    listTokens: vi.fn().mockResolvedValue([{ id: TOKEN_ID, verseId: VERSE_ID, position: 1, surface: "token", normalized: "token" }]),
    listMorphemes: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("consulta de idiomas originais", () => {
  it("mapeia AT para hebraico e NT para grego sem adivinhar livros", () => {
    expect(parseOriginalQuery({ book: "genesis", chapter: 1, verses: [2, 1, 2] })).toMatchObject({ canonBook: "Gen", language: "hbo", verses: [1, 2] });
    expect(parseOriginalQuery({ book: "joao", chapter: 3, verses: [16] })).toMatchObject({ canonBook: "Jn", language: "grc" });
    expect(parseOriginalQuery({ book: "enoque", chapter: 1, verses: [1] })).toBeNull();
  });

  it("usa a numeração hebraica da fonte sem trocar a referência do leitor", () => {
    expect(parseOriginalQuery({ book: "miqueias", chapter: 5, verses: [2] })?.sourceReferences)
      .toEqual([{ chapter: 5, verse: 1 }]);
  });

  it("limita uma consulta a um capítulo e 25 versículos válidos", async () => {
    const reader = createOriginalReader(repository());
    expect(await reader.read({ book: "joao", chapter: 0, verses: [1] })).toEqual({ ok: false, reason: "invalid_query" });
    expect(await reader.read({ book: "joao", chapter: 3, verses: [] })).toEqual({ ok: false, reason: "invalid_query" });
    expect(await reader.read({ book: "joao", chapter: 3, verses: Array.from({ length: 26 }, (_, index) => index + 1) })).toEqual({ ok: false, reason: "invalid_query" });
  });

  it("entrega somente a seleção e conserva atribuição da edição aprovada", async () => {
    const repo = repository();
    const result = await createOriginalReader(repo).read({ book: "joao", chapter: 3, verses: [16] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.edition).toMatchObject({ code: "TEST-GRC", licenseDeclared: "CC BY 4.0", attribution: "Atribuição sintética de teste." });
    expect(result.verses).toHaveLength(1);
    expect(result.verses[0]?.tokens[0]?.surface).toBe("token");
    expect(repo.listVerses).toHaveBeenCalledWith({ editionId: EDITION_ID, canonBook: "Jn", chapter: 3, verses: [16] });
  });

  it("não expõe edição pendente nem erro de infraestrutura", async () => {
    const pending = repository({ findApprovedEdition: vi.fn().mockResolvedValue({ status: "under_review" }) });
    expect(await createOriginalReader(pending).read({ book: "joao", chapter: 3, verses: [16] })).toEqual({ ok: false, reason: "edition_unavailable" });
    const broken = repository({ listVerses: vi.fn().mockRejectedValue(new Error("postgres://user:secret@host/db")) });
    const result = await createOriginalReader(broken).read({ book: "joao", chapter: 3, verses: [16] });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("falha fechado quando não há banco", async () => {
    expect(await createOriginalReader(null).read({ book: "joao", chapter: 3, verses: [16] })).toEqual({ ok: false, reason: "unavailable" });
  });
});
