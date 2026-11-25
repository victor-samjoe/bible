import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import {
  LEXICON_REGISTRY_VERSION,
  LEXICON_SOURCES,
  assertNoLicenseMixing,
  pinLabel,
} from "../src/domain/lexicon/source-registry.ts";
import { countSenses, senseDepth } from "../src/domain/lexicon/records.ts";
import type { BdbSense, FieldProvenance } from "../src/domain/lexicon/records.ts";
import type { StoredTranslation } from "../src/domain/lexicon/translation-store.ts";

/**
 * Importação do índice lexical para o Postgres (LEXICON-INDEX-001, fila C30).
 *
 * Lê os artefatos já conferidos — `lexicon-index.ndjson` e
 * `translations.ndjson` — e grava nas tabelas da migration 0008.
 *
 * Três propriedades, nesta ordem:
 *
 * 1. **Idempotente.** Toda escrita é `ON CONFLICT`, e rodar duas vezes sobre os
 *    mesmos bytes deixa o banco no mesmo estado. É o que permite reprocessar
 *    sem medo depois de corrigir um parser.
 * 2. **Não regressiva na tradução.** Rascunho não sobrescreve texto revisado:
 *    o `ON CONFLICT` da tradução só atualiza linha que ainda está
 *    `machine_draft`. O gatilho da 0008 é a segunda rede.
 * 3. **Em transação.** Falha no meio não deixa metade do corpus gravada.
 *
 * O volume é grande (607 mil ocorrências), então as linhas vão em lotes de
 * `INSERT ... VALUES` com muitas tuplas, e não uma por chamada: a diferença
 * entre 607 mil idas ao banco e algumas centenas.
 *
 * Uso:
 *   DATABASE_URL=... node --experimental-strip-types scripts/import-lexicon-index.ts --dry-run
 *   DATABASE_URL=... node --experimental-strip-types scripts/import-lexicon-index.ts
 *   DATABASE_URL=... node --experimental-strip-types scripts/import-lexicon-index.ts --scope="GEN 1:"
 */

const ROOT = join(import.meta.dirname, "..");
const GENERATED = join(ROOT, "data", "generated", "lexicons");
const INDEX = process.env.LEXICON_INDEX_PATH || join(GENERATED, "lexicon-index.ndjson");
const TRANSLATIONS = process.env.LEXICON_TRANSLATIONS_PATH || join(GENERATED, "translations.ndjson");

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined =>
  argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const dryRun = argv.includes("--dry-run");
const scope = flag("scope");
const BATCH = 2_000;

type Provenanced = { readonly value: string; readonly provenance: FieldProvenance };

type IndexEntry = {
  readonly key: string;
  readonly language: "hbo" | "grc";
  readonly strongId: string | null;
  readonly lemma: Provenanced;
  readonly transliteration: Provenanced | null;
  readonly partOfSpeech: Provenanced | null;
  readonly glosses: readonly Provenanced[];
  readonly definitions: readonly Provenanced[];
  readonly etymology: Provenanced | null;
};

type IndexOccurrence = {
  readonly sourceWordId: string;
  readonly language: "hbo" | "grc";
  readonly canonicalRef: string;
  readonly wordPosition: number | null;
  readonly surface: string;
  readonly lexemeKey: string;
  readonly lemma: string;
  readonly morphology: string | null;
  readonly partOfSpeech: string | null;
  readonly semanticDomain: string | null;
  readonly sdbhSense: string | null;
  readonly lexicalDomain: string | null;
  readonly senseNumber: string | null;
  readonly semanticFrame: string | null;
  readonly gloss: string | null;
  readonly provenance: FieldProvenance;
};

/** Chave de internamento da proveniência, igual à UNIQUE da tabela. */
function provenanceKey(provenance: FieldProvenance): string {
  return [
    provenance.sourceId,
    provenance.assetPath,
    provenance.assetSha256,
    provenance.sourceField,
  ].join("\u0000");
}

async function insertSources(client: PoolClient): Promise<void> {
  for (const source of LEXICON_SOURCES) {
    // Só fonte com pino resolvido entra: a tabela exige commit de 40 hex, e
    // uma fonte ainda não coletada não tem o que registrar aqui.
    if (source.pin.kind === "unresolved") continue;
    await client.query(
      `INSERT INTO lexicon_sources
         (id, name, repository, pin_commit, license_declared, license_url, attribution,
          collection_status, approved_by, approved_at, approval_scope, registry_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         pin_commit = EXCLUDED.pin_commit,
         collection_status = EXCLUDED.collection_status,
         approved_by = EXCLUDED.approved_by,
         approved_at = EXCLUDED.approved_at,
         approval_scope = EXCLUDED.approval_scope,
         registry_version = EXCLUDED.registry_version`,
      [
        source.id,
        source.name,
        source.repository,
        source.pin.commit,
        source.license.declared,
        source.license.url,
        source.attribution,
        source.collectionStatus,
        source.approval?.approvedBy ?? null,
        source.approval?.approvedAt ?? null,
        source.approval?.scope ?? null,
        LEXICON_REGISTRY_VERSION,
      ],
    );
  }
}

/**
 * Interna a proveniência e devolve o id. São poucas linhas distintas — uma por
 * (fonte, arquivo, campo) — para centenas de milhares de registros.
 */
async function provenanceIds(
  client: PoolClient,
  all: readonly FieldProvenance[],
): Promise<ReadonlyMap<string, number>> {
  const unique = new Map<string, FieldProvenance>();
  for (const provenance of all) unique.set(provenanceKey(provenance), provenance);
  const ids = new Map<string, number>();
  for (const [key, provenance] of unique) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO lexicon_provenance (source_id, asset_path, asset_sha256, source_field, pin)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (source_id, asset_path, asset_sha256, source_field) DO UPDATE SET pin = EXCLUDED.pin
       RETURNING id`,
      [
        provenance.sourceId,
        provenance.assetPath,
        provenance.assetSha256,
        provenance.sourceField,
        provenance.pin,
      ],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error(`proveniência não gravada: ${key}`);
    ids.set(key, Number(id));
  }
  return ids;
}

/** Monta `($1,$2,...),($3,$4,...)` para um lote de tuplas de igual largura. */
function placeholders(rows: number, columns: number): string {
  const chunks: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    const slots: string[] = [];
    for (let column = 0; column < columns; column += 1) {
      slots.push(`$${row * columns + column + 1}`);
    }
    chunks.push(`(${slots.join(",")})`);
  }
  return chunks.join(",");
}

async function flushEntries(client: PoolClient, batch: readonly unknown[][]): Promise<void> {
  if (batch.length === 0) return;
  const columns = 13;
  await client.query(
    `INSERT INTO lexeme_entries
       (lexeme_key, language, strong_id, lemma, lemma_provenance_id, transliteration,
        transliteration_provenance_id, part_of_speech, gloss, gloss_provenance_id,
        definition, definition_provenance_id, etymology)
     VALUES ${placeholders(batch.length, columns)}
     ON CONFLICT (lexeme_key) DO UPDATE SET
       lemma = EXCLUDED.lemma,
       lemma_provenance_id = EXCLUDED.lemma_provenance_id,
       transliteration = EXCLUDED.transliteration,
       transliteration_provenance_id = EXCLUDED.transliteration_provenance_id,
       part_of_speech = EXCLUDED.part_of_speech,
       gloss = EXCLUDED.gloss,
       gloss_provenance_id = EXCLUDED.gloss_provenance_id,
       definition = EXCLUDED.definition,
       definition_provenance_id = EXCLUDED.definition_provenance_id,
       etymology = EXCLUDED.etymology`,
    batch.flat(),
  );
}

async function flushOccurrences(client: PoolClient, batch: readonly unknown[][]): Promise<void> {
  if (batch.length === 0) return;
  const columns = 16;
  await client.query(
    `INSERT INTO lexeme_occurrences
       (source_word_id, language, canonical_ref, word_position, surface, lexeme_key, lemma,
        morphology, part_of_speech, semantic_domain, sdbh_sense, lexical_domain, sense_number,
        semantic_frame, gloss, provenance_id)
     VALUES ${placeholders(batch.length, columns)}
     ON CONFLICT (source_word_id) DO UPDATE SET
       canonical_ref = EXCLUDED.canonical_ref,
       word_position = EXCLUDED.word_position,
       surface = EXCLUDED.surface,
       lexeme_key = EXCLUDED.lexeme_key,
       lemma = EXCLUDED.lemma,
       morphology = EXCLUDED.morphology,
       part_of_speech = EXCLUDED.part_of_speech,
       semantic_domain = EXCLUDED.semantic_domain,
       sdbh_sense = EXCLUDED.sdbh_sense,
       lexical_domain = EXCLUDED.lexical_domain,
       sense_number = EXCLUDED.sense_number,
       semantic_frame = EXCLUDED.semantic_frame,
       gloss = EXCLUDED.gloss,
       provenance_id = EXCLUDED.provenance_id`,
    batch.flat(),
  );
}

type IndexBdbEntry = {
  readonly bdbId: string;
  readonly lemma: Provenanced;
  readonly partOfSpeech: Provenanced | null;
  readonly definitions: readonly Provenanced[];
  readonly isRoot: boolean;
  readonly senses: readonly BdbSense[];
};

type IndexBdbLink = {
  readonly lexemeKey: string | null;
  readonly bdbId: string;
  readonly augmentedLemma: string;
  readonly provenance: FieldProvenance;
};

async function flushBdbEntries(client: PoolClient, batch: readonly unknown[][]): Promise<void> {
  if (batch.length === 0) return;
  const columns = 9;
  await client.query(
    `INSERT INTO lexeme_bdb_entries
       (bdb_id, lemma, part_of_speech, is_root, definitions, senses, sense_count, max_depth,
        provenance_id)
     VALUES ${placeholders(batch.length, columns)}
     ON CONFLICT (bdb_id) DO UPDATE SET
       lemma = EXCLUDED.lemma,
       part_of_speech = EXCLUDED.part_of_speech,
       is_root = EXCLUDED.is_root,
       definitions = EXCLUDED.definitions,
       senses = EXCLUDED.senses,
       sense_count = EXCLUDED.sense_count,
       max_depth = EXCLUDED.max_depth,
       provenance_id = EXCLUDED.provenance_id`,
    batch.flat(),
  );
}

async function flushBdbLinks(client: PoolClient, batch: readonly unknown[][]): Promise<void> {
  if (batch.length === 0) return;
  const columns = 4;
  await client.query(
    `INSERT INTO lexeme_bdb_links (lexeme_key, bdb_id, augmented_lemma, provenance_id)
     VALUES ${placeholders(batch.length, columns)}
     ON CONFLICT (lexeme_key, bdb_id) DO UPDATE SET
       augmented_lemma = EXCLUDED.augmented_lemma,
       provenance_id = EXCLUDED.provenance_id`,
    batch.flat(),
  );
}

type Counts = {
  entries: number;
  occurrences: number;
  translations: number;
  bdbEntries: number;
  bdbLinks: number;
  /** Pontes sem Strong: não há ocorrência que as alcance. */
  bdbLinksWithoutStrong: number;
  /** Pontes colapsadas por repetirem o par (lema indexado, verbete). */
  bdbLinksCollapsed: number;
};

async function importIndex(client: PoolClient): Promise<Counts> {
  // Primeira passada: só a proveniência, que precisa existir antes das linhas
  // que a referenciam. São poucas distintas, então cabem em memória.
  const provenances: FieldProvenance[] = [];
  const seenProvenance = new Set<string>();
  const collect = (provenance: FieldProvenance | undefined | null): void => {
    if (!provenance) return;
    const key = provenanceKey(provenance);
    if (seenProvenance.has(key)) return;
    seenProvenance.add(key);
    provenances.push(provenance);
  };

  for await (const line of lines(INDEX)) {
    const record = JSON.parse(line) as { type: string };
    if (record.type === "entry") {
      const entry = record as unknown as IndexEntry;
      collect(entry.lemma.provenance);
      collect(entry.transliteration?.provenance);
      collect(entry.glosses[0]?.provenance);
      collect(entry.definitions[0]?.provenance);
    } else if (record.type === "bdb") {
      const bdbEntry = record as unknown as IndexBdbEntry;
      collect(bdbEntry.lemma.provenance);
      collect(bdbEntry.partOfSpeech?.provenance);
      collect(bdbEntry.definitions[0]?.provenance);
    } else if (record.type === "bdb_link") {
      collect((record as unknown as IndexBdbLink).provenance);
    } else {
      collect((record as unknown as IndexOccurrence).provenance);
    }
  }
  if (existsSync(TRANSLATIONS)) {
    for (const record of await storedTranslations()) collect(record.provenance);
  }
  const ids = await provenanceIds(client, provenances);
  console.log(`proveniências internadas: ${ids.size}`);

  const counts: Counts = {
    entries: 0,
    occurrences: 0,
    translations: 0,
    bdbEntries: 0,
    bdbLinks: 0,
    bdbLinksWithoutStrong: 0,
    bdbLinksCollapsed: 0,
  };
  let entryBatch: unknown[][] = [];
  let occurrenceBatch: unknown[][] = [];
  let bdbBatch: unknown[][] = [];
  // As pontes vao depois dos verbetes: a chave estrangeira exige o verbete
  // gravado antes, e inverter a ordem faria a transacao inteira voltar atras.
  const pendingLinks: unknown[][] = [];
  // `ON CONFLICT DO UPDATE` recusa o mesmo par duas vezes no mesmo comando, e
  // o índice lexical tem três casos reais: duas grafias do mesmo lema
  // (הֵן/הֵנָּה, רִישׁ/רֵישׁ, כְּלַל/שַׁכְלֵל) apontando para o mesmo verbete pelo
  // mesmo Strong. A primeira vence e o resto é contado, não descartado calado.
  const seenLinks = new Set<string>();

  for await (const line of lines(INDEX)) {
    const record = JSON.parse(line) as { type: string };
    if (record.type === "entry") {
      const entry = record as unknown as IndexEntry;
      const gloss = entry.glosses[0];
      const definition = entry.definitions[0];
      entryBatch.push([
        entry.key,
        entry.language,
        entry.strongId,
        entry.lemma.value,
        ids.get(provenanceKey(entry.lemma.provenance)),
        entry.transliteration?.value ?? null,
        entry.transliteration ? ids.get(provenanceKey(entry.transliteration.provenance)) : null,
        entry.partOfSpeech?.value ?? null,
        gloss?.value ?? null,
        gloss ? ids.get(provenanceKey(gloss.provenance)) : null,
        definition?.value ?? null,
        definition ? ids.get(provenanceKey(definition.provenance)) : null,
        entry.etymology?.value ?? null,
      ]);
      counts.entries += 1;
      if (entryBatch.length >= BATCH) {
        await flushEntries(client, entryBatch);
        entryBatch = [];
      }
      continue;
    }

    if (record.type === "bdb") {
      const bdbEntry = record as unknown as IndexBdbEntry;
      bdbBatch.push([
        bdbEntry.bdbId,
        bdbEntry.lemma.value,
        bdbEntry.partOfSpeech?.value ?? null,
        bdbEntry.isRoot,
        JSON.stringify(bdbEntry.definitions.map((item) => item.value)),
        JSON.stringify(bdbEntry.senses),
        countSenses(bdbEntry.senses),
        senseDepth(bdbEntry.senses),
        ids.get(provenanceKey(bdbEntry.lemma.provenance)),
      ]);
      counts.bdbEntries += 1;
      if (bdbBatch.length >= BATCH) {
        await flushBdbEntries(client, bdbBatch);
        bdbBatch = [];
      }
      continue;
    }

    if (record.type === "bdb_link") {
      const link = record as unknown as IndexBdbLink;
      if (!link.lexemeKey) {
        // Sem Strong nao ha ocorrencia que chegue a este verbete. Contado, nao
        // gravado: a tabela existe para ligar, e uma ponta solta nao liga nada.
        counts.bdbLinksWithoutStrong += 1;
        continue;
      }
      const pairKey = `${link.lexemeKey}\u0000${link.bdbId}`;
      if (seenLinks.has(pairKey)) {
        counts.bdbLinksCollapsed += 1;
        continue;
      }
      seenLinks.add(pairKey);
      pendingLinks.push([
        link.lexemeKey,
        link.bdbId,
        link.augmentedLemma,
        ids.get(provenanceKey(link.provenance)),
      ]);
      counts.bdbLinks += 1;
      continue;
    }

    const occurrence = record as unknown as IndexOccurrence;
    if (scope && !occurrence.canonicalRef.startsWith(scope)) continue;
    occurrenceBatch.push([
      occurrence.sourceWordId,
      occurrence.language,
      occurrence.canonicalRef,
      occurrence.wordPosition,
      occurrence.surface,
      occurrence.lexemeKey,
      occurrence.lemma,
      occurrence.morphology,
      occurrence.partOfSpeech,
      occurrence.semanticDomain,
      occurrence.sdbhSense,
      occurrence.lexicalDomain,
      occurrence.senseNumber,
      occurrence.semanticFrame,
      occurrence.gloss,
      ids.get(provenanceKey(occurrence.provenance)),
    ]);
    counts.occurrences += 1;
    if (occurrenceBatch.length >= BATCH) {
      await flushOccurrences(client, occurrenceBatch);
      occurrenceBatch = [];
    }
  }
  await flushEntries(client, entryBatch);
  await flushOccurrences(client, occurrenceBatch);
  await flushBdbEntries(client, bdbBatch);
  for (let at = 0; at < pendingLinks.length; at += BATCH) {
    await flushBdbLinks(client, pendingLinks.slice(at, at + BATCH));
  }

  if (existsSync(TRANSLATIONS)) {
    for (const record of await storedTranslations()) {
      await client.query(
        `INSERT INTO editorial_translations
           (subject, target, source_text, source_language, target_language, text, status,
            reviewed_by, reviewed_at, draft_method, provenance_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (subject, target) DO UPDATE SET
           text = EXCLUDED.text,
           source_text = EXCLUDED.source_text,
           draft_method = EXCLUDED.draft_method,
           provenance_id = EXCLUDED.provenance_id,
           updated_at = now()
         -- Rascunho novo não toca em linha que já passou por revisão humana.
         WHERE editorial_translations.status = 'machine_draft'`,
        [
          record.lexemeKey,
          record.target,
          record.sourceText,
          record.sourceLanguage,
          record.targetLanguage,
          record.text,
          record.status,
          record.reviewedBy,
          record.reviewedAt,
          record.draftMethod,
          ids.get(provenanceKey(record.provenance)),
        ],
      );
      counts.translations += 1;
    }
  }
  return counts;
}

async function* lines(path: string): AsyncGenerator<string> {
  const reader = createInterface({
    input: createReadStream(path, "utf8"),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  for await (const line of reader) {
    if (line.length > 0) yield line;
  }
}

/**
 * Confere um arquivo de índice contra o recorte declarado em `--scope`.
 *
 * Exportada para teste: a regra é simples, mas é a única coisa entre um caminho
 * digitado errado e o corpus completo gravado no banco.
 */
export async function occurrencesOutsideScope(
  path: string,
  prefix: string,
): Promise<{ readonly total: number; readonly inScope: number; readonly examples: readonly string[] }> {
  let total = 0;
  let inScope = 0;
  const examples: string[] = [];
  for await (const line of lines(path)) {
    const record = JSON.parse(line) as { type?: string; canonicalRef?: string };
    if (record.type !== "occurrence") continue;
    if (typeof record.canonicalRef === "string" && record.canonicalRef.startsWith(prefix)) {
      inScope += 1;
      continue;
    }
    total += 1;
    if (examples.length < 3) examples.push(record.canonicalRef ?? "(sem referência)");
  }
  return { total, inScope, examples };
}

async function storedTranslations(): Promise<readonly StoredTranslation[]> {
  const content = await readFile(TRANSLATIONS, "utf8");
  return content
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as StoredTranslation);
}

async function main(): Promise<void> {
  assertNoLicenseMixing(LEXICON_SOURCES);
  if (!existsSync(INDEX)) {
    throw new Error(`índice ausente: ${INDEX}. Rode scripts/build-lexicon-index.ts --emit`);
  }
  console.log(`registro ${LEXICON_REGISTRY_VERSION}`);
  for (const source of LEXICON_SOURCES) {
    if (source.pin.kind !== "unresolved") {
      console.log(`  ${source.id}: ${pinLabel(source.pin)} · ${source.collectionStatus}`);
    }
  }
  if (scope) console.log(`recorte: referências começando por "${scope}"`);

  if (scope && (!process.env.LEXICON_INDEX_PATH || !process.env.LEXICON_TRANSLATIONS_PATH)) {
    throw new Error("--scope requires prefiltered index and translation files; scope alone does not limit BDB entries.");
  }
  // Exigir os arquivos pré-filtrados não prova que eles **sejam** o recorte: o
  // caminho pode apontar para o índice completo. Aqui o arquivo é conferido
  // contra o recorte declarado antes de qualquer escrita, de modo que um
  // caminho errado falhe em vez de carregar o corpus inteiro no banco.
  if (scope) {
    const offenders = await occurrencesOutsideScope(INDEX, scope);
    if (offenders.total > 0) {
      throw new Error(
        `o arquivo ${INDEX} tem ${offenders.total} ocorrência(s) fora do recorte "${scope}" ` +
          `(ex.: ${offenders.examples.join(", ")}); refaça o recorte antes de importar`,
      );
    }
    console.log(`arquivo conferido contra o recorte: ${offenders.inScope} ocorrência(s), nenhuma fora`);
  }
  if (dryRun) {
    console.log("\n--dry-run: nada foi escrito no banco.");
    return;
  }
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL não definida. Este script não lê .env nem grava credencial.");
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await insertSources(client);
    const counts = await importIndex(client);
    await client.query("COMMIT");
    console.log(
      `\ngravados: ${counts.entries} verbete(s), ${counts.occurrences} ocorrência(s), ` +
        `${counts.translations} tradução(ões)`,
    );
    console.log(
      `BDB: ${counts.bdbEntries} verbete(s) com árvore de sentidos, ${counts.bdbLinks} ponte(s); ` +
        `${counts.bdbLinksWithoutStrong} ponte(s) sem Strong e ` +
        `${counts.bdbLinksCollapsed} par(es) repetido(s) ficaram de fora`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Só executa quando chamado como programa. Sem esta guarda, importar o módulo
// num teste dispararia uma importação de verdade.
if (process.argv[1]?.replace(/\\/gu, "/").endsWith("import-lexicon-index.ts")) {
  main().catch((error: unknown) => {
    console.error("FALHA NA IMPORTAÇÃO:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
