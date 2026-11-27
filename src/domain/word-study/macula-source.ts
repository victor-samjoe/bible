/**
 * Adaptador do MACULA para o índice de estudo de palavras (fila Claude 3, item 2).
 *
 * Transforma as linhas do TSV do MACULA em entradas do índice invertido. Não lê
 * arquivo, não calcula hash e não fala com banco: recebe o conteúdo como string
 * e devolve dados. Quem lê o disco e confere o SHA-256 é o script.
 *
 * Reaproveita `importers/lexicon/delimited.ts` de propósito, em vez de
 * reimplementar a leitura. Aquele módulo é quem faz valer a política de licença
 * do registro — coluna não declarada é ignorada e relatada, coluna proibida faz
 * a leitura falhar fechada. Reescrever isso aqui criaria um segundo caminho de
 * leitura sem essa garantia, que é o tipo de duplicação que mais tarde vira
 * importação indevida.
 *
 * Os problemas são **categorizados**, não jogados numa lista única, porque as
 * categorias têm significados muito diferentes e os números importam para a
 * honestidade do relatório: artigo absorvido pela preposição é gramática
 * normal da fonte, enquanto Strong fora de forma é defeito de leitura.
 */

import {
  type LexiconSource,
} from "../lexicon/source-registry.ts";
import {
  cell,
  mapColumns,
  parseDelimited,
  prohibitedColumnNames,
  requiredColumnNames,
} from "../../importers/lexicon/delimited.ts";
import {
  type WordStudyLanguage,
  identityOfLemma,
  identityOfStrong,
  parseStrong,
} from "./identity.ts";
import { type OccurrenceInput, type SourceAttribution } from "./inverted-index.ts";
import { parseRefWithPosition } from "./reference.ts";

export type MaculaReadInput = {
  readonly source: LexiconSource;
  readonly assetPath: string;
  /** SHA-256 dos bytes lidos, conferido pelo chamador antes desta chamada. */
  readonly assetSha256: string;
  readonly content: string;
};

/**
 * Contagem por categoria. Cada campo responde uma pergunta distinta sobre o
 * arquivo, e somá-los num total de "erros" apagaria justamente a distinção.
 */
export type MaculaTally = {
  /** Linhas que viraram ocorrência do índice. */
  readonly accepted: number;
  /** Aceitas cuja identidade veio do lema, por falta de Strong na fonte. */
  readonly identifiedByLemma: number;
  /**
   * Morfema sem forma escrita: o artigo absorvido pela preposição (בַּ = בְּ +
   * הַ). Existe na gramática e não na escrita. Fica fora do índice, que é
   * indexado por forma clicável, e é contado aqui para não ser lido como
   * defeito.
   */
  readonly withoutWrittenForm: number;
  /** Linha sem identificador estável: não há como deduplicar. */
  readonly withoutSourceWordId: number;
  /** Linha sem Strong **e** sem lema: nada a indexar. */
  readonly withoutIdentity: number;
  /** Referência fora da forma `XXX C:V[!N]`. */
  readonly badRef: number;
  /** Strong presente mas fora de forma, ou de idioma divergente. */
  readonly badStrong: number;
};

export type MaculaReadResult = {
  readonly language: WordStudyLanguage;
  readonly attribution: SourceAttribution;
  readonly occurrences: readonly OccurrenceInput[];
  readonly tally: MaculaTally;
  /** Colunas presentes no arquivo e não declaradas no registro. */
  readonly ignoredFields: readonly string[];
  /** Amostra dos problemas, limitada, para o relatório não virar o arquivo. */
  readonly samples: readonly { readonly at: string; readonly reason: string }[];
};

const SAMPLE_LIMIT = 20;

export class MaculaSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaculaSourceError";
  }
}

export function readMaculaOccurrences(input: MaculaReadInput): MaculaReadResult {
  const { source } = input;
  if (source.assetKind !== "occurrence_annotation") {
    throw new MaculaSourceError(`${source.id} não é fonte de anotação por ocorrência`);
  }
  if (source.language !== "hbo" && source.language !== "grc") {
    throw new MaculaSourceError(`${source.id} precisa declarar idioma hbo ou grc`);
  }
  const language: WordStudyLanguage = source.language;

  const table = parseDelimited(input.content, {
    delimiter: "\t",
    commentPrefix: "#",
    requiredColumns: requiredColumnNames(source),
    prohibitedColumns: prohibitedColumnNames(source),
  });
  const columns = mapColumns(source, table.header);

  const attribution: SourceAttribution = {
    sourceId: source.id,
    assetPath: input.assetPath,
    assetSha256: input.assetSha256,
    pin: source.pin.kind === "unresolved" ? `não resolvido (${source.pin.reason})` : source.pin.kind === "tag" ? `tag ${source.pin.tag} / commit ${source.pin.commit}` : `commit ${source.pin.commit}`,
    licenseDeclared: source.license.declared,
    attribution: source.attribution,
  };

  const occurrences: OccurrenceInput[] = [];
  const samples: { at: string; reason: string }[] = [];
  let accepted = 0;
  let identifiedByLemma = 0;
  let withoutWrittenForm = 0;
  let withoutSourceWordId = 0;
  let withoutIdentity = 0;
  let badRef = 0;
  let badStrong = 0;

  const note = (at: string, reason: string): void => {
    if (samples.length < SAMPLE_LIMIT) samples.push({ at, reason });
  };

  for (const row of table.rows) {
    const at = `linha ${String(row.line)}`;
    const sourceWordId = cell(columns, row, "occurrence.sourceWordId");
    if (!sourceWordId) {
      withoutSourceWordId += 1;
      note(at, "ocorrência sem identificador estável da fonte");
      continue;
    }
    const rawRef = cell(columns, row, "occurrence.canonicalRef");
    if (!rawRef) {
      badRef += 1;
      note(at, "ocorrência sem referência canônica");
      continue;
    }
    const parsedRef = parseRefWithPosition(rawRef);
    if ("problem" in parsedRef) {
      badRef += 1;
      note(at, parsedRef.problem.reason);
      continue;
    }
    // Forma escrita ausente é condição da fonte, não linha quebrada: o índice é
    // por forma clicável, então ela sai — contada à parte.
    if (!cell(columns, row, "occurrence.surface")) {
      withoutWrittenForm += 1;
      continue;
    }

    const rawStrong = cell(columns, row, "occurrence.strongId");
    const rawLemma = cell(columns, row, "occurrence.lemma");

    let identity = null as ReturnType<typeof identityOfStrong> | null;
    if (rawStrong) {
      const parsedStrong = parseStrong(language, rawStrong);
      if ("strong" in parsedStrong) {
        identity = identityOfStrong(parsedStrong.strong);
      } else {
        badStrong += 1;
        note(at, parsedStrong.problem.reason);
      }
    }
    // Sem Strong utilizável, o lema ainda identifica a palavra. Perder a
    // ocorrência seria pior: ela existe e some da contagem de usos.
    if (identity === null && rawLemma) {
      const byLemma = identityOfLemma(language, rawLemma);
      if ("identity" in byLemma) {
        identity = byLemma.identity;
        identifiedByLemma += 1;
      }
    }
    if (identity === null) {
      withoutIdentity += 1;
      note(at, "ocorrência sem Strong utilizável e sem lema; nada a indexar");
      continue;
    }

    occurrences.push({
      identity,
      ref: parsedRef.ref,
      position: parsedRef.position,
      sourceWordId,
    });
    accepted += 1;
  }

  return {
    language,
    attribution,
    occurrences,
    tally: {
      accepted,
      identifiedByLemma,
      withoutWrittenForm,
      withoutSourceWordId,
      withoutIdentity,
      badRef,
      badStrong,
    },
    ignoredFields: columns.ignoredFields,
    samples,
  };
}
