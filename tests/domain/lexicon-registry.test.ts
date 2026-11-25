import { describe, expect, it } from "vitest";
import {
  LEXICON_REGISTRY_VERSION,
  LEXICON_SOURCES,
  LexiconRegistryError,
  PROHIBITED_TBESH_MEANING_REASON,
  assertFieldAllowed,
  assertNoLicenseMixing,
  assetUrl,
  fieldDecision,
  importableLexiconSources,
  isPinned,
  looksLikeLfsPointer,
  lexiconSourceById,
  pinLabel,
  serializeRegistry,
  type LexiconSource,
} from "../../src/domain/lexicon/source-registry";

const COMMIT = "0".repeat(40);

describe("registro das fontes lexicais", () => {
  it("declara versão, licença, atribuição e campos para toda fonte importável", () => {
    expect(LEXICON_REGISTRY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/u);
    for (const source of importableLexiconSources()) {
      expect(source.license.declared.length).toBeGreaterThan(0);
      expect(source.attribution.length).toBeGreaterThan(0);
      expect(source.repository).toMatch(/^https:\/\/github\.com\//u);
      expect(source.selectedFields.length).toBeGreaterThan(0);
      for (const asset of source.assets) {
        expect(asset.localPath.length).toBeGreaterThan(0);
        expect(["parsed", "evidence_only", "pending_parser"]).toContain(asset.readerStatus);
      }
    }
  });

  it("marca como importáveis só as fontes recomendadas em docs, e nenhuma outra", () => {
    expect(importableLexiconSources().map((source) => source.id).sort()).toEqual([
      "macula-greek",
      "macula-hebrew",
      // BDB é fonte própria, e não um ativo do `oshb-hebrewlexicon`: são obras
      // distintas que dividem repositório, com autoria e atribuição diferentes.
      "oshb-bdb",
      "oshb-hebrewlexicon",
      "stepbible-tbesg",
      "stepbible-tflsj",
    ]);
    // Alignments é referência de formato: entra no registro, mas nada dela é importado.
    expect(lexiconSourceById("clear-bible-alignments").importable).toBe(false);
    expect(lexiconSourceById("clear-bible-alignments").assetKind).toBe("pipeline_reference");
  });

  it("só tem pino resolvido onde a coleta foi aprovada, e nunca sem aprovação nomeada", () => {
    for (const source of LEXICON_SOURCES) {
      const approved = source.collectionStatus === "approved_for_collection";
      // Pino resolvido e aprovação andam juntos: um sem o outro significa ou
      // coleta sem decisão registrada, ou decisão registrada sem alvo fixo.
      expect(isPinned(source)).toBe(approved);
      expect(source.approval !== undefined).toBe(approved);
      if (approved) {
        expect(pinLabel(source.pin)).toMatch(/^commit [0-9a-f]{40}$/u);
        expect(source.approval?.approvedBy).toMatch(/\S/u);
        expect(source.approval?.approvedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
        expect(source.approval?.scope).toMatch(/\S/u);
      } else {
        expect(pinLabel(source.pin)).toMatch(/^não resolvido/u);
      }
    }
  });

  it("exige SHA-256 congelado em todo ativo de fonte já aprovada", () => {
    for (const source of LEXICON_SOURCES) {
      if (source.collectionStatus !== "approved_for_collection") continue;
      for (const asset of source.assets) {
        // Aprovada e coletada significa versão congelada: sem o hash, o
        // verificador não teria contra o que comparar numa próxima leitura.
        expect(asset.expectedSha256).toMatch(/^[0-9a-f]{64}$/u);
        expect(asset.pathConfirmed).toBe(true);
      }
    }
  });

  it("recusa montar URL sem commit resolvido, para não baixar um alvo móvel", () => {
    // Fonte ainda não aprovada: é nela que o pino continua `unresolved`.
    const source = lexiconSourceById("stepbible-tflsj");
    const asset = {
      repoPath: "Lexicons/TFLSJ.txt",
      localPath: "TFLSJ.txt",
      format: "text",
      expectedSha256: null,
      pathConfirmed: false,
      readerStatus: "pending_parser",
    } as const;

    expect(() => assetUrl(source, asset)).toThrow(LexiconRegistryError);

    const pinnedSource: LexiconSource = { ...source, pin: { kind: "commit", commit: COMMIT } };
    expect(assetUrl(pinnedSource, asset)).toBe(
      `https://raw.githubusercontent.com/STEPBible/STEPBible-Data/${COMMIT}/Lexicons/TFLSJ.txt`,
    );

    const bogus: LexiconSource = { ...source, pin: { kind: "commit", commit: "main" } };
    expect(() => assetUrl(bogus, asset)).toThrow(/40 hex/u);
  });

  it("baixa ativo em Git LFS pelo endpoint de mídia, não pelo raw", () => {
    const source = lexiconSourceById("macula-hebrew");
    const tsv = source.assets.find((item) => item.localPath === "macula-hebrew.tsv");
    const license = source.assets.find((item) => item.localPath === "LICENSE.md");
    if (!tsv || !license) throw new Error("registro mudou: ativo ausente");

    // O `raw` devolveria o ponteiro de 133 bytes em vez dos 84 MB do arquivo.
    expect(tsv.lfs).toBe(true);
    expect(assetUrl(source, tsv)).toMatch(/^https:\/\/media\.githubusercontent\.com\/media\//u);
    expect(assetUrl(source, tsv)).toContain("/WLC/tsv/macula-hebrew.tsv");
    // Ativo comum continua no raw.
    expect(assetUrl(source, license)).toMatch(/^https:\/\/raw\.githubusercontent\.com\//u);
  });

  it("reconhece o ponteiro do Git LFS pelos primeiros bytes", () => {
    const pointer = new TextEncoder().encode(
      "version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 84382719\n",
    );
    expect(looksLikeLfsPointer(pointer)).toBe(true);
    expect(looksLikeLfsPointer(new TextEncoder().encode("xml:id\tref\ttext\n"))).toBe(false);
  });
});

describe("TBESH: a coluna Meaning é proibida e o motivo fica registrado", () => {
  const tbesh = lexiconSourceById("stepbible-tbesh");

  it("fica no registro como bloqueada e não importável", () => {
    expect(tbesh.importable).toBe(false);
    expect(tbesh.collectionStatus).toBe("blocked");
    expect(tbesh.license.family).toBe("permission-required");
    expect(tbesh.assets).toEqual([]);
    expect(tbesh.selectedFields).toEqual([]);
  });

  it("explica por quê, citando a ressalva do cabeçalho da própria fonte", () => {
    const prohibition = tbesh.prohibitedFields[0];
    expect(prohibition?.sourceField).toBe("Meaning");
    expect(prohibition?.reason).toBe(PROHIBITED_TBESH_MEANING_REASON);
    expect(prohibition?.reason).toMatch(/Abridged BDB/u);
    expect(prohibition?.reason).toMatch(/permissão/u);
    expect(prohibition?.evidenceUrl).toMatch(/STEPBible-Data/u);
  });

  it("falha fechada ao pedir o campo, em vez de ignorá-lo em silêncio", () => {
    const decision = fieldDecision(tbesh, "Meaning");
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.prohibited).toBe(true);
    expect(() => assertFieldAllowed(tbesh, "Meaning")).toThrow(/campo proibido/u);
  });

  it("distingue campo proibido de campo apenas não declarado", () => {
    const tbesg = lexiconSourceById("stepbible-tbesg");
    const unknown = fieldDecision(tbesg, "ColunaQueNaoExiste");
    expect(unknown.allowed).toBe(false);
    expect(unknown.allowed === false && unknown.prohibited).toBe(false);
    expect(assertFieldAllowed(tbesg, "Gloss").target).toBe("entry.gloss");
  });
});

describe("mistura de licença", () => {
  it("aceita o conjunto atual, que é inteiramente CC BY 4.0", () => {
    expect(() => assertNoLicenseMixing(LEXICON_SOURCES)).not.toThrow();
  });

  it("recusa CC BY-SA junto de CC BY, porque o derivado herdaria o share-alike", () => {
    const shareAlike: LexiconSource = {
      ...lexiconSourceById("oshb-hebrewlexicon"),
      id: "unfoldingword-uhal",
      license: { declared: "CC BY-SA 4.0", family: "cc-by-sa-4.0", url: "https://example.org/" },
    };
    expect(() => assertNoLicenseMixing([...LEXICON_SOURCES, shareAlike])).toThrow(
      /mistura de licença proibida/u,
    );
  });

  it("recusa marcar como importável uma fonte que exige permissão específica", () => {
    const forced: LexiconSource = { ...lexiconSourceById("stepbible-tbesh"), importable: true };
    expect(() => assertNoLicenseMixing([forced])).toThrow(/permissão pendente/u);
  });
});

describe("serialização do registro", () => {
  it("é determinística e independente da ordem das fontes", () => {
    const direct = serializeRegistry(LEXICON_SOURCES);
    const reversed = serializeRegistry([...LEXICON_SOURCES].reverse());
    expect(direct).toBe(reversed);
    expect(serializeRegistry(LEXICON_SOURCES)).toBe(direct);
  });

  it("carrega licença, atribuição, pino e campos proibidos", () => {
    const serialized = serializeRegistry();
    expect(serialized).toMatch(/"collectionStatus"/u);
    expect(serialized).toMatch(/Abridged BDB/u);
    expect(serialized).toMatch(/"importable":false/u);
  });
});
