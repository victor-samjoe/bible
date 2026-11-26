/** Extrai somente referências de ketiv da versão local fixada da MorphHB. */
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const root = process.cwd();
const source = join(root, "data/sources/originals/oshb-morphhb/extracted/morphhb-v.2.2/wlc");
const references: string[] = [];
const qereReferences: string[] = [];
for (const file of readdirSync(source).filter((name) => name.endsWith(".xml") && name !== "VerseMap.xml").sort()) {
  const xml = readFileSync(join(source, file), "utf8");
  for (const verse of xml.matchAll(/<verse\s+osisID="([^"]+)"\s*>([\s\S]*?)<\/verse>/gu)) {
    const [book, chapter, number] = verse[1]!.split(".");
    const qereRanges = [...verse[2]!.matchAll(/<rdg\b[^>]*\btype="x-qere"[^>]*>[\s\S]*?<\/rdg>/gu)]
      .map((match) => ({ start: match.index, end: match.index + match[0].length }));
    let position = 0;
    for (const word of verse[2]!.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/gu)) {
      position += 1;
      if (/\btype="x-ketiv"/u.test(word[1]!)) references.push(`${book} ${chapter}:${number}!${position}`);
      if (qereRanges.some((range) => word.index >= range.start && word.index < range.end)) {
        qereReferences.push(`${book} ${chapter}:${number}!${position}`);
      }
    }
  }
}
references.sort();
qereReferences.sort();
const data = JSON.stringify({ edition: "MORPHHB", version: "v.2.2", sourceCommit: "6a5db284c715c18b239422e57bb89684e6a19f00", references, qereReferences });
const destination = join(root, "data/generated/transliteration");
mkdirSync(destination, { recursive: true });
writeFileSync(join(destination, "morphhb-ketiv.json"), `${data}\n`, "utf8");
console.log(JSON.stringify({ ketiv: references.length, qere: qereReferences.length, bytes: Buffer.byteLength(data), sha256: createHash("sha256").update(data).digest("hex") }));
