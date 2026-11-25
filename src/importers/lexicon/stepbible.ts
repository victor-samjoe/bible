/**
 * Parser dos léxicos tabulares do STEPBible (LEXICON-INDEX-001).
 *
 * Cobre TBESG (verbete grego breve) e, quando for decidido usá-lo, TFLSJ. O
 * arquivo traz um preâmbulo longo com licença e notas, iniciado por `#`, e
 * depois uma tabela com cabeçalho.
 *
 * O **TBESH não é lido por este parser nem por nenhum outro**: a coluna
 * `Meaning` tem pendência de permissão declarada pelo próprio cabeçalho da
 * fonte, e o registro o marca como `importable: false`. Se alguém apontar este
 * parser para o TBESH, `mapColumns` encontra a coluna proibida e interrompe a
 * leitura antes de produzir uma única linha — ver
 * `PROHIBITED_TBESH_MEANING_REASON`.
 *
 * Função pura: recebe o conteúdo do arquivo como string.
 */

import {
  LexiconRegistryError,
  type LexiconSource,
  pinLabel,
} from "../../domain/lexicon/source-registry.ts";
import {
  type FieldProvenance,
  type LexiconParseResult,
  type NormalizedLexemeEntry,
  type ParseIssue,
  type ProvenancedValue,
  strongLexemeKey,
} from "../../domain/lexicon/records.ts";
import { cell, mapColumns, parseDelimited, prohibitedColumnNames, requiredColumnNames } from "./delimited.ts";

export type StepBibleReadContext = {
  readonly source: LexiconSource;
  readonly assetPath: string;
  readonly assetSha256: string;
};

function provenance(context: StepBibleReadContext, sourceField: string): FieldProvenance {
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

function valued(
  context: StepBibleReadContext,
  sourceField: string | undefined,
  value: string | null,
): ProvenancedValue | null {
  if (!value || !sourceField) return null;
  return { value: value.normalize("NFC"), provenance: provenance(context, sourceField) };
}

/** Normaliza "G0001=A" / "G0001" para o identificador exibível "G1". */
export function normalizeExtendedStrong(raw: string): string | null {
  const base = raw.split("=")[0]?.trim() ?? "";
  const match = /^([HG])0*(\d+)([a-z])?$/iu.exec(base);
  if (!match) return null;
  const prefix = (match[1] ?? "").toUpperCase();
  return `${prefix}${match[2] ?? ""}${(match[3] ?? "").toLowerCase()}`;
}

export function parseStepBibleLexicon(
  content: string,
  context: StepBibleReadContext,
): LexiconParseResult {
  const { source } = context;
  if (!source.importable) {
    throw new LexiconRegistryError(
      `${source.id} está marcada como não importável no registro; leitura recusada`,
    );
  }
  if (source.assetKind !== "lexical_entry") {
    throw new LexiconRegistryError(`${source.id} não é fonte de verbete lexical`);
  }
  if (source.language !== "hbo" && source.language !== "grc") {
    throw new LexiconRegistryError(`${source.id} precisa declarar idioma hbo ou grc`);
  }
  const language = source.language;

  const table = parseDelimited(content, {
    delimiter: "\t",
    commentPrefix: "#",
    requiredColumns: requiredColumnNames(source),
    prohibitedColumns: prohibitedColumnNames(source),
  });
  const columns = mapColumns(source, table.header);
  const field = (target: string) => columns.sourceFieldByTarget.get(target);

  const entries: NormalizedLexemeEntry[] = [];
  const issues: ParseIssue[] = [];
  const seen = new Set<string>();

  for (const row of table.rows) {
    const at = `linha ${row.line}`;
    const rawStrong = cell(columns, row, "entry.lexemeId");
    const lemma = valued(context, field("entry.lemma"), cell(columns, row, "entry.lemma"));
    if (!rawStrong) {
      issues.push({ at, reason: "verbete sem Extended Strong" });
      continue;
    }
    const strongId = normalizeExtendedStrong(rawStrong);
    if (!strongId) {
      issues.push({ at, reason: `Extended Strong fora do formato: '${rawStrong}'` });
      continue;
    }
    const key = strongLexemeKey(language, strongId);
    // O TBESG mantém algumas subdivisões no dStrong, mas a chave de ligação
    // publicada para o corpus é o eStrong. Quando ele se repete, a primeira
    // linha completa já representa o verbete que conseguimos ligar às
    // ocorrências; a linha seguinte pode inclusive omitir o lema. Detectar a
    // repetição antes de validar campos evita relatar esse artefato conhecido
    // como um verbete novo e malformado.
    if (seen.has(key)) {
      issues.push({ at, reason: `verbete repetido: ${strongId}` });
      continue;
    }
    if (!lemma) {
      issues.push({ at, reason: `verbete ${strongId} sem lema` });
      continue;
    }
    seen.add(key);

    const gloss = valued(context, field("entry.gloss"), cell(columns, row, "entry.gloss"));
    const definition = valued(
      context,
      field("entry.definition"),
      cell(columns, row, "entry.definition"),
    );

    entries.push({
      key,
      language,
      strongId,
      lemma,
      transliteration: valued(
        context,
        field("entry.transliteration"),
        cell(columns, row, "entry.transliteration"),
      ),
      partOfSpeech: valued(
        context,
        field("entry.partOfSpeech"),
        cell(columns, row, "entry.partOfSpeech"),
      ),
      glosses: gloss ? [gloss] : [],
      definitions: definition ? [definition] : [],
      etymology: null,
      translations: [],
    });
  }

  return {
    sourceId: source.id,
    entries: [...entries].sort((left, right) => left.key.localeCompare(right.key)),
    occurrences: [],
    ignoredFields: columns.ignoredFields,
    issues,
  };
}
