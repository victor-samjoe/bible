import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LexiconRegistryError,
  lexiconSourceById,
  type LexiconSource,
} from "../../src/domain/lexicon/source-registry";
import {
  buildLexemeIndex,
  danglingOccurrences,
  occurrencesByLexeme,
  serializeLexiconIndex,
  strongLexemeKey,
} from "../../src/domain/lexicon/records";
import { normalizeMaculaRef, parseMaculaTsv } from "../../src/importers/lexicon/macula";
import {
  normalizeExtendedStrong,
  parseStepBibleLexicon,
} from "../../src/importers/lexicon/stepbible";
import {
  parseHebrewStrongXml,
  parseLexicalIndexXml,
} from "../../src/importers/lexicon/oshb-hebrew-lexicon";

/**
 * Fixtures offline, pequenas e versionadas. Nenhum byte de fonte real é
 * reproduzido: lema, Strong e referência são dados factuais, enquanto glossa e
 * definição são textos de fixture, marcados como tais, para que o teste prove o
 * parser e não finja conhecer o verbete da fonte.
 */
function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/lexicons/${name}`, import.meta.url), "utf8");
}

const COMMIT = "0".repeat(40);

/** Fonte do registro com pino de teste, para a proveniência ficar completa. */
function pinned(id: string): LexiconSource {
  return { ...lexiconSourceById(id), pin: { kind: "commit", commit: COMMIT } };
}

function contextFor(id: string, assetPath: string) {
  return { source: pinned(id), assetPath, assetSha256: "b".repeat(64) };
}

describe("MACULA Hebrew — ocorrências de Gênesis 1:1", () => {
  const content = fixture("macula-hebrew-gen1-1.sample.tsv");
  const context = contextFor("macula-hebrew", "macula-hebrew.tsv");

  it("lê os onze morfemas das sete palavras e os liga ao lema por Strong", () => {
    const result = parseMaculaTsv(content, context);
    expect(result.issues).toEqual([]);
    expect(result.entries).toEqual([]);
    // A fonte é morfêmica: a primeira palavra do versículo são duas
    // linhas, preposição e substantivo. São 11 linhas para 7 palavras.
    expect(result.occurrences).toHaveLength(11);
    expect(result.occurrences.map((item) => item.lexemeKey)).toEqual([
      "hbo:H871a",
      "hbo:H7225",
      "hbo:H1254",
      "hbo:H430",
      "hbo:H853",
      "hbo:H1886a",
      "hbo:H8064",
      "hbo:H2050b",
      "hbo:H853",
      "hbo:H1886a",
      "hbo:H776",
    ]);
    // É a posição que devolve os morfemas de cada palavra do leitor.
    expect(result.occurrences.map((item) => item.wordPosition)).toEqual([
      1, 1, 2, 3, 4, 5, 5, 6, 6, 7, 7,
    ]);
    expect(result.occurrences.every((item) => item.canonicalRef === "GEN 1:1")).toBe(true);
    // O parser normaliza para NFC; a expectativa normaliza também, para o teste
    // não depender da forma em que o literal foi gravado neste arquivo.
    expect(result.occurrences[0]?.surface).toBe("בְּ".normalize("NFC"));
    expect(result.occurrences[0]?.morphology).toBe("R");
    expect(result.occurrences[0]?.semanticDomain).toBeNull();
    expect(result.occurrences[1]?.morphology).toBe("Ncfsa");
    expect(result.occurrences[1]?.semanticDomain).toBe("168");
  });

  it("ignora coluna não declarada e registra qual foi, em vez de lê-la calado", () => {
    const result = parseMaculaTsv(content, context);
    // Lista real do arquivo. `gloss` **não** está aqui: é importado de
    // propósito, por ser o texto-fonte da tradução editorial. Já `english`
    // e `mandarin` ficam fora, e `lexdomain`/`contextualdomain` são
    // preteridos em favor de `coredomain`.
    expect(result.ignoredFields).toEqual([
      "after",
      "class",
      "contextualdomain",
      "english",
      "extends",
      "gender",
      "greek",
      "greekstrong",
      "lang",
      "mandarin",
      "number",
      "participantref",
      "person",
      "state",
      "stem",
      "stronglemma",
      "subjref",
      "transliteration",
      "type",
    ]);
    expect(JSON.stringify(result.occurrences)).not.toMatch(/in the beginning/u);
  });

  it("guarda proveniência por ocorrência, com pino, licença e atribuição", () => {
    const provenance = parseMaculaTsv(content, context).occurrences[0]?.provenance;
    expect(provenance?.sourceId).toBe("macula-hebrew");
    expect(provenance?.pin).toBe(`commit ${COMMIT}`);
    expect(provenance?.licenseDeclared).toBe("CC BY 4.0");
    expect(provenance?.attribution).toMatch(/Clear Bible/u);
    expect(provenance?.assetSha256).toHaveLength(64);
  });

  it("carrega a glossa da fonte sem inventar verbete nem tradução", () => {
    const result = parseMaculaTsv(content, context);
    // A ocorrência traz a glossa contextual publicada pela fonte, em
    // inglês, porque é o texto-fonte da tradução editorial para pt-BR.
    expect(result.occurrences[0]?.gloss).toBe("in");
    expect(result.occurrences[1]?.gloss).toBe("beginning");
    expect(result.occurrences[2]?.gloss).toBe("he.created");
    // Mas não produz verbete, nem definição, nem uma linha de português:
    // traduzir é trabalho de `translate-lexicon.ts`, com revisão humana.
    expect(result.entries).toEqual([]);
    const serialized = JSON.stringify(result.occurrences);
    expect(serialized).not.toMatch(/definition|translation|tradu/iu);
  });

  it("é idempotente: duas leituras produzem exatamente o mesmo resultado", () => {
    expect(parseMaculaTsv(content, context)).toEqual(parseMaculaTsv(content, context));
  });
});

describe("MACULA Greek — ocorrências de João 1:1", () => {
  const content = fixture("macula-greek-jhn1-1.sample.tsv");
  const context = contextFor("macula-greek", "macula-greek-SBLGNT.tsv");

  it("lê as dezessete palavras e reconhece o lema repetido", () => {
    const result = parseMaculaTsv(content, context);
    expect(result.issues).toEqual([]);
    expect(result.occurrences).toHaveLength(17);
    expect(result.occurrences.every((item) => item.canonicalRef === "JHN 1:1")).toBe(true);
    const grouped = occurrencesByLexeme(result.occurrences);
    expect(grouped.get("grc:G3056")).toHaveLength(3);
    expect(grouped.get("grc:G3588")).toHaveLength(4);
    // A fonte marca as três ocorrências de ἦn com G2258, o Strong da
    // forma verbal, e não com G1510, o do lema. São chaves distintas no
    // índice, e o verbete de G2258 existe por conta própria no TBESG.
    expect(grouped.get("grc:G2258")).toHaveLength(3);
    expect(grouped.get("grc:G1510")).toBeUndefined();
    expect(grouped.get("grc:G746")).toHaveLength(1);
  });

  it("preserva a morfologia publicada e não inventa a que falta", () => {
    const result = parseMaculaTsv(content, context);
    expect(result.occurrences[0]?.morphology).toBe("PREP");
    const article = result.occurrences.find((item) => item.sourceWordId === "n43001001004");
    expect(article?.partOfSpeech).toBe("det");
    expect(article?.semanticDomain).toBe("092004");
    // O artigo não recebe papel semântico na fonte: a ausência é mantida
    // como ausência, não preenchida com cadeia vazia.
    expect(article?.semanticFrame).toBeNull();
  });
});

describe("MACULA — entrada malformada é recusada, nunca completada", () => {
  const context = contextFor("macula-greek", "macula-greek-SBLGNT.tsv");
  const header = "xml:id\tref\ttext\tlemma\tstrong\tmorph";

  it("relata linha sem referência, sem lema, sem Strong e com id repetido", () => {
    const content = [
      header,
      "n1\tJHN 1:1!1\tἘν\tἐν\t1722\tP",
      "n2\t\tἀρχῇ\tἀρχή\t746\tN-DSF",
      "n3\tJHN 1:1!3\tἦν\t\t1510\tV",
      "n4\tJHN 1:1!4\tὁ\tὁ\t\tD",
      "n1\tJHN 1:1!5\tλόγος\tλόγος\t3056\tN",
      "n5\tJoao um\tκαὶ\tκαί\t2532\tCONJ",
    ].join("\n");
    const result = parseMaculaTsv(content, context);
    expect(result.occurrences.map((item) => item.sourceWordId)).toEqual(["n1"]);
    expect(result.issues.map((issue) => issue.reason)).toEqual([
      "ocorrência sem referência canônica",
      "ocorrência sem lema; não é possível ligar ao verbete",
      "ocorrência sem Strong; a chave do índice lexical é o lema",
      "identificador repetido: n1",
      "referência fora do formato esperado: 'Joao um'",
    ]);
  });

  it("falha fechada quando o cabeçalho perde uma coluna exigida", () => {
    const content = ["xml:id\tref\ttext\tlemma", "n1\tJHN 1:1!1\tἘν\tἐν"].join("\n");
    // Nenhuma linha contém todas as colunas exigidas, então a busca pelo
    // cabeçalho chega ao fim do arquivo sem encontrá-lo.
    expect(() => parseMaculaTsv(content, context)).toThrow(
      /sem linha de cabeçalho contendo .*strong/u,
    );
  });

  it("recusa arquivo sem cabeçalho reconhecível", () => {
    expect(() => parseMaculaTsv("# só comentário\n", context)).toThrow(LexiconRegistryError);
  });

  it("normaliza a referência e recusa o que não reconhece", () => {
    expect(normalizeMaculaRef("GEN 1:1!1")).toBe("GEN 1:1");
    expect(normalizeMaculaRef("JHN 1:1")).toBe("JHN 1:1");
    expect(normalizeMaculaRef("Gen 1:1")).toBeNull();
    expect(normalizeMaculaRef("")).toBeNull();
  });
});

describe("STEPBible TBESG — verbetes gregos", () => {
  const content = fixture("stepbible-tbesg.sample.txt");
  const context = contextFor("stepbible-tbesg", "TBESG.txt");

  it("lê os verbetes de João 1:1 com chave normalizada por Strong estendido", () => {
    const result = parseStepBibleLexicon(content, context);
    expect(result.issues).toEqual([]);
    expect(result.occurrences).toEqual([]);
    expect(result.entries.map((entry) => entry.strongId).sort()).toEqual([
      "G1510",
      "G1722",
      "G2258",
      "G2316",
      "G2532",
      "G3056",
      "G3588",
      "G4314",
      "G746",
    ]);
    const logos = result.entries.find((entry) => entry.strongId === "G3056");
    expect(logos?.key).toBe("grc:G3056");
    expect(logos?.lemma.value).toBe("λόγος".normalize("NFC"));
    expect(logos?.transliteration?.value).toBe("logos");
    expect(logos?.glosses[0]?.value).toBe("word");
    expect(logos?.partOfSpeech?.value).toBe("G:N-M");
    expect(logos?.glosses[0]?.provenance.sourceField).toBe("Gloss");
    expect(logos?.translations).toEqual([]);
  });

  it("ignora a coluna não declarada", () => {
    const result = parseStepBibleLexicon(content, context);
    // O arquivo real publica três conjuntos de Strong; importamos só o
    // estendido, que é o que MACULA e OSHB também usam.
    expect(result.ignoredFields).toEqual(["dStrong", "uStrong"]);
    expect(JSON.stringify(result.entries)).not.toMatch(/G3056G/u);
  });

  it("normaliza o Extended Strong, inclusive com zero à esquerda e sufixo", () => {
    expect(normalizeExtendedStrong("G0746")).toBe("G746");
    expect(normalizeExtendedStrong("G0001=A")).toBe("G1");
    expect(normalizeExtendedStrong("H7225")).toBe("H7225");
    expect(normalizeExtendedStrong("lixo")).toBeNull();
    expect(strongLexemeKey("grc", "G0746")).toBe(strongLexemeKey("grc", "746"));
  });

  it("relata verbete sem Strong, sem lema e repetido", () => {
    const content = [
      "eStrong\tGreek\tTransliteration\tMorph\tGloss",
      "G3056\tλόγος\tlogos\tN:M\tg",
      "\tλόγος\tlogos\tN:M\tg",
      "G2316\t\ttheos\tN:M\tg",
      "G3056\tλόγος\tlogos\tN:M\tg",
      "lixo\tx\tx\tx\tg",
    ].join("\n");
    const result = parseStepBibleLexicon(content, context);
    expect(result.entries).toHaveLength(1);
    expect(result.issues.map((issue) => issue.reason)).toEqual([
      "verbete sem Extended Strong",
      "verbete G2316 sem lema",
      "verbete repetido: G3056",
      "Extended Strong fora do formato: 'lixo'",
    ]);
  });

  it("trata a régua visual e a subdivisão repetida do TBESG como metadados, não dados", () => {
    const content = [
      "eStrong\tGreek\tTransliteration\tMorph\tGloss",
      "===============================================",
      "G2199\tΖεβεδαῖος\tZebedaios\tN:N-M-P\tZebedee",
      "G2199\t\tZebedaios\tN:N-M-P\t[wife of Zebedee]",
    ].join("\n");
    const result = parseStepBibleLexicon(content, context);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.lemma.value).toBe("Ζεβεδαῖος".normalize("NFC"));
    expect(result.issues).toEqual([{ at: "linha 4", reason: "verbete repetido: G2199" }]);
  });
});

describe("TBESH — a coluna Meaning interrompe a leitura", () => {
  it("recusa a fonte inteira, porque o registro a marca como não importável", () => {
    const context = contextFor("stepbible-tbesh", "TBESH.txt");
    expect(() => parseStepBibleLexicon(fixture("stepbible-tbesh-meaning.sample.txt"), context)).toThrow(
      /não importável/u,
    );
  });

  it("interrompe antes de produzir registro mesmo se a fonte for marcada importável por engano", () => {
    const forced: LexiconSource = {
      ...pinned("stepbible-tbesh"),
      importable: true,
      selectedFields: [
        { sourceField: "eStrong", target: "entry.lexemeId", purpose: "chave", required: true },
        { sourceField: "Greek", target: "entry.lemma", purpose: "lema", required: true },
        { sourceField: "Gloss", target: "entry.gloss", purpose: "glossa", required: true },
      ],
    };
    const context = { source: forced, assetPath: "TBESH.txt", assetSha256: "c".repeat(64) };
    let message = "";
    try {
      parseStepBibleLexicon(fixture("stepbible-tbesh-meaning.sample.txt"), context);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/coluna proibida presente em stepbible-tbesh: 'Meaning'/u);
    expect(message).toMatch(/Abridged BDB/u);
  });
});

describe("Open Scriptures HebrewLexicon", () => {
  const content = fixture("oshb-hebrewstrong.sample.xml");
  const context = contextFor("oshb-hebrewlexicon", "HebrewStrong.xml");

  it("lê os verbetes de Gênesis 1:1 e normaliza o zero à esquerda do Strong", () => {
    const result = parseHebrewStrongXml(content, context);
    expect(result.issues).toEqual([]);
    // Ordenação por chave textual: "H8064" vem antes de "H853" porque a
    // comparação é caractere a caractere, não numérica.
    expect(result.entries.map((entry) => entry.key)).toEqual([
      "hbo:H1254",
      "hbo:H430",
      "hbo:H7225",
      "hbo:H776",
      "hbo:H8064",
      "hbo:H853",
    ]);
    const reshit = result.entries.find((entry) => entry.key === "hbo:H7225");
    expect(reshit?.lemma.value).toBe("רֵאשִׁית".normalize("NFC"));
    expect(reshit?.transliteration?.value).toBe("rêʼshîyth".normalize("NFC"));
    expect(reshit?.partOfSpeech?.value).toBe("n-f");
    expect(reshit?.definitions[0]?.value).toBe("definicao-fixture-H7225");
    expect(reshit?.glosses[0]?.value).toBe("glossa-fixture-H7225");
    expect(reshit?.etymology?.value).toBe("derivacao-fixture-H7225");
  });

  it("remove marcação interna preservando o texto", () => {
    const result = parseHebrewStrongXml(content, context);
    const erets = result.entries.find((entry) => entry.key === "hbo:H776");
    expect(erets?.definitions[0]?.value).toBe(
      "definicao-fixture-H776 com marcacao interna preservada como texto",
    );
  });

  it("ignora campo que o registro não declarar, em vez de importá-lo", () => {
    const restricted: LexiconSource = {
      ...pinned("oshb-hebrewlexicon"),
      selectedFields: lexiconSourceById("oshb-hebrewlexicon").selectedFields.filter(
        (field) => field.sourceField !== "w@xlit",
      ),
    };
    const result = parseHebrewStrongXml(content, {
      source: restricted,
      assetPath: "HebrewStrong.xml",
      assetSha256: "d".repeat(64),
    });
    expect(result.ignoredFields).toEqual(["w@xlit"]);
    expect(result.entries.every((entry) => entry.transliteration === null)).toBe(true);
  });

  it("relata verbete sem id, com id fora do formato, repetido e sem lema", () => {
    const broken = `<lexicon>
      <entry><w>אב</w></entry>
      <entry id="X1"><w>אב</w></entry>
      <entry id="H1"><w>אָב</w></entry>
      <entry id="H0001"><w>אָב</w></entry>
      <entry id="H2"><meaning>sem lema</meaning></entry>
    </lexicon>`;
    const result = parseHebrewStrongXml(broken, context);
    expect(result.entries.map((entry) => entry.key)).toEqual(["hbo:H1"]);
    expect(result.issues.map((issue) => issue.reason)).toEqual([
      "verbete sem atributo id",
      "id fora do formato Strong hebraico: 'X1'",
      "verbete repetido",
      "verbete sem lema <w>",
    ]);
  });

  it("lê o índice lexical preservando a ausência de Strong", () => {
    const index = parseLexicalIndexXml(fixture("oshb-lexicalindex.sample.xml"));
    expect(index.issues).toEqual([]);
    // Recorte real: os cinco lemas de Gênesis 1:1 mais uma entrada sem Strong.
    expect(index.links).toHaveLength(6);
    const reshit = index.links.find((link) => link.strongId === "H7225");
    // O id do BDB é real e conferido contra o arquivo: é o alvo que o parser do
    // BDB precisa encontrar para a ponte fechar.
    expect(reshit?.bdbId).toBe("t.ad.ag");
    const semStrong = index.links.find((link) => link.strongId === null);
    expect(semStrong?.bdbId).toBe("a.aa.aa");
    expect(semStrong?.augmentedLemma).toBe("א");
  });
});

describe("índice lexical reunido — substitui a prova manual de Gênesis 1:1", () => {
  const hebrewEntries = parseHebrewStrongXml(
    fixture("oshb-hebrewstrong.sample.xml"),
    contextFor("oshb-hebrewlexicon", "HebrewStrong.xml"),
  ).entries;
  const hebrewOccurrences = parseMaculaTsv(
    fixture("macula-hebrew-gen1-1.sample.tsv"),
    contextFor("macula-hebrew", "macula-hebrew.tsv"),
  ).occurrences;
  const greekEntries = parseStepBibleLexicon(
    fixture("stepbible-tbesg.sample.txt"),
    contextFor("stepbible-tbesg", "TBESG.txt"),
  ).entries;
  const greekOccurrences = parseMaculaTsv(
    fixture("macula-greek-jhn1-1.sample.tsv"),
    contextFor("macula-greek", "macula-greek-SBLGNT.tsv"),
  ).occurrences;

  const entries = [...hebrewEntries, ...greekEntries];
  const occurrences = [...hebrewOccurrences, ...greekOccurrences];

  it("guarda o verbete uma vez por lema e o reutiliza em cada ocorrência", () => {
    const index = buildLexemeIndex(entries);
    expect(index).toHaveLength(15);
    const grouped = occurrencesByLexeme(occurrences);
    // 28 ocorrências em 17 lemas: o verbete não é duplicado por ocorrência.
    expect(occurrences).toHaveLength(28);
    expect(grouped.size).toBe(17);
    expect(grouped.get("hbo:H853")).toHaveLength(2);
    expect(grouped.get("grc:G3056")).toHaveLength(3);
  });

  it("deixa órfão o morfema que o dicionário de Strong não define", () => {
    const orphans = danglingOccurrences(occurrences, buildLexemeIndex(entries));
    // Os quatro são prefixos hebraicos: a preposição, o artigo duas vezes e
    // a conjunção. O MACULA os numera em Strong *aumentado* ("0871a",
    // "1886a", "2050b"), e o dicionário de Strong, que só tem números sem
    // sufixo, não os define. Ficar órfão aqui é o comportamento correto: a
    // alternativa seria ligar a preposição ao verbete H871, que é um
    // topônimo sem relação nenhuma com ela.
    expect(orphans.map((item) => item.lexemeKey)).toEqual([
      "hbo:H871a",
      "hbo:H1886a",
      "hbo:H2050b",
      "hbo:H1886a",
    ]);
    expect(new Set(orphans.map((item) => item.canonicalRef))).toEqual(new Set(["GEN 1:1"]));
  });

  it("relata ocorrência sem verbete em vez de inventar definição", () => {
    const partial = buildLexemeIndex(hebrewEntries);
    const orphans = danglingOccurrences(occurrences, partial);
    expect(orphans).toHaveLength(21);
    expect(new Set(orphans.map((item) => item.canonicalRef))).toEqual(
      new Set(["GEN 1:1", "JHN 1:1"]),
    );
  });

  it("é determinístico e idempotente: ordem de entrada não muda a saída", () => {
    const direct = serializeLexiconIndex(entries, occurrences);
    const reversed = serializeLexiconIndex([...entries].reverse(), [...occurrences].reverse());
    expect(reversed).toBe(direct);
    expect(serializeLexiconIndex(entries, occurrences)).toBe(direct);
    // Reprocessar o mesmo conjunto duas vezes não duplica verbete.
    expect(buildLexemeIndex([...entries, ...entries])).toEqual(buildLexemeIndex(entries));
  });

  it("não produz tradução em português em nenhum verbete", () => {
    for (const entry of buildLexemeIndex(entries)) {
      expect(entry.translations).toEqual([]);
    }
  });
});
