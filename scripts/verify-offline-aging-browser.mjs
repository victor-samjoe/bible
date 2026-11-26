/** Reproduz o risco de poda durante instalação demorada; IndexedDB real isolado. */
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const bundle = await build({
  stdin: { contents: 'import {openOfflineStore,INSTALL_LEASE_MS} from "./src/client/offline/storage.ts"; window.offlineAudit={openOfflineStore,INSTALL_LEASE_MS};', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, write: false, format: "iife", platform: "browser",
});
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const context = await browser.newContext();
  await context.route("http://offline-audit.local/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>Offline audit</title>" }));
  const page = await context.newPage();
  await page.goto("http://offline-audit.local/");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const { openOfflineStore, INSTALL_LEASE_MS } = window.offlineAudit;
    const a = await openOfflineStore();
    const b = await openOfflineStore();
    const active = "1".repeat(64), pending = "2".repeat(64);
    const pref = await a.updatePreference(null, { enabled: true, decidedAt: 1, lastCheckedAt: null, lastKnownVersion: null, lastEtag: null });
    if (!pref.ok) throw new Error("preferência recusada");
    const now = Date.now();
    await a.stageBook(active, "GEN", [["ativo"]]);
    await a.promoteIfConsented({ schema: "test", version: active, manifest: {}, installedAt: now, chapters: 1 }, pref.preference.revision);
    const originalNow = Date.now;
    try {
      Date.now = () => now - INSTALL_LEASE_MS - 1000;
      await b.stageBook(pending, "GEN", [["antigo"]]);
      Date.now = () => now;
      await b.stageBook(pending, "EXO", [["recente"]]);
      const before = [...await b.stagedBooks(pending)].sort();
      await a.pruneOtherVersions(active, now);
      const after = [...await b.stagedBooks(pending)].sort();
      return { before, after, oldChapterStillPresent: Boolean(await b.readChapter(pending, "GEN", 1)) };
    } finally { Date.now = originalNow; a.close(); b.close(); }
  });
  console.log(JSON.stringify(result));
  if (result.before.join() !== result.after.join()) process.exitCode = 1;
  // Duas abas: uma revoga, outra reativa e a remoção atrasada precisa falhar.
  const second = await context.newPage();
  await second.goto("http://offline-audit.local/");
  await second.addScriptTag({ content: bundle.outputFiles[0].text });
  const disabledRevision = await second.evaluate(async () => {
    const store = await window.offlineAudit.openOfflineStore();
    try {
      const current = await store.readPreference();
      const result = await store.updatePreference(current.revision, { ...current, enabled: false });
      if (!result.ok) throw new Error("não gravou recusa");
      return result.preference.revision;
    } finally { store.close(); }
  });
  await page.evaluate(async () => {
    const store = await window.offlineAudit.openOfflineStore();
    try {
      const current = await store.readPreference();
      const result = await store.updatePreference(current.revision, { ...current, enabled: true });
      if (!result.ok) throw new Error("não reativou");
    } finally { store.close(); }
  });
  const lateRemoval = await second.evaluate(async (revision) => {
    const store = await window.offlineAudit.openOfflineStore();
    try { return { result: await store.removeIfStillDisabled(revision), chapter: await store.readChapter("1".repeat(64), "GEN", 1) }; }
    finally { store.close(); }
  }, disabledRevision);
  if (lateRemoval.result.ok || !lateRemoval.chapter) throw new Error("remoção atrasada apagou pacote reativado");
  console.log("Chromium: duas abas preservam pacote após reativação — OK");
  await context.close();
} finally { await browser.close(); }
