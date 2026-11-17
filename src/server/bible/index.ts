/**
 * Superfície pública da leitura bíblica, sem nada de runtime de infraestrutura:
 * importar este módulo não abre conexão, não lê ambiente e não exige Cloudflare.
 * A fiação com banco fica em `./runtime`, usada só por código de servidor.
 */
export { createBibleReader, type BibleReader } from "./reader";
export { BLIVRE_TRANSLATION_ID } from "./blivre";
export { createDrizzleBibleRepository } from "./repository";
export { createBibleSearch, type BibleSearch } from "./search";
export { createDrizzleBibleSearchRepository } from "./search-repository";
export type {
  BibleBook,
  BibleChapterRef,
  BibleFailure,
  BibleFailureReason,
  BibleRepository,
  BibleResult,
  BibleTranslation,
  BibleVerse,
  BookListing,
  ChapterListing,
  ChapterReading,
} from "../contracts/bible";
export type {
  BibleSearchRepository,
  SearchFailure,
  SearchFailureReason,
  SearchHit,
  SearchInput,
  SearchResult,
  SearchSuccess,
} from "../contracts/bible-search";
