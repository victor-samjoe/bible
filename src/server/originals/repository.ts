import { and, asc, eq, inArray } from "drizzle-orm";
import { lemmas, originalEditions, originalMorphemes, originalTokens, originalVerses } from "@/drizzle/schema";
import type { OriginalLanguage, OriginalRepository } from "../contracts/originals";
import type { Database } from "../db/client";

export function createDrizzleOriginalRepository(database: Database): OriginalRepository {
  return {
    async findApprovedEdition(language: OriginalLanguage) {
      const rows = await database.select({
        id: originalEditions.id, code: originalEditions.code, language: originalEditions.language,
        version: originalEditions.version, sourceUrl: originalEditions.sourceUrl,
        licenseDeclared: originalEditions.licenseDeclared, attribution: originalEditions.attribution,
        status: originalEditions.status, approvedBy: originalEditions.approvedBy, approvedAt: originalEditions.approvedAt,
      }).from(originalEditions).where(and(eq(originalEditions.language, language), eq(originalEditions.status, "approved"))).limit(1);
      return rows.at(0) ?? null;
    },
    async listVerses(input) {
      return await database.select({
        id: originalVerses.id, editionId: originalVerses.editionId, canonBook: originalVerses.canonBook,
        chapter: originalVerses.chapter, verse: originalVerses.verse,
        canonicalRef: originalVerses.canonicalRef, text: originalVerses.text,
      }).from(originalVerses).where(and(eq(originalVerses.editionId, input.editionId), eq(originalVerses.canonBook, input.canonBook), eq(originalVerses.chapter, input.chapter), inArray(originalVerses.verse, [...input.verses]))).orderBy(asc(originalVerses.verse));
    },
    async listTokens(verseIds) {
      if (verseIds.length === 0) return [];
      return await database.select({ id: originalTokens.id, verseId: originalTokens.verseId, position: originalTokens.position, surface: originalTokens.surface, normalized: originalTokens.normalized }).from(originalTokens).where(inArray(originalTokens.verseId, [...verseIds])).orderBy(asc(originalTokens.position));
    },
    async listMorphemes(tokenIds, editionId) {
      if (tokenIds.length === 0) return [];
      return await database.select({ tokenId: originalMorphemes.tokenId, position: originalMorphemes.position, surface: originalMorphemes.surface, lemma: lemmas.lemma, morphologyCode: originalMorphemes.morphologyCode }).from(originalMorphemes).leftJoin(lemmas, eq(originalMorphemes.lemmaId, lemmas.id)).where(and(eq(originalMorphemes.morphologyEditionId, editionId), inArray(originalMorphemes.tokenId, [...tokenIds]))).orderBy(asc(originalMorphemes.position));
    },
  };
}
