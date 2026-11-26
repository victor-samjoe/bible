/** Auditoria local de toda a edição MorphHB; não acessa rede ou banco. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { transliterateHebrewSurface } from "../src/domain/transliteration/hebrew.ts";

const path = join(process.cwd(), "data", "sources", "originals", "oshb-morphhb", "extracted", "morphhb-v.2.2", "wlc");
const excluded = new Set(["VerseMap.xml"]);
const forms = new Set<string>();
const unsupported = new Map<string, number>();
const nonKetivExceptions: { reference: string; position: number; form: string }[] = [];
const cache = new Map<string, boolean>();
let total = 0;
let generated = 0;
let ketiv = 0;
let ketivGenerated = 0;
for (const file of readdirSync(path).filter((name) => name.endsWith(".xml") && !excluded.has(name)).sort()) {
  const xml = readFileSync(join(path, file), "utf8");
  for (const verse of xml.matchAll(/<verse\s+osisID="([^"]+)"\s*>([\s\S]*?)<\/verse>/gu)) {
    let position = 0;
    for (const word of verse[2]!.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/gu)) {
      position += 1;
      const raw = word[2]!.replace(/<[^>]+>/gu, "").trim();
      const form = raw.replace(/\//gu, "");
      total += 1;
      const normalized = form.normalize("NFC");
      forms.add(normalized);
      const isKetiv = /\btype="x-ketiv"/u.test(word[1]!);
      if (isKetiv) ketiv += 1;
      let success = cache.get(normalized);
      if (success === undefined) {
        success = transliterateHebrewSurface(form) !== null;
        cache.set(normalized, success);
      }
      if (success) {
        generated += 1;
        if (isKetiv) ketivGenerated += 1;
      }
      else {
        unsupported.set(form, (unsupported.get(form) ?? 0) + 1);
        if (!isKetiv) nonKetivExceptions.push({ reference: verse[1]!, position, form });
      }
    }
  }
  process.stderr.write(`Concluído ${file}: ${total} ocorrências\n`);
}
console.log(JSON.stringify({ occurrences: total, distinctFormsIncludingCantillation: forms.size,
  generated, unsupportedOccurrences: total - generated, ketivMarked: ketiv, ketivGenerated,
  availableAfterKetivGuard: generated - ketivGenerated,
  unsupportedDistinctForms: unsupported.size, nonKetivExceptions, examples: [...unsupported.entries()].slice(0, 12) }, null, 2));
