/**
 * Teste local de integração do componente real em Chromium com APIs simuladas.
 * Não conecta ao banco, não inicia o app e não grava nenhum dado de usuário.
 * Executar: node scripts/verify-transliteration-browser.mjs
 */
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { strict as assert } from "node:assert";

const code = `
import React from "react";
import { createRoot } from "react-dom/client";
import { OriginalPanel } from "./app/biblia/original-panel.tsx";
const version = "tag v.2.2 / commit 6a5db284c715c18b239422e57bb89684e6a19f00";
const words = [
  {id:"token-1", position:1, surface:"בְּ/רֵאשִׁ֖ית", normalized:"בְּרֵאשִׁ֖ית", morphemes:[]},
  {id:"token-2", position:2, surface:"בָּרָ֣א", normalized:"בָּרָ֣א", morphemes:[]},
  {id:"token-3", position:3, surface:"אֱלֹהִ֑ים", normalized:"אֱלֹהִ֑ים", morphemes:[]},
  ...Array.from({length:12}, (_, index) => ({id:"wrap-"+index, position:index+4, surface:"הָאָֽרֶץ", normalized:"הָאָֽרֶץ", morphemes:[]})),
];
const greek = [
  {id:"greek-1", position:1, surface:"λόγος", normalized:"λόγος", morphemes:[]},
  {id:"greek-2", position:2, surface:"λόγον", normalized:"λόγον", morphemes:[]},
];
const variants = [
  {id:"ketiv", position:14, surface:"הוצא", normalized:"הוצא", morphemes:[]},
  {id:"qere", position:15, surface:"הַיְצֵ֣א", normalized:"הַיְצֵ֣א", morphemes:[]},
];
window.fetch = async (url) => {
  const isGreek = String(url).includes("book=joao");
  const isVariant = String(url).includes("chapter=8");
  const payload = String(url).includes("/original?")
    ? {ok:true, edition:{code:isGreek?"SBLGNT":"MORPHHB",language:isGreek?"grc":"hbo",version,attribution:"Fonte de teste",licenseDeclared:"teste",sourceUrl:"https://example.org"},
      verses:[{id:isGreek?"g1":isVariant?"h8":"h1",number:isVariant?17:1,canonicalRef:isGreek?"Jn 1:1":isVariant?"Gen 8:17":"Gen 1:1",tokens:isGreek?greek:isVariant?variants:words}]}
    : {ok:true,bookSlug:isGreek?"joao":"genesis",chapter:isVariant?8:1,previewingDrafts:false,verses:[{verse:isVariant?17:1,words:[]}]};
  return {json: async () => payload};
};
createRoot(document.getElementById("root")).render(<>
  <section id="hebrew"><OriginalPanel bookSlug="genesis" chapter={1} translationName="Bíblia Livre" selectionVerses={[{number:1,content:"No princípio Deus criou"}]}/></section>
  <section id="greek"><OriginalPanel bookSlug="joao" chapter={1} translationName="Bíblia Livre" selectionVerses={[{number:1,content:"No princípio era o Verbo"}]}/></section>
  <section id="variant"><OriginalPanel bookSlug="genesis" chapter={8} translationName="Bíblia Livre" selectionVerses={[{number:17,content:"Tira contigo todos os animais"}]}/></section>
</>);
`;

const built = await build({
  stdin: { contents: code, resolveDir: process.cwd(), sourcefile: "transliteration-harness.tsx", loader: "tsx" },
  bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
  loader: { ".css": "local-css" }, outdir: "virtual-output",
  plugins: [{
    name: "next-link-test-adapter",
    setup(builder) {
      builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "test-link" }));
      builder.onLoad({ filter: /.*/, namespace: "test-link" }, () => ({
        contents: 'import React from "react"; export default function Link(props){return React.createElement("a", props)}',
        loader: "js", resolveDir: process.cwd(),
      }));
    },
  }],
});
const js = built.outputFiles.find((item) => item.path.endsWith(".js"));
const css = built.outputFiles.find((item) => item.path.endsWith(".css"));
assert(js && css, "O componente não foi compilado para o teste visual");
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [320, 390, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    await page.setContent(`<html lang="pt-BR"><head><style>${css.text}</style></head><body><main id="root"></main></body></html>`);
    await page.addScriptTag({ content: js.text });
    const textual = page.locator('#hebrew button[aria-label^="bereshit, transliteração textual"]');
    await textual.waitFor();
    await textual.click();
    await page.locator("html").evaluate((element) => element.setAttribute("data-reader-theme", "dark"));
    const selectedColor = await textual.evaluate((element) => getComputedStyle(element).color);
    assert.equal(selectedColor, "rgb(20, 36, 47)", `Contraste da transliteração selecionada no tema escuro em ${width}px`);
    const panel = page.locator('#hebrew [aria-label="Análise da palavra"]');
    assert.match(await panel.innerText(), /Transliteração textual:\s*bereshit/u);
    assert.match(await panel.innerText(), /Acadêmica \(SBL\):\s*bərēʾšît/u);
    const wordButtons = page.locator('#hebrew p[lang="he"] > span');
    const first = await wordButtons.nth(0).boundingBox();
    const second = await wordButtons.nth(1).boundingBox();
    assert(first && second && first.x > second.x, `Ordem RTL incorreta em ${width}px`);
    const positions = await wordButtons.evaluateAll((spans) => spans.map((span) => {
      const parent = span.getBoundingClientRect();
      const buttons = [...span.querySelectorAll("button")].map((button) => button.getBoundingClientRect());
      return { y: parent.y, left: parent.left, right: parent.right, buttons: buttons.map((button) => ({ left: button.left, right: button.right })) };
    }));
    if (width === 320) assert(new Set(positions.map((position) => Math.round(position.y))).size > 1, "Amostra não quebrou de linha");
    for (const pair of positions) {
      assert(pair.buttons.length === 2 && pair.buttons.every((button) => button.left >= pair.left - 1 && button.right <= pair.right + 1), `Transliteração saiu do par em ${width}px`);
    }
    const greek = page.locator('#greek button[aria-label^="logon, transliteração textual"]');
    assert.equal(await greek.count(), 1, `Forma flexionada grega indisponível em ${width}px`);
    const variantLabels = page.locator('#variant [aria-label*="ketiv"], #variant [aria-label*="qere"]');
    assert.equal(await variantLabels.count(), 2, `Ketiv e qere não foram sinalizados em ${width}px`);
    await page.locator('#variant p[lang="he"] button').first().click();
    assert.match(await page.locator('#variant [aria-label="Análise da palavra"]').innerText(), /ketiv/u);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `Rolagem horizontal inesperada em ${width}px: ${overflow}px`);
    await page.close();
  }
  console.log("Chromium: alinhamento e seleção em 320px, 390px e 1024px; hebraico RTL e forma grega flexionada — OK");
} finally {
  await browser.close();
}
