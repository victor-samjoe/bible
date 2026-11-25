/**
 * Porta de leitura da árvore de conhecimento (KNOWLEDGE-GRAPH-001, fila A2).
 *
 * Aqui ficam a consulta, a porta de dados e os motivos de recusa. Nada de SQL:
 * a implementação Drizzle depende de uma migration que ainda não está
 * autorizada, e escrevê-la agora obrigaria a inventar nomes de tabela antes da
 * decisão. A porta é suficiente para provar a camada com repositório em memória,
 * que é exatamente o que os testes fazem.
 *
 * As linhas entram como `unknown` de propósito. Quem responde a esta porta é
 * banco, importador ou fixture — nenhum dos três é de confiança para o tipo, e
 * `projectPassageTree` revalida tudo pelos contratos do domínio. É o mesmo
 * tratamento que `projectOriginalVerses` dá às linhas do leitor de originais.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco.
 */

import {
  PassageAnchorSchema,
  parseAnchorKey,
  type PassageAnchor,
} from "../../domain/knowledge-graph/anchors";
import { BRANCH_IDS, type BranchId } from "../../domain/knowledge-graph/branches";

/**
 * Consulta por passagem. `branches` vazio significa todos os ramos — e não
 * "nenhum", porque uma lista vazia de filtro é o caso normal de quem abre a
 * passagem sem escolher perspectiva.
 */
export type KnowledgeGraphQuery = {
  readonly anchor: PassageAnchor;
  readonly branches: readonly BranchId[];
};

function parseBranches(input: unknown): readonly BranchId[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) return null;
  const branches: BranchId[] = [];
  for (const candidate of input) {
    if (typeof candidate !== "string") return null;
    const branch = BRANCH_IDS.find((id) => id === candidate.trim());
    if (branch === undefined) return null;
    if (!branches.includes(branch)) branches.push(branch);
  }
  return branches;
}

/**
 * Aceita a âncora como registro tipado ou como chave citável
 * (`protestante/blivre-pt/GEN 1:1`). A chave existe porque ela é o que viaja em
 * URL e em cache; aceitar só o registro obrigaria quem chama a desmontá-la na
 * mão, que é onde o cânon e o sistema se perdem.
 */
export function parseKnowledgeGraphQuery(input: unknown): KnowledgeGraphQuery | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;

  const branches = parseBranches(record.branches);
  if (branches === null) return null;

  if (typeof record.anchorKey === "string") {
    const parsed = parseAnchorKey(record.anchorKey);
    return parsed.ok ? { anchor: parsed.anchor, branches } : null;
  }

  const parsed = PassageAnchorSchema.safeParse(record.anchor);
  return parsed.success ? { anchor: parsed.data, branches } : null;
}

/**
 * Linhas cruas de uma passagem. Uma chamada, um pacote: a árvore só pode ser
 * validada com a proveniência na mão, porque evidência sem a edição que a
 * publica não passa pela própria validação do domínio. Buscar em sete idas
 * separadas convidaria a montar a árvore com metade do pacote.
 */
export type PassageBundleRows = {
  readonly works: readonly unknown[];
  readonly editions: readonly unknown[];
  readonly artifacts: readonly unknown[];
  readonly witnesses: readonly unknown[];
  readonly evidence: readonly unknown[];
  readonly claims: readonly unknown[];
  readonly positions: readonly unknown[];
  readonly connections: readonly unknown[];
};

export type KnowledgeGraphRepository = {
  loadPassage(query: KnowledgeGraphQuery): Promise<PassageBundleRows>;
};

/** Motivos de recusa. Fechados, para que a interface não invente mensagem. */
export const KNOWLEDGE_GRAPH_FAILURES = ["invalid_query", "unavailable", "not_published"] as const;
export type KnowledgeGraphFailure = (typeof KNOWLEDGE_GRAPH_FAILURES)[number];
