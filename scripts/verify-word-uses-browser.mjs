import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { strict as assert } from "node:assert";

const bundle = await build({ stdin: { contents: 'import React from "react"; import {createRoot} from "react-dom/client"; import {WordUsesIndex} from "./app/palavra/word-uses-index.tsx"; createRoot(document.getElementById("root")).render(<WordUsesIndex language="hbo" strong="H7121"/>);', resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", outdir: "out", loader: { ".css": "local-css" } });
const js = bundle.outputFiles.find((file) => file.path.endsWith(".js"));
assert(js);
const root = resolve("public");
let files = 0, api = 0;
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path.startsWith("/api/")) api += 1;
    if (path === "/") { res.setHeader("Content-Type", "text/html"); res.end('<div id="root"></div><script src="/test.js"></script>'); return; }
    if (path === "/test.js") { res.setHeader("Content-Type", "text/javascript"); res.end(js.contents); return; }
    const file = resolve(root, `.${path}`);
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if (path.startsWith("/word-study/")) files += 1;
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(files, 0, "o índice deve ser carregado apenas após ação da pessoa");
  await page.getByRole("button", { name: "Buscar ocorrências em outros livros" }).click();
  await page.getByText(/GEN 1:5/).waitFor({ timeout: 30000 });
  assert.equal(await page.getByText(/cobertura não foi certificada/i).count(), 1);
  assert.equal(files, 2, "manifesto e apenas uma partição");
  assert.equal(api, 0);
  const firstCount = await page.locator("ol li").count();
  await page.getByRole("button", { name: "Ver mais ocorrências" }).click();
  await page.waitForFunction((count) => document.querySelectorAll("ol li").length > count, firstCount);
  assert.equal(files, 2, "paginação deve reutilizar a partição já carregada");
  assert.equal(api, 0);
  console.log(`Chromium: H7121, paginação e aviso de cobertura; ${files} arquivos, nenhuma API — OK`);
} finally { await browser.close(); await new Promise((done) => server.close(done)); }
