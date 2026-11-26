/**
 * Compara a saída SBL calculada sobre cada forma textual MACULA com a
 * transliteração por morfema publicada pela própria MACULA. Não é comparação
 * entre pronúncias nem verificação independente por especialista. Algumas
 * diferenças são convenções (ex.: yod mater, diacríticos ou geminação).
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { transliterateHebrewSurface } from "../src/domain/transliteration/hebrew.ts";

type Group = { ref: string; surface: string; source: string; missing: boolean };
const normalizeNotation = (value: string) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").replace(/[ʾʿ'’\s-]/gu, "")
  .replace(/ə/gu, "e").toLowerCase();
let total = 0;
let complete = 0;
let calculated = 0;
let exact = 0;
let normalized = 0;
const examples: { reference: string; source: string; sbl: string }[] = [];
const cache = new Map<string, string | null>();
function examine(group: Group | null) {
  if (!group) return;
  total += 1;
  if (group.missing || !group.surface || !group.source) return;
  complete += 1;
  const key = group.surface.normalize("NFC");
  let value = cache.get(key);
  if (value === undefined) {
    value = transliterateHebrewSurface(group.surface)?.academic ?? null;
    cache.set(key, value);
  }
  if (!value) return;
  calculated += 1;
  if (group.source.normalize("NFC") === value.normalize("NFC")) exact += 1;
  else if (examples.length < 30) examples.push({ reference: group.ref, source: group.source, sbl: value });
  if (normalizeNotation(group.source) === normalizeNotation(value)) normalized += 1;
}

const stream = createInterface({ input: createReadStream("data/sources/lexicons/macula-hebrew/macula-hebrew.tsv", "utf8"), crlfDelay: Infinity });
let columns: string[] | null = null;
let active: Group | null = null;
for await (const line of stream) {
  const values = line.split("\t");
  if (!columns) { columns = values; continue; }
  const ref = values[columns.indexOf("ref")]?.trim() ?? "";
  if (!ref) continue;
  if ((active as Group | null)?.ref !== ref) { examine(active); active = { ref, surface: "", source: "", missing: false }; }
  const surface = values[columns.indexOf("text")]?.trim() ?? "";
  const transliteration = values[columns.indexOf("transliteration")]?.trim() ?? "";
  if (!surface) continue;
  active!.surface += surface;
  if (!transliteration || ["–", "—", "-"].includes(transliteration)) active!.missing = true;
  else active!.source += transliteration;
}
examine(active);
console.log(JSON.stringify({ total, completeSource: complete, calculated, exact, normalized,
  differenceAfterNormalization: calculated - normalized, examples }, null, 2));
