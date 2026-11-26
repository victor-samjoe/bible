/** Compara pacote estático com corpus local; não consulta nem grava no Supabase. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { strict as assert } from "node:assert";

const corpus = JSON.parse(await readFile("data/generated/blivre.json", "utf8"));
const manifest = JSON.parse(await readFile("public/biblia-offline/manifest.json", "utf8"));
const books = new Map(corpus.books.map((book) => [book.code, book]));
const chapters = new Map(corpus.chapters.map((chapter) => [chapter.id, chapter]));
const verses = new Map();
for (const verse of corpus.verses) {
  const chapter = chapters.get(verse.chapter_id);
  assert(chapter, `capítulo ausente para ${verse.id}`);
  verses.set(`${chapter.book_id}:${chapter.number}:${verse.number}`, verse.content);
}
let checked = 0;
for (const entry of manifest.files) {
  const book = books.get(entry.book);
  assert(book, `livro ausente: ${entry.book}`);
  const bytes = await readFile(`public${entry.path}`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, `hash: ${entry.book}`);
  const file = JSON.parse(bytes);
  for (const [chapterIndex, list] of file.chapters.entries()) for (const [verseIndex, content] of list.entries()) {
    const key = `${book.id}:${chapterIndex + 1}:${verseIndex + 1}`;
    assert.equal(content, verses.get(key), `texto divergente: ${entry.book} ${chapterIndex + 1}:${verseIndex + 1}`);
    checked += 1;
  }
}
assert.equal(manifest.files.length, 66);
assert.equal(checked, 31102);
assert.equal(checked, verses.size);
console.log(`${manifest.files.length} livros, ${checked} versículos, hashes e texto local — OK`);
