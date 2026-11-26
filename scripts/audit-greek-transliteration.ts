/** Auditoria local de cada token da edição SBLGNT; não acessa rede ou banco. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { transliterateGreekSurface } from "../src/domain/transliteration/greek.ts";

const path = join(process.cwd(), "data", "sources", "originals", "sblgnt", "text");
const verseLine = /^([1-3]?\s?[A-Za-z]+)\s+(\d{1,3}):(\d{1,3})\t(.+)$/u;
const edge = /^[\s.,;:!?·—–\-"'“”‘’()\[\]⟦⟧]+|[\s.,;:!?·—–\-"'“”‘’()\[\]⟦⟧]+$/gu;
const forms = new Set<string>();
const unsupported = new Map<string, number>();
const exceptions: { reference: string; position: number; form: string }[] = [];
let total = 0;
let converted = 0;
for (const file of readdirSync(path).filter((name) => name.endsWith(".txt")).sort()) {
  for (const line of readFileSync(join(path, file), "utf8").split(/\r?\n/u)) {
    const match = verseLine.exec(line.replace(/^\ufeff/u, ""));
    if (!match) continue;
    let position = 0;
    for (const raw of match[4]!.split(/\s+/u)) {
      const form = raw.replace(edge, "");
      if (!form) continue;
      position += 1;
      total += 1;
      forms.add(form.normalize("NFC"));
      if (transliterateGreekSurface(form)) converted += 1;
      else {
        unsupported.set(form, (unsupported.get(form) ?? 0) + 1);
        exceptions.push({ reference: `${match[1]} ${match[2]}:${match[3]}`, position, form });
      }
    }
  }
}
console.log(JSON.stringify({ occurrences: total, distinctForms: forms.size, converted, unsupportedOccurrences: total - converted,
  unsupportedDistinctForms: unsupported.size, exceptions, examples: [...unsupported.entries()].slice(0, 20) }, null, 2));
