/**
 * Parser das anotações por ocorrência da MACULA (LEXICON-INDEX-001).
 *
 * MACULA Hebrew e MACULA Greek respondem a "que sentido esta palavra assume
 * **neste** versículo": forma, lema, morfologia, classe, domínio semântico,
 * sentido e papéis semânticos. O verbete — "o que a palavra pode significar" —
 * vem de outra fonte e não é produzido aqui.
 *
 * O que este parser **não** faz, de propósito:
 * - não cria verbete, definição nem glossa;
 * - não traduz coisa alguma para português;
 * - não inventa referência: linha sem `ref`, sem `lemma` ou sem `strong` é
 *   recusada e relatada, nunca completada por inferência.
 *
 * Função pura: recebe o conteúdo do TSV como string.
 */

import {
  type LexiconSource,
  pinLabel,
} from "../../domain/lexicon/source-registry.ts";
import {
  type FieldProvenance,
  type LexiconParseResult,
  type NormalizedOccurrence,
  type ParseIssue,
  strongLexemeKey,
} from "../../domain/lexicon/records.ts";
import { cell, mapColumns, parseDelimited, prohibitedColumnNames, requiredColumnNames } from "./delimited.ts";

export type MaculaReadContext = {
  readonly source: LexiconSource;
  readonly assetPath: string;
  /** SHA-256 dos bytes lidos, conferido antes da chamada. */
  readonly assetSha256: string;
};

function provenanceFor(context: MaculaReadContext, sourceField: string): FieldProvenance {
  return {
    sourceId: context.source.id,
    assetPath: context.assetPath,
    pin: pinLabel(context.source.pin),
    assetSha256: context.assetSha256,
    licenseDeclared: context.source.license.declared,
    attribution: context.source.attribution,
    sourceField,
  };
}

/**
 * Normaliza a referência publicada pela MACULA (`GEN 1:1!1`, `JHN 1:1!3`) para
 * a âncora canônica sem o índice de palavra. O índice continua disponível em
 * `sourceWordId`, que é o identificador estável da fonte.
 */
export function normalizeMaculaRef(ref: string): string | null {
  const base = ref.split("!")[0]?.trim() ?? "";
  if (!/^[A-Z0-9]{3}\s+\d+:\d+$/u.test(base)) return null;
  return base.replace(/\s+/u, " ");
}

/**
 * Posição da palavra no versículo, tirada do sufixo `!N`. Mais de uma linha
 * pode trazer a mesma posição: no hebraico, cada morfema é uma linha.
 */
export function maculaWordPosition(ref: string): number | null {
  const suffix = ref.split("!")[1]?.trim() ?? "";
  if (!/^\d+$/u.test(suffix)) return null;
  const parsed = Number.parseInt(suffix, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseMaculaTsv(
  content: string,
  context: MaculaReadContext,
): LexiconParseResult {
  const { source } = context;
  if (source.assetKind !== "occurrence_annotation") {
    throw new Error(`${source.id} não é fonte de anotação por ocorrência`);
  }
  if (source.language !== "hbo" && source.language !== "grc") {
    throw new Error(`${source.id} precisa declarar idioma hbo ou grc`);
  }
  const language = source.language;

  const table = parseDelimited(content, {
    delimiter: "\t",
    commentPrefix: "#",
    requiredColumns: requiredColumnNames(source),
    prohibitedColumns: prohibitedColumnNames(source),
  });
  const columns = mapColumns(source, table.header);

  const occurrences: NormalizedOccurrence[] = [];
  const issues: ParseIssue[] = [];
  const seen = new Set<string>();

  for (const row of table.rows) {
    const at = `linha ${row.line}`;
    const sourceWordId = cell(columns, row, "occurrence.sourceWordId");
    const rawRef = cell(columns, row, "occurrence.canonicalRef");
    const surface = cell(columns, row, "occurrence.surface");
    const lemma = cell(columns, row, "occurrence.lemma");
    const strongId = cell(columns, row, "occurrence.strongId");

    if (!sourceWordId) {
      issues.push({ at, reason: "ocorrência sem identificador estável da fonte" });
      continue;
    }
    if (!rawRef) {
      issues.push({ at, reason: "ocorrência sem referência canônica" });
      continue;
    }
    const canonicalRef = normalizeMaculaRef(rawRef);
    if (!canonicalRef) {
      issues.push({ at, reason: `referência fora do formato esperado: '${rawRef}'` });
      continue;
    }
    if (!surface) {
      // Não é linha quebrada: é o artigo definido absorvido pela preposição
      // (בַּ = בְּ + הַ). A fonte publica o morfema com `text` vazio e
      // transliteração "–", porque ele existe na gramática e não na escrita.
      // São 6.435 linhas no MACULA Hebrew, todas artigo. Ficam fora do índice,
      // que é indexado por forma clicável, mas entram numa categoria própria
      // para o verificador não os contar como defeito de leitura.
      issues.push({
        at,
        reason: lemma
          ? `morfema sem forma escrita, mantido fora do índice: ${lemma}`
          : "morfema sem forma escrita, mantido fora do índice",
      });
      continue;
    }
    if (!lemma) {
      issues.push({ at, reason: "ocorrência sem lema; não é possível ligar ao verbete" });
      continue;
    }
    if (!strongId) {
      issues.push({ at, reason: "ocorrência sem Strong; a chave do índice lexical é o lema" });
      continue;
    }
    if (seen.has(sourceWordId)) {
      issues.push({ at, reason: `identificador repetido: ${sourceWordId}` });
      continue;
    }
    seen.add(sourceWordId);

    occurrences.push({
      sourceWordId,
      language,
      canonicalRef,
      wordPosition: maculaWordPosition(rawRef),
      surface: surface.normalize("NFC"),
      gloss: cell(columns, row, "occurrence.gloss"),
      lexemeKey: strongLexemeKey(language, strongId),
      lemma: lemma.normalize("NFC"),
      morphology: cell(columns, row, "occurrence.morphology"),
      partOfSpeech: cell(columns, row, "occurrence.partOfSpeech"),
      semanticDomain: cell(columns, row, "occurrence.semanticDomain"),
      sdbhSense: cell(columns, row, "occurrence.sdbhSense"),
      lexicalDomain: cell(columns, row, "occurrence.lexicalDomain"),
      senseNumber: cell(columns, row, "occurrence.senseNumber"),
      semanticFrame: cell(columns, row, "occurrence.semanticFrame"),
      provenance: provenanceFor(context, "row"),
    });
  }

  return {
    sourceId: source.id,
    entries: [],
    occurrences: [...occurrences].sort(
      (left, right) =>
        left.canonicalRef.localeCompare(right.canonicalRef) ||
        left.sourceWordId.localeCompare(right.sourceWordId),
    ),
    ignoredFields: columns.ignoredFields,
    issues,
  };
}
