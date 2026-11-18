import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseSblgntBook, countTokens } from "../src/importers/original/sblgnt.ts";
import {
  countHebrewMorphemes,
  countHebrewTokens,
  parseMorphhbBook,
} from "../src/importers/original/morphhb.ts";

/**
 * Verificação local do corpus coletado (tarefa C14). Não grava em banco, não
 * publica nada e não acessa a rede: relê os bytes já baixados, reconfere o
 * SHA-256 contra o manifesto e roda os parsers para contar o que existe.
 *
 * Falha fechada: checksum divergente, manifesto ausente ou linha fora do formato
 * aparecem como erro, e nada é declarado importado.
 *
 * Uso: node --experimental-strip-types scripts/verify-original-corpus.ts
 */

const ROOT = join(import.meta.dirname, "..");
const ORIGINALS = join(ROOT, "data", "sources", "originals");

type Manifest = {
  id: string;
  name: string;
  license_declared: string;
  status: string;
  assets: { path: string; sha256: string; bytes: number }[];
};

async function manifest(id: string): Promise<Manifest | null> {
  const path = join(ORIGINALS, id, "MANIFEST.json");
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, "utf8")) as Manifest;
}

async function checkChecksums(id: string, entries: Manifest["assets"]): Promise<number> {
  let bad = 0;
  for (const asset of entries) {
    const file = join(ORIGINALS, id, asset.path);
    if (!existsSync(file)) {
      console.log(`  FALHA ${asset.path}: arquivo ausente`);
      bad += 1;
      continue;
    }
    const bytes = await readFile(file);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== asset.sha256) {
      console.log(`  FALHA ${asset.path}: sha256 divergente do manifesto`);
      bad += 1;
    }
  }
  return bad;
}

async function verifySblgnt(): Promise<boolean> {
  const info = await manifest("sblgnt");
  if (!info) {
    console.log("sblgnt: manifesto ausente — rode scripts/fetch-original-sources.ts");
    return false;
  }
  console.log(`\n== ${info.name} (${info.license_declared}) — status ${info.status}`);
  const bad = await checkChecksums("sblgnt", info.assets);
  const dir = join(ORIGINALS, "sblgnt", "text");
  const files = (await readdir(dir)).filter((name) => name.endsWith(".txt")).sort();
  let verses = 0;
  let tokens = 0;
  let issues = 0;
  for (const file of files) {
    // "61-Mt.txt" -> sigla "Mt", que é o código usado nas referências do arquivo.
    const code = file.replace(/^\d+-/, "").replace(/\.txt$/, "");
    const result = parseSblgntBook(await readFile(join(dir, file), "utf8"), code);
    verses += result.book.verses.length;
    tokens += countTokens(result.book);
    issues += result.issues.length;
    if (result.issues.length > 0) {
      console.log(`  ${file}: ${result.issues.length} linha(s) recusada(s)`);
      for (const issue of result.issues.slice(0, 3)) {
        console.log(`    linha ${issue.line}: ${issue.reason}`);
      }
    }
  }
  console.log(`  livros: ${files.length} · versículos: ${verses} · tokens: ${tokens}`);
  console.log(`  checksums divergentes: ${bad} · linhas recusadas: ${issues}`);
  return bad === 0 && issues === 0;
}

async function verifyMorphhb(): Promise<boolean> {
  const info = await manifest("oshb-morphhb");
  if (!info) {
    console.log("oshb-morphhb: manifesto ausente — rode scripts/fetch-original-sources.ts");
    return false;
  }
  console.log(`\n== ${info.name} (${info.license_declared}) — status ${info.status}`);
  const bad = await checkChecksums("oshb-morphhb", info.assets);
  const wlc = join(ORIGINALS, "oshb-morphhb", "extracted", "morphhb-v.2.2", "wlc");
  if (!existsSync(wlc)) {
    console.log("  extração ausente: descompacte o tar.gz em extracted/ antes de verificar");
    return false;
  }
  const files = (await readdir(wlc)).filter((name) => name.endsWith(".xml")).sort();
  let verses = 0;
  let tokens = 0;
  let morphemes = 0;
  let issues = 0;
  for (const file of files) {
    const code = file.replace(/\.xml$/, "");
    const result = parseMorphhbBook(await readFile(join(wlc, file), "utf8"), code);
    verses += result.verses.length;
    tokens += countHebrewTokens(result);
    morphemes += countHebrewMorphemes(result);
    issues += result.issues.length;
    if (result.issues.length > 0) console.log(`  ${file}: ${result.issues.length} problema(s)`);
  }
  console.log(`  livros: ${files.length} · versículos: ${verses}`);
  console.log(`  tokens: ${tokens} · morfemas: ${morphemes}`);
  console.log(`  checksums divergentes: ${bad} · problemas: ${issues}`);
  return bad === 0;
}

async function verifyWlcPackage(): Promise<boolean> {
  const info = await manifest("wlc-ebible");
  if (!info) return false;
  console.log(`\n== ${info.name} (${info.license_declared}) — status ${info.status}`);
  const bad = await checkChecksums("wlc-ebible", info.assets);
  console.log(`  checksums divergentes: ${bad}`);
  console.log(
    "  pacote USFM guardado como evidência de domínio público do texto-base; o texto",
  );
  console.log(
    "  hebraico em uso vem do OSIS do MorphHB, para não misturar duas digitalizações",
  );
  console.log("  do mesmo códice sob o mesmo rótulo.");
  return bad === 0;
}

async function main() {
  const results = [await verifySblgnt(), await verifyMorphhb(), await verifyWlcPackage()];
  console.log(
    "\nNenhuma edição foi aprovada para exibição: a aprovação é humana e está registrada",
  );
  console.log("em docs/ORIGINAL_LANGUAGE_SOURCES.md, não neste script.");
  if (results.some((ok) => !ok)) {
    console.log("\nVERIFICAÇÃO COM PENDÊNCIAS");
    process.exitCode = 1;
  } else {
    console.log("\nVERIFICAÇÃO OK");
  }
}

main().catch((error: unknown) => {
  console.error("FALHA:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
