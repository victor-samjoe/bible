import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  OFFLINE_PACKAGE_BASE_PATH,
  OFFLINE_PACKAGE_SCHEMA,
  assertContiguousNumbering,
  assertPublicPayload,
  canonicalJson,
  offlineManifestSchema,
  sizeInBytes,
  verifyManifest,
  type OfflineBookFile,
  type OfflineEdition,
  type OfflineFileEntry,
  type OfflineManifest,
} from "../../domain/offline/package.ts";

/**
 * Construtor do pacote offline da Bíblia.
 *
 * Executa local, sem rede e sem banco por padrão:
 *
 * ```
 * node --experimental-strip-types src/server/offline/build-package.ts
 * node --experimental-strip-types src/server/offline/build-package.ts --prune
 * DATABASE_URL=... node --experimental-strip-types src/server/offline/build-package.ts --verify-database
 * ```
 *
 * **De onde vem o texto.** De `data/generated/blivre.json`, que é a conversão
 * dos USFM oficiais, e não do banco. O motivo é proveniência: o arquivo tem o
 * hash de cada USFM, e esses hashes são conferíveis contra a lista SHA-256
 * assinada que o próprio distribuidor publica dentro do pacote
 * (`signature.txt.asc`). O banco não carrega essa cadeia. Para o caso em que o
 * banco tenha divergido do arquivo — correção editorial, importação parcial —
 * existe `--verify-database`, que compara versículo por versículo e **falha**
 * em vez de publicar um pacote que mostraria offline um texto diferente do que
 * o leitor mostra online.
 *
 * **Falha fechada.** Nenhum byte é escrito antes de a cadeia de integridade
 * inteira passar; depois de escrever, os arquivos são lidos de volta e
 * reconferidos pelo hash. Uma execução repetida sobre o mesmo texto produz os
 * mesmos bytes, inclusive o manifesto, que não tem carimbo de hora.
 */

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const CORPUS_PATH = join(REPOSITORY_ROOT, "data", "generated", "blivre.json");
const ARCHIVE_PATH = join(REPOSITORY_ROOT, "data", "source", "porbr2018_usfm.zip");
const SOURCE_DIRECTORY = join(REPOSITORY_ROOT, "data", "source", "porbr2018_usfm");
const OUTPUT_ROOT = join(REPOSITORY_ROOT, "public", "biblia-offline");

/** Checksum do pacote oficial, registrado em 17/11 em `data/source/README.md`. */
const ARCHIVE_SHA256 =
  "7ca6742fc1a32ca657a9872047c919097bb9af1384dc318c9cc58ab1cfa5bbf9";

const EXPECTED = { books: 66, chapters: 1189, verses: 31102 } as const;

type CorpusBook = {
  id: string;
  translation_id: string;
  code: string;
  slug: string;
  name: string;
  order_no: number;
};
type CorpusChapter = { id: string; book_id: string; number: number };
type CorpusVerse = { id: string; chapter_id: string; number: number; content: string };
type Corpus = {
  source: {
    identifier: string;
    archiveUrl: string;
    archiveSha256Recorded: string;
    attribution: string;
    files: { name: string; sha256: string }[];
  };
  books: CorpusBook[];
  chapters: CorpusChapter[];
  verses: CorpusVerse[];
};

export type BuiltBook = {
  readonly entry: OfflineFileEntry;
  readonly text: string;
};

export type BuildResult = {
  readonly manifest: OfflineManifest;
  readonly manifestText: string;
  readonly books: readonly BuiltBook[];
};

export function digestOf(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function digestOfBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Lê a lista SHA-256 que o distribuidor assina e publica dentro do pacote.
 * Não valida a assinatura PGP: a chave pública viaja no mesmo arquivo
 * (`keys.asc`), então conferi-la ali seria circular. O que a lista prova é que
 * os arquivos extraídos são os que o distribuidor empacotou; o que liga isso à
 * origem é o checksum do ZIP, registrado no dia do download.
 */
export function parseSignedHashes(text: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of text.split(/\r?\n/u)) {
    const match = /^([0-9a-f]{64})\s{2}(.+)$/u.exec(line.trim());
    if (match) entries.set(match[2], match[1]);
  }
  if (entries.size === 0) throw new Error("signature.txt.asc: nenhuma linha de hash reconhecida");
  return entries;
}

/** Data da assinatura: é a "data correta da versão" que a licença manda indicar. */
export function parseSignedAt(text: string): string {
  const match = /^#\s*Digitally signed\s+(.+)$/mu.exec(text);
  if (!match) throw new Error("signature.txt.asc: data de assinatura não encontrada");
  return match[1].trim();
}

export function editionFrom(corpus: Corpus, signedAt: string): OfflineEdition {
  return {
    identifier: "porbr2018",
    name: "Bíblia Livre (BLIVRE)",
    abbreviation: "BLIVRE",
    language: "pt-BR",
    canon: "66 livros",
    license: "Creative Commons Atribuição 4.0 Brasil (CC BY 4.0 BR)",
    licenseUrl: "https://ebible.org/study/content/texts/porbr2018/about.html",
    attribution: corpus.source.attribution,
    sourceUrl: corpus.source.archiveUrl,
    archiveSha256: ARCHIVE_SHA256,
    sourceSignedAt: signedAt,
    redistribution:
      "Redistribuição permitida pela licença, preservada a atribuição e a indicação da fonte. " +
      "A Bíblia Livre é declarada pelos autores como trabalho em andamento; a versão desta cópia " +
      "é a data de assinatura da fonte registrada acima. Texto não alterado pela plataforma.",
  };
}

/**
 * Agrupa o corpus por livro e capítulo, em ordem canônica, e recusa qualquer
 * coisa que o formato do pacote não represente sem perda.
 */
export function groupCorpus(corpus: Corpus) {
  for (const [key, expected] of Object.entries(EXPECTED)) {
    const actual = corpus[key as "books" | "chapters" | "verses"].length;
    if (actual !== expected) {
      throw new Error(`corpus inválido: ${key} esperado=${expected} encontrado=${actual}`);
    }
  }

  const chapterById = new Map(corpus.chapters.map((chapter) => [chapter.id, chapter]));
  const versesByChapter = new Map<string, CorpusVerse[]>();
  for (const verse of corpus.verses) {
    if (!chapterById.has(verse.chapter_id)) {
      throw new Error(`versículo ${verse.id} aponta para capítulo inexistente`);
    }
    const list = versesByChapter.get(verse.chapter_id);
    if (list) list.push(verse);
    else versesByChapter.set(verse.chapter_id, [verse]);
  }

  const books = [...corpus.books].sort((left, right) => left.order_no - right.order_no);
  return books.map((book) => {
    const chapters = corpus.chapters
      .filter((chapter) => chapter.book_id === book.id)
      .sort((left, right) => left.number - right.number)
      .map((chapter) => {
        const verses = (versesByChapter.get(chapter.id) ?? []).sort(
          (left, right) => left.number - right.number,
        );
        if (verses.length === 0) throw new Error(`${book.code} ${chapter.number}: capítulo sem versículo`);
        return { number: chapter.number, verses };
      });
    if (chapters.length === 0) throw new Error(`${book.code}: livro sem capítulo`);
    assertContiguousNumbering(book.code, chapters);
    return { book, chapters };
  });
}

export async function buildPackage(corpus: Corpus, signedAt: string): Promise<BuildResult> {
  const grouped = groupCorpus(corpus);
  const edition = editionFrom(corpus, signedAt);

  const books: BuiltBook[] = [];
  let chapterTotal = 0;
  let verseTotal = 0;
  let byteTotal = 0;

  // Primeira passada: o conteúdo de cada livro e seu hash. O caminho e a versão
  // ainda não existem, porque a versão depende destes hashes.
  const drafts = grouped.map(({ book, chapters }) => {
    const payload = chapters.map((chapter) => chapter.verses.map((verse) => verse.content));
    const verses = payload.reduce((total, chapter) => total + chapter.length, 0);
    return { book, payload, chapters: chapters.length, verses };
  });

  // Hash provisório do conteúdo textual, para derivar a versão do pacote antes
  // de escrever os arquivos definitivos, que precisam carregar a versão dentro.
  const contentDigests = drafts.map((draft) =>
    digestOf(canonicalJson({ book: draft.book.code, chapters: draft.payload })),
  );

  // **Regra da semente da versão:** ela contém todo campo do manifesto que não
  // deriva da versão, e nada mais. Hoje isso é o esquema, a edição e, por
  // livro, código, nome, slug, ordem, quantidades e o hash do texto. Ficam de
  // fora `path`, `bytes` e `sha256`, que embutem a versão e tornariam o cálculo
  // circular — mas eles são função do que já está aqui, então nada escapa.
  //
  // Por que não só o texto: o cliente guarda o manifesto junto com o pacote e
  // decide "não mudou" pela versão. Um campo que entrasse sem mudar a versão
  // nunca chegaria a quem já instalou — foi o que aconteceu ao acrescentar
  // `slug` e `contentSha256` durante esta tarefa. Quem acrescentar campo novo
  // ao manifesto acrescenta aqui também; a consequência é um download, e a
  // alternativa é um cliente que não sabe ler o que tem gravado.
  const versionSeed = canonicalJson({
    schema: OFFLINE_PACKAGE_SCHEMA,
    edition,
    files: drafts.map((draft, index) => ({
      book: draft.book.code,
      name: draft.book.name,
      slug: draft.book.slug,
      order: index + 1,
      chapters: draft.chapters,
      verses: draft.verses,
      contentSha256: contentDigests[index],
    })),
  });
  const version = digestOf(versionSeed);

  for (const [index, draft] of drafts.entries()) {
    const file: OfflineBookFile = {
      schema: OFFLINE_PACKAGE_SCHEMA,
      version,
      book: draft.book.code,
      name: draft.book.name,
      attribution: edition.attribution,
      chapters: draft.payload,
    };
    const text = canonicalJson(file);
    assertPublicPayload(`${draft.book.code}.json`, text);
    const bytes = sizeInBytes(text);
    const entry: OfflineFileEntry = {
      book: draft.book.code,
      name: draft.book.name,
      slug: draft.book.slug,
      order: index + 1,
      path: `${OFFLINE_PACKAGE_BASE_PATH}/${version}/${draft.book.code}.json`,
      chapters: draft.chapters,
      verses: draft.verses,
      bytes,
      sha256: digestOf(text),
      contentSha256: contentDigests[index],
    };
    chapterTotal += draft.chapters;
    verseTotal += draft.verses;
    byteTotal += bytes;
    books.push({ entry, text });
  }

  const manifest: OfflineManifest = {
    schema: OFFLINE_PACKAGE_SCHEMA,
    version,
    edition,
    totals: {
      books: books.length,
      chapters: chapterTotal,
      verses: verseTotal,
      bytes: byteTotal,
    },
    files: books.map((built) => built.entry),
  };

  const manifestText = canonicalJson(manifest);
  assertPublicPayload("manifest.json", manifestText);

  // O construtor passa pelo mesmo validador que o instalador usa no aparelho.
  // Se o pacote não passaria lá, não é escrito aqui.
  const validated = verifyManifest(JSON.parse(manifestText));
  if (!validated.ok) throw new Error(`manifesto recusado pelo próprio validador: ${validated.reason}`);

  return { manifest, manifestText, books };
}

async function readCorpus(): Promise<Corpus> {
  return JSON.parse(await readFile(CORPUS_PATH, "utf8")) as Corpus;
}

/** Cadeia de integridade, antes de qualquer escrita. */
async function verifyProvenance(corpus: Corpus): Promise<{ signedAt: string }> {
  const archive = await readFile(ARCHIVE_PATH);
  const archiveDigest = digestOfBytes(archive);
  if (archiveDigest !== ARCHIVE_SHA256) {
    throw new Error(
      `pacote oficial com checksum diferente do registrado: ${archiveDigest} != ${ARCHIVE_SHA256}`,
    );
  }

  const signatureText = await readFile(join(SOURCE_DIRECTORY, "signature.txt.asc"), "utf8");
  const signed = parseSignedHashes(signatureText);
  const signedAt = parseSignedAt(signatureText);

  const names = await readdir(SOURCE_DIRECTORY);
  let checked = 0;
  for (const name of names) {
    const expected = signed.get(name);
    if (!expected) continue;
    const actual = digestOfBytes(await readFile(join(SOURCE_DIRECTORY, name)));
    if (actual !== expected) throw new Error(`${name}: conteúdo extraído divergente da lista assinada`);
    checked += 1;
  }
  if (checked !== signed.size) {
    throw new Error(`lista assinada tem ${signed.size} arquivos; ${checked} conferidos no disco`);
  }

  for (const file of corpus.source.files) {
    const expected = signed.get(file.name);
    if (!expected) throw new Error(`${file.name}: fora da lista assinada da fonte`);
    if (expected !== file.sha256.toLowerCase()) {
      throw new Error(`${file.name}: hash do corpus divergente da lista assinada`);
    }
  }

  return { signedAt };
}

/**
 * Compara o pacote construído com os versículos publicados de um Postgres.
 * Usado com banco local descartável; serve para provar que offline e online
 * mostram o mesmo texto. Importa `pg` sob demanda para não arrastar driver de
 * banco para quem só constrói o artefato.
 */
async function verifyAgainstDatabase(result: BuildResult, connectionString: string): Promise<void> {
  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query<{ code: string; chapter: number; number: number; content: string }>(
      `SELECT b.code, c.number AS chapter, v.number, v.content
         FROM verses v
         JOIN chapters c ON c.id = v.chapter_id
         JOIN books b ON b.id = c.book_id
         JOIN translations t ON t.id = b.translation_id
        WHERE t.status = 'approved' AND v.published
        ORDER BY b.order_no, c.number, v.number`,
    );

    const packaged = new Map<string, string>();
    for (const built of result.books) {
      const file = JSON.parse(built.text) as OfflineBookFile;
      file.chapters.forEach((chapter, chapterIndex) => {
        chapter.forEach((content, verseIndex) => {
          packaged.set(`${file.book} ${chapterIndex + 1}:${verseIndex + 1}`, content);
        });
      });
    }

    const divergences: string[] = [];
    for (const row of rows) {
      const key = `${row.code} ${row.chapter}:${row.number}`;
      const inPackage = packaged.get(key);
      if (inPackage === undefined) divergences.push(`${key}: no banco, fora do pacote`);
      else if (inPackage !== row.content) divergences.push(`${key}: texto divergente`);
      packaged.delete(key);
    }
    for (const key of packaged.keys()) divergences.push(`${key}: no pacote, não publicado no banco`);

    if (divergences.length > 0) {
      throw new Error(
        `pacote divergente do banco em ${divergences.length} versículos; os 5 primeiros: ` +
          divergences.slice(0, 5).join(" | "),
      );
    }
    console.log(
      JSON.stringify({ bancoConferido: { versiculos: rows.length, divergencias: 0 } }, null, 2),
    );
  } finally {
    await client.end();
  }
}

async function writePackage(result: BuildResult, prune: boolean): Promise<void> {
  const versionDirectory = join(OUTPUT_ROOT, result.manifest.version);
  await mkdir(versionDirectory, { recursive: true });

  for (const built of result.books) {
    await writeFile(join(versionDirectory, `${built.entry.book}.json`), built.text, "utf8");
  }
  await writeFile(join(OUTPUT_ROOT, "manifest.json"), result.manifestText, "utf8");

  // Pós-condição: relê o que foi escrito. Um erro de codificação ou uma escrita
  // truncada aparece aqui, não no aparelho de quem baixou.
  for (const built of result.books) {
    const written = await readFile(join(versionDirectory, `${built.entry.book}.json`), "utf8");
    if (digestOf(written) !== built.entry.sha256) {
      throw new Error(`${built.entry.book}.json: arquivo escrito não confere com o hash declarado`);
    }
  }
  const manifestWritten = await readFile(join(OUTPUT_ROOT, "manifest.json"), "utf8");
  const reparsed = offlineManifestSchema.safeParse(JSON.parse(manifestWritten));
  if (!reparsed.success || reparsed.data.version !== result.manifest.version) {
    throw new Error("manifest.json escrito não confere");
  }

  if (prune) {
    const existing = await readdir(OUTPUT_ROOT, { withFileTypes: true });
    for (const item of existing) {
      if (item.isDirectory() && item.name !== result.manifest.version) {
        await rm(join(OUTPUT_ROOT, item.name), { recursive: true, force: true });
        console.log(`versão anterior removida: ${item.name}`);
      }
    }
  }
}

async function main(): Promise<void> {
  const prune = process.argv.includes("--prune");
  const verifyDatabase = process.argv.includes("--verify-database");

  const corpus = await readCorpus();
  const { signedAt } = await verifyProvenance(corpus);
  const result = await buildPackage(corpus, signedAt);

  if (verifyDatabase) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("--verify-database exige DATABASE_URL");
    await verifyAgainstDatabase(result, connectionString);
  }

  await writePackage(result, prune);

  const largest = [...result.books].sort((left, right) => right.entry.bytes - left.entry.bytes)[0];
  console.log(
    JSON.stringify(
      {
        versao: result.manifest.version,
        fonteAssinadaEm: signedAt,
        totais: result.manifest.totals,
        manifestoBytes: sizeInBytes(result.manifestText),
        maiorArquivo: { livro: largest.entry.book, bytes: largest.entry.bytes },
        caminho: `${OFFLINE_PACKAGE_BASE_PATH}/${result.manifest.version}/`,
        construidoEm: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

const invokedPath = process.argv[1]?.replace(/\\/gu, "/") ?? "";
if (invokedPath.endsWith("src/server/offline/build-package.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
