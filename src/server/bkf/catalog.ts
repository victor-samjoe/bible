import { z } from "zod";
import { BkfId, RightsSchema, Sha256, type Rights } from "../../domain/bkf/contracts";
import { canAutomatedProcess, canQuote, canStore } from "../../domain/bkf/policy";

/**
 * Catálogo BKF: decide se um artefato de corpus pode ser registrado e evita
 * duplicata por (edição, hash do original, versão da extração).
 *
 * Fecha a porta por padrão. Nenhuma linha é gravada sem:
 * - edição existente no catálogo;
 * - direitos vigentes com `store` E `automated_processing` explicitamente true;
 * - caminho de armazenamento relativo e seguro (sem raiz, sem unidade, sem `..`).
 *
 * Não toca filesystem, rede nem segredo: o repositório é injetado, portanto esta
 * camada é testável sem banco. A cópia dos bytes é da tarefa BKF-P0-003 e só pode
 * acontecer depois de uma resposta `ok` daqui.
 */

const artifactKindSchema = z.enum(["ORIGINAL", "EXTRACTION", "NORMALIZED", "INDEX"]);

/**
 * Caminho dentro da raiz privada do operador. Precisa ser relativo: raiz, unidade
 * do Windows, `..` e caractere fora da lista são recusados antes de qualquer
 * gravação — a mesma regra está como CHECK em `drizzle/0004_bkf.sql`.
 */
export const storageLocatorSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine((value) => !/^[/\\]/.test(value), "caminho absoluto não é aceito")
  .refine((value) => !/^[A-Za-z]:/.test(value), "unidade do Windows não é aceita")
  .refine((value) => !value.includes(".."), "travessia de diretório não é aceita")
  .refine((value) => /^[A-Za-z0-9._\-/]+$/.test(value), "caractere não permitido no caminho");

const registerArtifactSchema = z
  .object({
    editionId: BkfId,
    kind: artifactKindSchema,
    originalSha256: Sha256,
    extractionVersion: z.string().trim().min(1).max(64),
    normalizedSha256: Sha256.optional(),
    byteSize: z.number().int().nonnegative().optional(),
    storageLocator: storageLocatorSchema,
  })
  .strict();

export type RegisterArtifactInput = z.input<typeof registerArtifactSchema>;

export type CatalogArtifact = {
  readonly id: string;
  readonly editionId: string;
  readonly kind: z.infer<typeof artifactKindSchema>;
  readonly originalSha256: string;
  readonly extractionVersion: string;
  readonly storageLocator: string;
};

export type CatalogFailureReason =
  | "unavailable"
  | "invalid_input"
  | "edition_not_found"
  | "rights_missing"
  | "rights_denied"
  | "invalid_data";

export type CatalogFailure = { readonly ok: false; readonly reason: CatalogFailureReason };

export type RegisterArtifactResult =
  | { readonly ok: true; readonly status: "created" | "reused"; readonly artifact: CatalogArtifact }
  | CatalogFailure;

export type RightsDecision =
  | {
      readonly ok: true;
      readonly status: Rights["status"];
      readonly store: boolean;
      readonly automatedProcessing: boolean;
      readonly quote: boolean;
      readonly attribution: string;
    }
  | CatalogFailure;

export type ArtifactRecord = {
  editionId: string;
  kind: z.infer<typeof artifactKindSchema>;
  originalSha256: string;
  extractionVersion: string;
  normalizedSha256?: string;
  byteSize?: number;
  storageLocator: string;
};

export interface BkfCatalogRepository {
  findEdition(editionId: string): Promise<unknown>;
  findCurrentRights(editionId: string): Promise<unknown>;
  findArtifact(key: {
    editionId: string;
    originalSha256: string;
    extractionVersion: string;
  }): Promise<unknown>;
  insertArtifact(record: ArtifactRecord): Promise<unknown>;
}

const editionRowSchema = z.object({ id: BkfId }).loose();

const artifactRowSchema = z
  .object({
    id: BkfId,
    editionId: BkfId,
    kind: artifactKindSchema,
    originalSha256: Sha256,
    extractionVersion: z.string().trim().min(1),
    storageLocator: storageLocatorSchema,
  })
  .loose();

/**
 * Texto obrigatório normalizado. `RightsSchema` (BKF-P0-001) usa `min(1)` sem
 * `trim`, então `"   "` passaria como prova ou responsável; o CHECK de
 * `drizzle/0004_bkf.sql` usa `btrim` e recusaria a mesma linha. Aqui o valor é
 * aparado antes de validar, para que contrato, catálogo e banco concordem: campo
 * só com espaço é campo ausente.
 */
function trimmedText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isoFrom(value: unknown): string | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  return undefined;
}

/**
 * Converte a linha achatada de `bkf_rights` no contrato de direitos e valida.
 * Linha incompleta devolve `null`: ausência de prova ou de data de verificação é
 * negativa, nunca permissão implícita.
 */
export function projectRights(row: unknown): Rights | null {
  if (typeof row !== "object" || row === null) return null;
  const source = row as Record<string, unknown>;
  const limits =
    typeof source.wordsPerQuote === "number" &&
    typeof source.wordsPerWork === "number" &&
    typeof source.wordsPerDocument === "number"
      ? {
          per_quote: source.wordsPerQuote,
          per_work: source.wordsPerWork,
          per_document: source.wordsPerDocument,
        }
      : undefined;
  const candidate = {
    id: source.id,
    edition_id: source.editionId,
    status: source.status,
    permissions: {
      store: source.store === true,
      automated_processing: source.automatedProcessing === true,
      quote: source.quote === true,
      public_distribution: source.publicDistribution === true,
    },
    proof: trimmedText(source.proof),
    verified_by: trimmedText(source.verifiedBy),
    verified_at: isoFrom(source.verifiedAt),
    valid_from: isoFrom(source.validFrom),
    ...(isoFrom(source.validUntil) ? { valid_until: isoFrom(source.validUntil) } : {}),
    territory: trimmedText(source.territory),
    attribution: trimmedText(source.attribution),
    ...(limits ? { word_limits: limits } : {}),
  };
  const parsed = RightsSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function createBkfCatalog(
  repository: BkfCatalogRepository | null | undefined,
  now: () => Date = () => new Date(),
) {
  async function resolveRights(
    editionId: string,
  ): Promise<{ ok: true; rights: Rights } | CatalogFailure> {
    if (!repository) return { ok: false, reason: "unavailable" };
    const edition = editionRowSchema.safeParse(await repository.findEdition(editionId));
    if (!edition.success || edition.data.id !== editionId) {
      return { ok: false, reason: "edition_not_found" };
    }
    const row = await repository.findCurrentRights(editionId);
    if (row === null || row === undefined) return { ok: false, reason: "rights_missing" };
    const rights = projectRights(row);
    if (!rights || rights.edition_id !== editionId) return { ok: false, reason: "rights_denied" };
    return { ok: true, rights };
  }

  return {
    available: Boolean(repository),

    /** Leitura das permissões vigentes, sem gravar nada. */
    async inspectRights(editionId: string): Promise<RightsDecision> {
      if (!repository) return { ok: false, reason: "unavailable" };
      if (!BkfId.safeParse(editionId).success) return { ok: false, reason: "invalid_input" };
      try {
        const resolved = await resolveRights(editionId);
        if (!resolved.ok) return resolved;
        const instant = now();
        return {
          ok: true,
          status: resolved.rights.status,
          store: canStore(resolved.rights, instant),
          automatedProcessing: canAutomatedProcess(resolved.rights, instant),
          quote: canQuote(resolved.rights, 1, 0, 0, instant),
          attribution: resolved.rights.attribution,
        };
      } catch {
        return { ok: false, reason: "unavailable" };
      }
    },

    /**
     * Registra o artefato ou devolve o já existente. Mesma edição, mesmo hash e
     * mesma versão de extração nunca geram segunda linha — a unique de
     * `bkf_artifacts` garante isso no banco, e esta checagem evita a tentativa.
     */
    async registerArtifact(input: RegisterArtifactInput): Promise<RegisterArtifactResult> {
      if (!repository) return { ok: false, reason: "unavailable" };
      const parsed = registerArtifactSchema.safeParse(input);
      if (!parsed.success) return { ok: false, reason: "invalid_input" };
      // O CHECK do banco exige hash minúsculo; normaliza antes de qualquer consulta.
      const record: ArtifactRecord = {
        editionId: parsed.data.editionId,
        kind: parsed.data.kind,
        originalSha256: parsed.data.originalSha256.toLowerCase(),
        extractionVersion: parsed.data.extractionVersion,
        storageLocator: parsed.data.storageLocator,
        ...(parsed.data.normalizedSha256
          ? { normalizedSha256: parsed.data.normalizedSha256.toLowerCase() }
          : {}),
        ...(parsed.data.byteSize === undefined ? {} : { byteSize: parsed.data.byteSize }),
      };

      try {
        const resolved = await resolveRights(record.editionId);
        if (!resolved.ok) return resolved;
        const instant = now();
        if (!canStore(resolved.rights, instant) || !canAutomatedProcess(resolved.rights, instant)) {
          return { ok: false, reason: "rights_denied" };
        }

        const key = {
          editionId: record.editionId,
          originalSha256: record.originalSha256,
          extractionVersion: record.extractionVersion,
        };
        const existing = artifactRowSchema.safeParse(await repository.findArtifact(key));
        if (existing.success) {
          return { ok: true, status: "reused", artifact: toArtifact(existing.data) };
        }

        const inserted = artifactRowSchema.safeParse(await repository.insertArtifact(record));
        if (!inserted.success) return { ok: false, reason: "invalid_data" };
        return { ok: true, status: "created", artifact: toArtifact(inserted.data) };
      } catch {
        return { ok: false, reason: "unavailable" };
      }
    },
  };
}

function toArtifact(row: z.infer<typeof artifactRowSchema>): CatalogArtifact {
  return {
    id: row.id,
    editionId: row.editionId,
    kind: row.kind,
    originalSha256: row.originalSha256.toLowerCase(),
    extractionVersion: row.extractionVersion,
    storageLocator: row.storageLocator,
  };
}

export type BkfCatalog = ReturnType<typeof createBkfCatalog>;
