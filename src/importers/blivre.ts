import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const CODES = "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split(" ");
export const SOURCE = {
  identifier: "porbr2018",
  archiveUrl: "https://ebible.org/Scriptures/porbr2018_usfm.zip",
  archiveSha256Recorded: "7CA6742FC1A32CA657A9872047C919097BB9AF1384DC318C9CC58AB1CFA5BBF9",
  downloadedAt: "2026-11-17",
  attribution: "Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio e Marco Teles, fevereiro de 2018. Licença Creative Commons Atribuição 4.0 Brasil.",
};
type Verse = { id: string; chapter_id: string; number: number; content: string; published: false };
type Chapter = { id: string; book_id: string; number: number };
type Book = { id: string; translation_id: string; code: string; slug: string; name: string; order_no: number };
export type ParsedBook = { book: Book; chapters: Chapter[]; verses: Verse[] };

export function parseBook(text: string, expectedCode: string, order: number, translationId: string): ParsedBook {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let code = "", name = "", chapter: Chapter | undefined, previousVerse = 0;
  const chapters: Chapter[] = [], verses: Verse[] = [];
  const bookId = randomUUID();
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const match = /^\\(\w+)\s*(.*)$/.exec(line);
    if (!match) throw new Error(`${expectedCode}:${index + 1}: linha USFM inválida`);
    const [, marker, value] = match;
    if (marker === "id") {
      if (code || chapter) throw new Error(`${expectedCode}: id duplicado ou tardio`);
      code = value.trim().split(/\s+/)[0];
    } else if (marker === "toc2") {
      if (name || chapter) throw new Error(`${expectedCode}: toc2 duplicado ou tardio`);
      name = value.trim();
    } else if (marker === "c") {
      if (!code || !name || !/^[1-9]\d*\s*$/.test(value)) throw new Error(`${expectedCode}: capítulo inválido`);
      const number = Number(value.trim());
      if (!Number.isSafeInteger(number) || number !== chapters.length + 1) throw new Error(`${expectedCode}: capítulos fora de ordem`);
      if (chapter && previousVerse === 0) throw new Error(`${expectedCode}: capítulo vazio`);
      chapter = { id: randomUUID(), book_id: bookId, number }; chapters.push(chapter); previousVerse = 0;
    } else if (marker === "v") {
      const v = /^([1-9]\d*)\s+(.+?)\s*$/.exec(value);
      if (!chapter || !v) throw new Error(`${expectedCode}:${index + 1}: versículo inválido`);
      const number = Number(v[1]);
      if (!Number.isSafeInteger(number) || number <= previousVerse) throw new Error(`${expectedCode}:${index + 1}: versículo duplicado ou fora de ordem`);
      previousVerse = number;
      verses.push({ id: randomUUID(), chapter_id: chapter.id, number, content: v[2], published: false });
    } else if (!["ide", "h", "toc1", "toc3", "mt1", "p", "d"].includes(marker)) {
      throw new Error(`${expectedCode}:${index + 1}: marcador não suportado ${marker}`);
    }
  }
  if (code !== expectedCode || !name || !chapter || !previousVerse) throw new Error(`${expectedCode}: livro incompleto ou código divergente`);
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { book: { id: bookId, translation_id: translationId, code, slug, name, order_no: order }, chapters, verses };
}

export async function convertCorpus(directory: string, translationId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(translationId)) throw new Error("translation_id deve ser UUID");
  const names = (await readdir(directory)).filter((name) => name.toLowerCase().endsWith(".usfm")).sort();
  if (names.length !== CODES.length) throw new Error(`Esperados 66 livros USFM; encontrados ${names.length}`);
  const books: Book[] = [], chapters: Chapter[] = [], verses: Verse[] = [];
  const files: { name: string; sha256: string }[] = [];
  for (const [index, name] of names.entries()) {
    const code = CODES[index];
    if (!new RegExp(`^\\d{2}-${code}porbr2018\\.usfm$`).test(name)) throw new Error(`Arquivo inesperado ou fora de ordem: ${name}`);
    const bytes = await readFile(join(directory, name));
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const result = parseBook(text, code, index + 1, translationId);
    books.push(result.book); chapters.push(...result.chapters); verses.push(...result.verses);
    files.push({ name, sha256: createHash("sha256").update(bytes).digest("hex").toUpperCase() });
  }
  return { source: { ...SOURCE, convertedAt: new Date().toISOString(), archiveChecksumVerified: false, files }, books, chapters, verses };
}
