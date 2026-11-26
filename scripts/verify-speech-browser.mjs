import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { strict as assert } from "node:assert";

const source = `
import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {SpeakText, ReadChapterAloud} from "./app/biblia/speech.tsx";
function App(){const [shown,setShown]=useState(true);return <>
  <button onClick={()=>setShown(false)}>Remover outro controle</button>
  <ReadChapterAloud verses={[{number:1,content:"No princípio"}]} />
  {shown ? <SpeakText text="בְּרֵאשִׁית" target="hbo" label="Ouvir o original"/> : null}
  <SpeakText text="λόγος" target="grc" label="Ouvir grego"/>
</>}; createRoot(document.getElementById("root")).render(<App/>);
`;
const result = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", outdir: "out", loader: { ".css": "local-css" } });
const js = result.outputFiles.find((file) => file.path.endsWith(".js"));
assert(js);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent('<div id="root"></div>');
  await page.evaluate(() => {
    const listeners = new Set();
    window.speechAudit = { cancelled: 0, spoken: [] };
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      getVoices: () => [{ lang: "pt-BR" }, { lang: "he-IL" }, { lang: "el-GR" }],
      addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn),
      cancel: () => { window.speechAudit.cancelled += 1; }, pause: () => {}, resume: () => {},
      speak: (item) => { window.speechAudit.spoken.push(item.text); item.onstart?.(); },
    }});
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  });
  await page.addScriptTag({ content: js.text });
  await page.getByRole("button", { name: "▶ Ouvir o capítulo" }).click();
  assert.equal(await page.getByRole("button", { name: "■ Parar leitura" }).count(), 1);
  await page.getByRole("button", { name: "▶ Ouvir grego" }).click();
  assert.equal(await page.getByRole("button", { name: "▶ Ouvir o capítulo" }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "■ Parar" }).count(), 1);
  const before = await page.evaluate(() => window.speechAudit.cancelled);
  await page.getByRole("button", { name: "Remover outro controle" }).click();
  assert.equal(await page.evaluate(() => window.speechAudit.cancelled), before, "desmontar outro controle cancelou o áudio atual");
  await page.getByRole("button", { name: "■ Parar" }).click();
  assert.equal(await page.evaluate(() => window.speechAudit.cancelled), before + 1);
  console.log("Chromium: iniciar, alternar e parar voz sem cancelar controle alheio — OK");
} finally { await browser.close(); }
