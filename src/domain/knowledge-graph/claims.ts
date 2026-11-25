/**
 * Afirmação de conhecimento, ligação com evidência e posição interpretativa
 * (KNOWLEDGE-GRAPH-001, fila A2).
 *
 * Uma afirmação só existe apoiada em evidência, e a ligação é **tipada**: a
 * mesma fonte pode apoiar, contestar, contextualizar ou apenas ser citada por
 * uma afirmação, e isso muda o que a interface deve dizer ao leitor. Guardar
 * essas quatro situações como "relacionado" perderia exatamente a informação
 * que faz diferença.
 *
 * Três recusas que o contrato impõe, todas tiradas da tabela de ramos:
 *
 * 1. **Tipo de afirmação fora do ramo.** `afirmacao_teologica` não entra como
 *    `dado_filologico`. É esse deslize que faz doutrina parecer dado de língua.
 * 2. **Tradição não declarada em afirmação interpretativa.** Apresentar uma
 *    tradição como leitura neutra é o erro mais fácil de cometer e o mais difícil
 *    de perceber depois de publicado.
 * 3. **Posição interpretativa sem localização na obra.** "Agostinho entendia
 *    assim" sem página é lista de nomes, não história da interpretação.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco, sem relógio.
 */

import { anchorIsPublishable, anchorKey, anchorsOverlap, PassageAnchorSchema, type PassageAnchor } from "./anchors";
import { branchDefinition, branchId, claimType, isInterpretive, relationAllowedIn, relationId, type ClaimType } from "./branches";
import { z } from "zod";
import {
  confidenceGrade,
  issuesOf,
  optionalText,
  requiredText,
  stableId,
} from "./primitives";
import { ReviewRecordSchema, isPublished } from "./review";
import {
  evidenceAnchoredAt,
  evidencePublicationErrors,
  localizesInsideWork,
  type EvidenceFragment,
  type ProvenanceIndex,
} from "./evidence";

export type EvidenceIndex = ReadonlyMap<string, EvidenceFragment>;

export function indexEvidence(fragments: readonly EvidenceFragment[]): EvidenceIndex {
  return new Map(fragments.map((fragment) => [fragment.id, fragment]));
}

/** Papéis que sustentam a afirmação; `contesta` registra oposição, não apoio. */
const SUPPORTING_ROLES: readonly string[] = ["apoia", "cita", "traduz", "interpreta", "contextualiza", "recebe", "aplica", "alude"];

export const ClaimEvidenceLinkSchema = z.strictObject({
  evidenceId: stableId,
  role: relationId,
  /** Por que esta evidência sustenta (ou contesta) a afirmação. */
  rationale: requiredText,
});

export type ClaimEvidenceLink = z.infer<typeof ClaimEvidenceLinkSchema>;

export const ClaimDivergenceSchema = z.strictObject({
  summary: requiredText,
  /** Evidência da divergência, quando existe registro dela no acervo. */
  evidenceId: stableId.nullable().default(null),
  heldBy: optionalText,
});

export const KnowledgeClaimSchema = z.strictObject({
  id: stableId,
  branch: branchId,
  claimType,
  anchors: z.array(PassageAnchorSchema).min(1),
  /** A afirmação em uma frase conferível. */
  statement: requiredText,
  /** Tradição, escola ou confissão de onde a afirmação fala. */
  tradition: optionalText,
  confidence: confidenceGrade,
  /** Por que este grau de confiança, e não outro. */
  confidenceBasis: optionalText,
  evidenceLinks: z.array(ClaimEvidenceLinkSchema).min(1),
  divergences: z.array(ClaimDivergenceSchema).default([]),
  review: ReviewRecordSchema,
  note: optionalText,
});

export type KnowledgeClaim = z.infer<typeof KnowledgeClaimSchema>;

export type ClaimValidationContext = {
  readonly evidence?: EvidenceIndex;
  readonly provenance?: ProvenanceIndex;
};

export type ClaimValidation =
  | { readonly ok: true; readonly claim: KnowledgeClaim; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly errors: readonly string[] };

export function validateClaim(input: unknown, context: ClaimValidationContext = {}): ClaimValidation {
  const parsed = KnowledgeClaimSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: issuesOf(parsed.error, "claim") };
  const claim = parsed.data;
  const branch = branchDefinition(claim.branch);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!branch.claimTypes.includes(claim.claimType)) {
    errors.push(
      `claim.claimType: afirmação do tipo ${claim.claimType} não pertence ao ramo ${claim.branch} (admite ${branch.claimTypes.join(", ")})`,
    );
  }

  if ((branch.obligations.requiresTradition || isInterpretive(claim.claimType)) && claim.tradition === null) {
    errors.push(`claim.tradition: ${claim.claimType} exige declarar a tradição de onde a afirmação fala; nenhuma leitura é neutra por omissão`);
  }

  if (branch.obligations.requiresConfidenceGrade && claim.confidenceBasis === null) {
    errors.push(`claim.confidenceBasis: o ramo ${claim.branch} é reconstrução e exige justificar o grau de confiança`);
  }

  const seen = new Set<string>();
  for (const link of claim.evidenceLinks) {
    if (seen.has(link.evidenceId)) {
      errors.push(`claim.evidenceLinks: evidência ${link.evidenceId} ligada mais de uma vez`);
    }
    seen.add(link.evidenceId);
    if (!relationAllowedIn(claim.branch, link.role)) {
      errors.push(`claim.evidenceLinks: a relação ${link.role} não é usada no ramo ${claim.branch} (admite ${branch.relations.join(", ")})`);
    }
  }
  if (!claim.evidenceLinks.some((link) => SUPPORTING_ROLES.includes(link.role))) {
    errors.push("claim.evidenceLinks: toda afirmação precisa de ao menos uma evidência de apoio, não só de contestação");
  }

  if (context.evidence !== undefined) {
    for (const link of claim.evidenceLinks) {
      const fragment = context.evidence.get(link.evidenceId);
      if (fragment === undefined) {
        errors.push(`claim.evidenceLinks: evidência ${link.evidenceId} não está registrada`);
        continue;
      }
      const touches = claim.anchors.some((anchor) => evidenceAnchoredAt(fragment, anchor));
      if (!touches) {
        // Aviso, e não erro: evidência de passagem paralela é legítima, mas
        // precisa ser percebida por quem revisa.
        warnings.push(`A evidência ${fragment.id} não está ancorada nas passagens da afirmação ${claim.id}`);
      }
      if (isPublished(claim.review.state)) {
        if (!isPublished(fragment.review.state)) {
          errors.push(`claim.review: afirmação publicada não pode depender da evidência ${fragment.id}, que está em ${fragment.review.state}`);
        }
        if (context.provenance !== undefined) {
          for (const message of evidencePublicationErrors(fragment, context.provenance)) {
            errors.push(`claim.review: ${message}`);
          }
        }
      }
    }
  }

  if (isPublished(claim.review.state)) {
    for (const anchor of claim.anchors) {
      if (!anchorIsPublishable(anchor)) {
        errors.push(`claim.anchors: ${anchorKey(anchor)} usa cânon ou versificação pendente de aprovação e não pode ser publicada`);
      }
    }
  }

  return errors.length === 0 ? { ok: true, claim, warnings } : { ok: false, errors };
}

/**
 * Posição interpretativa: quem interpretou, em que obra, em que lugar da obra.
 *
 * `evidenceId` é obrigatório e precisa localizar a leitura **dentro da obra**.
 * Sem isso o registro vira a lista de nomes que a tabela de ramos proíbe — e
 * uma lista de nomes é exatamente o que um modelo de linguagem produz quando não
 * tem fonte.
 */
export const InterpretationPositionSchema = z.strictObject({
  id: stableId,
  anchors: z.array(PassageAnchorSchema).min(1),
  workId: stableId,
  editionId: stableId,
  /** Nome como a obra o apresenta, sem normalizar para um autor "canônico". */
  authorName: requiredText,
  tradition: requiredText,
  /** Datação da posição, não da edição moderna que a publica. */
  period: requiredText,
  thesis: requiredText,
  /** Evidência que localiza a tese na obra. */
  evidenceId: stableId,
  /** Afirmação curada que esta posição sustenta, quando houver. */
  claimId: stableId.nullable().default(null),
  confidence: confidenceGrade,
  review: ReviewRecordSchema,
  note: optionalText,
});

export type InterpretationPosition = z.infer<typeof InterpretationPositionSchema>;

export type PositionValidation =
  | { readonly ok: true; readonly position: InterpretationPosition; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly errors: readonly string[] };

export function validateInterpretationPosition(
  input: unknown,
  context: ClaimValidationContext = {},
): PositionValidation {
  const parsed = InterpretationPositionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: issuesOf(parsed.error, "position") };
  const position = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (context.evidence !== undefined) {
    const fragment = context.evidence.get(position.evidenceId);
    if (fragment === undefined) {
      errors.push(`position.evidenceId: evidência ${position.evidenceId} não está registrada`);
    } else {
      if (!localizesInsideWork(fragment.locator)) {
        errors.push(
          `position.evidenceId: a evidência ${fragment.id} não localiza a interpretação dentro da obra; informe página, seção, parágrafo, fólio ou linha`,
        );
      }
      if (fragment.editionId !== position.editionId) {
        errors.push(`position.editionId: a evidência ${fragment.id} está na edição ${fragment.editionId}, não em ${position.editionId}`);
      }
      const touches = position.anchors.some((anchor) => evidenceAnchoredAt(fragment, anchor));
      if (!touches) {
        errors.push(`position.anchors: a evidência ${fragment.id} não está ancorada na passagem desta posição`);
      }
      if (isPublished(position.review.state) && !isPublished(fragment.review.state)) {
        errors.push(`position.review: posição publicada não pode depender da evidência ${fragment.id}, que está em ${fragment.review.state}`);
      }
      if (isPublished(position.review.state) && context.provenance !== undefined) {
        for (const message of evidencePublicationErrors(fragment, context.provenance)) {
          errors.push(`position.review: ${message}`);
        }
      }
    }
  }

  if (context.evidence === undefined) {
    warnings.push(`A posição ${position.id} foi validada sem índice de evidência: a localização na obra não foi conferida`);
  }

  return errors.length === 0 ? { ok: true, position, warnings } : { ok: false, errors };
}

/** Tipos de afirmação que a interface precisa rotular como não-dado. */
export function claimNeedsInterpretiveLabel(type: ClaimType): boolean {
  return isInterpretive(type);
}

/** Afirmações que tocam a passagem, na ordem em que foram recebidas. */
export function claimsAnchoredAt(claims: readonly KnowledgeClaim[], anchor: PassageAnchor): readonly KnowledgeClaim[] {
  return claims.filter((claim) => claim.anchors.some((candidate) => anchorsOverlap(candidate, anchor)));
}
