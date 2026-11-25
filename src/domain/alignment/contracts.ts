/**
 * Contratos do pipeline de alinhamento por versão (ALIGNMENT-PIPELINE-001, A1).
 *
 * O problema que este módulo resolve é de prova, não de produtividade: ligar uma
 * palavra portuguesa a uma palavra hebraica ou grega **exige evidência**, e a
 * única evidência que o produto aceita é lexical ou editorial. Posição não é
 * evidência. Duas línguas não preservam a mesma quantidade de palavras, nem a
 * mesma ordem, nem a mesma segmentação: emparelhar o token 3 com a palavra 3
 * produziria um mapa plausível e falso, que é o pior resultado possível num
 * produto cuja promessa é não inventar dado filológico.
 *
 * Três decisões ficam gravadas nos tipos, para não dependerem da disciplina de
 * quem escrever o código depois:
 *
 * 1. **Todo candidato carrega evidência.** `AlignmentCandidateGroup.evidence`
 *    não é opcional e cada evidência aponta a entrada de ponte lexical que a
 *    gerou. Um grupo sem evidência é rejeitado por `assertNoPositionalLinking`.
 * 2. **Candidato ≠ alinhamento publicado.** O pipeline só produz
 *    `AlignmentCandidateGroup`. O que o leitor pode exibir é decisão de revisão
 *    (`review.ts`), nunca a saída crua do algoritmo.
 * 3. **Alinhamento é por tradução.** O léxico é independente da tradução; o
 *    alinhamento não pode ser. `translationId` entra na identidade do lote e da
 *    execução, porque ordem, explicitação e omissão variam entre versões.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco.
 */

/** Versão do algoritmo. Muda ⇒ nova versão de alinhamento, por contrato. */
export const ALIGNMENT_ALGORITHM_VERSION = "alignment-candidates/1.0.0";

export type AlignmentLanguage = "hbo" | "grc";

/** Âncora canônica: não depende de tradução nem de edição original. */
export type CanonicalAnchor = {
  /** Código USFM, igual ao de `src/domain/lexicon/canon.ts` (`GEN`, `MIC`). */
  readonly bookCode: string;
  readonly chapter: number;
  readonly verse: number;
};

export function anchorRef(anchor: CanonicalAnchor): string {
  return `${anchor.bookCode} ${anchor.chapter}:${anchor.verse}`;
}

export function compareAnchors(left: CanonicalAnchor, right: CanonicalAnchor): number {
  return (
    left.bookCode.localeCompare(right.bookCode) ||
    left.chapter - right.chapter ||
    left.verse - right.verse
  );
}

/**
 * Referência na numeração da edição original, quando diverge da exibida.
 *
 * Miqueias 5 é o caso que obriga o campo a existir: o capítulo em português
 * começa onde a tradição hebraica enumera 4:14, e a partir do versículo 2 a
 * numeração hebraica fica uma unidade atrás. Sem registrar o mapa **e a versão
 * dele**, um reprocessamento futuro trocaria em silêncio o versículo original de
 * um alinhamento já revisado.
 */
export type OriginalVerseRef = {
  readonly chapter: number;
  readonly verse: number;
};

/** Palavra da tradução exibida, como o pipeline a enxerga. */
export type TranslationToken = {
  /** Ordem de leitura, 1-based, contando só tokens de texto. */
  readonly position: number;
  /** Como aparece no versículo, sem marcação USFM e sem pontuação de borda. */
  readonly surface: string;
  /** Minúsculo, sem diacrítico e sem pontuação: é por aqui que se compara. */
  readonly normalized: string;
  /** Deslocamento em unidades UTF-16 no texto recebido, para destaque na UI. */
  readonly start: number;
  readonly end: number;
  /**
   * Palavra acrescentada pelo tradutor (`\add ... \add*` no USFM da BLIVRE).
   * Fica marcada porque a expectativa correta é que **não** tenha original
   * correspondente: deixá-la sem alinhamento é acerto, não lacuna.
   */
  readonly supplied: boolean;
};

/**
 * Unidade do texto original: um morfema quando a fonte é morfêmica, uma palavra
 * quando não é.
 *
 * `wordPosition` é o que permite agrupar morfemas na palavra a que pertencem —
 * estrutura interna de uma única língua, e por isso legítima. Não confundir com
 * emparelhamento entre línguas, que é o que o pipeline recusa.
 */
export type OriginalUnit = {
  /** Identificador estável publicado pela fonte (`GEN 1:1!1`, uuid de token). */
  readonly unitId: string;
  readonly wordPosition: number;
  /** Posição do morfema dentro da palavra, 1-based. */
  readonly morphemePosition: number;
  readonly surface: string;
  readonly lemma: string;
  /** Chave do verbete (`hbo:H7225`), quando o léxico cobre a unidade. */
  readonly lexemeKey: string | null;
  readonly strongId: string | null;
  /** Glossa contextual publicada pela fonte, na língua da fonte (inglês). */
  readonly gloss: string | null;
  readonly morphology: string | null;
  readonly partOfSpeech: string | null;
};

/**
 * Sujeito de uma entrada de ponte: o que está sendo traduzido.
 *
 * Quatro formas porque as fontes dão ganchos diferentes e nenhum cobre tudo: o
 * Strong existe para a maioria dos lemas, mas não para prefixos aumentados; a
 * chave de verbete existe quando o léxico foi importado; a glossa é o único
 * gancho para morfema funcional, que não tem verbete próprio; e `unit` existe
 * para a decisão editorial que vale só naquela ocorrência.
 */
export type BridgeSubject =
  | { readonly kind: "strong"; readonly strongId: string }
  | { readonly kind: "lexeme"; readonly lexemeKey: string }
  | { readonly kind: "gloss"; readonly gloss: string }
  | { readonly kind: "unit"; readonly unitId: string };

export function bridgeSubjectLabel(subject: BridgeSubject): string {
  switch (subject.kind) {
    case "strong":
      return `strong:${subject.strongId}`;
    case "lexeme":
      return `lexeme:${subject.lexemeKey}`;
    case "gloss":
      return `gloss:${subject.gloss}`;
    case "unit":
      return `unit:${subject.unitId}`;
  }
}

/**
 * Como a equivalência foi estabelecida.
 *
 * `no_equivalent` é entrada de primeira classe de propósito: declarar que a
 * partícula אֵת não tem palavra correspondente em português é informação
 * editorial, e registrá-la evita que o leitor interprete a ausência como falha
 * do pipeline.
 */
export type BridgeKind =
  | "approved_translation"
  | "proper_noun"
  | "editorial_seed"
  | "no_equivalent";

/** Mesmos estados do fluxo lexical: rascunho de máquina nunca é publicável. */
export type BridgeStatus = "machine_draft" | "human_reviewed" | "approved";

export type BridgeProvenance = {
  readonly sourceId: string;
  readonly reviewedBy: string | null;
  readonly reviewedAt: string | null;
  readonly note: string;
};

export type BridgeEntry = {
  readonly kind: BridgeKind;
  readonly subject: BridgeSubject;
  /**
   * Expressão em pt-BR. Vazia só quando `kind === "no_equivalent"`.
   * Pode ter mais de uma palavra: é daí que sai 1:N sem truque de posição.
   */
  readonly phrase: string;
  readonly status: BridgeStatus;
  /**
   * Classe fechada: artigo, preposição, conjunção, pronome, partícula.
   *
   * Entrada de classe fechada **não cria grupo**. "the" casa com "o", "a", "os"
   * e "as" em qualquer lugar do versículo; deixá-la criar ligação encheria o
   * mapa de pares entre palavras que nada têm a ver uma com a outra. Ela só
   * estende um grupo que uma palavra de conteúdo da **mesma palavra original**
   * já estabeleceu — ver `candidates.ts`.
   */
  readonly closedClass: boolean;
  readonly provenance: BridgeProvenance;
};

/** Estado de aprovação do ativo de origem, tal como o banco o registra. */
export type AssetApproval = "collected" | "under_review" | "approved" | "blocked";

/**
 * Lote de entrada de uma execução: uma tradução, uma edição original, um
 * conjunto de versículos e a ponte lexical aplicável.
 *
 * Montar o lote é trabalho de quem lê o banco ou o artefato local; este módulo
 * só o valida e o consome. É o que mantém o pipeline offline e testável.
 */
export type AlignmentInputBundle = {
  readonly translationId: string;
  readonly translationCode: string;
  readonly translationStatus: AssetApproval;
  readonly originalEditionId: string;
  readonly originalEditionCode: string;
  readonly originalEditionStatus: AssetApproval;
  readonly language: AlignmentLanguage;
  /** Digest do índice lexical usado. Entra na impressão da execução. */
  readonly lexiconIndexDigest: string | null;
  /** Versão do mapa de versificação aplicado (`original-versification/1`). */
  readonly versificationMapVersion: string;
  readonly bridge: readonly BridgeEntry[];
  readonly verses: readonly VerseAlignmentInput[];
};

export type VerseAlignmentInput = {
  readonly anchor: CanonicalAnchor;
  readonly originalRef: OriginalVerseRef;
  /** Texto do versículo na tradução, como está persistido (USFM incluso). */
  readonly translationText: string;
  readonly units: readonly OriginalUnit[];
};

/**
 * Método do candidato. Não existe `positional`, e isso é deliberado: não há
 * valor possível que signifique "liguei por estarem na mesma posição".
 */
export type AlignmentMethod =
  /** Palavra de conteúdo ligada por tradução aprovada de glossa/verbete. */
  | "approved_gloss_translation"
  /** Nome próprio ligado por tradução aprovada do nome. */
  | "proper_noun_translation"
  /** Ligação semeada por decisão editorial explícita. */
  | "editorial_seed"
  /** Morfema funcional estendendo grupo já estabelecido, por contiguidade. */
  | "function_word_refinement"
  /** Palavra original só com morfema funcional: candidato, sempre em revisão. */
  | "function_word_only"
  /** Original declarado sem equivalente na tradução (1:0). */
  | "declared_no_equivalent"
  /** Original sem evidência alguma: fica registrado como lacuna, não ligado. */
  | "unaligned_original";

export const ALIGNMENT_METHODS: readonly AlignmentMethod[] = [
  "approved_gloss_translation",
  "proper_noun_translation",
  "editorial_seed",
  "function_word_refinement",
  "function_word_only",
  "declared_no_equivalent",
  "unaligned_original",
];

/** Métodos que estabelecem ligação por conta própria. */
export const GROUP_FORMING_METHODS: readonly AlignmentMethod[] = [
  "approved_gloss_translation",
  "proper_noun_translation",
  "editorial_seed",
];

export type AlignmentEvidence = {
  readonly method: AlignmentMethod;
  readonly unitIds: readonly string[];
  readonly translationTokenPositions: readonly number[];
  /** Entrada de ponte que produziu a ligação, ou `null` para lacuna. */
  readonly bridgeSubject: string | null;
  readonly bridgeKind: BridgeKind | null;
  readonly bridgeStatus: BridgeStatus | null;
  /** Frase curta, em português, legível na fila editorial. */
  readonly detail: string;
};

export type AlignmentCandidateGroup = {
  /**
   * Chave estável, independente da execução: sobrevive a reprocessamento e é
   * por ela que uma decisão editorial é reaproveitada.
   */
  readonly key: string;
  readonly anchor: CanonicalAnchor;
  readonly originalWordPositions: readonly number[];
  readonly unitIds: readonly string[];
  readonly translationTokenPositions: readonly number[];
  /** Formas normalizadas dos tokens, para a chave não depender de posição. */
  readonly translationForms: readonly string[];
  /** Método dominante, o de maior força entre as evidências do grupo. */
  readonly method: AlignmentMethod;
  readonly methods: readonly AlignmentMethod[];
  /** `"1:2"`, `"2:1"`, `"1:0"` — palavras originais : tokens da tradução. */
  readonly cardinality: string;
  /** 0..1, duas casas decimais, determinística. Ver `candidates.ts`. */
  readonly confidence: number;
  readonly needsReview: boolean;
  /** Motivos legíveis da ida à fila editorial. Vazio quando não precisa. */
  readonly reviewReasons: readonly string[];
  /** Chaves de candidatos que disputam as mesmas unidades. */
  readonly competing: readonly string[];
  readonly evidence: readonly AlignmentEvidence[];
};

export type VerseCandidateResult = {
  readonly anchor: CanonicalAnchor;
  readonly originalRef: OriginalVerseRef;
  readonly tokens: readonly TranslationToken[];
  readonly groups: readonly AlignmentCandidateGroup[];
  /** Tokens da tradução que nenhum candidato cobre. */
  readonly unalignedTranslationTokens: readonly number[];
  /** Palavras originais sem nenhuma evidência de ligação. */
  readonly unalignedOriginalWords: readonly number[];
};

export type BundleValidationIssue = {
  readonly at: string;
  readonly reason: string;
};

export class AlignmentBundleError extends Error {
  readonly issues: readonly BundleValidationIssue[];

  constructor(issues: readonly BundleValidationIssue[]) {
    super(
      `lote de alinhamento inválido: ${issues
        .map((issue) => `${issue.at}: ${issue.reason}`)
        .join("; ")}`,
    );
    this.name = "AlignmentBundleError";
    this.issues = issues;
  }
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/**
 * Validação que falha fechada. Em ordem de importância:
 *
 * - tradução ou edição que não esteja `approved` **não entra**: alinhar texto
 *   não aprovado produziria candidatos que ninguém pode publicar, pendurados em
 *   um ativo que talvez venha a ser rejeitado;
 * - identificador de unidade repetido no versículo é erro, não aviso: a chave
 *   estável do candidato depende dele, e chave ambígua quebra o reaproveitamento
 *   de decisão editorial;
 * - entrada de ponte sem frase só é aceita quando declara `no_equivalent`;
 * - ponte revisada ou aprovada exige revisor nomeado e data, igual ao fluxo de
 *   tradução lexical.
 */
export function validateAlignmentBundle(
  bundle: AlignmentInputBundle,
): readonly BundleValidationIssue[] {
  const issues: BundleValidationIssue[] = [];
  const at = (where: string, reason: string): void => {
    issues.push({ at: where, reason });
  };

  if (!isNonEmpty(bundle.translationId)) at("translationId", "ausente");
  if (!isNonEmpty(bundle.originalEditionId)) at("originalEditionId", "ausente");
  if (!isNonEmpty(bundle.versificationMapVersion)) {
    at("versificationMapVersion", "a versão do mapa de versificação é obrigatória");
  }
  if (bundle.translationStatus !== "approved") {
    at("translationStatus", `tradução não aprovada (${bundle.translationStatus})`);
  }
  if (bundle.originalEditionStatus !== "approved") {
    at("originalEditionStatus", `edição original não aprovada (${bundle.originalEditionStatus})`);
  }
  if (bundle.language !== "hbo" && bundle.language !== "grc") {
    at("language", "idioma original deve ser hbo ou grc");
  }

  bundle.bridge.forEach((entry, index) => {
    const where = `bridge[${index}] ${bridgeSubjectLabel(entry.subject)}`;
    if (entry.kind === "no_equivalent") {
      if (entry.phrase.trim().length > 0) {
        at(where, "no_equivalent não pode declarar frase em português");
      }
    } else if (!isNonEmpty(entry.phrase)) {
      at(where, "frase em português ausente");
    }
    if (entry.status !== "machine_draft") {
      if (!isNonEmpty(entry.provenance.reviewedBy) || !isNonEmpty(entry.provenance.reviewedAt)) {
        at(where, `status ${entry.status} exige revisor nomeado e data`);
      }
    }
    if (!isNonEmpty(entry.provenance.sourceId)) at(where, "proveniência sem fonte");
    if (entry.subject.kind === "strong" && !isNonEmpty(entry.subject.strongId)) {
      at(where, "sujeito strong vazio");
    }
    if (entry.subject.kind === "gloss" && !isNonEmpty(entry.subject.gloss)) {
      at(where, "sujeito glossa vazio");
    }
  });

  const seenAnchors = new Set<string>();
  bundle.verses.forEach((verse, index) => {
    const ref = anchorRef(verse.anchor);
    const where = `verses[${index}] ${ref}`;
    if (!isNonEmpty(verse.anchor.bookCode)) at(where, "livro ausente");
    if (!positiveInt(verse.anchor.chapter) || !positiveInt(verse.anchor.verse)) {
      at(where, "capítulo e versículo devem ser inteiros positivos");
    }
    if (!positiveInt(verse.originalRef.chapter) || !positiveInt(verse.originalRef.verse)) {
      at(where, "referência original inválida");
    }
    if (!isNonEmpty(verse.translationText)) at(where, "texto da tradução vazio");
    if (seenAnchors.has(ref)) at(where, "âncora repetida no lote");
    seenAnchors.add(ref);

    const seenUnits = new Set<string>();
    verse.units.forEach((unit, unitIndex) => {
      const unitWhere = `${where} unidade[${unitIndex}]`;
      if (!isNonEmpty(unit.unitId)) at(unitWhere, "unitId ausente");
      if (seenUnits.has(unit.unitId)) at(unitWhere, `unitId repetido: ${unit.unitId}`);
      seenUnits.add(unit.unitId);
      if (!positiveInt(unit.wordPosition)) at(unitWhere, "wordPosition deve ser inteiro positivo");
      if (!positiveInt(unit.morphemePosition)) {
        at(unitWhere, "morphemePosition deve ser inteiro positivo");
      }
      if (!isNonEmpty(unit.surface)) at(unitWhere, "superfície vazia");
      if (!isNonEmpty(unit.lemma)) at(unitWhere, "lema vazio");
    });
    if (verse.units.length === 0) at(where, "versículo sem unidades originais");
  });

  if (bundle.verses.length === 0) at("verses", "lote sem versículos");
  return issues;
}

export function assertAlignmentBundle(bundle: AlignmentInputBundle): AlignmentInputBundle {
  const issues = validateAlignmentBundle(bundle);
  if (issues.length > 0) throw new AlignmentBundleError(issues);
  return bundle;
}

/**
 * Guarda explícita contra o erro que esta frente existe para evitar.
 *
 * Um grupo sem evidência, ou com token ligado sem nenhuma evidência que o cite,
 * é exatamente o que um alinhamento por posição produziria. A checagem é barata
 * e roda no script e nos testes.
 */
export function assertNoPositionalLinking(
  groups: readonly AlignmentCandidateGroup[],
): readonly AlignmentCandidateGroup[] {
  for (const group of groups) {
    if (group.evidence.length === 0) {
      throw new Error(`grupo ${group.key} sem evidência: ligação por posição não é permitida`);
    }
    if (!ALIGNMENT_METHODS.includes(group.method)) {
      throw new Error(`grupo ${group.key} com método desconhecido: ${group.method}`);
    }
    const citedTokens = new Set(group.evidence.flatMap((item) => item.translationTokenPositions));
    for (const position of group.translationTokenPositions) {
      if (!citedTokens.has(position)) {
        throw new Error(`grupo ${group.key} liga o token ${position} sem evidência que o cite`);
      }
    }
    const citedUnits = new Set(group.evidence.flatMap((item) => item.unitIds));
    for (const unitId of group.unitIds) {
      if (!citedUnits.has(unitId)) {
        throw new Error(`grupo ${group.key} inclui a unidade ${unitId} sem evidência`);
      }
    }
  }
  return groups;
}

/**
 * Impressão determinística de um texto arbitrário, em FNV-1a de 64 bits.
 *
 * Por que não `node:crypto`: este módulo é puro e roda igual no script, no teste
 * e, no futuro, no servidor. E por que uma função de hash fraca serve: ela só
 * detecta **mudança** de entrada, para decidir se a execução gera uma nova
 * versão de alinhamento. Não é defesa contra adversário e não autentica nada; o
 * digest do léxico, esse sim, vem do SHA-256 calculado na coleta.
 */
export function fingerprint(value: string): string {
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash ^ BigInt(value.charCodeAt(index))) * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}
