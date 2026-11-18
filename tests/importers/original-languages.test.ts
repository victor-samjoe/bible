import { describe, expect, it } from "vitest";
import {
  countTokens,
  normalizeGreekToken,
  parseSblgntBook,
  tokenizeGreekVerse,
} from "../../src/importers/original/sblgnt";
import {
  countHebrewMorphemes,
  countHebrewTokens,
  parseMorphhbBook,
} from "../../src/importers/original/morphhb";

// Fixtures sintéticas no formato das fontes oficiais. Nenhum texto bíblico real é
// reproduzido nos testes: as palavras são inventadas de propósito, para que o teste
// verifique o parser e não o conteúdo do corpus.
const SBLGNT_FIXTURE = [
  "ΚΑΤΑ ΤΕΣΤΕ",
  "Te 1:1\tαλφα βητα, γαμμα·",
  "Te 1:2\tδελτα ⟦επσιλον⟧ ζητα.",
  "Te 2:1\tητα θητα",
].join("\n");

const MORPHHB_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<osis><osisText><div><chapter osisID="Te.1">
  <verse osisID="Te.1.1">
    <w lemma="b/7225" n="1.0" morph="HR/Ncfsa" id="01xeN">aa/bb</w>
    <w lemma="1254 a" morph="HVqp3ms" id="01Nvk">cc</w><seg type="x-sof-pasuq">:</seg>
  </verse>
  <verse osisID="Te.1.2">
    <w lemma="c/d/776" morph="HC/Td/Ncbsa" id="01LN3">dd/ee/ff</w>
  </verse>
</chapter></div></osisText></osis>`;

describe("SBLGNT: parser do texto grego", () => {
  it("lê título, referências e tokens", () => {
    const { book, issues } = parseSblgntBook(SBLGNT_FIXTURE, "Te");
    expect(issues).toEqual([]);
    expect(book.title).toBe("ΚΑΤΑ ΤΕΣΤΕ");
    expect(book.verses.map((verse) => verse.canonicalRef)).toEqual([
      "Te 1:1",
      "Te 1:2",
      "Te 2:1",
    ]);
    expect(book.verses[0]?.tokens.map((token) => token.normalized)).toEqual([
      "αλφα",
      "βητα",
      "γαμμα",
    ]);
    expect(countTokens(book)).toBe(8);
  });

  it("normaliza apenas as bordas, sem tocar no interior da palavra", () => {
    expect(normalizeGreekToken("γαμμα·")).toBe("γαμμα");
    expect(normalizeGreekToken("⟦επσιλον⟧")).toBe("επσιλον");
    expect(normalizeGreekToken("βητα,")).toBe("βητα");
    // Apóstrofo interno (elisão) é parte da palavra e permanece.
    expect(normalizeGreekToken("δι’")).toBe("δι");
    expect(tokenizeGreekVerse("  alfa   beta  ").map((t) => t.position)).toEqual([1, 2]);
  });

  it("relata divergência de sigla, referência repetida e linha inválida sem adivinhar", () => {
    const result = parseSblgntBook(
      ["Te 1:1\talfa", "Xx 1:2\tbeta", "Te 1:1\tgama", "linha solta\tcom tab"].join("\n"),
      "Te",
    );
    expect(result.book.verses).toHaveLength(1);
    expect(result.issues.map((issue) => issue.reason)).toEqual([
      "sigla Xx diverge do livro Te",
      "referência repetida",
      "formato não reconhecido",
    ]);
  });

  it("ordena por capítulo e versículo e é idempotente", () => {
    const shuffled = ["Te 2:1\tz", "Te 1:2\ty", "Te 1:1\tx"].join("\n");
    const first = parseSblgntBook(shuffled, "Te");
    const second = parseSblgntBook(shuffled, "Te");
    expect(first.book.verses.map((verse) => verse.canonicalRef)).toEqual([
      "Te 1:1",
      "Te 1:2",
      "Te 2:1",
    ]);
    expect(second).toEqual(first);
  });

  it("não produz lema nem morfologia: o texto grego é somente texto", () => {
    const { book } = parseSblgntBook(SBLGNT_FIXTURE, "Te");
    const token = book.verses[0]?.tokens[0];
    expect(Object.keys(token ?? {}).sort()).toEqual(["normalized", "position", "surface"]);
    expect(JSON.stringify(book)).not.toMatch(/lemma|morph|gloss/i);
  });
});

describe("MorphHB: parser de texto, lema e morfologia hebraicos", () => {
  it("separa morfemas como a fonte publica, sem concatenar nem inventar", () => {
    const result = parseMorphhbBook(MORPHHB_FIXTURE, "Te");
    expect(result.issues).toEqual([]);
    expect(result.verses).toHaveLength(2);

    const first = result.verses[0];
    expect(first?.canonicalRef).toBe("Te 1:1");
    expect(first?.tokens).toHaveLength(2);
    expect(first?.tokens[0]?.morphemes).toEqual([
      { position: 1, surface: "aa", lemma: "b", morphologyCode: "R" },
      { position: 2, surface: "bb", lemma: "7225", morphologyCode: "Ncfsa" },
    ]);
    // Lema com sufixo de homógrafo é preservado como publicado.
    expect(first?.tokens[1]?.morphemes[0]?.lemma).toBe("1254 a");
    expect(result.verses[1]?.tokens[0]?.morphemes).toHaveLength(3);
    expect(countHebrewTokens(result)).toBe(3);
    expect(countHebrewMorphemes(result)).toBe(6);
  });

  it("guarda o identificador estável da fonte e o texto contínuo", () => {
    const result = parseMorphhbBook(MORPHHB_FIXTURE, "Te");
    expect(result.verses[0]?.tokens[0]?.sourceTokenId).toBe("01xeN");
    expect(result.verses[0]?.tokens[0]?.normalized).toBe("aabb");
    expect(result.verses[0]?.text).toBe("aabb cc");
    // Pontuação em <seg> não vira palavra.
    expect(result.verses[0]?.tokens.map((token) => token.normalized)).not.toContain(":");
  });

  it("não produz glossa nem definição lexical", () => {
    const result = parseMorphhbBook(MORPHHB_FIXTURE, "Te");
    expect(JSON.stringify(result)).not.toMatch(/gloss|definition|translation|significa/i);
    const morpheme = result.verses[0]?.tokens[0]?.morphemes[0];
    expect(Object.keys(morpheme ?? {}).sort()).toEqual([
      "lemma",
      "morphologyCode",
      "position",
      "surface",
    ]);
  });

  it("relata osisID inválido, repetido e versículo sem palavra", () => {
    const broken = `<osis>
      <verse osisID="Te.1">
        <w lemma="1" morph="H" id="a">aa</w>
      </verse>
      <verse osisID="Te.2.1">
        <w lemma="1" morph="H" id="b">bb</w>
      </verse>
      <verse osisID="Te.2.1">
        <w lemma="1" morph="H" id="c">cc</w>
      </verse>
      <verse osisID="Te.3.1"><seg type="x-sof-pasuq">:</seg></verse>
    </osis>`;
    const result = parseMorphhbBook(broken, "Te");
    expect(result.verses.map((verse) => verse.canonicalRef)).toEqual(["Te 2:1"]);
    expect(result.issues.map((issue) => issue.reason)).toEqual([
      "osisID fora do formato Livro.Capítulo.Versículo",
      "versículo repetido",
      "versículo sem palavras",
    ]);
  });

  it("recusa versículo cujo livro diverge do arquivo, em vez de reetiquetar", () => {
    const foreign = `<osis>
      <verse osisID="Te.1.1"><w lemma="1" morph="H" id="a">aa</w></verse>
      <verse osisID="Outro.1.1"><w lemma="1" morph="H" id="b">bb</w></verse>
    </osis>`;
    const result = parseMorphhbBook(foreign, "Te");
    expect(result.verses.map((verse) => verse.canonicalRef)).toEqual(["Te 1:1"]);
    expect(result.issues).toEqual([
      { osisId: "Outro.1.1", reason: "livro Outro diverge do arquivo Te" },
    ]);
  });

  it("é idempotente e ordena por capítulo e versículo", () => {
    const shuffled = `<osis>
      <verse osisID="Te.2.1"><w lemma="1" morph="H" id="a">bb</w></verse>
      <verse osisID="Te.1.1"><w lemma="1" morph="H" id="b">aa</w></verse>
    </osis>`;
    const first = parseMorphhbBook(shuffled, "Te");
    expect(first.verses.map((verse) => verse.canonicalRef)).toEqual(["Te 1:1", "Te 2:1"]);
    expect(parseMorphhbBook(shuffled, "Te")).toEqual(first);
  });
});
