/**
 * Caminhos reais das acepções do BDB (GENESIS-PALAVRAS, item A3).
 *
 * Achata a árvore de sentidos de um verbete em registros com **caminho
 * posicional** (`1.2.1`: primeiro filho do segundo filho do primeiro nível), o
 * texto inglês e um hash desse texto. O caminho vem da posição na árvore da
 * fonte, nunca de rótulo impresso (`1.`, `a.`), que se repete entre troncos
 * verbais e níveis; e nunca é inventado: sem árvore, sem registros.
 *
 * Módulo puro. O hash é injetado para o domínio não depender de `node:*`.
 */

import type { BdbSense } from "../lexicon/records";

export type SenseRecord = {
  readonly bdbId: string;
  /** Caminho posicional, base 1, separado por ponto. */
  readonly path: string;
  /** Caminho do pai, ou null no primeiro nível. */
  readonly parent: string | null;
  readonly depth: number;
  /** Rótulo impresso na obra (`1`, `a`) ou tronco verbal; só para exibir. */
  readonly label: string | null;
  /** Texto original (inglês) deste nível; vazio se o nível só agrupa. */
  readonly original: string;
  /** Hash do texto original, para detectar mudança da fonte. */
  readonly hash: string;
};

const squash = (text: string) => text.replace(/\s+/gu, " ").trim();

/** Texto de um nível: as definições, ou a nota quando não há definição nem filhos. */
export function senseOriginal(sense: BdbSense): string {
  if (sense.definitions.length) return squash(sense.definitions.join("; "));
  if (!sense.children.length && sense.note) return squash(sense.note);
  return "";
}

export function flattenSenses(
  bdbId: string,
  senses: readonly BdbSense[],
  hash: (text: string) => string,
): SenseRecord[] {
  const out: SenseRecord[] = [];
  const walk = (level: readonly BdbSense[], parent: string | null, depth: number) => {
    level.forEach((sense, index) => {
      const path = parent ? `${parent}.${index + 1}` : String(index + 1);
      const original = senseOriginal(sense);
      out.push({
        bdbId,
        path,
        parent,
        depth,
        label: sense.number ? sense.number.replace(/\.$/u, "") : sense.stem,
        original,
        hash: hash(original),
      });
      walk(sense.children, path, depth + 1);
    });
  };
  walk(senses, null, 1);
  return out;
}

/** Verifica que um conjunto de registros é uma árvore coerente. */
export function senseTreeProblems(records: readonly SenseRecord[]): string[] {
  const problems: string[] = [];
  const paths = new Set<string>();
  for (const record of records) {
    if (paths.has(`${record.bdbId}#${record.path}`)) problems.push(`caminho repetido: ${record.bdbId} ${record.path}`);
    paths.add(`${record.bdbId}#${record.path}`);
    if (record.parent && !records.some((other) => other.bdbId === record.bdbId && other.path === record.parent)) {
      problems.push(`pai ausente: ${record.bdbId} ${record.path}`);
    }
    if (record.path.split(".").length !== record.depth) problems.push(`profundidade incoerente: ${record.path}`);
  }
  return problems;
}
