/**
 * Projeção da árvore por passagem (KNOWLEDGE-GRAPH-001, fila A2).
 *
 * Este módulo é o lugar onde os estados de revisão deixam de ser documentação e
 * passam a ter efeito. Os contratos do domínio sabem dizer que um registro está
 * em `rascunho`; é aqui que `rascunho` **não é servido**. Sem esta fronteira o
 * estado seria um campo que todos gravam e ninguém consulta, e o que aparece ao
 * leitor voltaria a depender de quem cadastrou por último.
 *
 * Três decisões que a projeção impõe:
 *
 * 1. **Só `publicado` sai.** Vale para evidência, afirmação, posição e conexão,
 *    e vale em cadeia: afirmação publicada apoiada em evidência não publicada é
 *    recusada pela própria validação do domínio.
 * 2. **Nada é omitido em silêncio.** Todo registro descartado aparece em
 *    `withheld` com motivo. Uma árvore que mostra dois cartões porque oito
 *    falharam na validação, sem dizer isso, é pior do que uma árvore vazia: ela
 *    afirma cobertura que não tem (`docs/VERSE_KNOWLEDGE_GRAPH.md` §3).
 * 3. **Ramo sem material publicado é declarado vazio, não escondido.** A lacuna
 *    é informação: diz ao leitor que a plataforma não cobriu aquela perspectiva
 *    nesta passagem, em vez de sugerir que não há nada a dizer.
 *
 * `withheld` carrega identificador, tipo e motivo — nunca o conteúdo do registro
 * recusado. Vazar a citação de uma evidência não publicada pelo relatório de
 * recusa anularia a própria recusa.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco, sem relógio.
 */

import {
  anchorContains,
  anchorKey,
  compareAnchors,
  anchorsOverlap,
  canonicalRef,
  type PassageAnchor,
} from "../../domain/knowledge-graph/anchors";
import {
  BRANCH_IDS,
  BRANCHES,
  branchDefinition,
  type BranchId,
  type ClaimType,
} from "../../domain/knowledge-graph/branches";
import {
  claimNeedsInterpretiveLabel,
  indexEvidence,
  validateClaim,
  validateInterpretationPosition,
  type EvidenceIndex,
  type KnowledgeClaim,
  type InterpretationPosition,
} from "../../domain/knowledge-graph/claims";
import {
  validatePassageConnection,
  type PassageConnection,
} from "../../domain/knowledge-graph/connections";
import {
  evidenceAnchoredAt,
  evidencePublicationErrors,
  indexProvenance,
  validateEvidence,
  type EvidenceContent,
  type EvidenceFragment,
  type ProvenanceIndex,
} from "../../domain/knowledge-graph/evidence";
import { duplicateIds, type ConfidenceGrade, type SourceTier } from "../../domain/knowledge-graph/primitives";
import {
  citationLabel,
  formatLocator,
  SourceArtifactSchema,
  SourceEditionSchema,
  SourceWorkSchema,
  type RightsStatus,
  type SourceArtifact,
  type SourceEdition,
  type SourceWork,
} from "../../domain/knowledge-graph/provenance";
import { isPublished } from "../../domain/knowledge-graph/review";
import { TextualWitnessSchema, type TextualWitness } from "../../domain/knowledge-graph/witnesses";
import type { KnowledgeGraphQuery, PassageBundleRows } from "./contracts";

/* ------------------------------------------------------------------- recusas */

export const WITHHELD_KINDS = ["work", "edition", "artifact", "witness", "evidence", "claim", "position", "connection"] as const;
export type WithheldKind = (typeof WITHHELD_KINDS)[number];

export const WITHHELD_REASONS = ["invalido", "nao_publicado", "direitos_nao_liberados", "fora_da_passagem"] as const;
export type WithheldReason = (typeof WITHHELD_REASONS)[number];

export type WithheldRecord = {
  readonly kind: WithheldKind;
  readonly id: string | null;
  readonly reason: WithheldReason;
  /** Mensagens da validação. Diagnóstico de contrato, nunca conteúdo da fonte. */
  readonly details: readonly string[];
};

/* -------------------------------------------------------------------- cartões */

/**
 * Extensão real do registro, para a consulta que o alcançou.
 *
 * A travessia inclui por sobreposição: material ancorado em Gênesis 1:1–5
 * aparece ao consultar 1:3. Sem dizer a extensão, a árvore sugeriria precisão
 * de versículo que o registro não tem — e evidência sobre cinco versículos
 * seria lida como prova sobre um. Pertencer não é equivaler, e é este campo que
 * obriga a interface a mostrar a diferença.
 */
export type CardScope = {
  /**
   * Extensão **inteira** do registro, em ordem canônica — não só a parte que a
   * consulta tocou. Quem consulta Gênesis 2:2 precisa saber que a afirmação
   * começa em 1:31, ou a perícope passa por afirmação sobre o capítulo 2.
   *
   * Enumerar as partes não afirma que elas se tocam: contiguidade exige a
   * contagem de versículos por capítulo, que a frente não tem.
   */
  readonly keys: readonly string[];
  /** As âncoras que a consulta efetivamente tocou, subconjunto de `keys`. */
  readonly matched: readonly string[];
  /** Referência legível da extensão inteira, partes separadas por `; `. */
  readonly reference: string;
  /** `true` quando o registro cobre mais do que foi consultado. */
  readonly broaderThanQuery: boolean;
};

export type EvidenceCard = {
  readonly id: string;
  readonly branch: BranchId;
  readonly tier: SourceTier;
  readonly language: string;
  /** Extensão do fragmento, que pode ser maior que a passagem consultada. */
  readonly scope: CardScope;
  /** Citação bibliográfica montada dos registros, não digitada. */
  readonly citation: string;
  readonly locator: string;
  readonly attribution: string;
  readonly rightsStatus: RightsStatus;
  readonly content: EvidenceContent;
  readonly confidence: ConfidenceGrade;
  readonly knownDisputes: readonly string[];
  /** Sigla do testemunho atestado, quando o ramo exige um. */
  readonly witnessSiglum: string | null;
};

export type ClaimCard = {
  readonly id: string;
  readonly branch: BranchId;
  readonly claimType: ClaimType;
  readonly statement: string;
  /** Extensão da afirmação, que pode ser maior que a passagem consultada. */
  readonly scope: CardScope;
  readonly tradition: string | null;
  readonly confidence: ConfidenceGrade;
  readonly confidenceBasis: string | null;
  /**
   * `true` quando a interface precisa rotular a afirmação como interpretação, e
   * não como dado. É o eixo do produto: mostrar lado a lado sem igualar o peso.
   */
  readonly interpretive: boolean;
  readonly support: readonly { readonly evidenceId: string; readonly role: string; readonly rationale: string }[];
  readonly divergences: readonly string[];
};

export type PositionCard = {
  readonly id: string;
  /** Extensão da posição, que pode ser maior que a passagem consultada. */
  readonly scope: CardScope;
  readonly authorName: string;
  readonly tradition: string;
  readonly period: string;
  readonly thesis: string;
  readonly evidenceId: string;
  readonly confidence: ConfidenceGrade;
};

export type ConnectionCard = {
  readonly id: string;
  /** Extensão da ponta de partida, que pode ser maior que a consulta. */
  readonly scope: CardScope;
  readonly fromKey: string;
  readonly toKey: string;
  readonly toReference: string;
  readonly relation: string;
  readonly branch: BranchId;
  readonly direction: "unidirecional" | "bidirecional";
  readonly evidenceId: string;
  readonly rationale: string;
  readonly confidence: ConfidenceGrade;
};

export type BranchSection = {
  readonly branch: BranchId;
  readonly label: string;
  readonly question: string;
  readonly claims: readonly ClaimCard[];
  readonly positions: readonly PositionCard[];
  readonly evidence: readonly EvidenceCard[];
  /** Sem nada publicado neste ramo para esta passagem. */
  readonly empty: boolean;
};

export type PassageTree = {
  readonly anchor: PassageAnchor;
  readonly anchorKey: string;
  readonly reference: string;
  readonly branches: readonly BranchSection[];
  readonly connections: readonly ConnectionCard[];
  /** Cobertura declarada, como a documentação exige: o que há e o que falta. */
  readonly coverage: {
    readonly publishedBranches: readonly BranchId[];
    readonly emptyBranches: readonly BranchId[];
    readonly evidenceCount: number;
    readonly claimCount: number;
  };
  readonly withheld: readonly WithheldRecord[];
};

/* ------------------------------------------------------------------ auxiliares */

function idOf(row: unknown): string | null {
  if (typeof row !== "object" || row === null) return null;
  const candidate = (row as { id?: unknown }).id;
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : null;
}

/**
 * Extensão do registro para a consulta que o alcançou.
 *
 * Considera apenas as âncoras que tocam a passagem: um fragmento ancorado em
 * 1:1–5 e em 2:3, alcançado por consulta a 1:3, tem escala 1:1–5 — citar 2:3
 * aqui sugeriria cobertura que a consulta não pediu. `broaderThanQuery` é
 * verdadeiro quando a consulta **não contém** a âncora do registro, isto é,
 * quando ele fala de mais do que foi perguntado.
 */
function scopeOf(anchors: readonly PassageAnchor[], anchor: PassageAnchor): CardScope {
  const extent = [...anchors].sort(compareAnchors);
  const matched = extent.filter((candidate) => anchorsOverlap(candidate, anchor));
  return {
    keys: extent.map((candidate) => anchorKey(candidate)),
    matched: matched.map((candidate) => anchorKey(candidate)),
    reference: extent.length > 0
      ? extent.map((candidate) => canonicalRef(candidate)).join("; ")
      : canonicalRef(anchor),
    // Mais largo que a consulta sempre que alguma parte do registro não cabe
    // dentro dela — inclusive uma parte em outro capítulo.
    broaderThanQuery: extent.some((candidate) => !anchorContains(anchor, candidate)),
  };
}

/**
 * Derruba todo registro cujo identificador é disputado por outro do mesmo tipo.
 *
 * Os índices da frente são `Map`s montados por `new Map(lista.map(...))`, onde o
 * último a entrar vence **em silêncio**. Entre duas edições de mesmo
 * identificador e licenças opostas, a ordem das linhas passaria a decidir se o
 * conteúdo é exibido, e uma citação poderia sair atribuída à fonte errada.
 *
 * Então falha fechado: na dúvida sobre qual é a fonte, nenhuma é servida.
 * Escolher a última seria servir a errada metade das vezes, sem registro de que
 * houve escolha. A recusa é declarada em `withheld`, como qualquer outra.
 */
function rejectDisputedIds<T extends { readonly id: string }>(
  items: readonly T[],
  kind: WithheldKind,
  withheld: WithheldRecord[],
): readonly T[] {
  const disputed = new Set(duplicateIds(items.map((item) => item.id)));
  if (disputed.size === 0) return items;
  for (const id of disputed) {
    const count = items.filter((item) => item.id === id).length;
    withheld.push({
      kind,
      id,
      reason: "invalido",
      details: [`identificador duplicado: ${count} registros disputam ${id}, e nenhum pode ser servido`],
    });
  }
  return items.filter((item) => !disputed.has(item.id));
}

/**
 * Valida um lote de registros de proveniência, separando aprovados de recusados.
 * Proveniência inválida não derruba a passagem inteira: ela derruba o que
 * depende dela, e a evidência órfã cai depois, pela validação cruzada.
 */
function collect<T>(
  rows: readonly unknown[],
  kind: WithheldKind,
  parse: (row: unknown) => { readonly success: true; readonly data: T } | { readonly success: false; readonly messages: readonly string[] },
  withheld: WithheldRecord[],
): readonly T[] {
  const accepted: T[] = [];
  for (const row of rows) {
    const parsed = parse(row);
    if (parsed.success) accepted.push(parsed.data);
    else withheld.push({ kind, id: idOf(row), reason: "invalido", details: parsed.messages });
  }
  return accepted;
}

function schemaCollector<T>(schema: { safeParse(input: unknown): { success: boolean; data?: unknown; error?: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } } }) {
  return (row: unknown): { readonly success: true; readonly data: T } | { readonly success: false; readonly messages: readonly string[] } => {
    const parsed = schema.safeParse(row);
    if (parsed.success) return { success: true, data: parsed.data as T };
    const messages = (parsed.error?.issues ?? []).map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    return { success: false, messages: messages.length > 0 ? messages : ["registro inválido"] };
  };
}

/* ------------------------------------------------------------------- projeção */

/**
 * Monta a árvore publicável da passagem a partir das linhas cruas.
 *
 * Função pura e total: não lança. Entrada ruim produz árvore vazia com os
 * motivos em `withheld`, porque quem chama precisa poder mostrar "não localizado
 * no acervo" sem distinguir falha de ausência.
 */
export function projectPassageTree(query: KnowledgeGraphQuery, rows: PassageBundleRows): PassageTree {
  const withheld: WithheldRecord[] = [];
  const anchor = query.anchor;
  const key = anchorKey(anchor);

  // Identidade primeiro: índice montado sobre identificador disputado serviria
  // a fonte errada sem registrar que houve escolha.
  const works = rejectDisputedIds(collect<SourceWork>(rows.works, "work", schemaCollector(SourceWorkSchema), withheld), "work", withheld);
  const editions = rejectDisputedIds(collect<SourceEdition>(rows.editions, "edition", schemaCollector(SourceEditionSchema), withheld), "edition", withheld);
  const artifacts = rejectDisputedIds(collect<SourceArtifact>(rows.artifacts, "artifact", schemaCollector(SourceArtifactSchema), withheld), "artifact", withheld);
  const witnesses = rejectDisputedIds(collect<TextualWitness>(rows.witnesses, "witness", schemaCollector(TextualWitnessSchema), withheld), "witness", withheld);

  const provenance: ProvenanceIndex = indexProvenance(editions, artifacts, witnesses);
  const workById = new Map(works.map((work) => [work.id, work]));
  const witnessById = new Map(witnesses.map((witness) => [witness.id, witness]));

  /* --------------------------------------------------------------- evidência */

  const publishedEvidence: EvidenceFragment[] = [];
  for (const row of rows.evidence) {
    const result = validateEvidence(row, provenance);
    if (!result.ok) {
      withheld.push({ kind: "evidence", id: idOf(row), reason: "invalido", details: result.errors });
      continue;
    }
    const evidence = result.evidence;
    if (!isPublished(evidence.review.state)) {
      withheld.push({ kind: "evidence", id: evidence.id, reason: "nao_publicado", details: [`estado ${evidence.review.state}`] });
      continue;
    }
    const rightsErrors = evidencePublicationErrors(evidence, provenance);
    if (rightsErrors.length > 0) {
      withheld.push({ kind: "evidence", id: evidence.id, reason: "direitos_nao_liberados", details: rightsErrors });
      continue;
    }
    publishedEvidence.push(evidence);
  }

  const uniqueEvidence = rejectDisputedIds(publishedEvidence, "evidence", withheld);

  // Defesa em profundidade: a porta busca por passagem, mas um repositório que
  // devolva vizinhos não deve alargar a árvore em silêncio.
  const anchoredEvidence = uniqueEvidence.filter((evidence) => {
    if (evidenceAnchoredAt(evidence, anchor)) return true;
    withheld.push({ kind: "evidence", id: evidence.id, reason: "fora_da_passagem", details: [`não está ancorada em ${key}`] });
    return false;
  });

  const evidenceIndex: EvidenceIndex = indexEvidence(anchoredEvidence);
  const context = { evidence: evidenceIndex, provenance };

  /* -------------------------------------------------------------- afirmações */

  const collectedClaims: KnowledgeClaim[] = [];
  for (const row of rows.claims) {
    const result = validateClaim(row, context);
    if (!result.ok) {
      withheld.push({ kind: "claim", id: idOf(row), reason: "invalido", details: result.errors });
      continue;
    }
    const claim = result.claim;
    if (!isPublished(claim.review.state)) {
      withheld.push({ kind: "claim", id: claim.id, reason: "nao_publicado", details: [`estado ${claim.review.state}`] });
      continue;
    }
    if (!claim.anchors.some((candidate) => anchorsOverlap(candidate, anchor))) {
      withheld.push({ kind: "claim", id: claim.id, reason: "fora_da_passagem", details: [`não toca ${key}`] });
      continue;
    }
    collectedClaims.push(claim);
  }
  const claims = rejectDisputedIds(collectedClaims, "claim", withheld);

  const collectedPositions: InterpretationPosition[] = [];
  for (const row of rows.positions) {
    const result = validateInterpretationPosition(row, context);
    if (!result.ok) {
      withheld.push({ kind: "position", id: idOf(row), reason: "invalido", details: result.errors });
      continue;
    }
    const position = result.position;
    if (!isPublished(position.review.state)) {
      withheld.push({ kind: "position", id: position.id, reason: "nao_publicado", details: [`estado ${position.review.state}`] });
      continue;
    }
    if (!position.anchors.some((candidate) => anchorsOverlap(candidate, anchor))) {
      withheld.push({ kind: "position", id: position.id, reason: "fora_da_passagem", details: [`não toca ${key}`] });
      continue;
    }
    collectedPositions.push(position);
  }
  const positions = rejectDisputedIds(collectedPositions, "position", withheld);

  /* ---------------------------------------------------------------- conexões */

  const collectedConnections: PassageConnection[] = [];
  for (const row of rows.connections) {
    const result = validatePassageConnection(row, evidenceIndex);
    if (!result.ok) {
      withheld.push({ kind: "connection", id: idOf(row), reason: "invalido", details: result.errors });
      continue;
    }
    const connection = result.connection;
    if (!isPublished(connection.review.state)) {
      withheld.push({ kind: "connection", id: connection.id, reason: "nao_publicado", details: [`estado ${connection.review.state}`] });
      continue;
    }
    // Sobreposição, como no resto da travessia: conexão que parte de um
    // intervalo é alcançada por consulta a qualquer versículo dele.
    const touchesFrom = anchorsOverlap(connection.from, anchor);
    const touchesTo = connection.direction === "bidirecional" && anchorsOverlap(connection.to, anchor);
    if (!touchesFrom && !touchesTo) {
      withheld.push({ kind: "connection", id: connection.id, reason: "fora_da_passagem", details: [`não parte de ${key}`] });
      continue;
    }
    collectedConnections.push(connection);
  }
  const connections = rejectDisputedIds(collectedConnections, "connection", withheld);

  /* ---------------------------------------------------------------- cartões */

  function evidenceCard(evidence: EvidenceFragment): EvidenceCard | null {
    const edition = provenance.editions.get(evidence.editionId);
    if (edition === undefined) return null;
    const work = workById.get(edition.workId);
    const witness = evidence.witnessId === null ? null : witnessById.get(evidence.witnessId) ?? null;
    return {
      id: evidence.id,
      branch: evidence.branch,
      tier: evidence.tier,
      language: evidence.language,
      scope: scopeOf(evidence.anchors, anchor),
      citation: work === undefined
        ? `${edition.label} (obra não registrada), ${formatLocator(evidence.locator)}`
        : citationLabel(work, edition, evidence.locator),
      locator: formatLocator(evidence.locator),
      attribution: edition.rights.attribution,
      rightsStatus: edition.rights.status,
      content: evidence.content,
      confidence: evidence.confidence,
      knownDisputes: evidence.knownDisputes,
      witnessSiglum: witness === null ? null : witness.siglum,
    };
  }

  const wanted: readonly BranchId[] = query.branches.length === 0 ? BRANCH_IDS : query.branches;
  const sections: BranchSection[] = [];
  let evidenceCount = 0;

  for (const branchId of BRANCHES.map((branch) => branch.id)) {
    if (!wanted.includes(branchId)) continue;
    const definition = branchDefinition(branchId);
    const branchEvidence = anchoredEvidence
      .filter((evidence) => evidence.branch === branchId)
      .flatMap((evidence) => {
        const card = evidenceCard(evidence);
        if (card === null) {
          withheld.push({ kind: "evidence", id: evidence.id, reason: "invalido", details: [`edição ${evidence.editionId} não registrada`] });
          return [];
        }
        return [card];
      });
    const branchClaims: ClaimCard[] = claims
      .filter((claim) => claim.branch === branchId)
      .map((claim) => ({
        id: claim.id,
        branch: claim.branch,
        claimType: claim.claimType,
        statement: claim.statement,
        scope: scopeOf(claim.anchors, anchor),
        tradition: claim.tradition,
        confidence: claim.confidence,
        confidenceBasis: claim.confidenceBasis,
        interpretive: claimNeedsInterpretiveLabel(claim.claimType),
        support: claim.evidenceLinks.map((link) => ({ evidenceId: link.evidenceId, role: link.role, rationale: link.rationale })),
        divergences: claim.divergences.map((divergence) => divergence.summary),
      }));
    const branchPositions: PositionCard[] = branchId !== "historia-interpretacao"
      ? []
      : positions.map((position) => ({
          id: position.id,
          scope: scopeOf(position.anchors, anchor),
          authorName: position.authorName,
          tradition: position.tradition,
          period: position.period,
          thesis: position.thesis,
          evidenceId: position.evidenceId,
          confidence: position.confidence,
        }));

    evidenceCount += branchEvidence.length;
    sections.push({
      branch: branchId,
      label: definition.label,
      question: definition.question,
      claims: branchClaims,
      positions: branchPositions,
      evidence: branchEvidence,
      empty: branchEvidence.length === 0 && branchClaims.length === 0 && branchPositions.length === 0,
    });
  }

  return {
    anchor,
    anchorKey: key,
    reference: canonicalRef(anchor),
    branches: sections,
    connections: connections.map((connection) => ({
      id: connection.id,
      scope: scopeOf([connection.from], anchor),
      fromKey: anchorKey(connection.from),
      toKey: anchorKey(connection.to),
      toReference: canonicalRef(connection.to),
      relation: connection.relation,
      branch: connection.branch,
      direction: connection.direction,
      evidenceId: connection.evidenceId,
      rationale: connection.rationale,
      confidence: connection.confidence,
    })),
    coverage: {
      publishedBranches: sections.filter((section) => !section.empty).map((section) => section.branch),
      emptyBranches: sections.filter((section) => section.empty).map((section) => section.branch),
      evidenceCount,
      claimCount: claims.length,
    },
    withheld,
  };
}

/** `true` quando nada publicado sobreviveu — o caso "não localizado no acervo". */
export function treeIsEmpty(tree: PassageTree): boolean {
  return tree.coverage.publishedBranches.length === 0 && tree.connections.length === 0;
}
