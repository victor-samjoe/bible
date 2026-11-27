/**
 * Contrato de consulta por palavra (fila Claude 3, item 3).
 *
 * Módulo puro: recebe uma postagem já carregada e devolve a página de usos.
 * Quem acha a partição, lê bytes e confere integridade é
 * `src/server/word-study/service.ts`. A separação existe para que o contrato
 * possa ser testado inteiro sem disco, sem rede e sem banco.
 *
 * O item 3 pede quatro coisas que este arquivo faz valer no **tipo**, e não só
 * na documentação:
 *
 * 1. **Estados distintos.** "Sem índice", "parcial", "vazio" e "erro" são
 *    variantes diferentes de `WordUsesResult`, não um resultado vazio com um
 *    booleano ao lado. O caso que mais importa é a diferença entre *vazio
 *    exaustivo* ("procuramos nos 66 livros e esta palavra não ocorre") e *vazio
 *    parcial* ("não ocorre no que indexamos, e não sabemos do resto"). Os dois
 *    renderizariam a mesma lista vazia, e dizer a primeira coisa quando a
 *    verdade é a segunda é a desonestidade central que esta frente evita.
 * 2. **Camadas separadas.** Uso de um lema, sentido contextual, tradução e
 *    alinhamento editorial são ativos distintos, com licença e fluxo de revisão
 *    distintos. O índice só conhece **uso**. As outras três voltam como
 *    `LayerState` indisponível, com o motivo e a origem de onde viriam — em vez
 *    de voltarem nulas, que na tela parece "esta palavra não tem sentido".
 * 3. **Referência não repetida.** As ocorrências vêm agrupadas por versículo,
 *    com as posições da fonte preservadas na ordem.
 * 4. **Versificação explícita.** Cada grupo diz se a numeração foi conferida,
 *    mapeada por regra ou não conferida.
 *
 * Paginação é **por versículo**, nunca por ocorrência: cortar no meio de um
 * versículo entregaria metade das posições de uma palavra e faria a página
 * seguinte repetir a referência, que é o que o item 3 proíbe.
 */

import {
  type LexicalIdentity,
  type WordStudyLanguage,
  identityOfLemma,
  identityOfStrong,
  parseStrong,
} from "./identity.ts";
import {
  type Coverage,
  type IndexOccurrence,
  type Posting,
  type SourceAttribution,
} from "./inverted-index.ts";
import { formatRef, refCode } from "./reference.ts";
import {
  type VersificationMap,
  type VersificationState,
  divergenceWarning,
  readerRefForSource,
} from "./versification.ts";

export const WORD_STUDY_QUERY_CONTRACT = "word-study-query/2";

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;

/** Entrada crua, como chega da borda. Nada aqui é confiável antes de validar. */
export type UsesQueryInput = {
  readonly language: string;
  /** Um dos dois: Strong como a fonte o grafa, ou lema. */
  readonly strong?: string | null;
  readonly lemma?: string | null;
  readonly limit?: number | null;
  /** Cursor opaco devolvido pela página anterior. */
  readonly cursor?: string | null;
};

export type QueryPlan = {
  readonly identity: LexicalIdentity;
  readonly limit: number;
  /** `refCode` a partir do qual continuar; `null` na primeira página. */
  readonly startAtRefCode: number | null;
  readonly cursorIndexVersion: string | null;
};

export type QueryRejection = { readonly reason: string };

const LANGUAGES: readonly string[] = ["hbo", "grc"];

/**
 * Valida a entrada. Recusa por motivo nomeado, nunca por coerção: linguagem
 * desconhecida, identidade ausente, Strong fora de forma e cursor inválido são
 * erros do chamador e precisam ser distinguíveis de "palavra não encontrada".
 */
export function planQuery(input: UsesQueryInput): { readonly plan: QueryPlan } | QueryRejection {
  const language = (input.language ?? "").trim().toLowerCase();
  if (!LANGUAGES.includes(language)) {
    return { reason: `idioma não suportado: '${input.language}' (esperado hbo ou grc)` };
  }
  const typed = language as WordStudyLanguage;

  const strong = (input.strong ?? "").trim();
  const lemma = (input.lemma ?? "").trim();
  if (strong.length > 0 && lemma.length > 0) {
    return { reason: "informe Strong ou lema, não os dois" };
  }
  if (strong.length === 0 && lemma.length === 0) {
    return { reason: "consulta sem Strong e sem lema" };
  }

  let identity: LexicalIdentity;
  if (strong.length > 0) {
    const parsed = parseStrong(typed, strong);
    if ("problem" in parsed) return { reason: parsed.problem.reason };
    identity = identityOfStrong(parsed.strong);
  } else {
    const parsed = identityOfLemma(typed, lemma);
    if ("problem" in parsed) return { reason: parsed.problem.reason };
    identity = parsed.identity;
  }

  const rawLimit = input.limit ?? DEFAULT_PAGE_LIMIT;
  if (!Number.isSafeInteger(rawLimit) || rawLimit < 1) {
    return { reason: `limite inválido: ${String(input.limit)}` };
  }
  // Teto aplicado em silêncio seria surpresa; aqui é recusa explícita.
  if (rawLimit > MAX_PAGE_LIMIT) {
    return { reason: `limite acima do máximo de ${MAX_PAGE_LIMIT}: ${rawLimit}` };
  }

  let startAtRefCode: number | null = null;
  let cursorIndexVersion: string | null = null;
  if (input.cursor !== null && input.cursor !== undefined && input.cursor.trim().length > 0) {
    const parsed = decodeCursor(input.cursor.trim());
    if (parsed === null) return { reason: `cursor inválido: '${input.cursor}'` };
    if (parsed.identity !== identity.key) return { reason: "cursor pertence a outra palavra" };
    startAtRefCode = parsed.ref;
    cursorIndexVersion = parsed.indexVersion;
  }

  return { plan: { identity, limit: rawLimit, startAtRefCode, cursorIndexVersion } };
}

/**
 * Cursor contém a referência, a identidade e a versão do índice. Sua estrutura
 * é opaca ao cliente; cursores de outra palavra ou edição são recusados.
 */
export function encodeCursor(ref: number, identity: string, indexVersion: string): string {
  return encodeURIComponent(JSON.stringify({ v: 2, ref, identity, indexVersion }));
}

export function decodeCursor(cursor: string): { ref: number; identity: string; indexVersion: string } | null {
  if (cursor.length > 2048) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(cursor));
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (record.v !== 2 || typeof record.ref !== "number" || !Number.isSafeInteger(record.ref) || record.ref <= 0 ||
        typeof record.identity !== "string" || !record.identity || typeof record.indexVersion !== "string" || !record.indexVersion) return null;
    return { ref: record.ref, identity: record.identity, indexVersion: record.indexVersion };
  } catch { return null; }
}

/** Ocorrências de um versículo, com a referência dita uma vez só. */
export type VerseUses = {
  /** Referência da fonte, que é a âncora real do índice. */
  readonly sourceRef: string;
  /**
   * `refCode` da referência da fonte. É o que a paginação usa: ele inclui o
   * livro, então um cursor em Gênesis 1:1 não casa com Êxodo 1:1 — o que
   * aconteceria com qualquer código que só carregasse capítulo e versículo.
   */
  readonly sourceRefCode: number;
  /**
   * Referência na numeração do leitor. Igual à da fonte quando nenhuma regra se
   * aplicou; diferente quando `versification` é `mapped`.
   */
  readonly readerRef: string;
  readonly versification: VersificationState;
  /** Posições da fonte, em ordem. Vazio quando a fonte não publica posição. */
  readonly positions: readonly number[];
  /** `true` quando a fonte não publicou posição para nenhuma ocorrência daqui. */
  readonly positionsUnknown: boolean;
  /** Ocorrências neste versículo, incluindo as sem posição. */
  readonly occurrences: number;
};

export type UsesPage = {
  readonly groups: readonly VerseUses[];
  /** `null` quando não há mais página. */
  readonly nextCursor: string | null;
  /** Totais da postagem inteira, não da página. */
  readonly totalOccurrences: number;
  readonly totalVerses: number;
};

/**
 * Estado de uma camada de informação. A variante indisponível carrega **motivo**
 * e **origem**, porque "não temos" e "não existe" são coisas diferentes e a tela
 * precisa poder dizer qual é.
 */
export type LayerState =
  | { readonly available: true; readonly from: string }
  | { readonly available: false; readonly reason: string; readonly wouldComeFrom: string };

/**
 * As quatro camadas que o item 3 manda diferenciar. Só a primeira sai deste
 * índice; as outras três são declaradas indisponíveis **aqui**, o que não quer
 * dizer que não existam no produto — querem dizer que esta consulta não as
 * serve e não deve fingir que serve.
 */
export type Layers = {
  readonly uses: LayerState;
  readonly contextualSense: LayerState;
  readonly translation: LayerState;
  readonly editorialAlignment: LayerState;
};

export function layersForIndexOnly(indexVersion: string): Layers {
  return {
    uses: { available: true, from: `índice invertido de usos, versão ${indexVersion}` },
    contextualSense: {
      available: false,
      reason:
        "O índice guarda referência e posição, não sentido. A glossa contextual por ocorrência " +
        "não entra aqui para não repetir texto de fonte licenciada em centenas de milhares de linhas.",
      wouldComeFrom: "MACULA (coluna gloss/sdbh), por ocorrência, já importado em lexeme_occurrences",
    },
    translation: {
      available: false,
      reason:
        "Não existe tradução editorial revisada para pt-BR: traduzir é trabalho separado, com " +
        "revisão humana, e o fluxo proíbe rascunho de máquina chegar ao leitor como verbete conferido.",
      wouldComeFrom: "editorial_translations, após revisão nomeada",
    },
    editorialAlignment: {
      available: false,
      reason:
        "Alinhamento entre o original e a tradução portuguesa não existe neste índice e não deve " +
        "ser inferido por posição, que é o erro que a fila proíbe explicitamente.",
      wouldComeFrom: "frente de alinhamento (ALIGNMENT-PIPELINE-001), ainda não concluída",
    },
  };
}

/** Procedência exibível de uma consulta. Sem caminho de arquivo, de propósito. */
export type QueryProvenance = {
  readonly indexVersion: string;
  readonly identityMode: string;
  readonly versificationVersion: string;
  readonly contract: typeof WORD_STUDY_QUERY_CONTRACT;
  readonly sources: readonly SourceAttribution[];
};

/**
 * Resultado da consulta. Seis variantes, porque os seis casos exigem telas
 * diferentes e colapsá-los é o que produz resposta enganosa.
 */
export type WordUsesResult =
  /** Entrada do chamador inválida. Não é "palavra não encontrada". */
  | { readonly status: "invalid_query"; readonly reason: string }
  /** Nenhum índice configurado ou disponível. Diferente de índice vazio. */
  | { readonly status: "no_index"; readonly reason: string }
  /** Índice existe, mas falhou ao ler ou não conferiu integridade. */
  | { readonly status: "error"; readonly reason: string }
  /**
   * Identidade válida, índice íntegro, nenhuma ocorrência. `exhaustive` diz se
   * isso significa "não ocorre na Bíblia" (`true`) ou apenas "não ocorre no que
   * indexamos" (`false`).
   */
  | {
      readonly status: "empty";
      readonly identityKey: string;
      readonly exhaustive: boolean;
      readonly coverage: Coverage;
      readonly provenance: QueryProvenance;
      readonly layers: Layers;
      readonly warnings: readonly string[];
    }
  /** Tem usos, e o índice cobre os 66 livros. */
  | {
      readonly status: "complete";
      readonly identityKey: string;
      readonly page: UsesPage;
      readonly coverage: Coverage;
      readonly provenance: QueryProvenance;
      readonly layers: Layers;
      readonly warnings: readonly string[];
    }
  /** Tem usos, mas a cobertura é parcial: a lista não é "todos os usos". */
  | {
      readonly status: "partial";
      readonly identityKey: string;
      readonly page: UsesPage;
      readonly coverage: Coverage;
      readonly provenance: QueryProvenance;
      readonly layers: Layers;
      readonly warnings: readonly string[];
    };

function groupByVerse(
  occurrences: readonly IndexOccurrence[],
  map: VersificationMap,
): readonly VerseUses[] {
  const groups: VerseUses[] = [];
  let current: { ref: IndexOccurrence["ref"]; positions: number[]; total: number } | null = null;

  const flush = (): void => {
    if (!current) return;
    const { reader, state } = readerRefForSource(map, current.ref);
    groups.push({
      sourceRef: formatRef(current.ref),
      sourceRefCode: refCode(current.ref),
      readerRef: `${current.ref.book} ${reader.chapter}:${reader.verse}`,
      versification: state,
      positions: [...current.positions].sort((left, right) => left - right),
      positionsUnknown: current.positions.length === 0,
      occurrences: current.total,
    });
    current = null;
  };

  for (const occurrence of occurrences) {
    const sameVerse =
      current !== null &&
      current.ref.book === occurrence.ref.book &&
      current.ref.chapter === occurrence.ref.chapter &&
      current.ref.verse === occurrence.ref.verse;
    if (!sameVerse) {
      flush();
      current = { ref: occurrence.ref, positions: [], total: 0 };
    }
    if (current) {
      if (occurrence.position !== null) current.positions.push(occurrence.position);
      current.total += 1;
    }
  }
  flush();
  return groups;
}

/**
 * Monta a página a partir da postagem. A postagem já vem ordenada
 * canonicamente pelo construtor do índice; esta função não reordena, para que
 * uma falha de ordenação apareça como teste quebrado e não seja escondida aqui.
 */
export function pageOfPosting(
  posting: Posting,
  plan: QueryPlan,
  map: VersificationMap,
  indexVersion: string,
): UsesPage {
  const all = groupByVerse(posting.occurrences, map);
  const startIndex =
    plan.startAtRefCode === null
      ? 0
      : all.findIndex((group) => group.sourceRefCode >= (plan.startAtRefCode ?? 0));
  const from = startIndex < 0 ? all.length : startIndex;
  const slice = all.slice(from, from + plan.limit);
  const next = all[from + plan.limit];
  return {
    groups: slice,
    nextCursor: next ? encodeCursor(next.sourceRefCode, plan.identity.key, indexVersion) : null,
    totalOccurrences: posting.occurrences.length,
    totalVerses: all.length,
  };
}

/** Avisos que acompanham qualquer resultado com usos. */
export function warningsFor(
  groups: readonly VerseUses[],
  coverage: Coverage,
  map: VersificationMap,
  indexLimitations: readonly string[],
): readonly string[] {
  const warnings: string[] = [...indexLimitations];
  if (!map.exhaustive) {
    warnings.push(
      `Mapa de versificação ${map.version} não é exaustivo: ${map.rules.length} regra(s) ` +
        `conferida(s) e ${map.declaredDivergences.length} divergência(s) declarada(s) sem regra.`,
    );
  }
  const unverifiedBooks = new Set<string>();
  for (const group of groups) {
    if (group.versification === "unverified") {
      unverifiedBooks.add(group.sourceRef.split(" ")[0] ?? "");
    }
  }
  for (const book of [...unverifiedBooks].sort()) {
    const warning = divergenceWarning(map, book);
    if (warning) warnings.push(warning);
  }
  // O índice já pode ter declarado a cobertura parcial entre suas limitações.
  // Repetir a mesma informação em duas redações só gasta a atenção de quem lê o
  // aviso, então aqui só é acrescentado o que ainda não foi dito.
  const alreadySaidCoverage = warnings.some((item) => item.startsWith("Cobertura parcial"));
  if (!alreadySaidCoverage) {
    warnings.push(
      `Cobertura parcial: há registros em ${coverage.booksPresent.length} de 66 livros, ` +
        "mas a ingestão completa não foi comprovada. Esta lista não é 'todos os usos na Bíblia'.",
    );
  }
  return warnings;
}

/** Reservado para um futuro certificado verificável de cobertura. */
export function isExhaustive(coverage: Coverage): boolean {
  // Um livro presente não comprova que todas as suas ocorrências entraram.
  // Sem certificado de cobertura por fonte e identidade, nunca afirmar totalidade.
  void coverage;
  return false;
}
