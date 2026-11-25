import {
  parseOriginalQuery,
  projectOriginalEdition,
  projectOriginalVerses,
  type OriginalRepository,
  type OriginalSelectionResult,
} from "../contracts/originals";
import { displayVerseForOriginal } from "../../domain/original-versification";

export function createOriginalReader(repository: OriginalRepository | null | undefined) {
  return {
    available: Boolean(repository),
    async read(input: unknown): Promise<OriginalSelectionResult> {
      const query = parseOriginalQuery(input);
      if (!query) return { ok: false, reason: "invalid_query" };
      if (!repository) return { ok: false, reason: "unavailable" };
      try {
        const edition = projectOriginalEdition(await repository.findApprovedEdition(query.language));
        if (!edition) return { ok: false, reason: "edition_unavailable" };
        // A fonte pode ter numeração hebraica própria. Hoje a única exceção
        // tratada cruza Miqueias 4–5; por isso buscamos cada referência-fonte
        // e reunimos o resultado antes de projetá-lo de volta ao leitor.
        const rows = (await Promise.all(query.sourceReferences.map((reference) => repository.listVerses({
          editionId: edition.id,
          canonBook: query.canonBook,
          chapter: reference.chapter,
          verses: [reference.verse],
        })))).flat();
        const rawRows = Array.isArray(rows) ? rows : [];
        const verseIds = rawRows.flatMap((row) => typeof row === "object" && row !== null && typeof (row as { id?: unknown }).id === "string" ? [(row as { id: string }).id] : []);
        const tokenRows = verseIds.length > 0 ? await repository.listTokens(verseIds) : [];
        const rawTokens = Array.isArray(tokenRows) ? tokenRows : [];
        const tokenIds = rawTokens.flatMap((row) => typeof row === "object" && row !== null && typeof (row as { id?: unknown }).id === "string" ? [(row as { id: string }).id] : []);
        const morphemeRows = tokenIds.length > 0 ? await repository.listMorphemes(tokenIds, edition.id) : [];
        const verses = projectOriginalVerses({
          rows, tokenRows, morphemeRows, editionId: edition.id, canonBook: query.canonBook,
          chapter: query.chapter, requested: query.verses,
          displayVerse: (sourceChapter, sourceVerse) => displayVerseForOriginal(query.book, query.chapter, sourceChapter, sourceVerse),
        });
        if (verses.length === 0) return { ok: false, reason: "not_found" };
        return { ok: true, edition, bookSlug: query.book, chapter: query.chapter, verses };
      } catch {
        return { ok: false, reason: "unavailable" };
      }
    },
  };
}
