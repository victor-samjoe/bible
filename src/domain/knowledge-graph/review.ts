/**
 * Estado de revisão e transições (KNOWLEDGE-GRAPH-001, fila A2).
 *
 * O estado de revisão é obrigatório em todo registro publicável da árvore. Sem
 * ele, rascunho e material conferido ficam indistinguíveis no mesmo índice — e
 * o que aparece ao leitor passa a depender de quem consultou por último, não de
 * uma decisão registrada. É a mesma regra que o fluxo de tradução lexical já
 * aplica: `machine_draft` nunca vira `approved` sozinho.
 *
 * Três decisões que o tipo faz valer:
 *
 * 1. **Revisor é pessoa.** `reviewer.human` precisa ser `true` para alcançar
 *    `revisado` ou `publicado`. Uma síntese de agente pode ser matéria-prima de
 *    revisão, nunca o revisor.
 * 2. **Revisor não é o autor.** Autorrevisão registrada como revisão é pior do
 *    que ausência de revisão, porque afirma uma conferência que não houve.
 * 3. **Retratação preserva histórico.** `retratado` é um estado, não exclusão:
 *    um estudo que citou a afirmação precisa continuar mostrando o que usou.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco, sem relógio.
 */

import { z } from "zod";
import { isoDate, issuesOf, optionalText, requiredText } from "./primitives";

export const REVIEW_STATES = [
  "rascunho",
  "em_revisao",
  "revisado",
  "publicado",
  "rejeitado",
  "retratado",
] as const;

export type ReviewState = (typeof REVIEW_STATES)[number];
export const reviewState = z.enum(REVIEW_STATES);

/** Estados cuja existência depende de conferência humana registrada. */
const REQUIRE_REVIEWER: ReadonlySet<ReviewState> = new Set<ReviewState>(["revisado", "publicado"]);

/** Só `publicado` pode ser servido ao leitor como conhecimento curado. */
export function isPublished(state: ReviewState): boolean {
  return state === "publicado";
}

export const ReviewerSchema = z.strictObject({
  name: requiredText,
  /**
   * `false` é aceito no tipo para que uma conferência automática possa ser
   * registrada com honestidade — mas então o registro não alcança `revisado`.
   */
  human: z.boolean(),
  affiliation: optionalText,
});

export type Reviewer = z.infer<typeof ReviewerSchema>;

export const ReviewRecordSchema = z
  .strictObject({
    state: reviewState,
    /** Quem produziu o registro. Nome de pessoa ou de equipe editorial. */
    author: requiredText,
    reviewer: ReviewerSchema.nullable().default(null),
    reviewedAt: isoDate.nullable().default(null),
    /** Motivo obrigatório em rejeição e retratação. */
    note: optionalText,
  })
  .check((ctx) => {
    const review = ctx.value;
    if (REQUIRE_REVIEWER.has(review.state)) {
      if (review.reviewer === null) {
        ctx.issues.push({ code: "custom", input: review, path: ["reviewer"], message: `Estado ${review.state} exige revisor identificado` });
      } else {
        if (!review.reviewer.human) {
          ctx.issues.push({ code: "custom", input: review, path: ["reviewer", "human"], message: "Revisão precisa ser humana" });
        }
        if (review.reviewer.name.trim().toLocaleLowerCase() === review.author.trim().toLocaleLowerCase()) {
          ctx.issues.push({ code: "custom", input: review, path: ["reviewer", "name"], message: "Revisor e autor devem ser pessoas diferentes" });
        }
      }
      if (review.reviewedAt === null) {
        ctx.issues.push({ code: "custom", input: review, path: ["reviewedAt"], message: `Estado ${review.state} exige data de revisão` });
      }
    }
    if ((review.state === "rejeitado" || review.state === "retratado") && review.note === null) {
      ctx.issues.push({ code: "custom", input: review, path: ["note"], message: `Estado ${review.state} exige motivo registrado` });
    }
  });

export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;

/**
 * Transições permitidas. Nenhum caminho leva de `rascunho` a `publicado`
 * diretamente: a passagem por revisão é estrutural, não convenção.
 */
const TRANSITIONS: Readonly<Record<ReviewState, readonly ReviewState[]>> = {
  rascunho: ["em_revisao"],
  em_revisao: ["revisado", "rejeitado", "rascunho"],
  revisado: ["publicado", "em_revisao"],
  publicado: ["retratado", "em_revisao"],
  rejeitado: ["rascunho"],
  retratado: ["em_revisao"],
};

export function allowedTransitions(from: ReviewState): readonly ReviewState[] {
  return TRANSITIONS[from];
}

export function canTransition(from: ReviewState, to: ReviewState): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Aplica a transição e revalida o registro resultante. Devolve erros em vez de
 * lançar, porque o chamador costuma estar validando um lote.
 */
export function applyTransition(
  current: ReviewRecord,
  to: ReviewState,
  changes: { readonly reviewer?: Reviewer | null; readonly reviewedAt?: string | null; readonly note?: string | null } = {},
): { readonly ok: true; readonly review: ReviewRecord } | { readonly ok: false; readonly errors: readonly string[] } {
  if (!canTransition(current.state, to)) {
    return { ok: false, errors: [`Transição ${current.state} → ${to} não é permitida`] };
  }
  const candidate = {
    state: to,
    author: current.author,
    reviewer: changes.reviewer !== undefined ? changes.reviewer : current.reviewer,
    reviewedAt: changes.reviewedAt !== undefined ? changes.reviewedAt : current.reviewedAt,
    note: changes.note !== undefined ? changes.note : current.note,
  };
  const parsed = ReviewRecordSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, errors: issuesOf(parsed.error, "review") };
  return { ok: true, review: parsed.data };
}
