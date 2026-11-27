import { describe, expect, it } from "vitest";

import { parseRef } from "../../src/domain/word-study/reference";
import {
  VersificationError,
  WORD_STUDY_VERSIFICATION,
  assertVersificationMapIsCoherent,
  divergenceWarning,
  readerRefForSource,
  sourceRefForReader,
} from "../../src/domain/word-study/versification";
import { sourceVerseForOriginal } from "../../src/domain/original-versification";

function ref(raw: string) {
  const parsed = parseRef(raw);
  if ("problem" in parsed) throw new Error(parsed.problem.reason);
  return parsed.ref;
}

describe("mapa de versificação", () => {
  it("é coerente e se declara não exaustivo", () => {
    expect(() => assertVersificationMapIsCoherent(WORD_STUDY_VERSIFICATION)).not.toThrow();
    // Uma regra conferida e seis divergências sem regra não é tabela completa.
    expect(WORD_STUDY_VERSIFICATION.exhaustive).toBe(false);
    expect(WORD_STUDY_VERSIFICATION.rules).toHaveLength(1);
    expect(WORD_STUDY_VERSIFICATION.declaredDivergences.length).toBeGreaterThan(0);
  });

  it("toda regra tem procedência declarada", () => {
    for (const rule of WORD_STUDY_VERSIFICATION.rules) {
      expect(rule.provenance.trim().length).toBeGreaterThan(0);
    }
  });

  it("recusa regra sem procedência", () => {
    expect(() =>
      assertVersificationMapIsCoherent({
        version: "teste",
        exhaustive: false,
        declaredDivergences: [],
        rules: [
          {
            book: "MIC",
            readerChapter: 5,
            from: "reader-pt-br",
            to: "wlc-morphhb",
            shifts: [{ readerVerseFrom: 1, readerVerseTo: null, sourceChapter: null, verseOffset: 0 }],
            describe: "x",
            provenance: "   ",
          },
        ],
      }),
    ).toThrow(VersificationError);
  });

  it("recusa faixa invertida e regra duplicada", () => {
    const base = {
      book: "MIC",
      readerChapter: 5,
      from: "reader-pt-br" as const,
      to: "wlc-morphhb" as const,
      describe: "x",
      provenance: "y",
    };
    expect(() =>
      assertVersificationMapIsCoherent({
        version: "t",
        exhaustive: false,
        declaredDivergences: [],
        rules: [
          { ...base, shifts: [{ readerVerseFrom: 5, readerVerseTo: 2, sourceChapter: null, verseOffset: 0 }] },
        ],
      }),
    ).toThrow(VersificationError);
    expect(() =>
      assertVersificationMapIsCoherent({
        version: "t",
        exhaustive: false,
        declaredDivergences: [],
        rules: [
          { ...base, shifts: [{ readerVerseFrom: 1, readerVerseTo: null, sourceChapter: null, verseOffset: 0 }] },
          { ...base, shifts: [{ readerVerseFrom: 1, readerVerseTo: null, sourceChapter: null, verseOffset: 0 }] },
        ],
      }),
    ).toThrow(VersificationError);
  });
});

describe("mapa de versificação — Miqueias 5", () => {
  it("reproduz exatamente o módulo que já existia no repositório", () => {
    // A regra não introduz afirmação nova: só dá versão e procedência ao que
    // `original-versification.ts` já fazia. Se divergirem, uma das duas está
    // errada, e este teste é que avisa.
    for (let verse = 1; verse <= 15; verse += 1) {
      const antigo = sourceVerseForOriginal("miqueias", 5, verse);
      const novo = sourceRefForReader(WORD_STUDY_VERSIFICATION, "MIC", 5, verse);
      expect({ chapter: novo.chapter, verse: novo.verse }).toEqual(antigo);
      expect(novo.state).toBe("mapped");
    }
  });

  it("mapeia 5:1 do leitor para 4:14 da fonte", () => {
    const mapped = sourceRefForReader(WORD_STUDY_VERSIFICATION, "MIC", 5, 1);
    expect(mapped).toEqual({ chapter: 4, verse: 14, state: "mapped" });
  });

  it("inverte a regra: 4:14 da fonte volta como 5:1 do leitor", () => {
    const back = readerRefForSource(WORD_STUDY_VERSIFICATION, ref("MIC 4:14"));
    expect(back.reader).toEqual({ chapter: 5, verse: 1 });
    expect(back.state).toBe("mapped");
  });

  it("ida e volta é identidade em todo o capítulo mapeado", () => {
    for (let verse = 1; verse <= 15; verse += 1) {
      const forward = sourceRefForReader(WORD_STUDY_VERSIFICATION, "MIC", 5, verse);
      const back = readerRefForSource(
        WORD_STUDY_VERSIFICATION,
        ref(`MIC ${forward.chapter}:${forward.verse}`),
      );
      expect(back.reader).toEqual({ chapter: 5, verse });
    }
  });
});

describe("mapa de versificação — divergência declarada sem regra", () => {
  it("devolve 'unverified' em vez de supor coincidência", () => {
    // Salmos tem divergência declarada e nenhuma regra: o resultado não desloca
    // nada e o estado obriga o chamador a avisar.
    const psalm = sourceRefForReader(WORD_STUDY_VERSIFICATION, "PSA", 3, 1);
    expect(psalm).toEqual({ chapter: 3, verse: 1, state: "unverified" });
    expect(readerRefForSource(WORD_STUDY_VERSIFICATION, ref("PSA 3:1")).state).toBe("unverified");
  });

  it("produz aviso legível para o livro com divergência", () => {
    const warning = divergenceWarning(WORD_STUDY_VERSIFICATION, "PSA");
    expect(warning).toContain("não conferida");
    expect(warning).toContain("sem deslocamento");
  });

  it("não produz aviso para livro sem divergência declarada", () => {
    expect(divergenceWarning(WORD_STUDY_VERSIFICATION, "GEN")).toBe(null);
  });

  it("'identical' é afirmação positiva: nem regra nem divergência declarada", () => {
    expect(sourceRefForReader(WORD_STUDY_VERSIFICATION, "GEN", 1, 1)).toEqual({
      chapter: 1,
      verse: 1,
      state: "identical",
    });
    expect(readerRefForSource(WORD_STUDY_VERSIFICATION, ref("JHN 1:1")).state).toBe("identical");
  });
});
