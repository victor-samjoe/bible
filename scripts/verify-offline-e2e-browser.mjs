/** Exercita controles reais, pacote local e service worker em origem descartável. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { strict as assert } from "node:assert";

const root = resolve("public");
const result = await build({
  stdin: { contents: 'import React from "react"; import {createRoot} from "react-dom/client"; import {OfflineControls} from "./app/biblia/offline-controls.tsx"; createRoot(document.getElementById("root")).render(<OfflineControls/>);', resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", outdir: "out", loader: { ".css": "local-css" },
  plugins: [{ name: "link", setup(builder) {
    builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'import React from "react"; export default function Link(p){return React.createElement("a",p)}', loader: "js", resolveDir: process.cwd() }));
  }}],
});
const js = result.outputFiles.find((file) => file.path.endsWith(".js"));
assert(js);
let bookRequests = 0, apiRequests = 0, failAfter = Infinity;
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path.startsWith("/api/")) apiRequests += 1;
    if (path === "/") { res.setHeader("Content-Type", "text/html"); res.end('<div id="root"></div><script src="/test.js"></script>'); return; }
    if (path === "/test.js") { res.setHeader("Content-Type", "text/javascript"); res.end(js.contents); return; }
    if (path === "/offline") { res.end("Sem conexão"); return; }
    if (path === "/icon.svg") { res.setHeader("Content-Type", "image/svg+xml"); res.end('<svg xmlns="http://www.w3.org/2000/svg"/>'); return; }
    if (path.startsWith("/biblia-offline/") && path.endsWith(".json") && !path.endsWith("manifest.json")) {
      bookRequests += 1;
      if (bookRequests > failAfter) { res.statusCode = 503; res.end(); return; }
    }
    const file = resolve(root, `.${path}`);
    if (!file.startsWith(root + sep)) { res.statusCode = 403; res.end(); return; }
    const body = await readFile(file);
    res.setHeader("Content-Type", path.endsWith(".js") ? "text/javascript" : path.endsWith(".json") ? "application/json" : "text/html");
    res.end(body);
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.evaluate(async () => { await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready; });
  await page.getByRole("button", { name: "Baixar a Bíblia" }).waitFor({ timeout: 30000 });
  assert.equal(bookRequests, 0, "livros baixados antes do consentimento");
  await page.getByRole("button", { name: "Baixar a Bíblia" }).click();
  await page.getByText("Bíblia salva neste aparelho.").waitFor({ timeout: 120000 });
  assert.equal(bookRequests, 66);
  assert.equal(apiRequests, 0);
  await context.setOffline(true);
  await page.goto(`${origin}/biblia/genesis/1`, { waitUntil: "load" });
  await page.getByText("No princípio criou Deus os céus e a terra.").waitFor({ timeout: 30000 });
  await page.goto(`${origin}/biblia/joao/1`, { waitUntil: "load" });
  await page.getByText("No princípio era a Palavra, e a Palavra estava junto de Deus, e a Palavra era Deus.").waitFor({ timeout: 30000 });
  assert.equal((await page.locator("body").innerText()).includes("\\fr"), false, "marcas de nota apareceram na leitura offline");
  await context.setOffline(false);
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Remover do aparelho" }).click();
  await page.getByText(/Pacote removido deste aparelho/).waitFor({ timeout: 30000 });
  // Falha após o primeiro livro: mesmo sem instalação, é possível remover o
  // download parcial e revogar o consentimento pelo próprio controle.
  failAfter = bookRequests + 1;
  await page.getByRole("button", { name: "Baixar a Bíblia" }).click();
  await page.getByRole("alert").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Remover do aparelho" }).click();
  await page.getByText(/Pacote removido deste aparelho/).waitFor({ timeout: 30000 });
  await context.setOffline(true);
  await page.goto(`${origin}/biblia/genesis/1`, { waitUntil: "domcontentloaded" });
  assert.equal(await page.getByText("No princípio criou Deus os céus e a terra.").count(), 0);
  await context.close();
  console.log("Chromium: consentimento, 66 livros, leitura offline, falha parcial e remoção — OK; sem chamadas de API");
} finally { await browser.close(); await new Promise((resolveClose) => server.close(resolveClose)); }
