import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LexiconRegistryError,
  lexiconSourceById,
  type LexiconSource,
} from "../../src/domain/lexicon/source-registry";
import {
  countSenses,
  senseDepth,
  strongLexemeKey,
  type BdbSense,
} from "../../src/domain/lexicon/records";
import { parseBrownDriverBriggsXml } from "../../src/importers/lexicon/oshb-bdb";
import { parseLexicalIndexXml } from "../../src/importers/lexicon/oshb-hebrew-lexicon";

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/lexicons/${name}`, import.meta.url), "utf8");
}

const COMMIT = "0".repeat(40);

function context(source: LexiconSource = lexiconSourceById("oshb-bdb")) {
  return {
    source: { ...source, pin: { kind: "commit", commit: COMMIT } as const },
    assetPath: "BrownDriverBriggs.xml",
    assetSha256: "e".repeat(64),
  };
}

const bdb = fixture("oshb-bdb.sample.xml");

/** Achata a árvore em caminhos legíveis, só para as asserções. */
function paths(senses: readonly BdbSense[], prefix = ""): readonly string[] {
  return senses.flatMap((sense) => {
    const label = `${prefix}${sense.number ?? (sense.stem ?? "-")}`;
    return [label, ...paths(sense.children, `${label} > `)];
  });
}

describe("Brown-Driver-Briggs — a hierarquia de sentidos é o dado", () => {
  it("lê os verbetes do recorte e nenhum campo fica ignorado", () => {
    const result = parseBrownDriverBriggsXml(bdb, context());
    expect(result.issues).toEqual([]);
    expect(result.ignoredFields).toEqual([]);
    expect(result.entries.map((entry) => entry.bdbId)).toEqual([
      "a.ae.ab",
      "e.bf.aa",
      "t.ad.ag",
      "b.cx.aa",
      "a.dl.ad",
      "a.fx.aa",
      "v.dy.ab",
    ]);
  });

  it("guarda os nove sentidos de אָב na ordem publicada, sem achatar", () => {
    const av = parseBrownDriverBriggsXml(bdb, context()).entries.find(
      (entry) => entry.bdbId === "a.ae.ab",
    );
    expect(av?.lemma.value).toBe("אָב".normalize("NFC"));
    expect(av?.partOfSpeech?.value).toBe("n.m");
    // Definição do topo do verbete, distinta das dos sentidos: sem separá-las,
    // "father" apareceria duas vezes, como geral e como sentido 1.
    expect(av?.definitions.map((item) => item.value)).toEqual(["father"]);
    expect(av?.senses).toHaveLength(9);
    expect(av?.senses.map((sense) => sense.number)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]);
    expect(av?.senses[0]?.definitions).toEqual(["father of individual"]);
    expect(av?.senses[3]?.definitions).toEqual(["ancestor"]);
    // Um sentido pode trazer mais de uma definição; são acepções irmãs.
    expect(av?.senses[4]?.definitions).toEqual(["originator", "patron"]);
    // A prosa que qualifica o sentido não é definição e fica separada dela.
    expect(av?.senses[1]?.note).toBe("of God as");
    expect(av?.senses[1]?.definitions).toEqual(["father of his people"]);
    // Nenhum dos nove tem subsentido: a profundidade é 1.
    expect(senseDepth(av?.senses ?? [])).toBe(1);
  });

  it("preserva os cinco níveis de הָיָה, com tronco verbal e numeração mista", () => {
    const hayah = parseBrownDriverBriggsXml(bdb, context()).entries.find(
      (entry) => entry.bdbId === "e.bf.aa",
    );
    expect(hayah?.isRoot).toBe(true);
    expect(countSenses(hayah?.senses ?? [])).toBe(32);
    expect(senseDepth(hayah?.senses ?? [])).toBe(5);

    // O primeiro nível agrupa por tronco verbal e não recebe número: é o caso
    // em que `number` é nulo de propósito.
    expect(hayah?.senses[0]?.number).toBeNull();
    expect(hayah?.senses[0]?.stem).toBe("Qal");

    // A obra mistura romano, árabe, letra e parênteses para marcar o nível, e a
    // numeração é guardada como publicada, não reescrita por um índice nosso.
    const trilha = paths(hayah?.senses ?? []);
    expect(trilha).toContain("Qal > I > 1 > a");
    expect(trilha).toContain("Qal > I > 2 > a > (1)");
    expect(trilha).toContain("Qal > III > 2");

    const qal = hayah?.senses[0];
    const romanoI = qal?.children.find((sense) => sense.number === "I");
    expect(romanoI?.children.map((sense) => sense.number)).toEqual(["1", "2"]);
    const umA = romanoI?.children[0]?.children.find((sense) => sense.number === "a");
    expect(umA?.definitions).toEqual(["Fall out", "happen"]);
    const doisA = romanoI?.children[1]?.children.find((sense) => sense.number === "a");
    expect(doisA?.children.map((sense) => sense.number)).toEqual(["(1)", "(2)"]);
    expect(doisA?.children[0]?.definitions).toEqual(["and it came to pass"]);
  });

  it("não atribui ao sentido a definição que pertence ao nível de baixo", () => {
    const hayah = parseBrownDriverBriggsXml(bdb, context()).entries.find(
      (entry) => entry.bdbId === "e.bf.aa",
    );
    const qal = hayah?.senses[0];
    // Qal só agrupa; a definição está nos filhos. Se a leitura varresse o ramo
    // inteiro em busca de `<def>`, o tronco herdaria todas as 32 acepções e o
    // verbete perderia exatamente a regência que o torna útil.
    expect(qal?.definitions).toEqual([]);
    const romanoII = qal?.children.find((sense) => sense.number === "II");
    expect(romanoII?.definitions).toEqual(["Come into being", "become"]);
  });

  it("é idempotente e determinístico", () => {
    expect(parseBrownDriverBriggsXml(bdb, context())).toEqual(
      parseBrownDriverBriggsXml(bdb, context()),
    );
  });

  it("recusa arquivo que não é o BDB declarado", () => {
    expect(() => parseBrownDriverBriggsXml("<lexicon></lexicon>", context())).toThrow(
      /nenhum <entry> reconhecido/u,
    );
  });

  it("relata verbete sem id, repetido e sem lema, em vez de completá-lo", () => {
    const broken = `<lexicon>
      <entry><w>אב</w></entry>
      <entry id="x.aa.aa"><w>אב</w></entry>
      <entry id="x.aa.aa"><w>אב</w></entry>
      <entry id="x.aa.ab"><pos>n.m</pos><def>sem lema</def></entry>
    </lexicon>`;
    const result = parseBrownDriverBriggsXml(broken, context());
    expect(result.entries.map((entry) => entry.bdbId)).toEqual(["x.aa.aa"]);
    expect(result.issues.map((issue) => issue.reason)).toEqual([
      "verbete sem atributo id",
      "verbete repetido",
      "verbete sem lema <w>",
    ]);
  });

  it("ignora campo que o registro não declarar, em vez de importá-lo", () => {
    const restricted: LexiconSource = {
      ...lexiconSourceById("oshb-bdb"),
      selectedFields: lexiconSourceById("oshb-bdb").selectedFields.filter(
        (field) => field.sourceField !== "stem" && field.sourceField !== "sense@n",
      ),
    };
    const result = parseBrownDriverBriggsXml(bdb, context(restricted));
    expect(result.ignoredFields).toEqual(["sense@n", "stem"]);
    const hayah = result.entries.find((entry) => entry.bdbId === "e.bf.aa");
    // A árvore continua de pé; só a rotulagem desaparece, porque o registro
    // deixou de autorizá-la.
    expect(senseDepth(hayah?.senses ?? [])).toBe(5);
    expect(hayah?.senses[0]?.stem).toBeNull();
    expect(hayah?.senses[0]?.number).toBeNull();
  });

  it("recusa ler fonte marcada como não importável", () => {
    const blocked: LexiconSource = { ...lexiconSourceById("oshb-bdb"), importable: false };
    expect(() => parseBrownDriverBriggsXml(bdb, context(blocked))).toThrow(LexiconRegistryError);
  });

  it("guarda proveniência por campo, com pino, licença e atribuição do BDB", () => {
    const av = parseBrownDriverBriggsXml(bdb, context()).entries[0];
    expect(av?.lemma.provenance.sourceId).toBe("oshb-bdb");
    expect(av?.lemma.provenance.pin).toBe(`commit ${COMMIT}`);
    expect(av?.lemma.provenance.sourceField).toBe("w");
    expect(av?.definitions[0]?.provenance.sourceField).toBe("def");
    // A atribuição credita a obra e a edição digital, que são coisas distintas.
    expect(av?.lemma.provenance.attribution).toMatch(/Brown-Driver-Briggs/u);
    expect(av?.lemma.provenance.attribution).toMatch(/dom[íi]nio p[úu]blico/u);
    expect(av?.lemma.provenance.licenseDeclared).toMatch(/CC BY 4\.0/u);
  });
});

describe("a ponte do LexicalIndex liga a ocorrência ao verbete do BDB", () => {
  it("fecha lema → Strong → id do BDB com identificadores reais", () => {
    const links = parseLexicalIndexXml(fixture("oshb-lexicalindex.sample.xml")).links;
    const entries = parseBrownDriverBriggsXml(bdb, context()).entries;
    const byId = new Map(entries.map((entry) => [entry.bdbId, entry]));

    // É esta junção que dá sentido ao BDB no produto: a ocorrência traz o
    // Strong, o índice traduz o Strong em id do BDB, e o BDB devolve a árvore
    // de acepções. Sem ela, o BDB seria um dicionário que ninguém alcança.
    const reshit = links.find((link) => link.strongId === "H7225");
    expect(reshit?.bdbId).toBe("t.ad.ag");
    expect(strongLexemeKey("hbo", reshit?.strongId ?? "")).toBe("hbo:H7225");
    expect(byId.get(reshit?.bdbId ?? "")?.lemma.value).toBe("רֵאשִׁית".normalize("NFC"));

    // Os cinco lemas de Gênesis 1:1 que têm Strong fecham a ponte inteira.
    const comStrong = links.filter((link) => link.strongId !== null);
    expect(comStrong).toHaveLength(5);
    for (const link of comStrong) {
      expect(byId.has(link.bdbId ?? "")).toBe(true);
    }
  });

  it("entrada sem Strong não inventa ponte, mas mantém o id do BDB", () => {
    const links = parseLexicalIndexXml(fixture("oshb-lexicalindex.sample.xml")).links;
    const semStrong = links.find((link) => link.strongId === null);
    expect(semStrong?.bdbId).toBe("a.aa.aa");
    // O verbete existe no BDB real, mas não está no recorte: a ausência aqui é
    // da fixture, não da obra, e o teste não finge o contrário.
    expect(parseBrownDriverBriggsXml(bdb, context()).entries.map((e) => e.bdbId)).not.toContain(
      "a.aa.aa",
    );
  });
});
