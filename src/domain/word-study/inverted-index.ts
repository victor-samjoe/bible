/**
 * Índice invertido compacto por identidade lexical (fila Claude 3, item 2).
 *
 * O que o índice é: para cada identidade lexical, a lista das referências onde
 * ela ocorre, com a posição da palavra dentro do versículo. Nada mais.
 *
 * O que o índice **não** é, e por quê:
 *
 * - **Não guarda texto bíblico.** Nem o original, nem a tradução, nem a glossa.
 *   A ocorrência é um par (referência, posição); o texto é buscado por quem já
 *   tem licença para exibi-lo. Isso mantém o arquivo pequeno e impede que o
 *   índice se torne, por acidente, uma redistribuição do corpus.
 * - **Não guarda definição nem sentido.** Verbete e acepção vivem nas tabelas
 *   do C30, que têm proveniência por campo e fluxo de revisão editorial.
 * - **Não carrega proveniência por linha.** Repetir o bloco de crédito em
 *   centenas de milhares de postagens multiplicaria o mesmo texto; a atribuição
 *   fica no cabeçalho, uma vez por fonte, e cada partição aponta para ele.
 *
 * Forma da ocorrência na serialização: um vetor plano de inteiros
 * `[refCode0, pos0, Δ1, pos1, Δ2, pos2, …]`, com o primeiro `refCode` absoluto e
 * os seguintes como diferença do anterior. Como `refCode` é monotônico na ordem
 * canônica (ver `reference.ts`), as diferenças são pequenas e não negativas, e
 * **Δ = 0 é o caso de duas ocorrências no mesmo versículo** — que é o que
 * preserva as duas posições de `אֵת` em Gênesis 1:1 sem repetir a referência.
 *
 * Partição: as identidades são ordenadas canonicamente e cortadas em partições
 * por orçamento de ocorrências, **nunca partindo uma postagem**. Consultar uma
 * palavra lê exatamente uma partição — é esse invariante que torna o custo em
 * celular previsível. Uma postagem maior que o orçamento inteiro (a conjunção
 * hebraica, o artigo grego) ganha partição própria, marcada `oversized`.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco, sem relógio. O hash e a
 * medição de bytes ficam em `scripts/build-word-study-index.ts`, porque exigem
 * `node:crypto` e `node:zlib`.
 */

import {
  type IdentityPolicy,
  type LexicalIdentity,
  type WordStudyLanguage,
  compareIdentities,
  identitySortKey,
} from "./identity.ts";
import { type CanonicalRef, decodeRefCode, formatRef, refCode } from "./reference.ts";

export const WORD_STUDY_INDEX_FORMAT = "word-study-inverted/1";

/** Uma ocorrência, reduzida ao mínimo que a identifica. */
export type IndexOccurrence = {
  readonly ref: CanonicalRef;
  /** `null` quando a fonte não publica a posição da palavra. */
  readonly position: number | null;
};

/** Entrada do índice: uma identidade e todas as suas ocorrências. */
export type Posting = {
  readonly identity: LexicalIdentity;
  /** Ordenada canonicamente, e por posição dentro do mesmo versículo. */
  readonly occurrences: readonly IndexOccurrence[];
};

/** Crédito de uma fonte, uma vez por índice. */
export type SourceAttribution = {
  readonly sourceId: string;
  readonly assetPath: string;
  /** SHA-256 dos bytes efetivamente lidos. */
  readonly assetSha256: string;
  /** Pino legível: `commit <sha>` ou `tag x / commit <sha>`. */
  readonly pin: string;
  readonly licenseDeclared: string;
  readonly attribution: string;
};

/**
 * O que o índice cobre — e, sobretudo, o que **não** cobre. Existe porque a
 * promessa do produto é "usos em toda a Bíblia" e o dado real é parcial; dizer
 * isso é requisito, não cortesia.
 */
export type Coverage = {
  readonly languages: readonly WordStudyLanguage[];
  readonly identities: number;
  readonly occurrences: number;
  /** Livros com ao menos uma ocorrência, em ordem canônica. */
  readonly booksPresent: readonly string[];
  /** Livros do cânone de 66 sem nenhuma ocorrência, em ordem canônica. */
  readonly booksAbsent: readonly string[];
  /** Referências distintas alcançadas. */
  readonly refsPresent: number;
};

export type IndexHeader = {
  readonly format: typeof WORD_STUDY_INDEX_FORMAT;
  /** Versão do conteúdo deste índice, declarada por quem o monta. */
  readonly indexVersion: string;
  readonly identityVersion: string;
  readonly identityMode: IdentityPolicy["mode"];
  /** `null` quando não há mapa de redução — a lacuna fica explícita. */
  readonly foldMapSource: string | null;
  readonly sources: readonly SourceAttribution[];
  readonly coverage: Coverage;
  /**
   * Limitações conhecidas, em texto, para serem exibidas junto do resultado.
   * Lista vazia significa "nenhuma limitação declarada", o que deve ser raro e
   * suspeito enquanto a cobertura for parcial.
   */
  readonly limitations: readonly string[];
};

export type PartitionPlan = {
  readonly ordinal: number;
  /** Chave legível da primeira/última postagem, para leitura humana. */
  readonly firstKey: string;
  readonly lastKey: string;
  /**
   * Limites de **ordenação** (ver `identitySortKey`). São estes que o cliente
   * compara, porque comparar a chave legível como texto poria `hbo:H10` antes
   * de `hbo:H9` e faria a consulta ler a partição errada.
   */
  readonly firstSortKey: string;
  readonly lastSortKey: string;
  readonly postings: readonly Posting[];
  readonly occurrences: number;
  /** `true` quando a partição existe só para abrigar uma postagem gigante. */
  readonly oversized: boolean;
};

export type BuildProblem = { readonly at: string; readonly reason: string };

export type BuildResult = {
  readonly postings: readonly Posting[];
  readonly coverage: Coverage;
  readonly problems: readonly BuildProblem[];
};

/** Entrada crua do construtor: já validada por quem leu a fonte. */
export type OccurrenceInput = {
  readonly identity: LexicalIdentity;
  readonly ref: CanonicalRef;
  readonly position: number | null;
  /**
   * Identificador estável da fonte. Serve só para deduplicar: duas linhas com o
   * mesmo `sourceWordId` são a mesma ocorrência lida duas vezes, e contá-la
   * duas vezes inflaria a contagem de usos.
   */
  readonly sourceWordId: string;
};

const CANON_ORDER_CACHE: { value: readonly string[] | null } = { value: null };

function canonCodes(): readonly string[] {
  if (CANON_ORDER_CACHE.value === null) {
    const codes: string[] = [];
    for (let order = 1; order <= 66; order += 1) {
      // `decodeRefCode` conhece a ordem do cânone; 1:1 existe em todo livro.
      const ref = decodeRefCode(order * 1_000_000 + 1_001);
      if (ref) codes.push(ref.book);
    }
    CANON_ORDER_CACHE.value = codes;
  }
  return CANON_ORDER_CACHE.value;
}

function compareOccurrences(left: IndexOccurrence, right: IndexOccurrence): number {
  const byRef = refCode(left.ref) - refCode(right.ref);
  if (byRef !== 0) return byRef;
  // Posição ausente vai depois da presente, para que a ordem seja total mesmo
  // quando a fonte não publica posição em parte das linhas.
  if (left.position === null && right.position === null) return 0;
  if (left.position === null) return 1;
  if (right.position === null) return -1;
  return left.position - right.position;
}

/**
 * Monta o índice. Determinístico: mesma entrada, mesma saída, byte a byte —
 * ordenação total, nenhuma iteração dependente de inserção, nenhum relógio.
 *
 * Deduplica por `sourceWordId`, e relata a duplicata em vez de absorvê-la em
 * silêncio: no hebraico, a mesma referência aparece legitimamente várias vezes
 * (um morfema por linha), então só o identificador da fonte distingue
 * "ocorrência diferente" de "linha lida duas vezes".
 */
export function buildInvertedIndex(inputs: readonly OccurrenceInput[]): BuildResult {
  const byKey = new Map<string, { identity: LexicalIdentity; occurrences: IndexOccurrence[] }>();
  const problems: BuildProblem[] = [];
  const seenWordIds = new Set<string>();
  const refs = new Set<number>();
  const books = new Set<string>();
  const languages = new Set<WordStudyLanguage>();
  let occurrences = 0;

  for (const input of inputs) {
    if (seenWordIds.has(input.sourceWordId)) {
      problems.push({
        at: input.sourceWordId,
        reason: "identificador de ocorrência repetido; linha ignorada",
      });
      continue;
    }
    seenWordIds.add(input.sourceWordId);

    const bucket = byKey.get(input.identity.key);
    const occurrence: IndexOccurrence = { ref: input.ref, position: input.position };
    if (bucket) bucket.occurrences.push(occurrence);
    else byKey.set(input.identity.key, { identity: input.identity, occurrences: [occurrence] });

    refs.add(refCode(input.ref));
    books.add(input.ref.book);
    languages.add(input.identity.language);
    occurrences += 1;
  }

  const postings: Posting[] = [...byKey.values()]
    .map((bucket) => ({
      identity: bucket.identity,
      occurrences: [...bucket.occurrences].sort(compareOccurrences),
    }))
    .sort((left, right) => compareIdentities(left.identity, right.identity));

  const present = canonCodes().filter((code) => books.has(code));
  const absent = canonCodes().filter((code) => !books.has(code));

  return {
    postings,
    coverage: {
      languages: [...languages].sort(),
      identities: postings.length,
      occurrences,
      booksPresent: present,
      booksAbsent: absent,
      refsPresent: refs.size,
    },
    problems,
  };
}

export class PartitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartitionError";
  }
}

/**
 * Corta o índice em partições por intervalo de chave.
 *
 * O orçamento é em **ocorrências**, não em postagens: é o que determina o
 * tamanho em bytes, e postagens variam de 1 a dezenas de milhares de
 * ocorrências. Uma postagem nunca é partida, porque o invariante que faz o
 * custo em celular ser previsível é "uma consulta lê uma partição".
 */
export function planPartitions(
  postings: readonly Posting[],
  options: { readonly occurrenceBudget: number },
): readonly PartitionPlan[] {
  const budget = options.occurrenceBudget;
  if (!Number.isSafeInteger(budget) || budget <= 0) {
    throw new PartitionError(`orçamento de ocorrências inválido: ${String(budget)}`);
  }
  const plans: PartitionPlan[] = [];
  let current: Posting[] = [];
  let currentCount = 0;

  const flush = (oversized: boolean): void => {
    if (current.length === 0) return;
    const first = current[0]?.identity;
    const last = current[current.length - 1]?.identity;
    plans.push({
      ordinal: plans.length,
      firstKey: first?.key ?? "",
      lastKey: last?.key ?? "",
      firstSortKey: first ? identitySortKey(first) : "",
      lastSortKey: last ? identitySortKey(last) : "",
      postings: current,
      occurrences: currentCount,
      oversized,
    });
    current = [];
    currentCount = 0;
  };

  for (const posting of postings) {
    const size = posting.occurrences.length;
    // Postagem que sozinha passa do orçamento ganha partição própria, declarada.
    // Alternativa seria partir a lista, e aí consultar uma palavra comum
    // passaria a custar várias leituras — exatamente o que se quer evitar.
    if (size > budget) {
      flush(false);
      current = [posting];
      currentCount = size;
      flush(true);
      continue;
    }
    if (currentCount + size > budget) flush(false);
    current.push(posting);
    currentCount += size;
  }
  flush(false);
  return plans;
}

/**
 * Vetor plano de inteiros com `refCode` em delta. Primeiro valor absoluto, os
 * seguintes como diferença; posição `null` vira `0`, que é inequívoco porque
 * posição real é sempre ≥ 1.
 */
export function encodeOccurrences(occurrences: readonly IndexOccurrence[]): readonly number[] {
  const out: number[] = [];
  let previous = 0;
  for (const occurrence of occurrences) {
    const code = refCode(occurrence.ref);
    out.push(previous === 0 ? code : code - previous, occurrence.position ?? 0);
    previous = code;
  }
  return out;
}

export function decodeOccurrences(encoded: readonly number[]): readonly IndexOccurrence[] | null {
  if (encoded.length % 2 !== 0) return null;
  const out: IndexOccurrence[] = [];
  let previous = 0;
  for (let index = 0; index < encoded.length; index += 2) {
    const delta = encoded[index] ?? 0;
    const position = encoded[index + 1] ?? 0;
    const code = previous === 0 ? delta : previous + delta;
    const ref = decodeRefCode(code);
    if (!ref) return null;
    out.push({ ref, position: position === 0 ? null : position });
    previous = code;
  }
  return out;
}

/**
 * Serializa uma partição como NDJSON, uma postagem por linha, na ordem do
 * plano. NDJSON e não um único JSON porque o índice real não cabe numa string
 * do V8 — é a mesma razão que levou `lexiconIndexLines` a usar gerador.
 */
export function* partitionLines(plan: PartitionPlan): Generator<string> {
  for (const posting of plan.postings) {
    yield `${JSON.stringify({
      k: posting.identity.key,
      n: posting.occurrences.length,
      r: encodeOccurrences(posting.occurrences),
    })}\n`;
  }
}

/** Estatística de uma partição gravada, preenchida pelo script que grava. */
export type PartitionStat = {
  readonly ordinal: number;
  readonly file: string;
  readonly firstKey: string;
  readonly lastKey: string;
  readonly firstSortKey: string;
  readonly lastSortKey: string;
  readonly postings: number;
  readonly occurrences: number;
  readonly oversized: boolean;
  readonly bytes: number;
  readonly gzipBytes: number;
  readonly sha256: string;
};

/**
 * Manifesto: cabeçalho, limitações e a tabela de partições. É o único arquivo
 * que o cliente precisa ler inteiro; a partir dele ele escolhe **uma** partição
 * por intervalo de chave.
 *
 * Serialização estável: chaves em ordem fixa e nenhum dado de relógio, para que
 * reprocessar os mesmos bytes devolva o mesmo hash. O tempo de geração é
 * relatado pelo script, fora do manifesto, exatamente para não quebrar isso.
 */
export function serializeManifest(
  header: IndexHeader,
  partitions: readonly PartitionStat[],
): string {
  return `${JSON.stringify({ header, partitions }, null, 2)}\n`;
}

/**
 * Qual partição atende uma identidade. `null` quando ela está fora do índice —
 * que é resposta legítima e diferente de "sem índice" e de "erro".
 *
 * Recebe a identidade, e não a chave em texto, de propósito: a comparação é
 * feita sobre `identitySortKey`, a única que ordena canonicamente. Aceitar uma
 * string aqui convidaria o chamador a passar `hbo:H9` e ler a partição errada.
 */
export function partitionForIdentity(
  partitions: readonly PartitionStat[],
  identity: LexicalIdentity,
): PartitionStat | null {
  const sortKey = identitySortKey(identity);
  for (const partition of partitions) {
    if (sortKey >= partition.firstSortKey && sortKey <= partition.lastSortKey) return partition;
  }
  return null;
}

/** Referências legíveis de uma postagem, para conferência manual. */
export function postingRefs(posting: Posting): readonly string[] {
  return posting.occurrences.map((occurrence) =>
    occurrence.position === null
      ? formatRef(occurrence.ref)
      : `${formatRef(occurrence.ref)}!${String(occurrence.position)}`,
  );
}
