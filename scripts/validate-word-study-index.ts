/** Verificação independente dos bytes, dos limites e dos vetores de todas as partições. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createFileManifestPort } from "../src/server/word-study/runtime.ts";
import { decodeRefCode } from "../src/domain/word-study/reference.ts";
import { identityOfLemma, identityOfStrong, identitySortKey, parseStrong } from "../src/domain/word-study/identity.ts";

const dir = process.argv[2];
if (!dir) throw new Error("Informe o diretório do índice");
const manifest = await createFileManifestPort(dir).read();
if (!manifest) throw new Error("Manifesto ausente");
let total = 0, postingCount = 0, previousKey = "";
for (const part of manifest.partitions) {
  const body = readFileSync(join(dir, part.file));
  if (body.length !== part.bytes || createHash("sha256").update(body).digest("hex") !== part.sha256) throw new Error(`bytes ou hash inválidos: ${part.file}`);
  const lines = body.toString("utf8").split("\n").filter(Boolean);
  if (lines.length !== part.postings) throw new Error(`contagem inválida: ${part.file}`);
  let first = "", last = "", count = 0;
  for (const line of lines) {
    const row: unknown = JSON.parse(line);
    if (typeof row !== "object" || row === null) throw new Error("postagem inválida");
    const record = row as { k?: unknown; n?: unknown; r?: unknown };
    if (typeof record.k !== "string" || !Array.isArray(record.r) || !Number.isSafeInteger(record.n) || record.n !== record.r.length / 2 || !record.n) throw new Error("estrutura inválida");
    const match = /^(hbo|grc):(.*)$/u.exec(record.k);
    if (!match) throw new Error(`identidade inválida: ${record.k}`);
    const lang = match[1] as "hbo" | "grc", raw = match[2] ?? "";
    const parsed = raw.startsWith("lemma:") ? identityOfLemma(lang, raw.slice(6)) : parseStrong(lang, raw);
    const identity = "strong" in parsed ? identityOfStrong(parsed.strong) : "identity" in parsed ? parsed.identity : null;
    if (!identity || identity.key !== record.k) throw new Error(`identidade não canônica: ${record.k}`);
    const sortKey = identitySortKey(identity);
    if (previousKey && previousKey >= sortKey) throw new Error(`ordem ou duplicação inválida: ${record.k}`);
    previousKey = sortKey; if (!first) first = sortKey; last = sortKey;
    let ref = 0, previousPosition = 0;
    for (let i = 0; i < record.r.length; i += 2) {
      const delta: unknown = record.r[i], position: unknown = record.r[i + 1];
      if (typeof delta !== "number" || !Number.isSafeInteger(delta) || delta < 0 ||
          typeof position !== "number" || !Number.isSafeInteger(position) || position < 0) throw new Error(`vetor inválido: ${record.k}`);
      if (delta) previousPosition = 0;
      ref += delta;
      if (!decodeRefCode(ref) || (position !== 0 && previousPosition > position)) throw new Error(`referência ou ordem inválida: ${record.k}`);
      previousPosition = position || Number.MAX_SAFE_INTEGER;
    }
    count += Number(record.n); postingCount += 1;
  }
  if (first !== part.firstSortKey || last !== part.lastSortKey || count !== part.occurrences) throw new Error(`limites inconsistentes: ${part.file}`);
  total += count;
}
if (total !== manifest.header.coverage.occurrences || postingCount !== manifest.header.coverage.identities) throw new Error("totais inconsistentes");
console.log(JSON.stringify({ version: manifest.header.indexVersion, partitions: manifest.partitions.length, postings: postingCount, occurrences: total }));
