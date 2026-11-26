import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { strict as assert } from "node:assert";

const built = await build({
  stdin: { contents: 'import React from "react"; import {createRoot} from "react-dom/client"; import {SelectionBar} from "./app/biblia/selection-bar.tsx"; createRoot(document.getElementById("root")).render(<SelectionBar/>);', resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", outdir: "virtual-output", loader: { ".css": "local-css" },
  plugins: [{ name: "fixtures", setup(b) {
    b.onResolve({ filter: /^\.\/reader-state$/ }, () => ({ path: "state", namespace: "fixture" }));
    b.onResolve({ filter: /^\.\/original-panel$/ }, () => ({ path: "panel", namespace: "fixture" }));
    b.onResolve({ filter: /^@\/src\/domain\/reader-marks$/ }, () => ({ path: "marks", namespace: "fixture" }));
    b.onLoad({ filter: /state/, namespace: "fixture" }, () => ({ contents: 'export function useReader(){return {selection:new Set([1]),selectionLabel:"Gênesis 1:1",selectionText:"No princípio",selectionVerses:[],translationName:"Bíblia Livre",bookSlug:"genesis",chapterNumber:1,clearSelection(){},applyHighlight(c){window.selectedColor=c},removeHighlight(){},highlightOf(){},selectionNote:"",saveNote(){},removeNote(){},panel:null,openPanel(){},closePanel(){},notice:null,setNotice(){},storage:"local"}}' }));
    b.onLoad({ filter: /panel/, namespace: "fixture" }, () => ({ contents: "export function OriginalPanel(){return null}" }));
    b.onLoad({ filter: /marks/, namespace: "fixture" }, () => ({ contents: 'export const highlightColors=["amarelo","verde","azul","rosa"]' }));
  }}],
});
const js = built.outputFiles.find((file) => file.path.endsWith(".js"));
const css = built.outputFiles.find((file) => file.path.endsWith(".css"));
assert(js && css);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    page.on("pageerror", (error) => console.error(error));
    await page.setContent(`<html data-reader-theme="dark"><head><style>${css.text}</style></head><body><div id="root"></div></body></html>`);
    await page.addScriptTag({ content: js.text });
    await page.getByRole("button", { name: /Aplicar/ }).click();
    const details = page.locator("details");
    assert.equal(await details.evaluate((element) => element.open), false);
    assert.equal(await page.getByRole("button", { name: "Azul" }).isVisible(), false);
    assert.equal(await page.getByRole("button", { name: /Consultar original/ }).isVisible(), true);
    const menu = page.getByLabel("Ações disponíveis");
    assert.equal(await menu.evaluate((element) => element.scrollHeight <= element.clientHeight), true, `Menu fechado precisa rolar em ${width}px`);
    await details.locator("summary").click();
    assert.equal(await details.evaluate((element) => element.open), true);
    await page.getByRole("button", { name: "Azul" }).click();
    assert.equal(await page.evaluate(() => window.selectedColor), "azul");
    await page.close();
  }
  console.log("Chromium: menu compacto, cores expansíveis e seleção em 320px e 390px — OK");
} finally { await browser.close(); }
