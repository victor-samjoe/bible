import { and, eq, inArray } from "drizzle-orm";
import {
  editorialTranslations,
  lexemeBdbEntries,
  lexemeBdbLinks,
  lexiconChapterShards,
  lexiconSources,
} from "../../../drizzle/schema";
import type { Database } from "../db/client";
import type { BdbEntryView, OccurrenceRow, SourceCredit } from "../../domain/lexicon/word-analysis-view";
import type { BdbSense } from "../../domain/lexicon/records";
import type { EditorialTranslation } from "../../domain/lexicon/translation-workflow";

/**
 * Leitura do índice lexical para o leitor (LEXICON-INDEX-001, fila C30).
 *
 * São três consultas, e a separação é deliberada:
 *
 * 1. **Estrutura, do shard por capítulo.** Forma, lema, morfologia, domínio e
 *    glossa da fonte vêm de `lexicon_chapter_shards`, um payload compacto por
 *    livro/capítulo. O dado é público, imutável e sempre lido por capítulo, e
 *    as 607 mil ocorrências relacionais não caberiam no plano do banco.
 * 2. **Tradução editorial, da tabela.** `editorial_translations` **não** é
 *    embutida no shard, embora caberia. O shard é um instantâneo com hash
 *    próprio, e o estado de revisão é mutável: assar a revisão dentro dele o
 *    deixaria obsoleto no instante em que alguém aprovasse um verbete, sem que
 *    nada no hash indicasse isso. O que muda por decisão humana se lê ao vivo.
 * 3. **Acepções do BDB, da tabela.** 11.845 verbetes com árvore de sentidos,
 *    alcançados por `lexeme_bdb_links`. São poucos e consultados por chave.
 *
 * A junção da tradução é pelo **texto** da glossa (`gloss:<idioma>:<texto>`),
 * e não pelo lema, porque é assim que ela é armazenada: por texto distinto, de
 * modo que a mesma palavra saia igual em todo o corpus.
 */
export type LexiconRepository = {
  listOccurrences(canonicalRefs: readonly string[]): Promise<readonly OccurrenceRow[]>;
  /** Traduções por sujeito (`gloss:hbo:in`), em qualquer estado de revisão. */
  listTranslations(subjects: readonly string[]): Promise<ReadonlyMap<string, EditorialTranslation>>;
  /** Verbetes do BDB alcançados por cada chave de lema. */
  listBdbEntries(lexemeKeys: readonly string[]): Promise<ReadonlyMap<string, readonly BdbEntryView[]>>;
  /** Licença e atribuição das fontes, como registradas na importação. */
  listSources(sourceIds: readonly string[]): Promise<ReadonlyMap<string, Omit<SourceCredit, "fields">>>;
};

/** Posição de cada campo na linha compacta do shard. Ver build-lexicon-chapter-shards.ts. */
type CompactRow = [
  number, // 0 wordPosition
  string, // 1 sourceWordId
  string, // 2 surface
  string, // 3 lemma
  string | null, // 4 strongId do verbete
  string | null, // 5 transliteração do verbete
  string | null, // 6 morphology
  string | null, // 7 partOfSpeech
  string | null, // 8 semanticDomain
  string | null, // 9 gloss
  string, // 10 lexemeKey
];

export function createDrizzleLexiconRepository(database: Database): LexiconRepository {
  return {
    async listOccurrences(canonicalRefs) {
      if (canonicalRefs.length === 0) return [];
      const requested = new Set(canonicalRefs);
      const references = new Map<string, { bookCode: string; chapter: number }>();
      for (const canonicalRef of canonicalRefs) {
        const parsed = /^([A-Z0-9]{3}) (\d+):/u.exec(canonicalRef);
        if (!parsed) continue;
        const bookCode = parsed[1] ?? "";
        const chapter = Number(parsed[2]);
        references.set(`${bookCode}:${chapter}`, { bookCode, chapter });
      }
      if (references.size === 0) return [];

      const chunks = await Promise.all(
        [...references.values()].map(
          async ({ bookCode, chapter }) =>
            await database
              .select({
                language: lexiconChapterShards.language,
                payload: lexiconChapterShards.payload,
                bookCode: lexiconChapterShards.bookCode,
                chapter: lexiconChapterShards.chapter,
              })
              .from(lexiconChapterShards)
              .where(
                and(
                  eq(lexiconChapterShards.bookCode, bookCode),
                  eq(lexiconChapterShards.chapter, chapter),
                  inArray(lexiconChapterShards.language, ["hbo", "grc"]),
                ),
              ),
        ),
      );

      const rows: OccurrenceRow[] = [];
      for (const shard of chunks.flat()) {
        const verses = (shard.payload as { v?: Record<string, unknown[][]> }).v ?? {};
        for (const [verse, items] of Object.entries(verses)) {
          const canonicalRef = `${shard.bookCode} ${shard.chapter}:${verse}`;
          if (!requested.has(canonicalRef)) continue;
          for (const item of items) {
            const row = item as CompactRow;
            rows.push({
              sourceWordId: row[1],
              language: shard.language,
              canonicalRef,
              wordPosition: row[0],
              surface: row[2],
              lexemeKey: row[10] ?? "",
              lemma: row[3],
              morphology: row[6],
              partOfSpeech: row[7],
              semanticDomain: row[8],
              gloss: row[9],
              entryTransliteration: row[5],
              entryStrongId: row[4],
              translation: null,
              bdb: [],
            });
          }
        }
      }
      return rows.sort(
        (left, right) =>
          left.canonicalRef.localeCompare(right.canonicalRef) ||
          (left.wordPosition ?? 0) - (right.wordPosition ?? 0) ||
          left.sourceWordId.localeCompare(right.sourceWordId),
      );
    },

    async listTranslations(subjects) {
      const unique = [...new Set(subjects)].filter((subject) => subject.length > 0);
      if (unique.length === 0) return new Map();
      const rows = await database
        .select({
          subject: editorialTranslations.subject,
          sourceText: editorialTranslations.sourceText,
          sourceLanguage: editorialTranslations.sourceLanguage,
          text: editorialTranslations.text,
          status: editorialTranslations.status,
          reviewedBy: editorialTranslations.reviewedBy,
          reviewedAt: editorialTranslations.reviewedAt,
          draftMethod: editorialTranslations.draftMethod,
        })
        .from(editorialTranslations)
        .where(
          and(
            inArray(editorialTranslations.subject, unique),
            eq(editorialTranslations.target, "occurrence.gloss"),
          ),
        );

      const found = new Map<string, EditorialTranslation>();
      for (const row of rows) {
        found.set(row.subject, {
          target: "occurrence.gloss",
          sourceText: row.sourceText,
          sourceLanguage: row.sourceLanguage as "en" | "grc" | "hbo",
          targetLanguage: "pt-BR",
          text: row.text,
          status: row.status,
          reviewedBy: row.reviewedBy,
          reviewedAt: row.reviewedAt?.toISOString() ?? null,
          draftMethod: row.draftMethod,
          // A proveniência exibível vem da tabela de fontes, por `listSources`;
          // repeti-la em cada tradução custaria outra junção para o mesmo texto.
          provenance: {
            sourceId: "",
            assetPath: "",
            pin: "",
            assetSha256: "",
            licenseDeclared: "",
            attribution: "",
            sourceField: "gloss",
          },
        });
      }
      return found;
    },

    async listBdbEntries(lexemeKeys) {
      const unique = [...new Set(lexemeKeys)].filter((key) => key.length > 0);
      if (unique.length === 0) return new Map();
      const rows = await database
        .select({
          lexemeKey: lexemeBdbLinks.lexemeKey,
          bdbId: lexemeBdbEntries.bdbId,
          lemma: lexemeBdbEntries.lemma,
          partOfSpeech: lexemeBdbEntries.partOfSpeech,
          isRoot: lexemeBdbEntries.isRoot,
          definitions: lexemeBdbEntries.definitions,
          senses: lexemeBdbEntries.senses,
          senseCount: lexemeBdbEntries.senseCount,
          maxDepth: lexemeBdbEntries.maxDepth,
        })
        .from(lexemeBdbLinks)
        .innerJoin(lexemeBdbEntries, eq(lexemeBdbEntries.bdbId, lexemeBdbLinks.bdbId))
        .where(inArray(lexemeBdbLinks.lexemeKey, unique));

      const grouped = new Map<string, BdbEntryView[]>();
      // Ordenado pelo id da obra para a saída não depender do plano de consulta.
      for (const row of [...rows].sort((left, right) => left.bdbId.localeCompare(right.bdbId))) {
        const bucket = grouped.get(row.lexemeKey) ?? [];
        bucket.push({
          bdbId: row.bdbId,
          lemma: row.lemma,
          partOfSpeech: row.partOfSpeech,
          isRoot: row.isRoot,
          definitions: (row.definitions as string[] | null) ?? [],
          senseCount: row.senseCount,
          maxDepth: row.maxDepth,
          senses: (row.senses as BdbSense[] | null) ?? [],
        });
        grouped.set(row.lexemeKey, bucket);
      }
      return grouped;
    },

    async listSources(sourceIds) {
      const unique = [...new Set(sourceIds)].filter((id) => id.length > 0);
      if (unique.length === 0) return new Map();
      const rows = await database
        .select({
          id: lexiconSources.id,
          name: lexiconSources.name,
          licenseDeclared: lexiconSources.licenseDeclared,
          attribution: lexiconSources.attribution,
        })
        .from(lexiconSources)
        .where(inArray(lexiconSources.id, unique));
      return new Map(
        rows.map((row) => [
          row.id,
          {
            sourceId: row.id,
            name: row.name,
            licenseDeclared: row.licenseDeclared,
            attribution: row.attribution,
          },
        ]),
      );
    },
  };
}
