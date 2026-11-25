/**
 * Registros lexicais normalizados (LEXICON-INDEX-001, fila C30).
 *
 * A unidade é o **lema**, não o versículo: definição, transliteração e campo
 * semântico são importados uma vez e reutilizados em todas as ocorrências.
 * A ocorrência guarda só o que é dela — forma, morfologia, referência, edição e
 * eventual sentido contextual — e aponta para o verbete por chave.
 *
 * Duas decisões que o tipo faz valer:
 *
 * 1. **Proveniência por campo, não por registro.** Um mesmo verbete pode ter a
 *    transliteração de uma fonte e a definição de outra. Guardar uma única
 *    linha de crédito no registro inteiro tornaria a atribuição imprecisa
 *    justamente onde a licença exige precisão.
 * 2. **Determinismo.** Mesma entrada produz exatamente a mesma saída, byte a
 *    byte: ordenação total, nada de `Date.now()`, nada de iteração dependente
 *    de inserção. Sem isso não existe reprocessamento idempotente nem
 *    comparação de diferença entre duas coletas.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco.
 */

import type { LexiconLanguage } from "./source-registry.ts";

/** De onde veio **este campo**, com a versão exata da fonte. */
export type FieldProvenance = {
  readonly sourceId: string;
  /** Caminho local do arquivo lido, relativo ao diretório da fonte. */
  readonly assetPath: string;
  /** Pino legível da versão: `commit <sha>` ou `tag x / commit <sha>`. */
  readonly pin: string;
  /** SHA-256 dos bytes efetivamente lidos. */
  readonly assetSha256: string;
  readonly licenseDeclared: string;
  readonly attribution: string;
  /** Nome do campo no arquivo da fonte. */
  readonly sourceField: string;
};

export type ProvenancedValue = {
  readonly value: string;
  readonly provenance: FieldProvenance;
};

/**
 * Chave do verbete: idioma + identificador do lema. O identificador é o Strong
 * estendido quando existe, porque é o que MACULA, MorphHB, OSHB e STEPBible têm
 * em comum; quando não existe, é o próprio lema normalizado, prefixado para não
 * colidir com um Strong.
 */
export type LexemeKey = string;

export function strongLexemeKey(language: LexiconLanguage, strongId: string): LexemeKey {
  const trimmed = strongId.trim();
  if (trimmed.length === 0) throw new Error("strongId vazio");
  // A fonte publica "H7225", "7225", "G0001", "G1" e variantes com sufixo de
  // homógrafo ("1254 a"). Normalizar o zero à esquerda e o espaço, preservando
  // o sufixo, evita que a mesma palavra vire dois verbetes.
  const match = /^([HG])?0*(\d+)\s*([a-z])?$/iu.exec(trimmed);
  if (!match) return `${language}:lemma:${trimmed}`;
  const prefix = language === "hbo" ? "H" : "G";
  const number = match[2] ?? "";
  const suffix = (match[3] ?? "").toLowerCase();
  return `${language}:${prefix}${number}${suffix}`;
}

export function lemmaLexemeKey(language: LexiconLanguage, lemma: string): LexemeKey {
  const trimmed = lemma.trim();
  if (trimmed.length === 0) throw new Error("lema vazio");
  return `${language}:lemma:${trimmed.normalize("NFC")}`;
}

/** Verbete normalizado: o que a palavra **pode** significar. */
export type NormalizedLexemeEntry = {
  readonly key: LexemeKey;
  readonly language: LexiconLanguage;
  /** Identificador canônico exibível, ex. "H7225". `null` quando só há lema. */
  readonly strongId: string | null;
  readonly lemma: ProvenancedValue;
  readonly transliteration: ProvenancedValue | null;
  readonly partOfSpeech: ProvenancedValue | null;
  readonly glosses: readonly ProvenancedValue[];
  readonly definitions: readonly ProvenancedValue[];
  readonly etymology: ProvenancedValue | null;
  /**
   * Tradução editorial em português. Sempre vazio nesta frente: traduzir é
   * trabalho separado, com revisão humana (ver `translation-workflow.ts`).
   */
  readonly translations: readonly never[];
};

/** Ocorrência normalizada: que sentido a palavra assume **aqui**. */
export type NormalizedOccurrence = {
  readonly sourceWordId: string;
  readonly language: LexiconLanguage;
  readonly canonicalRef: string;
  /**
   * Posição da palavra dentro do versículo, 1-based, tirada do sufixo `!N` da
   * referência da fonte. `null` quando a fonte não publica a posição.
   *
   * Existe porque o MACULA Hebrew é **morfêmico**: `GEN 1:1!1` aparece duas
   * vezes, uma para a preposição בְּ e outra para o substantivo רֵאשִׁית. São
   * 11 linhas para as 7 palavras que o leitor mostra. Sem a posição, não há
   * como devolver "os morfemas da palavra 1" — e o leitor é indexado por
   * palavra, não por morfema.
   */
  readonly wordPosition: number | null;
  readonly surface: string;
  /**
   * Glossa contextual publicada pela fonte, em inglês, para **esta**
   * ocorrência. É o texto-fonte da tradução editorial para pt-BR.
   *
   * Vive na ocorrência, e não no verbete, porque muda com o contexto: o mesmo
   * lema aparece como "he.created" e "to create". O verbete responde o que a
   * palavra pode significar; a glossa responde o que ela diz aqui.
   */
  readonly gloss: string | null;
  readonly lexemeKey: LexemeKey;
  readonly lemma: string;
  readonly morphology: string | null;
  readonly partOfSpeech: string | null;
  readonly semanticDomain: string | null;
  /**
   * Acepção no Semantic Dictionary of Biblical Hebrew, quando a fonte a anota.
   * Diferente de `semanticDomain`: este **nomeia** o sentido que a palavra
   * assume aqui, enquanto o domínio dá apenas a categoria estável do lema.
   */
  readonly sdbhSense: string | null;
  readonly lexicalDomain: string | null;
  readonly senseNumber: string | null;
  readonly semanticFrame: string | null;
  readonly provenance: FieldProvenance;
};

/**
 * Sentido do BDB, com a hierarquia preservada.
 *
 * A árvore é o valor da obra. `רוּם` tem sentidos de primeiro nível por tronco
 * verbal (Qal, Pō‛lēl, Hiphil), cada um com sentidos numerados dentro, e esses
 * com subsentidos `a`, `b`, `(1)`, `(2)` — até cinco níveis. Um sentido de
 * terceiro nível sob Hiphil **não** significa o mesmo que um de primeiro nível:
 * achatar transformaria lexicografia em lista de sinônimos.
 *
 * `number` é a numeração como a obra a publica, e não um índice nosso: a fonte
 * mistura "1", "a" e "(1)" de propósito, para marcar o nível. `null` acontece
 * no sentido que só agrupa um tronco verbal e não recebe número.
 */
export type BdbSense = {
  readonly number: string | null;
  /** Tronco verbal que agrupa os sentidos abaixo (Qal, Hiphil, …). */
  readonly stem: string | null;
  /** Definições deste nível, na ordem em que a obra as traz. */
  readonly definitions: readonly string[];
  /** Prosa do nível, sem a marcação interna, quando há. */
  readonly note: string | null;
  readonly children: readonly BdbSense[];
};

/** Verbete do BDB. A chave é o id da obra, não o Strong. */
export type NormalizedBdbEntry = {
  readonly bdbId: string;
  readonly lemma: ProvenancedValue;
  readonly partOfSpeech: ProvenancedValue | null;
  /** Definições do topo do verbete, antes de qualquer sentido. */
  readonly definitions: readonly ProvenancedValue[];
  /** `true` para verbete de raiz (`type="root"`). */
  readonly isRoot: boolean;
  readonly senses: readonly BdbSense[];
};

/**
 * Ponte entre o lema aumentado, o Strong e o verbete do BDB.
 *
 * É o que torna o BDB alcançável: a ocorrência traz o Strong, não o id da obra.
 * Sem esta ligação, as 8.989 acepções seriam um dicionário que ninguém atinge.
 * `lexemeKey` é nulo quando o índice não publica Strong para aquele lema — a
 * ausência é informação, e inventar um Strong plausível é o erro que o próprio
 * `LexicalIndex.xml` existe para evitar.
 */
export type NormalizedBdbLink = {
  readonly lexemeKey: LexemeKey | null;
  readonly bdbId: string;
  readonly augmentedLemma: string;
  readonly provenance: FieldProvenance;
};

/** Quantos sentidos a árvore tem, somando todos os níveis. */
export function countSenses(senses: readonly BdbSense[]): number {
  return senses.reduce((total, sense) => total + 1 + countSenses(sense.children), 0);
}

/** Profundidade máxima da árvore; 0 para verbete sem sentido declarado. */
export function senseDepth(senses: readonly BdbSense[]): number {
  return senses.reduce((deepest, sense) => Math.max(deepest, 1 + senseDepth(sense.children)), 0);
}

export type ParseIssue = {
  /** Linha do arquivo (1-based) ou identificador do registro problemático. */
  readonly at: string;
  readonly reason: string;
};

export type LexiconParseResult = {
  readonly sourceId: string;
  readonly entries: readonly NormalizedLexemeEntry[];
  readonly occurrences: readonly NormalizedOccurrence[];
  /** Campos presentes no arquivo que não estavam declarados e foram ignorados. */
  readonly ignoredFields: readonly string[];
  readonly issues: readonly ParseIssue[];
};

function compareProvenanced(left: ProvenancedValue, right: ProvenancedValue): number {
  return (
    left.provenance.sourceId.localeCompare(right.provenance.sourceId) ||
    left.provenance.sourceField.localeCompare(right.provenance.sourceField) ||
    left.value.localeCompare(right.value)
  );
}

function dedupe(values: readonly ProvenancedValue[]): readonly ProvenancedValue[] {
  const seen = new Map<string, ProvenancedValue>();
  for (const item of values) {
    const key = `${item.provenance.sourceId}\u001f${item.provenance.sourceField}\u001f${item.value}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  return [...seen.values()].sort(compareProvenanced);
}

/**
 * Funde dois verbetes do mesmo lema vindos de fontes diferentes. Determinístico
 * e idempotente: `merge(a, a) === a` e `merge(a, b) === merge(b, a)` quanto ao
 * conteúdo, porque listas são deduplicadas e ordenadas, e campos únicos seguem
 * uma regra fixa — a primeira fonte em ordem alfabética de `sourceId` vence,
 * para que a escolha não dependa da ordem de leitura dos arquivos.
 */
export function mergeLexemeEntries(
  left: NormalizedLexemeEntry,
  right: NormalizedLexemeEntry,
): NormalizedLexemeEntry {
  if (left.key !== right.key) {
    throw new Error(`fusão entre verbetes de chaves diferentes: ${left.key} e ${right.key}`);
  }
  const pickSingle = (
    a: ProvenancedValue | null,
    b: ProvenancedValue | null,
  ): ProvenancedValue | null => {
    if (!a) return b;
    if (!b) return a;
    return compareProvenanced(a, b) <= 0 ? a : b;
  };
  const lemma = pickSingle(left.lemma, right.lemma);
  if (!lemma) throw new Error(`verbete ${left.key} sem lema após fusão`);
  return {
    key: left.key,
    language: left.language,
    strongId: left.strongId ?? right.strongId,
    lemma,
    transliteration: pickSingle(left.transliteration, right.transliteration),
    partOfSpeech: pickSingle(left.partOfSpeech, right.partOfSpeech),
    glosses: dedupe([...left.glosses, ...right.glosses]),
    definitions: dedupe([...left.definitions, ...right.definitions]),
    etymology: pickSingle(left.etymology, right.etymology),
    translations: [],
  };
}

/**
 * Índice lexical final: verbetes únicos por chave, ordenados. Reexecutar sobre
 * a mesma entrada devolve exatamente o mesmo resultado.
 */
export function buildLexemeIndex(
  entries: readonly NormalizedLexemeEntry[],
): readonly NormalizedLexemeEntry[] {
  const byKey = new Map<LexemeKey, NormalizedLexemeEntry>();
  for (const entry of entries) {
    const existing = byKey.get(entry.key);
    byKey.set(entry.key, existing ? mergeLexemeEntries(existing, entry) : normalizeEntry(entry));
  }
  return [...byKey.values()]
    .map(normalizeEntry)
    .sort((left, right) => left.key.localeCompare(right.key));
}

function normalizeEntry(entry: NormalizedLexemeEntry): NormalizedLexemeEntry {
  return {
    ...entry,
    glosses: dedupe(entry.glosses),
    definitions: dedupe(entry.definitions),
    translations: [],
  };
}

export function sortOccurrences(
  occurrences: readonly NormalizedOccurrence[],
): readonly NormalizedOccurrence[] {
  return [...occurrences].sort(
    (left, right) =>
      left.canonicalRef.localeCompare(right.canonicalRef) ||
      left.sourceWordId.localeCompare(right.sourceWordId),
  );
}

/**
 * Ocorrências agrupadas por verbete — é esta estrutura que substitui o mapa
 * manual de Gênesis 1:1 em `src/domain/word-analysis.ts`, porque liga qualquer
 * ocorrência ao verbete sem duplicar o verbete.
 */
export function occurrencesByLexeme(
  occurrences: readonly NormalizedOccurrence[],
): ReadonlyMap<LexemeKey, readonly NormalizedOccurrence[]> {
  const grouped = new Map<LexemeKey, NormalizedOccurrence[]>();
  for (const occurrence of sortOccurrences(occurrences)) {
    const bucket = grouped.get(occurrence.lexemeKey);
    if (bucket) bucket.push(occurrence);
    else grouped.set(occurrence.lexemeKey, [occurrence]);
  }
  return new Map([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Ocorrência que aponta para verbete inexistente é pendência, não erro fatal:
 * a MACULA cobre o corpus inteiro e o verbete pode faltar numa coleta parcial.
 * O leitor, nesse caso, mostra "dados lexicais ainda não disponíveis".
 */
export function danglingOccurrences(
  occurrences: readonly NormalizedOccurrence[],
  entries: readonly NormalizedLexemeEntry[],
): readonly NormalizedOccurrence[] {
  const known = new Set(entries.map((entry) => entry.key));
  return sortOccurrences(occurrences.filter((item) => !known.has(item.lexemeKey)));
}

/** Serialização estável, para gravar em disco e comparar entre execuções. */
export function serializeLexiconIndex(
  entries: readonly NormalizedLexemeEntry[],
  occurrences: readonly NormalizedOccurrence[],
): string {
  return `${JSON.stringify(
    { entries: buildLexemeIndex(entries), occurrences: sortOccurrences(occurrences) },
    null,
    2,
  )}\n`;
}

/**
 * Mesma saída, linha a linha, para o corpus inteiro.
 *
 * `serializeLexiconIndex` monta um único JSON e serve para conjuntos pequenos —
 * é o que os testes usam. Contra os dados reais ela não serve: 19.521 verbetes
 * e 607.217 ocorrências com proveniência por campo passam do comprimento máximo
 * de string do V8, e `JSON.stringify` termina em `Invalid string length` depois
 * de já ter feito todo o trabalho.
 *
 * Aqui cada registro é uma linha de JSON independente (NDJSON), emitida por um
 * gerador, de modo que nada precisa existir inteiro em memória como texto. A
 * ordem é a mesma das funções de ordenação, então a saída continua
 * determinística e comparável byte a byte entre execuções.
 */
export function* lexiconIndexLines(
  entries: readonly NormalizedLexemeEntry[],
  occurrences: readonly NormalizedOccurrence[],
  bdb: readonly NormalizedBdbEntry[] = [],
  bdbLinks: readonly NormalizedBdbLink[] = [],
): Generator<string> {
  for (const entry of buildLexemeIndex(entries)) {
    yield `${JSON.stringify({ type: "entry", ...entry })}\n`;
  }
  // Ordenado pelo id da obra, que é estável e já ordena por seção.
  for (const entry of [...bdb].sort((left, right) => left.bdbId.localeCompare(right.bdbId))) {
    yield `${JSON.stringify({ type: "bdb", ...entry })}\n`;
  }
  for (const link of [...bdbLinks].sort(
    (left, right) =>
      left.bdbId.localeCompare(right.bdbId) ||
      (left.lexemeKey ?? "").localeCompare(right.lexemeKey ?? ""),
  )) {
    yield `${JSON.stringify({ type: "bdb_link", ...link })}\n`;
  }
  for (const occurrence of sortOccurrences(occurrences)) {
    yield `${JSON.stringify({ type: "occurrence", ...occurrence })}\n`;
  }
}
