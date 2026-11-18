import { describe, expect, it } from "vitest";
import {
  READER_SESSION_KEY,
  READING_POINTER_KEY,
  chapterLabelFromTitle,
  emptySnapshot,
  parseChapterScope,
  parseLocalReadingSnapshot,
  parseReaderPath,
  parseReadingPointer,
} from "../../src/domain/reading-session";

describe("chaves de armazenamento", () => {
  it("usa a mesma chave do leitor e uma chave própria para o ponteiro", () => {
    expect(READER_SESSION_KEY).toBe("reader-session-v3");
    expect(READING_POINTER_KEY).toBe("reader-last-chapter-v1");
  });
});

describe("escopo de capítulo", () => {
  it("aceita escopo válido e monta o caminho do leitor", () => {
    expect(parseChapterScope("genesis.1")).toEqual({
      book: "genesis",
      chapter: 1,
      scope: "genesis.1",
      path: "/biblia/genesis/1",
    });
    expect(parseChapterScope("1-reis.22")?.path).toBe("/biblia/1-reis/22");
  });

  it("recusa escopo inválido em vez de adivinhar", () => {
    for (const invalid of [
      "genesis",
      "genesis.0",
      "genesis.1.5",
      "Genesis.1",
      "genesis.-1",
      "genesis.1000",
      "",
      null,
      42,
      { scope: "genesis.1" },
    ]) {
      expect(parseChapterScope(invalid)).toBeNull();
    }
  });
});

describe("rota do leitor", () => {
  it("lê livro e capítulo da rota do capítulo", () => {
    expect(parseReaderPath("/biblia/joao/3")).toEqual({
      book: "joao",
      chapter: 3,
      scope: "joao.3",
      path: "/biblia/joao/3",
    });
    expect(parseReaderPath("/biblia/joao/3?x=1")?.chapter).toBe(3);
  });

  it("não trata /biblia nem rota de outra área como capítulo", () => {
    for (const path of [
      "/biblia",
      "/biblia/joao",
      "/biblia/joao/3/4",
      "/inicio",
      "/materiais",
      "/biblia/joao/abc",
      "/biblia/joao/0",
      "",
      null,
    ]) {
      expect(parseReaderPath(path)).toBeNull();
    }
  });
});

describe("rótulo vindo do título da página", () => {
  it("usa o nome real do livro que o servidor colocou no título", () => {
    expect(
      chapterLabelFromTitle("Gênesis 1 · Bíblia Livre (BLIVRE) | Bíblia Bereana", 1),
    ).toBe("Gênesis 1");
    expect(chapterLabelFromTitle("João 3 · Bíblia Livre (BLIVRE) | Bíblia Bereana", 3)).toBe(
      "João 3",
    );
  });

  it("não se perde com livro numerado", () => {
    expect(chapterLabelFromTitle("1 Reis 1 · Bíblia Livre (BLIVRE) | Bíblia Bereana", 1)).toBe(
      "1 Reis 1",
    );
    expect(chapterLabelFromTitle("2 Coríntios 13 · Bíblia Livre | Bíblia Bereana", 13)).toBe(
      "2 Coríntios 13",
    );
  });

  it("funciona mesmo com separador ilegível no título", () => {
    expect(chapterLabelFromTitle("Gênesis 1 � Bíblia Livre | Bíblia Bereana", 1)).toBe(
      "Gênesis 1",
    );
  });

  it("recusa o rótulo quando o título não confere com o capítulo da rota", () => {
    expect(chapterLabelFromTitle("Gênesis 1 · Bíblia Livre | Bíblia Bereana", 2)).toBeNull();
    expect(chapterLabelFromTitle("Leitura indisponível | Bíblia Bereana", 1)).toBeNull();
    expect(chapterLabelFromTitle("Início | Bíblia Bereana", 1)).toBeNull();
    expect(chapterLabelFromTitle("", 1)).toBeNull();
    expect(chapterLabelFromTitle(null, 1)).toBeNull();
    expect(chapterLabelFromTitle("Gênesis 1", 0)).toBeNull();
  });

  it("recusa rótulo longo demais para ser uma referência", () => {
    expect(
      chapterLabelFromTitle("uma frase bem comprida que não é referência 1 | x", 1),
    ).toBeNull();
  });
});

describe("ponteiro de última leitura", () => {
  it("lê livro, capítulo, rótulo e instante", () => {
    const pointer = parseReadingPointer(
      JSON.stringify({ book: "genesis", chapter: 2, label: "Gênesis 2", at: "2026-11-17T19:00:00.000Z" }),
    );
    expect(pointer).toEqual({
      book: "genesis",
      chapter: 2,
      scope: "genesis.2",
      path: "/biblia/genesis/2",
      label: "Gênesis 2",
      at: "2026-11-17T19:00:00.000Z",
    });
  });

  it("mantém o capítulo quando só o rótulo ou o instante é inválido", () => {
    const pointer = parseReadingPointer(
      JSON.stringify({ book: "joao", chapter: 3, label: "   ", at: "ontem" }),
    );
    expect(pointer?.path).toBe("/biblia/joao/3");
    expect(pointer?.label).toBeNull();
    expect(pointer?.at).toBeNull();
  });

  it("descarta ponteiro corrompido, vazio ou de rota impossível", () => {
    for (const raw of [
      null,
      "",
      "{",
      "[]",
      "null",
      JSON.stringify({ book: "genesis" }),
      JSON.stringify({ book: "genesis", chapter: "2" }),
      JSON.stringify({ book: "genesis", chapter: 0 }),
      JSON.stringify({ book: "genesis", chapter: 2.5 }),
      JSON.stringify({ book: "Genesis", chapter: 2 }),
      JSON.stringify({ book: "../etc", chapter: 2 }),
    ]) {
      expect(parseReadingPointer(raw)).toBeNull();
    }
  });
});

describe("retrato do registro local", () => {
  const session = JSON.stringify({
    preferences: { fontFamily: "serif", fontSize: "medio", spacing: "padrao" },
    highlights: { "genesis.1.3": "amarelo", "genesis.1.5": "verde", "lixo": "azul" },
    notes: { "genesis.1.3,5": "pergunta", "joao.3.16": "   ", "genesis.1": "escopo não é nota" },
    readChapters: ["genesis.1", "joao.3", "genesis.1", "invalido", "genesis.0"],
  });

  it("conta somente chave e valor válidos", () => {
    const snapshot = parseLocalReadingSnapshot({ session, pointer: null });
    expect(snapshot.highlightCount).toBe(2);
    expect(snapshot.noteCount).toBe(1);
    expect(snapshot.completedCount).toBe(2);
    expect(snapshot.completed.map((chapter) => chapter.scope)).toEqual(["genesis.1", "joao.3"]);
    expect(snapshot.hasLocalData).toBe(true);
    expect(snapshot.resume).toBeNull();
  });

  it("não inventa nada quando não há registro", () => {
    expect(parseLocalReadingSnapshot({ session: null, pointer: null })).toEqual(emptySnapshot);
    expect(parseLocalReadingSnapshot({ session: "{", pointer: "{" })).toEqual(emptySnapshot);
    expect(parseLocalReadingSnapshot({ session: "{}", pointer: null }).hasLocalData).toBe(false);
  });

  it("junta o ponteiro ao registro do leitor", () => {
    const snapshot = parseLocalReadingSnapshot({
      session,
      pointer: JSON.stringify({ book: "joao", chapter: 3, label: "João 3", at: new Date(0).toISOString() }),
    });
    expect(snapshot.resume?.path).toBe("/biblia/joao/3");
    expect(snapshot.resume?.label).toBe("João 3");
  });

  it("considera o ponteiro sozinho como registro local", () => {
    const snapshot = parseLocalReadingSnapshot({
      session: null,
      pointer: JSON.stringify({ book: "genesis", chapter: 1 }),
    });
    expect(snapshot.hasLocalData).toBe(true);
    expect(snapshot.completedCount).toBe(0);
  });
});
