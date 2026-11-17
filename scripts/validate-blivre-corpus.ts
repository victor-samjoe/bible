import { readFile } from "node:fs/promises";

const expected = { books: 66, chapters: 1189, verses: 31102 };

async function main() {
  const parsed = JSON.parse(await readFile("data/generated/blivre.json", "utf8")) as Record<string, unknown[]>;
  for (const [key, count] of Object.entries(expected)) {
    if (!Array.isArray(parsed[key]) || parsed[key].length !== count) throw new Error(`${key}: esperado ${count}`);
  }
  console.log(JSON.stringify({ valid: true, ...expected }));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

