/** Compara quatro trechos públicos; não varre nem escreve no banco remoto. */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { strict as assert } from "node:assert";

const code = await build({ entryPoints: ["src/server/contracts/bible.ts"], bundle: true, write: false, platform: "node", format: "cjs" });
const module = { exports: {} };
new Function("require", "module", "exports", code.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { sanitizeUsfm } = module.exports;
const manifest = JSON.parse(await readFile("public/biblia-offline/manifest.json", "utf8"));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  for (const [slug, chapter] of [["genesis", 1], ["salmos", 23], ["joao", 1], ["apocalipse", 22]]) {
    const entry = manifest.files.find((item) => item.slug === slug);
    assert(entry);
    const book = JSON.parse(await readFile(`public${entry.path}`, "utf8"));
    const expected = sanitizeUsfm(book.chapters[chapter - 1][0]);
    const response = await page.goto(`https://bibliabereianos.com.br/biblia/${slug}/${chapter}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert.equal(response?.status(), 200);
    const text = (await page.locator("body").innerText()).replace(/\s+/gu, " ");
    assert(text.includes(expected), `${slug} ${chapter}: primeiro versículo difere`);
    console.log(`${slug} ${chapter}: primeiro versículo confere`);
  }
} finally { await browser.close(); }
