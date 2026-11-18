import { describe, expect, it } from "vitest";
import {
  chapterMarksPayload,
  emptySnapshot,
  mergeMarks,
  scopesToUpload,
  type MarkSnapshot,
} from "../../src/domain/reading-sync";

const local: MarkSnapshot = {
  highlights: { "genesis.1.3": "amarelo", "genesis.1.5": "verde", "joao.1.1": "azul" },
  notes: { "genesis.1.3-5": "nota do navegador", "joao.1.1": "nota de joão" },
  readChapters: ["genesis.1", "salmos.23"],
};

const account: MarkSnapshot = {
  highlights: { "genesis.1.3": "rosa", "marcos.2.4": "verde" },
  notes: { "genesis.1.3-5": "nota da conta" },
  readChapters: ["marcos.2"],
};

describe("conciliação entre navegador e conta", () => {
  it("a conta vence no conflito da mesma chave", () => {
    const merged = mergeMarks(account, local);
    expect(merged.highlights["genesis.1.3"]).toBe("rosa");
    expect(merged.notes["genesis.1.3-5"]).toBe("nota da conta");
  });

  it("o que só existe no navegador sobe", () => {
    const merged = mergeMarks(account, local);
    expect(merged.highlights["genesis.1.5"]).toBe("verde");
    expect(merged.highlights["joao.1.1"]).toBe("azul");
    expect(merged.notes["joao.1.1"]).toBe("nota de joão");
  });

  it("capítulos lidos são união, sem repetição", () => {
    const merged = mergeMarks(account, local);
    expect([...merged.readChapters].sort()).toEqual(["genesis.1", "marcos.2", "salmos.23"]);
  });

  it("conciliar com conta vazia preserva tudo do navegador", () => {
    expect(mergeMarks(emptySnapshot, local).highlights).toEqual(local.highlights);
  });
});

describe("quais capítulos precisam subir", () => {
  it("aponta só os capítulos em que o navegador tem algo novo ou diferente", () => {
    // `genesis.1` entra por duas razões: o destaque 1.5 não existe na conta e a
    // cor de 1.3 diverge. `joao.1` entra por ser inteiramente novo. `marcos.2`
    // não entra: só a conta tem, e a conta é a fonte.
    expect(scopesToUpload(account, local, 25).sort()).toEqual(["genesis.1", "joao.1", "salmos.23"]);
  });

  it("não sobe nada quando os dois lados são idênticos", () => {
    expect(scopesToUpload(local, local, 25)).toEqual([]);
  });

  it("respeita o teto de capítulos por vez", () => {
    expect(scopesToUpload(account, local, 1)).toHaveLength(1);
    expect(scopesToUpload(account, local, 0)).toEqual([]);
  });

  it("ignora chave malformada em vez de inventar escopo", () => {
    const sujo: MarkSnapshot = {
      highlights: { "chave invalida": "amarelo", "": "verde" },
      notes: { "sem.ponto": "x" },
      readChapters: [],
    };
    expect(scopesToUpload(emptySnapshot, sujo, 25)).toEqual([]);
  });
});

describe("recorte do capítulo para gravação", () => {
  const marks: MarkSnapshot = {
    highlights: { "genesis.1.3": "amarelo", "genesis.1.5": "verde", "genesis.2.1": "azul" },
    notes: { "genesis.1.3-5": "nota", "genesis.2.1": "outra" },
    readChapters: ["genesis.1"],
  };

  it("leva só o capítulo pedido e tira o prefixo das chaves", () => {
    const payload = chapterMarksPayload("genesis.1", marks);
    expect(payload).toEqual({
      scope: "genesis.1",
      highlights: { "3": "amarelo", "5": "verde" },
      notes: { "3-5": "nota" },
      read: true,
    });
  });

  it("capítulo sem marca nenhuma vira carga vazia, que apaga o que havia", () => {
    expect(chapterMarksPayload("rute.4", marks)).toEqual({
      scope: "rute.4",
      highlights: {},
      notes: {},
      read: false,
    });
  });

  it("não trata chave de intervalo como destaque", () => {
    // Destaque é sempre de um versículo. Uma chave com intervalo na coleção de
    // destaques é dado corrompido, e entrar como destaque de "3" seria pior do
    // que sumir: mudaria o que a pessoa marcou.
    const corrompido: MarkSnapshot = {
      highlights: { "genesis.1.3-5": "amarelo" },
      notes: {},
      readChapters: [],
    };
    expect(chapterMarksPayload("genesis.1", corrompido).highlights).toEqual({});
  });
});
