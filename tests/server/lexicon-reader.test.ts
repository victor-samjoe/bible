import { describe, expect, it, vi } from "vitest";
import { createLexiconReader } from "../../src/server/lexicon/reader";
import type { LexiconRepository } from "../../src/server/lexicon/repository";

const EMPTY = {
  // O leitor consulta tradução, acepções e fontes à parte do shard; um falso
  // sem elas prova que o painel ainda funciona quando só há estrutura.
  listTranslations: vi.fn().mockResolvedValue(new Map()),
  listBdbEntries: vi.fn().mockResolvedValue(new Map()),
  listSources: vi.fn().mockResolvedValue(new Map()),
};

function repository(): LexiconRepository {
  return {
    ...EMPTY,
    listOccurrences: vi.fn().mockResolvedValue([
      {
        sourceWordId: "o1",
        language: "hbo",
        canonicalRef: "GEN 1:2",
        wordPosition: 1,
        surface: "וְ",
        lexemeKey: "hbo:H2050b",
        lemma: "וְ",
        morphology: "C",
        partOfSpeech: "conj",
        semanticDomain: null,
        gloss: "and",
        entryTransliteration: null,
        entryStrongId: null,
        translation: null,
        bdb: [],
      },
      {
        sourceWordId: "o2",
        language: "hbo",
        canonicalRef: "GEN 1:2",
        wordPosition: 1,
        surface: "הָיְתָה",
        lexemeKey: "hbo:H1961",
        lemma: "היה",
        morphology: "V",
        partOfSpeech: "verb",
        semanticDomain: "013",
        gloss: "was",
        entryTransliteration: "hāyâ",
        entryStrongId: "H1961",
        translation: null,
        bdb: [],
      },
    ]),
  };
}

describe("leitor do índice lexical", () => {
  it("agrupa morfemas por palavra e mantém a glossa da fonte quando ainda não há tradução editorial", async () => {
    const result = await createLexiconReader(repository(), { previewDrafts: false }).read({
      book: "genesis",
      chapter: 1,
      verses: [2],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verses).toHaveLength(1);
    expect(result.verses[0]?.words).toHaveLength(1);
    expect(result.verses[0]?.words[0]).toMatchObject({
      position: 1,
      meaning: "and was",
      meaningSource: "source_gloss",
      morphemes: [
        { surface: "וְ", meaning: "and", strongId: null },
        { surface: "הָיְתָה", meaning: "was", strongId: "H1961", semanticDomain: "013" },
      ],
    });
  });

  it("não expõe a infraestrutura quando a consulta falha", async () => {
    const broken: LexiconRepository = { ...EMPTY, listOccurrences: vi.fn().mockRejectedValue(new Error("connection secret")) };
    expect(await createLexiconReader(broken, { previewDrafts: false }).read({
      book: "genesis", chapter: 1, verses: [1],
    })).toEqual({ ok: false, reason: "unavailable" });
  });
});
