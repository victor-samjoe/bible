/**
 * Conexões tipadas entre passagens (KNOWLEDGE-GRAPH-001, fila A2).
 *
 * `MIC 5:2` e `MAT 2:6` estão ligados, mas dizer apenas "ligados" não informa
 * nada: a relação é de **citação**, feita pelo evangelista, atestada no texto
 * grego, e ela não é simétrica. Uma conexão sem relação tipada e sem evidência
 * é um palpite com aparência de referência cruzada — e referência cruzada é
 * precisamente o tipo de dado que se propaga sem ninguém reconferir.
 *
 * Por isso toda conexão exige:
 *
 * - relação da lista fechada, admitida pelo ramo que a declara;
 * - evidência registrada, ancorada em uma das duas pontas;
 * - direção explícita, porque `cita` e `alude` têm sentido, enquanto
 *   `contextualiza` costuma valer nos dois.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco.
 */

import { z } from "zod";
import {
  anchorIsPublishable,
  anchorKey,
  anchorsOverlap,
  PassageAnchorSchema,
  type PassageAnchor,
} from "./anchors";
import { branchDefinition, branchId, relationAllowedIn, relationId } from "./branches";
import { confidenceGrade, issuesOf, optionalText, requiredText, stableId } from "./primitives";
import { ReviewRecordSchema, isPublished } from "./review";
import { evidenceAnchoredAt } from "./evidence";
import type { EvidenceIndex } from "./claims";

export const PassageConnectionSchema = z.strictObject({
  id: stableId,
  from: PassageAnchorSchema,
  to: PassageAnchorSchema,
  relation: relationId,
  /** Ramo sob o qual a conexão é afirmada. */
  branch: branchId,
  direction: z.enum(["unidirecional", "bidirecional"]),
  /** Evidência que registra a conexão. Sem ela, não há conexão. */
  evidenceId: stableId,
  rationale: requiredText,
  confidence: confidenceGrade,
  review: ReviewRecordSchema,
  note: optionalText,
});

export type PassageConnection = z.infer<typeof PassageConnectionSchema>;

export type ConnectionValidation =
  | { readonly ok: true; readonly connection: PassageConnection; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly errors: readonly string[] };

export function validatePassageConnection(input: unknown, evidence?: EvidenceIndex): ConnectionValidation {
  const parsed = PassageConnectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: issuesOf(parsed.error, "connection") };
  const connection = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (anchorKey(connection.from) === anchorKey(connection.to)) {
    errors.push("connection.to: a conexão precisa ligar passagens diferentes");
  }
  if (!relationAllowedIn(connection.branch, connection.relation)) {
    errors.push(
      `connection.relation: ${connection.relation} não é usada no ramo ${connection.branch} (admite ${branchDefinition(connection.branch).relations.join(", ")})`,
    );
  }

  if (evidence !== undefined) {
    const fragment = evidence.get(connection.evidenceId);
    if (fragment === undefined) {
      errors.push(`connection.evidenceId: evidência ${connection.evidenceId} não está registrada`);
    } else {
      const touches = evidenceAnchoredAt(fragment, connection.from) || evidenceAnchoredAt(fragment, connection.to);
      if (!touches) {
        errors.push(`connection.evidenceId: a evidência ${fragment.id} não está ancorada em nenhuma das duas passagens`);
      }
      if (isPublished(connection.review.state) && !isPublished(fragment.review.state)) {
        errors.push(`connection.review: conexão publicada não pode depender da evidência ${fragment.id}, que está em ${fragment.review.state}`);
      }
    }
  } else {
    warnings.push(`A conexão ${connection.id} foi validada sem índice de evidência`);
  }

  if (isPublished(connection.review.state)) {
    for (const anchor of [connection.from, connection.to]) {
      if (!anchorIsPublishable(anchor)) {
        errors.push(`connection: ${anchorKey(anchor)} usa cânon ou versificação pendente de aprovação e não pode ser publicada`);
      }
    }
  }

  return errors.length === 0 ? { ok: true, connection, warnings } : { ok: false, errors };
}

/**
 * Conexões que saem da passagem, mais as bidirecionais que chegam a ela.
 *
 * A seleção é por **sobreposição**, como no resto da frente: conexão que parte
 * de um intervalo é alcançada por consulta a qualquer versículo dele. O
 * contrato de direção não muda — `to` só conta quando a conexão é
 * `bidirecional`, porque conexão unidirecional que chega aqui não sai daqui.
 *
 * A montagem da chave à mão que esta função fazia foi removida: duplicava o
 * formato de `anchorKey` e, coincidindo hoje, deixava duas respostas no
 * repositório para a mesma pergunta — e a errada seria mais fácil de achar
 * depois. A equivalência entre as duas está provada em
 * `tests/domain/knowledge-graph-references.test.ts`.
 */
export function connectionsFrom(
  connections: readonly PassageConnection[],
  anchor: PassageAnchor,
): readonly PassageConnection[] {
  return connections.filter(
    (connection) =>
      anchorsOverlap(connection.from, anchor)
      || (connection.direction === "bidirecional" && anchorsOverlap(connection.to, anchor)),
  );
}
