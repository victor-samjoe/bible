/**
 * Camada de leitura da árvore de conhecimento (KNOWLEDGE-GRAPH-001, fila A2).
 *
 * Sem UI, sem IA, sem corpus novo e sem banco remoto: a porta de dados é
 * injetada e a implementação Drizzle fica para quando a migration das tabelas
 * estiver autorizada. Ver `tasks/product/knowledge-graph-001.md`.
 */

export {
  KNOWLEDGE_GRAPH_FAILURES,
  parseKnowledgeGraphQuery,
  type KnowledgeGraphFailure,
  type KnowledgeGraphQuery,
  type KnowledgeGraphRepository,
  type PassageBundleRows,
} from "./contracts";

export {
  createKnowledgeGraphReader,
  type KnowledgeGraphReader,
  type KnowledgeGraphResult,
} from "./reader";

export {
  projectPassageTree,
  treeIsEmpty,
  WITHHELD_KINDS,
  WITHHELD_REASONS,
  type BranchSection,
  type ClaimCard,
  type ConnectionCard,
  type EvidenceCard,
  type PassageTree,
  type PositionCard,
  type WithheldKind,
  type WithheldReason,
  type WithheldRecord,
} from "./tree";
