import { readFile } from "node:fs/promises";
import { Client } from "pg";

type Book = { id: string; translation_id: string; code: string; slug: string; name: string; order_no: number };
type Chapter = { id: string; book_id: string; number: number };
type Verse = { id: string; chapter_id: string; number: number; content: string; published: boolean };
type Corpus = { books: Book[]; chapters: Chapter[]; verses: Verse[] };

const expected = { books: 66, chapters: 1189, verses: 31102 };
const sourcePath = process.env.BLIVRE_CORPUS_PATH ?? "data/generated/blivre.json";

async function readCorpus(): Promise<Corpus> {
  const parsed = JSON.parse(await readFile(sourcePath, "utf8")) as Corpus;
  for (const [key, count] of Object.entries(expected)) {
    if (parsed[key as keyof Corpus].length !== count) throw new Error(`Corpus inválido: ${key} esperado=${count}`);
  }
  return parsed;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL é obrigatório; não use chaves de serviço no script.");
  const corpus = await readCorpus();
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    for (const book of corpus.books) {
      await client.query(
        `INSERT INTO books (id, translation_id, code, slug, name, order_no)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (translation_id, code) DO UPDATE SET slug=EXCLUDED.slug,name=EXCLUDED.name,order_no=EXCLUDED.order_no`,
        [book.id, book.translation_id, book.code, book.slug, book.name, book.order_no],
      );
    }
    for (const chapter of corpus.chapters) {
      await client.query(
        `INSERT INTO chapters (id, book_id, number) VALUES ($1,$2,$3)
         ON CONFLICT (book_id, number) DO NOTHING`, [chapter.id, chapter.book_id, chapter.number],
      );
    }
    for (const verse of corpus.verses) {
      await client.query(
        `INSERT INTO verses (id, chapter_id, number, content, published) VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (chapter_id, number) DO UPDATE SET content=EXCLUDED.content, published=true`,
        [verse.id, verse.chapter_id, verse.number, verse.content],
      );
    }
    const result = await client.query<{ books: string; chapters: string; verses: string }>(
      `SELECT
       (SELECT count(*) FROM books WHERE translation_id = '42f1e145-244c-4dd7-ae60-8ab66407f678')::text AS books,
       (SELECT count(*) FROM chapters c JOIN books b ON b.id=c.book_id WHERE b.translation_id = '42f1e145-244c-4dd7-ae60-8ab66407f678')::text AS chapters,
       (SELECT count(*) FROM verses v JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id WHERE b.translation_id = '42f1e145-244c-4dd7-ae60-8ab66407f678' AND v.published)::text AS verses`,
    );
    await client.query("COMMIT");
    console.log(JSON.stringify({ imported: result.rows[0], expected, sourcePath }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

