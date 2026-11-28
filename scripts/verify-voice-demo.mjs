import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { strict as assert } from "node:assert";

const manifest = JSON.parse(await readFile("public/biblia-offline/manifest.json", "utf8"));
const book = JSON.parse(await readFile(`public${manifest.files.find((item) => item.book === "GEN").path}`, "utf8"));
const verses = book.chapters[0].map((content, index) => ({ number: index + 1, content }));
const source = `import React from 'react';import {createRoot} from 'react-dom/client';import {VoiceDemo} from './app/biblia/voice-demo.tsx';createRoot(document.getElementById('root')).render(<VoiceDemo book="Gênesis" chapter={1} translation="Bíblia Livre" verses={${JSON.stringify(verses)}}/>);`;
const result = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", outdir: "out", loader: { ".css": "local-css" } });
const js = result.outputFiles.find((file) => file.path.endsWith(".js"));
assert(js);
let audioRequests = 0;
const server = createServer(async (req, res) => {
  if (req.url === "/") { res.setHeader("Content-Type", "text/html"); res.end('<div id="root"></div><script src="/test.js"></script>'); }
  else if (req.url === "/test.js") { res.setHeader("Content-Type", "text/javascript"); res.end(js.contents); }
  else if (req.url === "/audio/homologacao/genesis-1-1-3-felipe.mp3") { audioRequests += 1; res.setHeader("Content-Type", "audio/mpeg"); res.end(await readFile(`public${req.url}`)); }
  else res.writeHead(404).end();
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const audio = page.getByLabel("Teste de voz Felipe: Gênesis 1, versículos 1 a 3");
  await audio.waitFor();
  assert.equal(await audio.getAttribute("preload"), "none");
  assert.equal(audioRequests, 0, "áudio não deve ser baixado automaticamente");
  await audio.evaluate((element) => element.play());
  await page.waitForFunction(() => document.querySelector("audio")?.currentTime > 0, null, { timeout: 30000 });
  assert.equal(audioRequests, 1);
  await page.evaluate(() => window.dispatchEvent(new Event("reader-speech-start")));
  assert.equal(await audio.evaluate((element) => element.paused), true);
  console.log("Prévia de Gênesis 1:1–3 reproduz, só baixa após toque e pausa ao iniciar outra voz — OK");
} finally { await browser.close(); await new Promise((done) => server.close(done)); }
