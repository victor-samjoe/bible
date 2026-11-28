/** Teste local de equivalência, sem conexão ao Supabase. */
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { mkdtemp, rm, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { strict as assert } from "node:assert";

const temp = await mkdtemp(join(tmpdir(), "samjoe-static-reader-"));
try {
  const output = join(temp, "reader.mjs");
  await build({ entryPoints: ["src/server/bible/static-cloudflare.ts"], bundle: true, platform: "node", format: "esm", outfile: output });
  const { createStaticCloudflareReader } = await import(pathToFileURL(output).href);
  const source = JSON.parse(await readFile("data/generated/blivre.json", "utf8"));
  const manifest = JSON.parse(await readFile("public/biblia-offline/manifest.json", "utf8"));
  const reader = createStaticCloudflareReader(async (path) => new Response(await readFile(`public${path}`)));
  const books = new Map(source.books.map((book) => [book.id, book]));
  const chapters = new Map(source.chapters.map((chapter) => [chapter.id, chapter]));
  const expected = new Map();
  for (const row of source.verses) {
    const chapter = chapters.get(row.chapter_id), book = chapter && books.get(chapter.book_id);
    if (!book || !chapter) throw new Error("referência sem capítulo ou livro");
    const key = `${book.slug}:${chapter.number}`;
    const clean = row.content.replace(/\\(?:f|x)\b[\s\S]*?\\(?:f|x)\*/g, " ").replace(/\\add\*?/g, "").replace(/\\[a-z0-9]+\*?(?:\s+)?/gi, "").replace(/\s+/g, " ").trim();
    const verses = expected.get(key) ?? [];
    verses.push({ number: row.number, content: clean }); expected.set(key, verses);
  }
  let verses = 0, chapterCount = 0;
  for (const book of manifest.files) for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
    const result = await reader.readChapter(book.slug, chapter);
    assert.equal(result.ok, true, `${book.slug} ${chapter}`);
    assert.deepEqual(result.chapter.verses, (expected.get(`${book.slug}:${chapter}`) ?? []).sort((a, b) => a.number - b.number));
    verses += result.chapter.verses.length; chapterCount += 1;
  }
  console.log(`${manifest.files.length} livros, ${chapterCount} capítulos, ${verses} versículos comparados ao corpus local; sem chamadas de rede`);
} finally {
  // Apenas os arquivos conhecidos criados por este teste temporário.
  await rm(join(temp, "reader.mjs"), { force: true });
  await rmdir(temp);
}
