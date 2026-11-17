import { and, desc, eq } from "drizzle-orm";
import { bkfArtifacts, bkfEditions, bkfRights } from "@/drizzle/schema";
import type { Database } from "../db/client";
import type { ArtifactRecord, BkfCatalogRepository } from "./catalog";

/**
 * Persistência do catálogo BKF em Postgres. Só toca tabelas `bkf_*`: nada de
 * escrita em `works`, `sources`, `licenses`, `studies` ou qualquer entidade
 * pública existente.
 *
 * `id` e `created_at` são enviados explicitamente porque `drizzle/schema.ts` não
 * declara defaults — o SQL é a autoridade e mantém `gen_random_uuid()`/`now()`
 * como rede de segurança.
 *
 * As garantias de integridade continuam no banco: unique de
 * (edition_id, original_sha256, extraction_version), CHECKs de direitos e caminho,
 * e os gatilhos que recusam UPDATE/DELETE em registros versionados.
 */
export function createDrizzleBkfCatalogRepository(database: Database): BkfCatalogRepository {
  const artifactColumns = {
    id: bkfArtifacts.id,
    editionId: bkfArtifacts.editionId,
    kind: bkfArtifacts.kind,
    originalSha256: bkfArtifacts.originalSha256,
    extractionVersion: bkfArtifacts.extractionVersion,
    normalizedSha256: bkfArtifacts.normalizedSha256,
    byteSize: bkfArtifacts.byteSize,
    storageLocator: bkfArtifacts.storageLocator,
  };

  return {
    async findEdition(editionId: string) {
      const rows = await database
        .select({ id: bkfEditions.id, currentRightsId: bkfEditions.currentRightsId })
        .from(bkfEditions)
        .where(eq(bkfEditions.id, editionId))
        .limit(1);
      return rows.at(0) ?? null;
    },

    async findCurrentRights(editionId: string) {
      // Prefere o registro apontado por `current_rights_id`; sem ele, o mais
      // recente da edição. A decisão de uso continua sendo do contrato de
      // direitos: estar no banco não significa estar liberado.
      const [edition] = await database
        .select({ currentRightsId: bkfEditions.currentRightsId })
        .from(bkfEditions)
        .where(eq(bkfEditions.id, editionId))
        .limit(1);
      if (!edition) return null;
      const rows = await database
        .select()
        .from(bkfRights)
        .where(
          edition.currentRightsId
            ? and(eq(bkfRights.editionId, editionId), eq(bkfRights.id, edition.currentRightsId))
            : eq(bkfRights.editionId, editionId),
        )
        .orderBy(desc(bkfRights.createdAt))
        .limit(1);
      return rows.at(0) ?? null;
    },

    async findArtifact(key) {
      const rows = await database
        .select(artifactColumns)
        .from(bkfArtifacts)
        .where(
          and(
            eq(bkfArtifacts.editionId, key.editionId),
            eq(bkfArtifacts.originalSha256, key.originalSha256),
            eq(bkfArtifacts.extractionVersion, key.extractionVersion),
          ),
        )
        .limit(1);
      return rows.at(0) ?? null;
    },

    async insertArtifact(record: ArtifactRecord) {
      const rows = await database
        .insert(bkfArtifacts)
        .values({
          id: crypto.randomUUID(),
          editionId: record.editionId,
          kind: record.kind,
          originalSha256: record.originalSha256,
          extractionVersion: record.extractionVersion,
          normalizedSha256: record.normalizedSha256 ?? null,
          byteSize: record.byteSize ?? null,
          storageLocator: record.storageLocator,
          createdAt: new Date(),
        })
        .returning(artifactColumns);
      return rows.at(0) ?? null;
    },
  };
}
