import { projectBooks, projectTranslation } from "../contracts/bible";
import {
  escapeLikeTerm,
  parseReference,
  projectHits,
  searchInputSchema,
  searchTerms,
  type BibleSearchRepository,
  type SearchInput,
  type SearchResult,
} from "../contracts/bible-search";

/**
 * Serviço de busca. Mesmo desenho do leitor (C3): repositório injetado, falha
 * fechada, nenhuma mensagem de banco atravessando a fronteira.
 *
 * Duas formas de consulta, decididas pelo próprio texto digitado:
 * - referência canônica ("João 3:16", "gen 1") devolve o versículo ou o capítulo;
 * - qualquer outra coisa vira busca lexical por termos, todos exigidos (AND).
 *
 * Nenhum parâmetro de tradução é aceito: a busca é sempre na tradução aprovada
 * recebida na construção, para que a API não possa ser apontada a texto sem
 * licença.
 */
export function createBibleSearch(
  translationId: string,
  repository: BibleSearchRepository | null | undefined,
) {
  return {
    available: Boolean(repository),

    async search(input: SearchInput): Promise<SearchResult> {
      if (!repository) return { ok: false, reason: "unavailable" };
      const parsed = searchInputSchema.safeParse(input);
      if (!parsed.success) return { ok: false, reason: "invalid_query" };
      const { q, book, limit, offset } = parsed.data;

      try {
        const translation = projectTranslation(await repository.findTranslation(translationId));
        if (!translation) return { ok: false, reason: "translation_unavailable" };

        const books = projectBooks(await repository.listBooks(translation.id), translation.id);

        // Referência canônica tem precedência: quem digita "João 3:16" quer o
        // versículo, não as ocorrências da palavra "João".
        const reference = book ? null : parseReference(q, books);
        if (reference) {
          const rows = await repository.findVerseByReference({
            translationId: translation.id,
            bookSlug: reference.book.slug,
            chapter: reference.chapter,
            verse: reference.verse,
            limit,
          });
          const hits = projectHits(rows);
          return {
            ok: true,
            kind: "reference",
            terms: [],
            total: hits.length,
            limit,
            offset: 0,
            hits,
            truncated: hits.length >= limit,
          };
        }

        const terms = searchTerms(q);
        if (terms.length === 0) return { ok: false, reason: "invalid_query" };
        const patterns = terms.map((term) => `%${escapeLikeTerm(term)}%`);

        const [rows, countRow] = await Promise.all([
          repository.searchVerses({
            translationId: translation.id,
            patterns,
            ...(book ? { bookSlug: book } : {}),
            limit,
            offset,
          }),
          repository.countVerses({
            translationId: translation.id,
            patterns,
            ...(book ? { bookSlug: book } : {}),
          }),
        ]);

        const hits = projectHits(rows);
        const total = typeof countRow === "number" && Number.isSafeInteger(countRow) && countRow >= 0
          ? countRow
          : hits.length;

        return {
          ok: true,
          kind: "terms",
          terms,
          total,
          limit,
          offset,
          hits,
          truncated: offset + hits.length < total,
        };
      } catch {
        return { ok: false, reason: "unavailable" };
      }
    },
  };
}

export type BibleSearch = ReturnType<typeof createBibleSearch>;
