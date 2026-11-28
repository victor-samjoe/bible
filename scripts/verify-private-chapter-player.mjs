import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { strict as assert } from "node:assert";

const hash = createHash("sha256").update("No princípio.").digest("hex");
const code = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {ReadChapterAloud} from './app/biblia/speech.tsx';
function App(){const [bad,setBad]=useState(false);return <><button onClick={()=>setBad(!bad)}>Trocar texto</button><ReadChapterAloud verses={[{number:1,content:bad?'Outro texto.':'No princípio.'}]} recording={{source:'/api/private-audio/genesis/1.mp3',textSha256:'${hash}',verseCount:1,label:'Prévia privada'}}/></>};createRoot(document.getElementById('root')).render(<App/>);`;
const result = await build({ stdin: { contents: code, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", outdir: "out", loader: { ".css": "local-css" } });
const js = result.outputFiles.find((file) => file.path.endsWith(".js"));
assert(js);
let requests = 0;
const server = createServer((req, res) => {
  if (req.url === "/") { res.setHeader("Content-Type", "text/html"); res.end('<div id="root"></div><script src="/test.js"></script>'); }
  else if (req.url === "/test.js") { res.setHeader("Content-Type", "text/javascript"); res.end(js.contents); }
  else { if (req.url?.startsWith("/api/private-audio/")) requests += 1; res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      getVoices: () => [{ lang: "pt-BR" }], addEventListener() {}, removeEventListener() {},
      cancel() {}, pause() {}, resume() {}, speak(item) { item.onstart?.(); },
    } });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.getByLabel("Prévia privada").waitFor({ timeout: 30000 });
  assert.equal(requests, 0, "não carregar áudio sem ação da pessoa");
  await page.getByRole("button", { name: "▶ Ouvir o capítulo" }).click();
  await page.getByLabel("Prévia privada").dispatchEvent("play");
  assert.equal(await page.getByRole("button", { name: "▶ Ouvir o capítulo" }).count(), 1, "a gravação deve parar a voz do aparelho");
  await page.getByRole("button", { name: "Trocar texto" }).click();
  assert.equal(await page.getByLabel("Prévia privada").count(), 0, "não usar áudio de texto divergente");
  await page.getByRole("button", { name: "Trocar texto" }).click();
  await page.getByLabel("Prévia privada").waitFor({ timeout: 30000 });
  assert.equal(requests, 0);
  console.log("Prévia privada: texto conferido, arquivo não carregado antecipadamente e áudio divergente recusado — OK");
} finally { await browser.close(); await new Promise((done) => server.close(done)); }
