/**
 * Primitivas compartilhadas da árvore de conhecimento (KNOWLEDGE-GRAPH-001,
 * fila A2). Ver `docs/VERSE_KNOWLEDGE_GRAPH.md`.
 *
 * Existe para que "texto obrigatório", "data" e "identificador" signifiquem a
 * mesma coisa em todos os contratos do ramo. Um campo de proveniência aceito
 * como `"  "` em um módulo e recusado em outro produz exatamente o defeito que
 * esta frente precisa evitar: evidência que passa na validação e não localiza
 * nada. O mesmo problema já apareceu no catálogo BKF, onde `verified_by`
 * entrava só com espaços e o CHECK do banco recusava depois.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco, sem relógio.
 */

import { z } from "zod";

/** Texto obrigatório: espaço em branco não conta como conteúdo. */
export const requiredText = z.string().trim().min(1);

/** Texto opcional já normalizado — `""` depois do trim vira `null`. */
export const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .default(null);

/**
 * Identificador legível e estável, não UUID.
 *
 * A escolha é deliberada: estes registros são escritos e revisados por pessoas
 * e aparecem em bibliografia e em fixtures de prova. `vulgata-clementina-1592`
 * é conferível à vista; `9f1c...` exige uma consulta para saber do que se
 * trata. Instabilidade não é o risco aqui, porque o identificador é editorial
 * e versionado junto com o registro.
 */
export const stableId = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9._-]{2,79}$/u, "Use identificador estável em minúsculas (a-z, 0-9, . _ -)");

/** Data civil ISO (`AAAA-MM-DD`). Sem hora: a precisão de hora não é real aqui. */
export const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/u, "Use data no formato AAAA-MM-DD");

/** SHA-256 em hexadecimal minúsculo, como o pipeline lexical já grava. */
export const sha256 = z.string().trim().regex(/^[0-9a-f]{64}$/u, "Informe SHA-256 em hexadecimal minúsculo");

/** Só `https`. Identificador persistente ou URL de recuperação, nada de `http`. */
export const httpsUrl = z
  .string()
  .trim()
  .regex(/^https:\/\/\S+$/u, "Use URL https")
  .or(z.string().trim().regex(/^urn:[a-z0-9][a-z0-9-]{0,31}:\S+$/iu, "Use URN válida"))
  .or(z.string().trim().regex(/^doi:10\.\d{4,9}\/\S+$/iu, "Use DOI no formato doi:10.xxxx/yyy"));

/** Idioma em BCP-47 ou ISO 639-3, incluindo `hbo`, `grc`, `lat`, `pt-BR`. */
export const languageTag = z
  .string()
  .trim()
  .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/u, "Use etiqueta de idioma como pt-BR, hbo, grc ou lat");

/**
 * Grau de confiança declarado. Ordinal e pequeno de propósito: percentual
 * sugere medição que ninguém fez. `contestado` não é o degrau mais baixo da
 * escala, é um estado diferente — há evidência, e ela é disputada.
 */
export const CONFIDENCE_GRADES = ["alta", "media", "baixa", "contestado"] as const;
export const confidenceGrade = z.enum(CONFIDENCE_GRADES);
export type ConfidenceGrade = (typeof CONFIDENCE_GRADES)[number];

/**
 * Tipo de fonte. `terciaria` existe para que enciclopédia e manual não entrem
 * disfarçados de fonte primária.
 */
export const SOURCE_TIERS = ["primaria", "secundaria", "terciaria"] as const;
export const sourceTier = z.enum(SOURCE_TIERS);
export type SourceTier = (typeof SOURCE_TIERS)[number];

/** Erro de contrato da árvore de conhecimento. */
export class KnowledgeGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeGraphError";
  }
}

/**
 * Converte falha de schema em lista de mensagens, no mesmo formato que
 * `validateStudy` já usa em `src/domain/editorial/validation.ts`.
 */
export function issuesOf(error: z.ZodError, prefix = ""): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    const where = [prefix, path].filter((part) => part.length > 0).join(".");
    return where.length > 0 ? `${where}: ${issue.message}` : issue.message;
  });
}

/** Ordenação total e estável por texto, para saída determinística. */
export function byText<T>(select: (value: T) => string): (left: T, right: T) => number {
  return (left, right) => {
    const a = select(left);
    const b = select(right);
    return a < b ? -1 : a > b ? 1 : 0;
  };
}

/** Devolve os identificadores repetidos de uma coleção. */
export function duplicateIds(ids: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return [...repeated].sort();
}
