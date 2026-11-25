/**
 * Leitor da árvore por passagem (KNOWLEDGE-GRAPH-001, fila A2).
 *
 * Falha fechada, no mesmo contrato do leitor de originais: sem repositório, a
 * resposta é `unavailable`; com consulta malformada, `invalid_query`; sem nada
 * publicado, `not_published`. Nunca uma árvore parcial apresentada como
 * completa, e nunca uma exceção atravessando a camada.
 *
 * `not_published` tem nome próprio em vez de `not_found` porque as duas
 * situações são diferentes para quem lê: a passagem existe, o acervo é que não
 * cobriu — e esse é o texto honesto a exibir. Mesmo nesse caso a árvore vai no
 * resultado, porque `withheld` e `emptyBranches` explicam o vazio.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco.
 */

import {
  parseKnowledgeGraphQuery,
  type KnowledgeGraphFailure,
  type KnowledgeGraphRepository,
} from "./contracts";
import { projectPassageTree, treeIsEmpty, type PassageTree } from "./tree";

export type KnowledgeGraphResult =
  | { readonly ok: true; readonly tree: PassageTree }
  | { readonly ok: false; readonly reason: Exclude<KnowledgeGraphFailure, "not_published"> }
  | { readonly ok: false; readonly reason: "not_published"; readonly tree: PassageTree };

export type KnowledgeGraphReader = {
  readonly available: boolean;
  read(input: unknown): Promise<KnowledgeGraphResult>;
};

export function createKnowledgeGraphReader(
  repository: KnowledgeGraphRepository | null | undefined,
): KnowledgeGraphReader {
  return {
    available: Boolean(repository),
    async read(input: unknown): Promise<KnowledgeGraphResult> {
      const query = parseKnowledgeGraphQuery(input);
      if (!query) return { ok: false, reason: "invalid_query" };
      if (!repository) return { ok: false, reason: "unavailable" };
      try {
        const rows = await repository.loadPassage(query);
        const tree = projectPassageTree(query, {
          works: Array.isArray(rows?.works) ? rows.works : [],
          editions: Array.isArray(rows?.editions) ? rows.editions : [],
          artifacts: Array.isArray(rows?.artifacts) ? rows.artifacts : [],
          witnesses: Array.isArray(rows?.witnesses) ? rows.witnesses : [],
          evidence: Array.isArray(rows?.evidence) ? rows.evidence : [],
          claims: Array.isArray(rows?.claims) ? rows.claims : [],
          positions: Array.isArray(rows?.positions) ? rows.positions : [],
          connections: Array.isArray(rows?.connections) ? rows.connections : [],
        });
        return treeIsEmpty(tree) ? { ok: false, reason: "not_published", tree } : { ok: true, tree };
      } catch {
        return { ok: false, reason: "unavailable" };
      }
    },
  };
}
