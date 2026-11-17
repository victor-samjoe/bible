import { describe, expect, it, vi } from "vitest";
import { createBibleSearch } from "../../src/server/bible/search";
import { BLIVRE_TRANSLATION_ID } from "../../src/server/bible/blivre";
import {
  escapeLikeTerm,
  parseReference,
  projectHits,
  searchTerms,
  type BibleSearchRepository,
} from "../../src/server/contracts/bible-search";
import type { BibleBook } from "../../src/server/contracts/bible";

// Fixtures sintéticas: nenhum versículo real é usado nos testes.
const TRANSLATION = BLIVRE_TRANSLATION_ID;
const book = (slug: string, name: string, code: string, orderNo: number): BibleBook => ({
  id: `${String(orderNo).padStart(8, "1")}-1111-4111-8111-111111111111`,
  slug,
  name,
  code,
  orderNo,
});

const genesis = book("genesis", "Gênesis", "GEN", 1);
const joao = book("joao", "João", "JHN", 43);
const jonas = book("jonas", "Jonas", "JON", 32);
const coríntios = book("1-corintios", "1 Coríntios", "1CO", 46);
const bookList = [joao, genesis, coríntios, jonas];

const approvedTranslation = {
  id: TRANSLATION,
  name: "Bíblia Livre (BLIVRE)",
  status: "approved",
  attribution: "Atribuição de teste.",
};

const hitRow = (overrides: Record<string, unknown> = {}) => ({
  bookSlug: "genesis",
  bookName: "Gênesis",
  bookOrder: 1,
  chapter: 1,
  verse: 1,
  content: "Texto sintético de teste.",
  published: true,
  ...overrides,
});

function repository(overrides: Partial<BibleSearchRepository> = {}): BibleSearchRepository {
  return {
    findTranslation: vi.fn().mockResolvedValue(approvedTranslation),
    listBooks: vi.fn().mockResolvedValue(
      bookList.map((item) => ({ ...item, translationId: TRANSLATION })),
    ),
    searchVerses: vi.fn().mockResolvedValue([hitRow()]),
    countVerses: vi.fn().mockResolvedValue(1),
    findVerseByReference: vi.fn().mockResolvedValue([hitRow({ chapter: 3, verse: 16 })]),
    ...overrides,
  };
}

const subject = (overrides: Partial<BibleSearchRepository> = {}) =>
  createBibleSearch(TRANSLATION, repository(overrides));

describe("busca: termos e curingas", () => {
  it("separa termos, descarta os curtos, remove repetidos e limita a quantidade", () => {
    expect(searchTerms("  no princípio  criou ")).toEqual(["no", "princípio", "criou"]);
    expect(searchTerms("a e o")).toEqual([]);
    expect(searchTerms("luz luz luz")).toEqual(["luz"]);
    expect(searchTerms("um dois tres quatro cinco seis sete oito")).toHaveLength(6);
    expect(searchTerms("(princípio),")).toEqual(["princípio"]);
  });

  it("escapa curinga de LIKE para que % procure o caractere, não qualquer coisa", () => {
    expect(escapeLikeTerm("100%")).toBe("100\\%");
    expect(escapeLikeTerm("a_b")).toBe("a\\_b");
    expect(escapeLikeTerm("c\\d")).toBe("c\\\\d");
    expect(escapeLikeTerm("luz")).toBe("luz");
  });

  it("manda o padrão escapado ao repositório e apara pontuação nas bordas", async () => {
    const repo = repository();
    // `lu%z` mantém o curinga no meio do termo, e ele vai escapado ao banco;
    // em `100%` o `%` final é pontuação de borda e sai junto com ela.
    await createBibleSearch(TRANSLATION, repo).search({ q: "lu%z 100% luz" });
    expect(vi.mocked(repo.searchVerses).mock.calls[0]?.[0].patterns).toEqual([
      "%lu\\%z%",
      "%100%",
      "%luz%",
    ]);
  });
});

describe("busca: referência canônica", () => {
  it("resolve nome, slug e código, com e sem versículo", () => {
    expect(parseReference("João 3:16", bookList)).toEqual({ book: joao, chapter: 3, verse: 16 });
    expect(parseReference("joao 3", bookList)).toEqual({ book: joao, chapter: 3, verse: null });
    expect(parseReference("JHN 3.16", bookList)).toEqual({ book: joao, chapter: 3, verse: 16 });
    expect(parseReference("genesis 1 1", bookList)).toEqual({
      book: genesis,
      chapter: 1,
      verse: 1,
    });
    expect(parseReference("1 Coríntios 13:4", bookList)).toEqual({
      book: coríntios,
      chapter: 13,
      verse: 4,
    });
  });

  it("não adivinha livro ambíguo nem inventa livro ausente", () => {
    // "jo" serve para João e Jonas: prefixo ambíguo não resolve.
    expect(parseReference("jo 3", bookList)).toBeNull();
    expect(parseReference("Enoque 1", bookList)).toBeNull();
    expect(parseReference("João", bookList)).toBeNull();
    expect(parseReference("3:16", bookList)).toBeNull();
    expect(parseReference("João 0", bookList)).toBeNull();
    expect(parseReference("João 151", bookList)).toBeNull();
    expect(parseReference("João 3:999", bookList)).toBeNull();
    expect(parseReference("João 3:16", [])).toBeNull();
  });

  it("referência tem precedência sobre busca textual", async () => {
    const repo = repository();
    const result = await createBibleSearch(TRANSLATION, repo).search({ q: "João 3:16" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe("reference");
    expect(result.hits[0]?.reference).toBe("Gênesis 3:16");
    expect(repo.findVerseByReference).toHaveBeenCalledWith({
      translationId: TRANSLATION,
      bookSlug: "joao",
      chapter: 3,
      verse: 16,
      limit: 20,
    });
    expect(repo.searchVerses).not.toHaveBeenCalled();
  });

  it("com filtro de livro, a consulta é sempre textual", async () => {
    const repo = repository();
    await createBibleSearch(TRANSLATION, repo).search({ q: "João 3:16", book: "genesis" });
    expect(repo.findVerseByReference).not.toHaveBeenCalled();
    expect(vi.mocked(repo.searchVerses).mock.calls[0]?.[0].bookSlug).toBe("genesis");
  });
});

describe("busca: limites, paginação e ordenação", () => {
  it("aplica limite e deslocamento padrão", async () => {
    const repo = repository();
    const result = await createBibleSearch(TRANSLATION, repo).search({ q: "luz" });
    expect(result.ok && result.limit).toBe(20);
    expect(result.ok && result.offset).toBe(0);
    expect(vi.mocked(repo.searchVerses).mock.calls[0]?.[0]).toMatchObject({ limit: 20, offset: 0 });
  });

  it("recusa consulta vazia, limite e deslocamento fora da faixa e campo desconhecido", async () => {
    const repo = repository();
    const service = createBibleSearch(TRANSLATION, repo);
    const invalid = [
      { q: "" },
      { q: "   " },
      { q: "a".repeat(121) },
      { q: "luz", limit: 0 },
      { q: "luz", limit: 51 },
      { q: "luz", offset: -1 },
      { q: "luz", offset: 1001 },
      { q: "luz", book: "GEN/1" },
      { q: "luz", extra: "x" },
      { q: "a e" },
    ];
    for (const input of invalid) {
      expect(await service.search(input as never)).toEqual({ ok: false, reason: "invalid_query" });
    }
    expect(repo.searchVerses).not.toHaveBeenCalled();
  });

  it("informa total e truncamento a partir da contagem do banco", async () => {
    const repo = repository({
      searchVerses: vi.fn().mockResolvedValue([hitRow(), hitRow({ verse: 2 })]),
      countVerses: vi.fn().mockResolvedValue(57),
    });
    const result = await createBibleSearch(TRANSLATION, repo).search({ q: "luz", limit: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.total).toBe(57);
    expect(result.truncated).toBe(true);
    expect(result.hits).toHaveLength(2);
  });

  it("ordena por livro, capítulo e versículo, independente da ordem recebida", () => {
    const hits = projectHits([
      hitRow({ bookSlug: "joao", bookName: "João", bookOrder: 43, chapter: 3, verse: 16 }),
      hitRow({ chapter: 2, verse: 1 }),
      hitRow({ chapter: 1, verse: 3 }),
      hitRow({ chapter: 1, verse: 1 }),
    ]);
    expect(hits.map((hit) => hit.reference)).toEqual([
      "Gênesis 1:1",
      "Gênesis 1:3",
      "Gênesis 2:1",
      "João 3:16",
    ]);
  });

  it("descarta não publicado, duplicado e linha fora do formato", () => {
    const hits = projectHits([
      hitRow(),
      hitRow({ published: false, verse: 9 }),
      hitRow(),
      hitRow({ content: "   ", verse: 7 }),
      hitRow({ bookOrder: 0, verse: 8 }),
      hitRow({ chapter: 0, verse: 11 }),
      "linha inválida",
      null,
    ]);
    expect(hits).toHaveLength(1);
    expect(JSON.stringify(hits)).not.toContain("published");
  });
});

describe("busca: falha fechada", () => {
  it("responde unavailable sem repositório e sem vazar mensagem de banco", async () => {
    const withoutRepository = createBibleSearch(TRANSLATION, null);
    expect(withoutRepository.available).toBe(false);
    expect(await withoutRepository.search({ q: "luz" })).toEqual({
      ok: false,
      reason: "unavailable",
    });

    const leaking = subject({
      searchVerses: vi.fn().mockRejectedValue(new Error("postgres://user:senha@db.interno/app")),
    });
    const result = await leaking.search({ q: "luz" });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("senha");
  });

  it("não busca em tradução não aprovada nem sem atribuição", async () => {
    for (const row of [
      { ...approvedTranslation, status: "pending" },
      { ...approvedTranslation, attribution: "  " },
      null,
    ]) {
      const repo = repository({ findTranslation: vi.fn().mockResolvedValue(row) });
      expect(await createBibleSearch(TRANSLATION, repo).search({ q: "luz" })).toEqual({
        ok: false,
        reason: "translation_unavailable",
      });
      expect(repo.searchVerses).not.toHaveBeenCalled();
    }
  });

  it("usa sempre o id de tradução recebido na construção", async () => {
    const repo = repository();
    await createBibleSearch(TRANSLATION, repo).search({ q: "luz" });
    expect(repo.findTranslation).toHaveBeenCalledWith(TRANSLATION);
    expect(vi.mocked(repo.searchVerses).mock.calls[0]?.[0].translationId).toBe(TRANSLATION);
  });
});
