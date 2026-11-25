/**
 * Geração de candidatos de alinhamento (ALIGNMENT-PIPELINE-001, A1).
 *
 * Como o alinhamento é obtido, em uma frase: **a ponte lexical propõe, a
 * estrutura da palavra original agrupa, a ambiguidade vai para revisão.** Em
 * nenhum momento a posição do token decide uma equivalência.
 *
 * O procedimento, na ordem em que roda:
 *
 * 1. A tradução é tokenizada (`tokenizer.ts`), sem marcação USFM.
 * 2. Cada unidade original procura entradas de ponte pelo gancho mais
 *    específico que tiver resultado — ocorrência, verbete, Strong, glossa.
 * 3. Entradas de **classe aberta** (substantivo, verbo, adjetivo, nome próprio)
 *    propõem ligações. A expressão em português é buscada como sequência de
 *    tokens, o que produz 1:N naturalmente: "in.beginning" → "no princípio".
 * 4. Hipóteses sem ambiguidade são fundidas em componentes conexos. Duas
 *    palavras originais que apontam para o **mesmo** trecho da tradução caem no
 *    mesmo grupo — é daí que sai N:1, como בֵּית + לֶחֶם → "Belém", sem que
 *    nenhuma das duas tenha sido escolhida por estar na posição 2 ou 3.
 * 5. Entradas de **classe fechada** (artigo, preposição, conjunção, pronome)
 *    não criam grupo: só estendem um grupo já estabelecido por uma palavra de
 *    conteúdo da mesma palavra original, e só para token contíguo ao trecho já
 *    ligado. A contiguidade aqui não cria equivalência nenhuma — ela limita uma
 *    equivalência que já existe, impedindo que o artigo "the" se ligue a
 *    qualquer "a" do versículo.
 * 6. Quando a mesma palavra original casa em mais de um trecho, o pipeline
 *    **não escolhe**: emite um candidato por trecho, marcado para revisão, com
 *    as chaves concorrentes registradas.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco.
 */

import {
  type AlignmentCandidateGroup,
  type AlignmentEvidence,
  type AlignmentInputBundle,
  type AlignmentMethod,
  type BridgeEntry,
  type BridgeStatus,
  type CanonicalAnchor,
  type OriginalUnit,
  type TranslationToken,
  type VerseAlignmentInput,
  type VerseCandidateResult,
  assertAlignmentBundle,
  anchorRef,
  bridgeSubjectLabel,
  compareAnchors,
} from "./contracts.ts";
import { findPhraseSpans, tokenizeTranslationVerse } from "./tokenizer.ts";

export type CandidateOptions = {
  /** Abaixo disto, o candidato vai para a fila editorial. */
  readonly reviewThreshold: number;
  /** Estados de ponte aceitos como fonte de candidato. */
  readonly acceptedBridgeStatuses: readonly BridgeStatus[];
  /**
   * Emitir candidato de lacuna para palavra original sem nenhuma ponte.
   * Ligado por padrão: é a lista de trabalho de quem vai estender a ponte.
   */
  readonly emitUnalignedOriginals: boolean;
};

export const DEFAULT_CANDIDATE_OPTIONS: CandidateOptions = {
  reviewThreshold: 0.8,
  // `machine_draft` fica de fora por padrão, pela mesma razão do fluxo lexical:
  // rascunho de máquina não deve alimentar nada que possa ser publicado.
  acceptedBridgeStatuses: ["approved", "human_reviewed"],
  emitUnalignedOriginals: true,
};

/** Força base por tipo de ponte. Documentada para a confiança ser auditável. */
const KIND_BASE: Readonly<Record<BridgeEntry["kind"], number>> = {
  editorial_seed: 0.95,
  proper_noun: 0.9,
  no_equivalent: 0.9,
  approved_translation: 0.85,
};

/** Peso do estado de revisão da entrada de ponte. */
const STATUS_FACTOR: Readonly<Record<BridgeStatus, number>> = {
  approved: 1,
  human_reviewed: 0.75,
  machine_draft: 0.4,
};

/** Confiança de palavra original coberta só por morfema funcional. */
const FUNCTION_ONLY_BASE = 0.45;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function glossKey(gloss: string): string {
  return gloss.trim().toLowerCase();
}

type BridgeIndex = {
  readonly byUnit: ReadonlyMap<string, readonly BridgeEntry[]>;
  readonly byLexeme: ReadonlyMap<string, readonly BridgeEntry[]>;
  readonly byStrong: ReadonlyMap<string, readonly BridgeEntry[]>;
  readonly byGloss: ReadonlyMap<string, readonly BridgeEntry[]>;
};

function push(map: Map<string, BridgeEntry[]>, key: string, entry: BridgeEntry): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(entry);
  else map.set(key, [entry]);
}

export function indexBridge(
  bridge: readonly BridgeEntry[],
  accepted: readonly BridgeStatus[],
): BridgeIndex {
  const byUnit = new Map<string, BridgeEntry[]>();
  const byLexeme = new Map<string, BridgeEntry[]>();
  const byStrong = new Map<string, BridgeEntry[]>();
  const byGloss = new Map<string, BridgeEntry[]>();
  for (const entry of bridge) {
    if (!accepted.includes(entry.status)) continue;
    switch (entry.subject.kind) {
      case "unit":
        push(byUnit, entry.subject.unitId, entry);
        break;
      case "lexeme":
        push(byLexeme, entry.subject.lexemeKey, entry);
        break;
      case "strong":
        push(byStrong, entry.subject.strongId, entry);
        break;
      case "gloss":
        push(byGloss, glossKey(entry.subject.gloss), entry);
        break;
    }
  }
  return { byUnit, byLexeme, byStrong, byGloss };
}

/**
 * Entradas aplicáveis a uma unidade, do gancho mais específico para o mais
 * genérico, parando no primeiro nível que produz resultado.
 *
 * A ordem não é estética: uma decisão tomada para **aquela ocorrência** tem de
 * vencer a tradução genérica do lema, e a tradução do lema tem de vencer a da
 * glossa, que é o gancho mais frouxo de todos.
 */
function applicableEntries(unit: OriginalUnit, index: BridgeIndex): readonly BridgeEntry[] {
  const levels: readonly (readonly BridgeEntry[])[] = [
    index.byUnit.get(unit.unitId) ?? [],
    unit.lexemeKey ? index.byLexeme.get(unit.lexemeKey) ?? [] : [],
    unit.strongId ? index.byStrong.get(unit.strongId) ?? [] : [],
    unit.gloss ? index.byGloss.get(glossKey(unit.gloss)) ?? [] : [],
  ];
  for (const level of levels) {
    if (level.length > 0) return level;
  }
  return [];
}

type Hypothesis = {
  readonly wordPosition: number;
  readonly unit: OriginalUnit;
  readonly entry: BridgeEntry;
  readonly span: readonly number[];
  /** Quantos trechos distintos a palavra original propôs. */
  readonly spanCount: number;
};

function spanId(span: readonly number[]): string {
  return span.join(",");
}

function methodOf(entry: BridgeEntry): AlignmentMethod {
  switch (entry.kind) {
    case "editorial_seed":
      return "editorial_seed";
    case "proper_noun":
      return "proper_noun_translation";
    case "no_equivalent":
      return "declared_no_equivalent";
    case "approved_translation":
      return "approved_gloss_translation";
  }
}

function evidenceOf(
  hypothesis: Hypothesis,
  method: AlignmentMethod,
  detail: string,
): AlignmentEvidence {
  return {
    method,
    unitIds: [hypothesis.unit.unitId],
    translationTokenPositions: [...hypothesis.span],
    bridgeSubject: bridgeSubjectLabel(hypothesis.entry.subject),
    bridgeKind: hypothesis.entry.kind,
    bridgeStatus: hypothesis.entry.status,
    detail,
  };
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  find(node: string): string {
    const current = this.parent.get(node);
    if (current === undefined) {
      this.parent.set(node, node);
      return node;
    }
    if (current === node) return node;
    const root = this.find(current);
    this.parent.set(node, root);
    return root;
  }

  union(left: string, right: string): void {
    const a = this.find(left);
    const b = this.find(right);
    if (a !== b) this.parent.set(a, b);
  }
}

type Draft = {
  words: Set<number>;
  tokens: Set<number>;
  units: Set<string>;
  evidence: AlignmentEvidence[];
  methods: Set<AlignmentMethod>;
  base: number;
  ambiguitySpans: number;
  competing: string[];
};

function keyFor(
  anchor: CanonicalAnchor,
  words: readonly number[],
  forms: readonly string[],
  used: Map<string, number>,
): string {
  // A chave não usa posição de token: usa as formas normalizadas. Isso a faz
  // sobreviver a uma reedição que mexa em pontuação ou acrescente palavra
  // antes do trecho, e é o que permite reaproveitar a decisão editorial depois
  // de um reprocessamento.
  const base = `${anchorRef(anchor)}#w${words.join("+")}#${forms.join("_") || "sem-token"}`;
  const seen = used.get(base) ?? 0;
  used.set(base, seen + 1);
  return seen === 0 ? base : `${base}~${seen + 1}`;
}

function tokensOf(
  positions: Iterable<number>,
  tokens: readonly TranslationToken[],
): readonly TranslationToken[] {
  const wanted = new Set(positions);
  return tokens.filter((token) => wanted.has(token.position));
}

/**
 * Candidatos de um versículo.
 *
 * Determinística: ordenações totais em toda saída, nenhuma dependência de ordem
 * de inserção em `Map`/`Set` que não seja ordenada depois.
 */
export function generateVerseCandidates(
  verse: VerseAlignmentInput,
  bridge: readonly BridgeEntry[],
  options: CandidateOptions = DEFAULT_CANDIDATE_OPTIONS,
): VerseCandidateResult {
  const tokens = tokenizeTranslationVerse(verse.translationText);
  const index = indexBridge(bridge, options.acceptedBridgeStatuses);
  const units = [...verse.units].sort(
    (left, right) =>
      left.wordPosition - right.wordPosition ||
      left.morphemePosition - right.morphemePosition ||
      left.unitId.localeCompare(right.unitId),
  );

  const words = new Map<number, OriginalUnit[]>();
  for (const unit of units) {
    const bucket = words.get(unit.wordPosition);
    if (bucket) bucket.push(unit);
    else words.set(unit.wordPosition, [unit]);
  }
  const wordPositions = [...words.keys()].sort((left, right) => left - right);

  // --- 1. hipóteses ---------------------------------------------------------
  const openHypotheses: Hypothesis[] = [];
  const closedByWord = new Map<number, Hypothesis[]>();
  const noEquivalent = new Map<number, { unit: OriginalUnit; entry: BridgeEntry }[]>();
  const spansByWord = new Map<number, Set<string>>();

  for (const wordPosition of wordPositions) {
    const spans = new Set<string>();
    const open: Hypothesis[] = [];
    const closed: Hypothesis[] = [];
    for (const unit of words.get(wordPosition) ?? []) {
      for (const entry of applicableEntries(unit, index)) {
        if (entry.kind === "no_equivalent") {
          const bucket = noEquivalent.get(wordPosition) ?? [];
          bucket.push({ unit, entry });
          noEquivalent.set(wordPosition, bucket);
          continue;
        }
        for (const span of findPhraseSpans(tokens, entry.phrase)) {
          const hypothesis: Hypothesis = { wordPosition, unit, entry, span, spanCount: 1 };
          if (entry.closedClass) closed.push(hypothesis);
          else {
            open.push(hypothesis);
            spans.add(spanId(span));
          }
        }
      }
    }
    spansByWord.set(wordPosition, spans);
    if (closed.length > 0) closedByWord.set(wordPosition, closed);
    for (const hypothesis of open) {
      openHypotheses.push({ ...hypothesis, spanCount: spans.size });
    }
  }

  // --- 2. componentes conexos sobre hipóteses sem ambiguidade ---------------
  const unionFind = new UnionFind();
  const unambiguous = openHypotheses.filter((item) => item.spanCount === 1);
  const ambiguous = openHypotheses.filter((item) => item.spanCount > 1);
  for (const hypothesis of unambiguous) {
    for (const position of hypothesis.span) {
      unionFind.union(`w:${hypothesis.wordPosition}`, `t:${position}`);
    }
  }

  const drafts = new Map<string, Draft>();
  const draftOf = (root: string): Draft => {
    const existing = drafts.get(root);
    if (existing) return existing;
    const created: Draft = {
      words: new Set<number>(),
      tokens: new Set<number>(),
      units: new Set<string>(),
      evidence: [],
      methods: new Set<AlignmentMethod>(),
      base: 1,
      ambiguitySpans: 1,
      competing: [],
    };
    drafts.set(root, created);
    return created;
  };

  for (const hypothesis of unambiguous) {
    const draft = draftOf(unionFind.find(`w:${hypothesis.wordPosition}`));
    const method = methodOf(hypothesis.entry);
    draft.words.add(hypothesis.wordPosition);
    for (const position of hypothesis.span) draft.tokens.add(position);
    draft.units.add(hypothesis.unit.unitId);
    draft.methods.add(method);
    draft.base = Math.min(
      draft.base,
      KIND_BASE[hypothesis.entry.kind] * STATUS_FACTOR[hypothesis.entry.status],
    );
    draft.evidence.push(
      evidenceOf(
        hypothesis,
        method,
        `"${hypothesis.unit.surface}" (${hypothesis.unit.lemma}) ligado a "${hypothesis.entry.phrase}" por ${bridgeSubjectLabel(hypothesis.entry.subject)}`,
      ),
    );
  }

  // --- 3. refinamento por morfema funcional, iterativo ---------------------
  const tokenOwner = new Map<number, string>();
  for (const [root, draft] of drafts) {
    for (const position of draft.tokens) tokenOwner.set(position, root);
  }
  let changed = true;
  let passes = 0;
  while (changed && passes < tokens.length + 1) {
    changed = false;
    passes += 1;
    for (const [root, draft] of [...drafts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      for (const wordPosition of [...draft.words].sort((a, b) => a - b)) {
        for (const hypothesis of closedByWord.get(wordPosition) ?? []) {
          const span = hypothesis.span;
          if (span.some((position) => tokenOwner.has(position))) continue;
          const min = Math.min(...draft.tokens);
          const max = Math.max(...draft.tokens);
          const contiguous =
            Math.max(...span) + 1 === min || Math.min(...span) - 1 === max;
          if (!contiguous) continue;
          for (const position of span) {
            draft.tokens.add(position);
            tokenOwner.set(position, root);
          }
          draft.units.add(hypothesis.unit.unitId);
          draft.methods.add("function_word_refinement");
          draft.evidence.push(
            evidenceOf(
              hypothesis,
              "function_word_refinement",
              `morfema funcional "${hypothesis.unit.surface}" estende o grupo para "${hypothesis.entry.phrase}", contíguo ao trecho já ligado`,
            ),
          );
          changed = true;
        }
      }
    }
  }

  // --- 4. candidatos ------------------------------------------------------
  const used = new Map<string, number>();
  const groups: AlignmentCandidateGroup[] = [];

  const emit = (draft: Draft, ambiguityNote: readonly string[] = []): AlignmentCandidateGroup => {
    const wordList = [...draft.words].sort((a, b) => a - b);
    const tokenList = [...draft.tokens].sort((a, b) => a - b);
    const selected = tokensOf(tokenList, tokens);
    const forms = selected.map((token) => token.normalized);
    const coveredUnits = draft.units;
    const totalUnits = wordList.reduce(
      (sum, position) => sum + (words.get(position)?.length ?? 0),
      0,
    );
    const partial = coveredUnits.size < totalUnits;
    const manyToMany = wordList.length > 1 && tokenList.length > 1;
    const suppliedInside = selected.some((token) => token.supplied);
    const functionOnly = draft.methods.has("function_word_only");

    let confidence = functionOnly ? FUNCTION_ONLY_BASE : draft.base;
    if (draft.ambiguitySpans > 1) confidence /= draft.ambiguitySpans;
    if (manyToMany) confidence *= 0.8;
    if (suppliedInside) confidence *= 0.9;
    if (partial) confidence *= 0.95;
    confidence = round2(Math.max(0.01, Math.min(0.99, confidence)));

    const reasons: string[] = [...ambiguityNote];
    if (draft.ambiguitySpans > 1) {
      reasons.push(`a mesma palavra original casa em ${draft.ambiguitySpans} trechos da tradução`);
    }
    if (manyToMany) {
      reasons.push(`grupo ${wordList.length}:${tokenList.length} exige conferência humana`);
    }
    if (functionOnly) {
      reasons.push("palavra original coberta apenas por morfema funcional");
    }
    if (draft.methods.has("unaligned_original")) {
      reasons.push("nenhuma entrada de ponte cobre esta palavra original");
    }
    if (suppliedInside) {
      reasons.push("o grupo inclui palavra acrescentada pela tradução (\\add)");
    }
    if (draft.evidence.some((item) => item.bridgeStatus !== null && item.bridgeStatus !== "approved")) {
      reasons.push("evidência vem de ponte ainda não aprovada");
    }
    if (confidence < options.reviewThreshold) {
      reasons.push(`confiança ${confidence.toFixed(2)} abaixo do piso ${options.reviewThreshold.toFixed(2)}`);
    }

    const ordered: readonly AlignmentMethod[] = [
      "editorial_seed",
      "proper_noun_translation",
      "approved_gloss_translation",
      "declared_no_equivalent",
      "function_word_refinement",
      "function_word_only",
      "unaligned_original",
    ];
    const dominant = ordered.find((method) => draft.methods.has(method)) ?? "unaligned_original";

    return {
      key: keyFor(verse.anchor, wordList, forms, used),
      anchor: verse.anchor,
      originalWordPositions: wordList,
      unitIds: [...coveredUnits].sort((a, b) => a.localeCompare(b)),
      translationTokenPositions: tokenList,
      translationForms: forms,
      method: dominant,
      methods: ordered.filter((method) => draft.methods.has(method)),
      cardinality: `${wordList.length}:${tokenList.length}`,
      confidence,
      needsReview: reasons.length > 0,
      reviewReasons: [...new Set(reasons)],
      competing: [...draft.competing].sort((a, b) => a.localeCompare(b)),
      evidence: [...draft.evidence].sort(
        (left, right) =>
          left.method.localeCompare(right.method) ||
          left.unitIds.join().localeCompare(right.unitIds.join()) ||
          left.translationTokenPositions.join().localeCompare(right.translationTokenPositions.join()),
      ),
    };
  };

  for (const root of [...drafts.keys()].sort((a, b) => a.localeCompare(b))) {
    const draft = drafts.get(root);
    if (draft) groups.push(emit(draft));
  }

  // Ambíguos: um candidato por trecho, nunca fundidos, sempre em revisão. A
  // escolha entre eles é editorial — resolver aqui seria resolver por ordem.
  const ambiguousByWord = new Map<number, Hypothesis[]>();
  for (const hypothesis of ambiguous) {
    const bucket = ambiguousByWord.get(hypothesis.wordPosition) ?? [];
    bucket.push(hypothesis);
    ambiguousByWord.set(hypothesis.wordPosition, bucket);
  }
  for (const wordPosition of [...ambiguousByWord.keys()].sort((a, b) => a - b)) {
    const bucket = ambiguousByWord.get(wordPosition) ?? [];
    const bySpan = new Map<string, Hypothesis[]>();
    for (const hypothesis of bucket) {
      const id = spanId(hypothesis.span);
      const existing = bySpan.get(id) ?? [];
      existing.push(hypothesis);
      bySpan.set(id, existing);
    }
    const produced: AlignmentCandidateGroup[] = [];
    for (const id of [...bySpan.keys()].sort((a, b) => a.localeCompare(b))) {
      const hypotheses = bySpan.get(id) ?? [];
      const draft: Draft = {
        words: new Set([wordPosition]),
        tokens: new Set(hypotheses[0].span),
        units: new Set(hypotheses.map((item) => item.unit.unitId)),
        evidence: hypotheses.map((hypothesis) =>
          evidenceOf(
            hypothesis,
            methodOf(hypothesis.entry),
            `"${hypothesis.unit.surface}" (${hypothesis.unit.lemma}) casa com "${hypothesis.entry.phrase}" em mais de um trecho; nenhum foi escolhido automaticamente`,
          ),
        ),
        methods: new Set(hypotheses.map((hypothesis) => methodOf(hypothesis.entry))),
        base: Math.min(
          ...hypotheses.map(
            (hypothesis) =>
              KIND_BASE[hypothesis.entry.kind] * STATUS_FACTOR[hypothesis.entry.status],
          ),
        ),
        ambiguitySpans: bySpan.size,
        competing: [],
      };
      produced.push(emit(draft));
    }
    // As chaves concorrentes só existem depois de todas emitidas.
    for (const candidate of produced) {
      groups.push({
        ...candidate,
        competing: produced
          .filter((other) => other.key !== candidate.key)
          .map((other) => other.key)
          .sort((a, b) => a.localeCompare(b)),
      });
    }
  }

  // Palavras originais sem grupo: funcional sozinha, sem equivalente declarado
  // ou lacuna de ponte.
  const grouped = new Set(groups.flatMap((group) => group.originalWordPositions));
  const unalignedOriginalWords: number[] = [];
  for (const wordPosition of wordPositions) {
    if (grouped.has(wordPosition)) continue;
    const declared = noEquivalent.get(wordPosition);
    const closed = (closedByWord.get(wordPosition) ?? []).filter(
      (hypothesis) => !hypothesis.span.some((position) => tokenOwner.has(position)),
    );
    const wordUnits = words.get(wordPosition) ?? [];

    if (closed.length > 0) {
      const bySpan = new Map<string, Hypothesis[]>();
      for (const hypothesis of closed) {
        const id = spanId(hypothesis.span);
        const existing = bySpan.get(id) ?? [];
        existing.push(hypothesis);
        bySpan.set(id, existing);
      }
      const produced: AlignmentCandidateGroup[] = [];
      for (const id of [...bySpan.keys()].sort((a, b) => a.localeCompare(b))) {
        const hypotheses = bySpan.get(id) ?? [];
        const draft: Draft = {
          words: new Set([wordPosition]),
          tokens: new Set(hypotheses[0].span),
          units: new Set(hypotheses.map((item) => item.unit.unitId)),
          evidence: hypotheses.map((hypothesis) =>
            evidenceOf(
              hypothesis,
              "function_word_only",
              `palavra original "${hypothesis.unit.surface}" só tem morfema funcional; "${hypothesis.entry.phrase}" é hipótese, não ligação confirmada`,
            ),
          ),
          methods: new Set<AlignmentMethod>(["function_word_only"]),
          base: FUNCTION_ONLY_BASE,
          ambiguitySpans: bySpan.size,
          competing: [],
        };
        produced.push(emit(draft));
      }
      for (const candidate of produced) {
        groups.push({
          ...candidate,
          competing: produced
            .filter((other) => other.key !== candidate.key)
            .map((other) => other.key)
            .sort((a, b) => a.localeCompare(b)),
        });
      }
      continue;
    }

    if (declared && declared.length > 0) {
      const draft: Draft = {
        words: new Set([wordPosition]),
        tokens: new Set<number>(),
        units: new Set(declared.map((item) => item.unit.unitId)),
        evidence: declared.map(({ unit, entry }) => ({
          method: "declared_no_equivalent" as AlignmentMethod,
          unitIds: [unit.unitId],
          translationTokenPositions: [],
          bridgeSubject: bridgeSubjectLabel(entry.subject),
          bridgeKind: entry.kind,
          bridgeStatus: entry.status,
          detail: `"${unit.surface}" (${unit.lemma}) declarado sem equivalente nesta tradução: ${entry.provenance.note}`,
        })),
        methods: new Set<AlignmentMethod>(["declared_no_equivalent"]),
        base: Math.min(
          ...declared.map(({ entry }) => KIND_BASE[entry.kind] * STATUS_FACTOR[entry.status]),
        ),
        ambiguitySpans: 1,
        competing: [],
      };
      groups.push(emit(draft));
      continue;
    }

    unalignedOriginalWords.push(wordPosition);
    if (options.emitUnalignedOriginals) {
      const draft: Draft = {
        words: new Set([wordPosition]),
        tokens: new Set<number>(),
        units: new Set(wordUnits.map((unit) => unit.unitId)),
        evidence: wordUnits.map((unit) => ({
          method: "unaligned_original" as AlignmentMethod,
          unitIds: [unit.unitId],
          translationTokenPositions: [],
          bridgeSubject: null,
          bridgeKind: null,
          bridgeStatus: null,
          detail: `nenhuma entrada de ponte cobre "${unit.surface}" (${unit.lemma}${unit.strongId ? `, ${unit.strongId}` : ""})`,
        })),
        methods: new Set<AlignmentMethod>(["unaligned_original"]),
        base: 0.01,
        ambiguitySpans: 1,
        competing: [],
      };
      groups.push(emit(draft));
    }
  }

  const covered = new Set(groups.flatMap((group) => group.translationTokenPositions));
  const unalignedTranslationTokens = tokens
    .filter((token) => !covered.has(token.position))
    .map((token) => token.position);

  return {
    anchor: verse.anchor,
    originalRef: verse.originalRef,
    tokens,
    groups: [...groups].sort(
      (left, right) =>
        (left.originalWordPositions[0] ?? 0) - (right.originalWordPositions[0] ?? 0) ||
        (left.translationTokenPositions[0] ?? 0) - (right.translationTokenPositions[0] ?? 0) ||
        left.key.localeCompare(right.key),
    ),
    unalignedTranslationTokens,
    unalignedOriginalWords,
  };
}

/** Candidatos de um lote inteiro, em ordem canônica. */
export function generateBundleCandidates(
  bundle: AlignmentInputBundle,
  options: CandidateOptions = DEFAULT_CANDIDATE_OPTIONS,
): readonly VerseCandidateResult[] {
  // Não deixe um chamador de script pular a validação e gerar uma fila para
  // ativos ainda não aprovados. O gerador de um versículo fica puro para testes
  // locais; o gerador de lote é a fronteira de publicação do pipeline.
  assertAlignmentBundle(bundle);
  return [...bundle.verses]
    .sort((left, right) => compareAnchors(left.anchor, right.anchor))
    .map((verse) => generateVerseCandidates(verse, bundle.bridge, options));
}
