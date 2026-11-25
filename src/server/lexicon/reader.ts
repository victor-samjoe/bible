import { z } from "zod";
import { bookCodeOfSlug } from "../../domain/lexicon/canon";
import { sourceVerseForOriginal } from "../../domain/original-versification";
import {
  buildWordViews,
  reviewStateOf,
  wordMeaning,
  type BdbEntryView,
  type MeaningSource,
  type OccurrenceRow,
  type ReviewState,
  type SourceCredit,
} from "../../domain/lexicon/word-analysis-view";
import { glossSubjectKey } from "../../domain/lexicon/translation-store";
import { wordAnalysisFor } from "../../domain/word-analysis";
import type { EditorialTranslation } from "../../domain/lexicon/translation-workflow";
import type { LexiconRepository } from "./repository";

/**
 * Análise lexical de uma seleção de versículos (LEXICON-INDEX-001, fila C30).
 *
 * Endpoint separado do `/api/biblia/original` de propósito: aquele serve o
 * texto-base e a morfologia da edição aprovada, e não deve ficar indisponível
 * porque o índice lexical falhou. Aqui, ausência de índice devolve
 * `unavailable` e o leitor segue mostrando o original.
 *
 * `preview` **nunca** é ligado pelo cliente. A pré-visualização existe para
 * conferir rascunho antes de aprová-lo, e quem decide se ela está ligada é o
 * servidor, pela variável de ambiente. Aceitar um parâmetro de consulta faria
 * qualquer visitante publicar texto não revisado pra si mesmo trocando a URL.
 */

/**
 * Fontes que esta camada pode creditar. Lista fechada: creditar uma fonte que
 * não entrou na análise é impreciso na direção oposta à que a licença pede.
 */
const SOURCE_IDS = [
  "macula-hebrew",
  "macula-greek",
  "oshb-hebrewlexicon",
  "oshb-bdb",
  "stepbible-tbesg",
] as const;

/**
 * Credita apenas as fontes de que a palavra exibida realmente saiu, dizendo
 * quais campos vieram de cada uma.
 *
 * O mapeamento campo → fonte é fixo porque é uma propriedade do desenho do
 * pipeline, não do dado: forma, lema, morfologia, domínio e glossa contextual
 * vêm do MACULA; transliteração e Strong vêm do léxico de verbete do idioma; as
 * acepções vêm do BDB. O shard não carrega proveniência por campo — carregá-la
 * repetiria o mesmo bloco de crédito em 607 mil linhas — então a atribuição
 * exibida é buscada da tabela de fontes, que é o que a importação registrou.
 */
function creditsFor(
  view: { readonly morphemes: readonly { readonly transliteration: string | null; readonly strongId: string | null; readonly bdb: readonly BdbEntryView[] }[] },
  language: "hbo" | "grc",
  sourcesById: ReadonlyMap<string, Omit<SourceCredit, "fields">>,
): readonly SourceCredit[] {
  const used = new Map<string, Set<string>>();
  const credit = (sourceId: string, field: string): void => {
    const fields = used.get(sourceId) ?? new Set<string>();
    fields.add(field);
    used.set(sourceId, fields);
  };

  const maculaId = language === "hbo" ? "macula-hebrew" : "macula-greek";
  for (const field of ["forma", "lema", "morfologia", "domínio semântico", "glossa contextual"]) {
    credit(maculaId, field);
  }
  const entryId = language === "hbo" ? "oshb-hebrewlexicon" : "stepbible-tbesg";
  if (view.morphemes.some((morpheme) => morpheme.transliteration !== null)) {
    credit(entryId, "transliteração");
  }
  if (view.morphemes.some((morpheme) => morpheme.strongId !== null)) {
    credit(entryId, "Strong");
  }
  if (view.morphemes.some((morpheme) => morpheme.bdb.length > 0)) {
    credit("oshb-bdb", "acepções");
  }

  return [...used.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([sourceId, fields]) => {
      const source = sourcesById.get(sourceId);
      // Fonte sem linha na tabela não é creditada com texto inventado: o
      // crédito só existe se a importação o registrou.
      if (!source) return [];
      return [{ ...source, fields: [...fields].sort() }];
    });
}

export type LexiconMorpheme = {
  readonly surface: string;
  readonly lemma: string;
  readonly strongId: string | null;
  readonly morphology: string | null;
  readonly partOfSpeech: string | null;
  readonly semanticDomain: string | null;
  readonly transliteration: string | null;
  readonly meaning: string | null;
  readonly meaningSource: MeaningSource | null;
  readonly reviewState: ReviewState | null;
  /**
   * Acepções do Brown-Driver-Briggs alcançadas por este morfema. Lista, porque
   * um Strong pode chegar a mais de um verbete: `בָּרָא` chega a dois homógrafos.
   */
  readonly bdb: readonly BdbEntryView[];
};

export type LexiconWord = {
  readonly position: number;
  readonly meaning: string | null;
  readonly meaningSource: MeaningSource | null;
  readonly reviewState: ReviewState | null;
  /** Presente só quando o significado é rascunho; a interface rotula com ele. */
  readonly draftMethod: string | null;
  readonly morphemes: readonly LexiconMorpheme[];
  /** Fontes efetivamente usadas nesta palavra, com licença e atribuição. */
  readonly sources: readonly SourceCredit[];
};

export type LexiconVerse = {
  readonly canonicalRef: string;
  readonly verse: number;
  readonly words: readonly LexiconWord[];
};

export type LexiconSelectionResult =
  | {
      readonly ok: true;
      readonly bookSlug: string;
      readonly chapter: number;
      /** Verdadeiro quando rascunho não revisado está sendo exibido. */
      readonly previewingDrafts: boolean;
      readonly verses: readonly LexiconVerse[];
    }
  | { readonly ok: false; readonly reason: "invalid_query" | "unavailable" | "not_found" };

const querySchema = z
  .object({
    book: z.string().trim().toLowerCase().min(1).max(64),
    chapter: z.coerce.number().int().min(1).max(150),
    verses: z.array(z.coerce.number().int().min(1).max(176)).min(1).max(25),
  })
  .strict();

export type LexiconReader = {
  read(input: unknown): Promise<LexiconSelectionResult>;
};

export function createLexiconReader(
  repository: LexiconRepository | null,
  options: { readonly previewDrafts: boolean },
): LexiconReader {
  return {
    async read(input) {
      const parsed = querySchema.safeParse(input);
      if (!parsed.success) return { ok: false, reason: "invalid_query" };
      const code = bookCodeOfSlug(parsed.data.book);
      if (!code) return { ok: false, reason: "invalid_query" };
      if (!repository) return { ok: false, reason: "unavailable" };

      const verses = [...new Set(parsed.data.verses)].sort((left, right) => left - right);
      const refs = verses.map((verse) => {
        const source = sourceVerseForOriginal(parsed.data.book, parsed.data.chapter, verse);
        return `${code} ${source.chapter}:${source.verse}`;
      });

      let rows;
      try {
        rows = await repository.listOccurrences(refs);
      } catch {
        // O índice é camada acessória: indisponível não derruba o leitor.
        return { ok: false, reason: "unavailable" };
      }
      if (rows.length === 0) return { ok: false, reason: "not_found" };

      // A tradução e as acepções são lidas por chave, fora do shard: o shard é
      // instantâneo imutável e o estado de revisão muda por decisão humana.
      const subjects = rows
        .filter((row) => (row.gloss ?? "").trim().length > 0)
        .map((row) => glossSubjectKey(row.language, row.gloss ?? ""));
      const lexemeKeys = rows.map((row) => row.lexemeKey);

      // `allSettled`, não `all`: as três consultas são independentes, e com
      // `all` uma falha descartaria as duas que deram certo — uma queda na
      // consulta de acepções apagaria da tela a tradução revisada que já estava
      // em mãos. Cada uma degrada por si; forma, lema e morfologia vêm do shard
      // e não dependem de nenhuma delas.
      const [translationsResult, bdbResult, sourcesResult] = await Promise.allSettled([
        repository.listTranslations(subjects),
        repository.listBdbEntries(lexemeKeys),
        repository.listSources(SOURCE_IDS),
      ]);
      const translations: ReadonlyMap<string, EditorialTranslation> =
        translationsResult.status === "fulfilled" ? translationsResult.value : new Map();
      const bdbByLexeme: ReadonlyMap<string, readonly BdbEntryView[]> =
        bdbResult.status === "fulfilled" ? bdbResult.value : new Map();
      const sourcesById: ReadonlyMap<string, Omit<SourceCredit, "fields">> =
        sourcesResult.status === "fulfilled" ? sourcesResult.value : new Map();

      const enriched: OccurrenceRow[] = rows.map((row) => ({
        ...row,
        translation:
          (row.gloss ?? "").trim().length > 0
            ? translations.get(glossSubjectKey(row.language, row.gloss ?? "")) ?? null
            : null,
        bdb: bdbByLexeme.get(row.lexemeKey) ?? [],
      }));

      const byRef = new Map<string, OccurrenceRow[]>();
      for (const row of enriched) {
        const bucket = byRef.get(row.canonicalRef) ?? [];
        bucket.push(row);
        byRef.set(row.canonicalRef, bucket);
      }

      const built: LexiconVerse[] = [];
      for (const verse of verses) {
        const source = sourceVerseForOriginal(parsed.data.book, parsed.data.chapter, verse);
        const ref = `${code} ${source.chapter}:${source.verse}`;
        const forVerse = byRef.get(ref);
        if (!forVerse || forVerse.length === 0) continue;
        const views = buildWordViews(
          forVerse,
          (position) => wordAnalysisFor(parsed.data.book, parsed.data.chapter, verse, position),
          { allowMachineDraft: options.previewDrafts },
        );
        built.push({
          canonicalRef: ref,
          verse,
          words: views.map((view) => {
            const meaning = wordMeaning(view);
            const language = forVerse[0]?.language ?? "hbo";
            return {
              position: view.position,
              meaning: meaning.text,
              meaningSource: meaning.source,
              reviewState: reviewStateOf(meaning.source),
              draftMethod: meaning.draftMethod,
              morphemes: view.morphemes.map((morpheme) => ({
                surface: morpheme.surface,
                lemma: morpheme.lemma,
                strongId: morpheme.strongId,
                morphology: morpheme.morphology,
                partOfSpeech: morpheme.partOfSpeech,
                semanticDomain: morpheme.semanticDomain,
                transliteration: morpheme.transliteration,
                meaning: morpheme.meaning,
                meaningSource: morpheme.meaningSource,
                reviewState: reviewStateOf(morpheme.meaningSource),
                bdb: morpheme.bdb,
              })),
              sources: creditsFor(view, language, sourcesById),
            };
          }),
        });
      }
      if (built.length === 0) return { ok: false, reason: "not_found" };
      return {
        ok: true,
        bookSlug: parsed.data.book,
        chapter: parsed.data.chapter,
        previewingDrafts: options.previewDrafts,
        verses: built,
      };
    },
  };
}
