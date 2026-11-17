import { describe, expect, it, vi } from "vitest";
import { createBibleReader } from "../../src/server/bible/reader";
import { BLIVRE_TRANSLATION_ID } from "../../src/server/bible/blivre";
import type { BibleRepository } from "../../src/server/contracts/bible";

// Fixtures sintéticas: nenhum versículo real é usado nos testes, para não
// reproduzir nem inventar texto bíblico aqui.
const TRANSLATION = BLIVRE_TRANSLATION_ID;
const OTHER_TRANSLATION = "99999999-9999-4999-8999-999999999999";
const BOOK_A = "11111111-1111-4111-8111-111111111111";
const BOOK_B = "22222222-2222-4222-8222-222222222222";
const CHAPTER_1 = "33333333-3333-4333-8333-333333333333";
const CHAPTER_2 = "44444444-4444-4444-8444-444444444444";
const VERSE = (tail: string) => `55555555-5555-4555-8555-5555555555${tail}`;

const approvedTranslation = {
  id: TRANSLATION,
  name: "Bíblia Livre (BLIVRE)",
  status: "approved",
  attribution: "Atribuição obrigatória de teste.",
};

const bookA = {
  id: BOOK_A,
  translationId: TRANSLATION,
  code: "GEN",
  slug: "genesis",
  name: "Livro A",
  orderNo: 1,
};

const bookB = {
  id: BOOK_B,
  translationId: TRANSLATION,
  code: "EXO",
  slug: "exodo",
  name: "Livro B",
  orderNo: 2,
};

function repository(overrides: Partial<BibleRepository> = {}): BibleRepository {
  return {
    findTranslation: vi.fn().mockResolvedValue(approvedTranslation),
    listBooks: vi.fn().mockResolvedValue([bookA, bookB]),
    findBook: vi.fn().mockResolvedValue(bookA),
    listChapters: vi
      .fn()
      .mockResolvedValue([
        { id: CHAPTER_1, bookId: BOOK_A, number: 1 },
        { id: CHAPTER_2, bookId: BOOK_A, number: 2 },
      ]),
    findChapter: vi.fn().mockResolvedValue({ id: CHAPTER_1, bookId: BOOK_A, number: 1 }),
    listVerses: vi.fn().mockResolvedValue([
      { id: VERSE("01"), chapterId: CHAPTER_1, number: 1, content: "Texto de teste 1", published: true },
      { id: VERSE("02"), chapterId: CHAPTER_1, number: 2, content: "Texto de teste 2", published: true },
    ]),
    ...overrides,
  };
}

describe("leitura BLIVRE: indisponibilidade e falha fechada", () => {
  it("responde unavailable sem banco configurado, sem lançar exceção", async () => {
    const reader = createBibleReader(TRANSLATION, null);
    expect(reader.available).toBe(false);
    expect(await reader.listBooks()).toEqual({ ok: false, reason: "unavailable" });
    expect(await reader.listChapters("genesis")).toEqual({ ok: false, reason: "unavailable" });
    expect(await reader.readChapter("genesis", 1)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("converte exceção do repositório em unavailable sem repassar a mensagem", async () => {
    const leak = new Error("postgres://user:senha@db.interno:5432/app");
    const repo = repository({
      findTranslation: vi.fn().mockRejectedValue(leak),
    });
    const reader = createBibleReader(TRANSLATION, repo);
    for (const result of [
      await reader.listBooks(),
      await reader.listChapters("genesis"),
      await reader.readChapter("genesis", 1),
    ]) {
      expect(result).toEqual({ ok: false, reason: "unavailable" });
      expect(JSON.stringify(result)).not.toContain("senha");
      expect(JSON.stringify(result)).not.toContain("postgres");
    }
  });

  it("recusa tradução não aprovada e nem chega a consultar texto", async () => {
    const repo = repository({
      findTranslation: vi.fn().mockResolvedValue({ ...approvedTranslation, status: "pending" }),
    });
    const reader = createBibleReader(TRANSLATION, repo);
    expect(await reader.listBooks()).toEqual({ ok: false, reason: "translation_unavailable" });
    expect(await reader.readChapter("genesis", 1)).toEqual({
      ok: false,
      reason: "translation_unavailable",
    });
    expect(repo.listBooks).not.toHaveBeenCalled();
    expect(repo.listVerses).not.toHaveBeenCalled();
  });

  it("recusa tradução sem atribuição ou com linha fora do formato", async () => {
    for (const row of [
      { ...approvedTranslation, attribution: "   " },
      { ...approvedTranslation, id: "not-a-uuid" },
      { ...approvedTranslation, name: "" },
      null,
      undefined,
      "approved",
    ]) {
      const reader = createBibleReader(
        TRANSLATION,
        repository({ findTranslation: vi.fn().mockResolvedValue(row) }),
      );
      expect(await reader.listBooks()).toEqual({ ok: false, reason: "translation_unavailable" });
    }
  });
});

describe("leitura BLIVRE: livros e capítulos", () => {
  it("lista livros em ordem canônica, descartando outra tradução e duplicados", async () => {
    const repo = repository({
      listBooks: vi
        .fn()
        .mockResolvedValue([
          bookB,
          { ...bookA, translationId: OTHER_TRANSLATION, slug: "intruso" },
          bookA,
          { ...bookB, id: BOOK_A, slug: "duplicado" },
          { id: "x", translationId: TRANSLATION, code: "", slug: "", name: "", orderNo: 0 },
        ]),
    });
    const result = await createBibleReader(TRANSLATION, repo).listBooks();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.books.map((book) => book.slug)).toEqual(["genesis", "exodo"]);
    expect(result.translation).toEqual({
      id: TRANSLATION,
      name: "Bíblia Livre (BLIVRE)",
      attribution: "Atribuição obrigatória de teste.",
    });
    expect(repo.listBooks).toHaveBeenCalledWith(TRANSLATION);
  });

  it("responde not_found quando a tradução aprovada ainda não tem livros importados", async () => {
    const reader = createBibleReader(
      TRANSLATION,
      repository({ listBooks: vi.fn().mockResolvedValue([]) }),
    );
    expect(await reader.listBooks()).toEqual({ ok: false, reason: "not_found" });
  });

  it("normaliza a referência do livro e só aceita slug ou código simples", async () => {
    const repo = repository();
    const reader = createBibleReader(TRANSLATION, repo);
    expect((await reader.listChapters("  GENESIS  ")).ok).toBe(true);
    expect(repo.findBook).toHaveBeenCalledWith(TRANSLATION, "genesis");

    for (const reference of ["", "   ", "gen 1", "../etc", "gen;drop", "a".repeat(33), "gên"]) {
      expect(await reader.listChapters(reference)).toEqual({
        ok: false,
        reason: "invalid_reference",
      });
      expect(await reader.readChapter(reference, 1)).toEqual({
        ok: false,
        reason: "invalid_reference",
      });
    }
    expect(repo.findBook).toHaveBeenCalledTimes(1);
  });

  it("lista capítulos ordenados e descarta capítulo de outro livro", async () => {
    const repo = repository({
      listChapters: vi.fn().mockResolvedValue([
        { id: CHAPTER_2, bookId: BOOK_A, number: 2 },
        { id: CHAPTER_1, bookId: BOOK_B, number: 1 },
        { id: CHAPTER_1, bookId: BOOK_A, number: 1 },
      ]),
    });
    const result = await createBibleReader(TRANSLATION, repo).listChapters("genesis");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chapters).toEqual([
      { id: CHAPTER_1, number: 1 },
      { id: CHAPTER_2, number: 2 },
    ]);
    expect(result.book).toEqual({
      id: BOOK_A,
      code: "GEN",
      slug: "genesis",
      name: "Livro A",
      orderNo: 1,
    });
  });

  it("responde not_found para livro inexistente ou de outra tradução", async () => {
    for (const row of [null, { ...bookA, translationId: OTHER_TRANSLATION }]) {
      const reader = createBibleReader(
        TRANSLATION,
        repository({ findBook: vi.fn().mockResolvedValue(row) }),
      );
      expect(await reader.listChapters("genesis")).toEqual({ ok: false, reason: "not_found" });
      expect(await reader.readChapter("genesis", 1)).toEqual({ ok: false, reason: "not_found" });
    }
  });
});

describe("leitura BLIVRE: versículos publicados", () => {
  it("devolve somente versículos publicados do capítulo pedido, em ordem", async () => {
    const repo = repository({
      listVerses: vi.fn().mockResolvedValue([
        { id: VERSE("03"), chapterId: CHAPTER_1, number: 3, content: "Texto de teste 3", published: true },
        { id: VERSE("09"), chapterId: CHAPTER_1, number: 9, content: "Rascunho não publicado", published: false },
        { id: VERSE("01"), chapterId: CHAPTER_1, number: 1, content: "  Texto de teste 1  ", published: true },
        { id: VERSE("08"), chapterId: CHAPTER_2, number: 8, content: "Outro capítulo", published: true },
        { id: VERSE("07"), chapterId: CHAPTER_1, number: 7, content: "   ", published: true },
        { id: "sem-uuid", chapterId: CHAPTER_1, number: 4, content: "Linha inválida", published: true },
        { id: VERSE("01"), chapterId: CHAPTER_1, number: 1, content: "Duplicado", published: true },
      ]),
    });
    const result = await createBibleReader(TRANSLATION, repo).readChapter("genesis", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verses).toEqual([
      { id: VERSE("01"), number: 1, content: "Texto de teste 1" },
      { id: VERSE("03"), number: 3, content: "Texto de teste 3" },
    ]);
    expect(JSON.stringify(result)).not.toContain("Rascunho");
    expect(JSON.stringify(result)).not.toContain("Outro capítulo");
    expect(repo.listVerses).toHaveBeenCalledWith(CHAPTER_1);
  });

  it("não expõe campos internos no resultado", async () => {
    const result = await createBibleReader(TRANSLATION, repository()).readChapter("genesis", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result).sort()).toEqual(["book", "chapter", "ok", "translation", "verses"]);
    expect(Object.keys(result.verses[0]).sort()).toEqual(["content", "id", "number"]);
    expect(Object.keys(result.book)).not.toContain("translationId");
    expect(Object.keys(result.chapter).sort()).toEqual(["id", "number"]);
    expect(JSON.stringify(result)).not.toContain("published");
  });

  it("responde not_published quando o capítulo existe sem versículo liberado", async () => {
    for (const rows of [
      [],
      [{ id: VERSE("05"), chapterId: CHAPTER_1, number: 5, content: "Rascunho", published: false }],
      "nada",
    ]) {
      const reader = createBibleReader(
        TRANSLATION,
        repository({ listVerses: vi.fn().mockResolvedValue(rows) }),
      );
      expect(await reader.readChapter("genesis", 1)).toEqual({
        ok: false,
        reason: "not_published",
      });
    }
  });

  it("valida o número do capítulo e aceita número vindo da URL como texto", async () => {
    const repo = repository();
    const reader = createBibleReader(TRANSLATION, repo);
    expect((await reader.readChapter("genesis", "1")).ok).toBe(true);
    expect(repo.findChapter).toHaveBeenCalledWith(BOOK_A, 1);

    for (const value of [0, -1, 151, 1.5, "abc", "", Number.NaN]) {
      expect(await reader.readChapter("genesis", value)).toEqual({
        ok: false,
        reason: "invalid_reference",
      });
    }
    expect(repo.findChapter).toHaveBeenCalledTimes(1);
  });

  it("responde not_found para capítulo ausente ou de outro livro", async () => {
    for (const row of [null, { id: CHAPTER_1, bookId: BOOK_B, number: 1 }, { id: CHAPTER_1 }]) {
      const reader = createBibleReader(
        TRANSLATION,
        repository({ findChapter: vi.fn().mockResolvedValue(row) }),
      );
      expect(await reader.readChapter("genesis", 1)).toEqual({ ok: false, reason: "not_found" });
    }
  });
});
