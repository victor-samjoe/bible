/**
 * Leitor de arquivos delimitados guiado pelo cabeçalho real (LEXICON-INDEX-001).
 *
 * MACULA e STEPBible publicam tabelas com colunas que mudam de nome e de ordem
 * entre revisões. Fixar índice de coluna no código seria importar a coluna
 * errada no dia em que a fonte inserir uma nova no meio — e importar a coluna
 * errada, aqui, é importar dado de licença diferente.
 *
 * Por isso o mapeamento vem do cabeçalho do próprio arquivo, cruzado com o
 * `selectedFields` do registro. Três resultados possíveis para cada coluna:
 *
 * - declarada em `selectedFields`: lida;
 * - não declarada: **ignorada**, e o nome volta em `ignoredFields` para auditoria;
 * - declarada em `prohibitedFields`: a leitura **falha fechada**, sem produzir
 *   registro parcial. É o caso do `Meaning` do TBESH.
 *
 * Função pura: não acessa filesystem, rede nem banco.
 */

import {
  LexiconRegistryError,
  fieldDecision,
  type LexiconSource,
} from "../../domain/lexicon/source-registry.ts";

export type DelimitedRow = {
  /** Número da linha no arquivo, 1-based, para relatar problema localizável. */
  readonly line: number;
  readonly cells: readonly string[];
};

export type DelimitedTable = {
  readonly header: readonly string[];
  readonly headerLine: number;
  readonly rows: readonly DelimitedRow[];
  /** Linhas de comentário/cabeçalho de licença, preservadas para auditoria. */
  readonly preamble: readonly string[];
};

export type DelimitedOptions = {
  readonly delimiter?: string;
  readonly commentPrefix?: string;
  /**
   * Nomes de coluna que identificam a linha de cabeçalho.
   *
   * Sem isto, o cabeçalho é a primeira linha que não é comentário — regra que
   * serve para o MACULA, cujo cabeçalho é a linha 1. Não serve para o TBESG: o
   * arquivo real abre com 87 linhas de prosa (título, licença, explicação dos
   * conjuntos de Strong) **sem prefixo de comentário**, e a primeira delas
   * seria lida como cabeçalho. O resultado seria uma falha fechada correta
   * pelo motivo errado — "faltam colunas exigidas" em vez de "ainda não
   * cheguei na tabela".
   *
   * Com a lista, a busca anda até a primeira linha que contenha **todas** as
   * colunas exigidas, e tudo que vier antes vira preâmbulo preservado. Continua
   * guiado pelo cabeçalho real: se a fonte renomear uma coluna exigida, nenhuma
   * linha casa e a leitura falha, que é o comportamento desejado.
   */
  readonly requiredColumns?: readonly string[];
  /**
   * Colunas proibidas pelo registro. Uma linha que traga qualquer uma delas é
   * tratada como cabeçalho imediatamente, mesmo que não tenha todas as colunas
   * exigidas, para que `mapColumns` interrompa a leitura com o motivo certo.
   *
   * Sem isto, `requiredColumns` abriria um buraco na garantia de falha
   * fechada: um registro mal configurado — que peça uma coluna com nome que o
   * arquivo não usa — faria a busca passar direto pela linha que contém a
   * coluna proibida e terminar o arquivo dizendo apenas "não achei cabeçalho".
   * A proibição por licença precisa vencer a procura.
   */
  readonly prohibitedColumns?: readonly string[];
};

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

/**
 * Alguns arquivos tabulares publicados por terceiros separam o cabeçalho da
 * primeira linha com uma régua visual (`=====`). Não é um registro e tratá-la
 * como tal transforma formatação em dado malformado. A regra é deliberadamente
 * estreita: só ignora uma linha inteira composta de `=`, espaços ou tabs.
 */
function isVisualSeparator(raw: string): boolean {
  return /^[=\t ]+$/u.test(raw) && raw.includes("=");
}

export function parseDelimited(content: string, options: DelimitedOptions = {}): DelimitedTable {
  const delimiter = options.delimiter ?? "\t";
  const commentPrefix = options.commentPrefix ?? "#";
  const required = options.requiredColumns ?? [];
  const prohibited = options.prohibitedColumns ?? [];
  const lines = stripBom(content).split(/\r?\n/u);
  const preamble: string[] = [];
  let header: readonly string[] | null = null;
  let headerLine = 0;
  const rows: DelimitedRow[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    const line = index + 1;
    if (raw.trim().length === 0) continue;
    if (header && isVisualSeparator(raw)) continue;
    if (raw.startsWith(commentPrefix)) {
      preamble.push(raw);
      continue;
    }
    const cells = raw.split(delimiter).map((cell) => cell.trim());
    if (!header) {
      const hasProhibited = prohibited.some((name) => cells.includes(name));
      if (!hasProhibited && required.length > 0 && !required.every((name) => cells.includes(name))) {
        // Ainda no preâmbulo: guarda a linha e continua procurando a tabela.
        preamble.push(raw);
        continue;
      }
      header = cells;
      headerLine = line;
      continue;
    }
    rows.push({ line, cells });
  }

  if (!header) {
    throw new LexiconRegistryError(
      required.length > 0
        ? `arquivo delimitado sem linha de cabeçalho contendo ${required.join(", ")}`
        : "arquivo delimitado sem cabeçalho reconhecível",
    );
  }
  return { header, headerLine, rows, preamble };
}

export type ColumnMap = {
  /** `target` do registro -> índice da coluna no arquivo. */
  readonly byTarget: ReadonlyMap<string, number>;
  /** `target` -> nome exato da coluna no arquivo, para a proveniência. */
  readonly sourceFieldByTarget: ReadonlyMap<string, string>;
  readonly ignoredFields: readonly string[];
};

/**
 * Cruza o cabeçalho do arquivo com o registro. Falha fechada em dois casos:
 * coluna proibida presente e coluna exigida ausente. Os dois são erro de
 * licença ou de versão, não detalhe de formatação.
 */
export function mapColumns(source: LexiconSource, header: readonly string[]): ColumnMap {
  const byTarget = new Map<string, number>();
  const sourceFieldByTarget = new Map<string, string>();
  const ignoredFields: string[] = [];

  header.forEach((name, index) => {
    if (name.length === 0) return;
    const decision = fieldDecision(source, name);
    if (decision.allowed) {
      // Coluna repetida: a primeira vence e a segunda é relatada, em vez de
      // sobrescrever em silêncio.
      if (byTarget.has(decision.selected.target)) {
        ignoredFields.push(`${name} (duplicada)`);
        return;
      }
      byTarget.set(decision.selected.target, index);
      sourceFieldByTarget.set(decision.selected.target, name);
      return;
    }
    if (decision.prohibited) {
      throw new LexiconRegistryError(
        `coluna proibida presente em ${source.id}: '${name}'. ${decision.reason}`,
      );
    }
    ignoredFields.push(name);
  });

  const missing = source.selectedFields
    .filter((field) => field.required && !byTarget.has(field.target))
    .map((field) => field.sourceField);
  if (missing.length > 0) {
    throw new LexiconRegistryError(
      `${source.id}: cabeçalho não traz coluna(s) exigida(s): ${missing.join(", ")}. ` +
        "O formato da fonte mudou ou o arquivo não é o declarado; nada foi lido.",
    );
  }

  return { byTarget, sourceFieldByTarget, ignoredFields: [...ignoredFields].sort() };
}

/**
 * Colunas que o registro declara como obrigatórias para esta fonte. Usado para
 * localizar a linha de cabeçalho em arquivos com preâmbulo em prosa.
 */
export function requiredColumnNames(source: LexiconSource): readonly string[] {
  return source.selectedFields.filter((field) => field.required).map((field) => field.sourceField);
}

/** Colunas que o registro proíbe ler nesta fonte. */
export function prohibitedColumnNames(source: LexiconSource): readonly string[] {
  return source.prohibitedFields.map((field) => field.sourceField);
}

export function cell(map: ColumnMap, row: DelimitedRow, target: string): string | null {
  const index = map.byTarget.get(target);
  if (index === undefined) return null;
  // `at` devolve `string | undefined`: linha mais curta que o cabeçalho é caso
  // normal em TSV, e vira ausência, não erro de índice.
  const trimmed = row.cells.at(index)?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}
