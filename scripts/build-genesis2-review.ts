/** Prepara caderno local para revisão editorial; não aprova nem publica candidatos. */
import { createHash } from "node:crypto";
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

type Unit = [number, string, string, string, string | null, string | null, string | null, ...unknown[]];
type Shard = { l: string; b: string; c: number; h: string; p: { v: Record<string, Unit[]> } };
type Group = { key: string; originalWordPositions: number[]; unitIds: string[]; translationTokenPositions: number[]; reviewReasons: string[]; competing: string[] };
type Verse = { anchor: { verse: number }; tokens: { position: number; surface: string }[]; groups: Group[]; unalignedOriginalWords: number[]; unalignedTranslationTokens: number[] };
const source = "data/generated/lexicons/batches/gen-2-alignment-candidates.json";
const raw = readFileSync(source);
const bundle = JSON.parse(raw.toString("utf8")) as { notice: string; provenance: { shardDigest: string }; verses: Verse[] };
let shard: Shard | undefined;
for await (const line of createInterface({ input: createReadStream("data/generated/lexicons/chapter-shards.ndjson"), crlfDelay: Infinity })) {
  const item = JSON.parse(line) as Shard;
  if (item.l === "hbo" && item.b === "GEN" && item.c === 2) { shard = item; break; }
}
if (!shard) throw new Error("shard hebraico de Gênesis 2 ausente");
if (shard.h !== bundle.provenance.shardDigest) throw new Error("o lote foi gerado com outro shard; gere-o novamente");
const safe = (s: string) => s.replaceAll("|", "\\|").replaceAll("\n", " ");
const lines = ["# Gênesis 2 — caderno de revisão de alinhamento", "", "Candidatos automáticos; nenhuma correspondência foi aprovada. Conferir o contexto, as unidades e as possíveis relações 1:N/N:1; não decidir por posição ou Strong isolado.", "", `SHA-256 do lote: ${createHash("sha256").update(raw).digest("hex")}`, "", "Para cada hipótese registrar: decisão (aceitar, corrigir, rejeitar ou pendente), responsável, justificativa e origem. Palavras sem hipótese exigem análise própria.", ""];
for (const verse of bundle.verses) {
  const units = shard.p.v[String(verse.anchor.verse)] ?? [];
  if (!units.length) throw new Error(`unidades ausentes em Gênesis 2:${verse.anchor.verse}`);
  const tokenByPosition = new Map(verse.tokens.map((token) => [token.position, token.surface]));
  lines.push(`## Gênesis 2:${verse.anchor.verse}`, "", `Tokens em português (pontuação omitida): ${verse.tokens.map((token) => token.surface).join(" ")}`, "", "Unidades originais (posição · identificador · forma · lema):", "", ...units.map((u) => `- ${u[0]} · ${u[1]} · ${u[2]} · ${u[3]}`), "", "| Hipótese | Original | Português | Alertas | Decisão |", "| --- | --- | --- | --- | --- |");
  for (const group of verse.groups) {
    if (group.unitIds.some((id) => !units.some((unit) => unit[1] === id)) || group.translationTokenPositions.some((position) => !tokenByPosition.has(position))) {
      throw new Error(`hipótese ${group.key} referencia unidade ou token ausente`);
    }
    const original = group.unitIds.map((id) => units.find((unit) => unit[1] === id)?.[2] ?? `? ${id}`).join(" + ");
    const translated = group.translationTokenPositions.map((position) => `${position}: ${tokenByPosition.get(position) ?? "?"}`).join(" + ");
    lines.push(`| ${safe(group.key)} | ${safe(original)} | ${safe(translated)} | ${safe(group.reviewReasons.join("; "))} | pendente |`);
  }
  lines.push("", `Posições originais sem hipótese: ${verse.unalignedOriginalWords.join(", ") || "nenhuma"}.`, `Posições portuguesas sem hipótese: ${verse.unalignedTranslationTokens.join(", ") || "nenhuma"}.`, "");
}
const target = "data/generated/lexicons/batches/gen-2-caderno-revisao.md";
writeFileSync(target, lines.join("\n"), "utf8");
console.log(`${bundle.verses.length} versículos preparados; nenhuma decisão editorial registrada: ${target}`);
