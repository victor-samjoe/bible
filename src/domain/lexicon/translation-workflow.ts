/**
 * Fluxo editorial da tradução para português (LEXICON-INDEX-001, fila C30).
 *
 * As fontes lexicais aprovadas estão em inglês. A versão portuguesa é **ativo
 * derivado**: nunca sobrescreve o original, carrega o texto-fonte, o idioma, a
 * fonte, o pino e a licença, e só é publicada depois de revisão humana.
 *
 * Esta frente **não gera e não publica tradução alguma**. O que existe aqui é o
 * contrato que a geração futura terá de obedecer — e, principalmente, a regra
 * que impede publicar rascunho de máquina como se fosse verbete.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco, sem chamada a modelo.
 */

import type { FieldProvenance } from "./records.ts";

export const TRANSLATION_STATUSES = ["machine_draft", "human_reviewed", "approved"] as const;

export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export type TranslationAction = "submit_review" | "approve" | "reject" | "reopen";

export type EditorialTranslation = {
  /** Campo do verbete traduzido, ex. "entry.definition". */
  readonly target: string;
  /** Texto original, preservado junto da tradução. */
  readonly sourceText: string;
  readonly sourceLanguage: "en" | "grc" | "hbo";
  readonly targetLanguage: "pt-BR";
  readonly text: string;
  readonly status: TranslationStatus;
  /** Quem revisou. Obrigatório a partir de `human_reviewed`. */
  readonly reviewedBy: string | null;
  /** ISO 8601. Obrigatório a partir de `human_reviewed`. */
  readonly reviewedAt: string | null;
  /** Proveniência do texto-fonte, não da tradução. */
  readonly provenance: FieldProvenance;
  /** Identificação honesta de como o rascunho nasceu, ex. "modelo X, 2026-11". */
  readonly draftMethod: string;
};

export class TranslationWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranslationWorkflowError";
  }
}

const TRANSITIONS: Readonly<Record<TranslationStatus, Readonly<Partial<Record<TranslationAction, TranslationStatus>>>>> = {
  machine_draft: { submit_review: "human_reviewed" },
  // Rejeitar devolve ao rascunho; aprovar exige ter passado por revisão humana.
  human_reviewed: { approve: "approved", reject: "machine_draft" },
  // Reabrir um texto aprovado o derruba para revisão, nunca para publicado.
  approved: { reopen: "human_reviewed" },
};

/**
 * Transição de estado. Falha fechada: `machine_draft -> approved` não existe,
 * de propósito, porque pular a revisão é o único jeito de um texto de máquina
 * chegar ao leitor como se fosse verbete conferido.
 */
export function nextTranslationStatus(
  current: TranslationStatus,
  action: TranslationAction,
): TranslationStatus {
  const next = TRANSITIONS[current][action];
  if (!next) {
    throw new TranslationWorkflowError(
      `transição inválida: '${action}' a partir de '${current}'`,
    );
  }
  return next;
}

/** Só texto aprovado é publicável como dado lexical em português. */
export function canPublishTranslation(translation: EditorialTranslation): boolean {
  return (
    translation.status === "approved" &&
    translation.reviewedBy !== null &&
    translation.reviewedAt !== null &&
    translation.text.trim().length > 0
  );
}

export type PublishableText =
  | { readonly kind: "translation"; readonly text: string; readonly language: "pt-BR" }
  /**
   * Rascunho de máquina, exibido **somente** em pré-visualização e sempre com
   * rótulo. Nunca é devolvido sem `allowMachineDraft` explícito.
   */
  | {
      readonly kind: "machine_draft";
      readonly text: string;
      readonly language: "pt-BR";
      readonly draftMethod: string;
    }
  /** Enquanto não houver tradução aprovada, mostra-se o original com aviso. */
  | { readonly kind: "source_fallback"; readonly text: string; readonly language: string }
  | { readonly kind: "unavailable" };

export type PublishOptions = {
  /**
   * Liga a exibição de rascunho não revisado. Existe para a pré-visualização
   * interna, onde o objetivo é conferir o texto antes de aprová-lo.
   *
   * O padrão é `false`, e é de propósito: quem esquecer de passar a opção
   * obtém o comportamento de produção, não o de pré-visualização. O rascunho
   * volta num `kind` próprio, e não como `translation`, para que a interface
   * seja obrigada a tratá-lo à parte e rotulá-lo — se viesse no mesmo formato
   * do texto aprovado, bastaria um descuido para publicá-lo sem aviso.
   */
  readonly allowMachineDraft?: boolean;
};

/**
 * O que o leitor pode mostrar. Em produção nunca devolve rascunho: a
 * alternativa a uma tradução aprovada é a glossa original, não um texto
 * plausível sem revisor.
 */
export function publishableText(
  translation: EditorialTranslation | null,
  sourceFallback: string | null,
  options: PublishOptions = {},
): PublishableText {
  if (translation && canPublishTranslation(translation)) {
    return { kind: "translation", text: translation.text, language: "pt-BR" };
  }
  if (
    options.allowMachineDraft === true &&
    translation &&
    translation.status === "machine_draft" &&
    translation.text.trim().length > 0
  ) {
    return {
      kind: "machine_draft",
      text: translation.text,
      language: "pt-BR",
      draftMethod: translation.draftMethod,
    };
  }
  const fallback = (translation?.sourceText ?? sourceFallback ?? "").trim();
  if (fallback.length > 0) {
    return {
      kind: "source_fallback",
      text: fallback,
      language: translation?.sourceLanguage ?? "en",
    };
  }
  return { kind: "unavailable" };
}

/**
 * Valida a coerência de um registro de tradução antes de gravar. Revisão sem
 * revisor nomeado e sem data é a forma mais fácil de um rascunho virar
 * "aprovado" por descuido.
 */
export function assertTranslationIsCoherent(translation: EditorialTranslation): void {
  if (translation.targetLanguage !== "pt-BR") {
    throw new TranslationWorkflowError("esta frente só prevê tradução editorial para pt-BR");
  }
  if (translation.sourceText.trim().length === 0) {
    throw new TranslationWorkflowError("tradução sem texto-fonte: o original é obrigatório");
  }
  if (translation.draftMethod.trim().length === 0) {
    throw new TranslationWorkflowError("tradução sem método de rascunho declarado");
  }
  if (translation.status !== "machine_draft") {
    if (!translation.reviewedBy || translation.reviewedBy.trim().length === 0) {
      throw new TranslationWorkflowError(`status '${translation.status}' exige revisor nomeado`);
    }
    if (!translation.reviewedAt || Number.isNaN(Date.parse(translation.reviewedAt))) {
      throw new TranslationWorkflowError(`status '${translation.status}' exige data de revisão válida`);
    }
  }
}

/**
 * Guarda desta tarefa: o pipeline de preparação não pode emitir tradução
 * nenhuma. Gerar texto em português é trabalho de outra frente, com orçamento,
 * método e revisor definidos.
 */
export function assertNoTranslationsProduced(
  translations: readonly EditorialTranslation[],
): void {
  if (translations.length > 0) {
    throw new TranslationWorkflowError(
      "a fase de preparação não gera tradução: traduzir exige aprovação e revisão humanas",
    );
  }
}
