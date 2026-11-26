/** Quantifica a sobreposição de ketiv com resultados do conversor. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { transliterateHebrewSurface } from "../src/domain/transliteration/hebrew.ts";

const path = join(process.cwd(), "data/sources/originals/oshb-morphhb/extracted/morphhb-v.2.2/wlc");
let marked = 0;
let convertible = 0;
let qere = 0;
let qereConvertible = 0;
for (const file of readdirSync(path).filter((name) => name.endsWith(".xml") && name !== "VerseMap.xml")) {
  const xml = readFileSync(join(path, file), "utf8");
  for (const verse of xml.matchAll(/<verse\s+osisID="[^"]+"\s*>([\s\S]*?)<\/verse>/gu)) {
    const qereRanges = [...verse[1]!.matchAll(/<rdg\b[^>]*\btype="x-qere"[^>]*>[\s\S]*?<\/rdg>/gu)]
      .map((match) => ({ start: match.index, end: match.index + match[0].length }));
    for (const word of verse[1]!.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/gu)) {
      const isKetiv = /\btype="x-ketiv"/u.test(word[1]!);
      const isQere = qereRanges.some((range) => word.index >= range.start && word.index < range.end);
      if (!isKetiv && !isQere) continue;
      const form = word[2]!.replace(/<[^>]+>/gu, "").trim().replace(/\//gu, "");
      const available = transliterateHebrewSurface(form) !== null;
      if (isKetiv) { marked += 1; if (available) convertible += 1; }
      if (isQere) { qere += 1; if (available) qereConvertible += 1; }
    }
  }
}
console.log(JSON.stringify({ marked, convertible, unavailableWithoutGuard: marked - convertible, qere, qereConvertible }, null, 2));
