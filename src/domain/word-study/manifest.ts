import { z } from "zod";
import { WORD_STUDY_INDEX_FORMAT } from "./inverted-index.ts";
import type { IndexManifest } from "../../server/word-study/service.ts";

export function parseWordStudyManifest(value: unknown): IndexManifest {
  const count = z.number().int().nonnegative().safe();
  const label = z.string().min(1).max(4096);
  const digest = z.string().regex(/^[a-f0-9]{64}$/u);
  const schema = z.object({
    header: z.object({
      format: z.literal(WORD_STUDY_INDEX_FORMAT), indexVersion: label, identityVersion: label,
      identityMode: z.enum(["strong-exact", "strong-folded"]), foldMapSource: label.nullable(),
      sources: z.array(z.object({ sourceId: label, assetPath: label, assetSha256: digest, pin: label, licenseDeclared: label, attribution: label })).max(100),
      coverage: z.object({ languages: z.array(z.enum(["hbo", "grc"])).max(2), identities: count, occurrences: count,
        booksPresent: z.array(label).max(66), booksAbsent: z.array(label).max(66), refsPresent: count }),
      limitations: z.array(label).max(1000),
    }),
    partitions: z.array(z.object({ ordinal: count, file: z.string().regex(/^postings-\d{4,}\.ndjson$/u),
      firstKey: label, lastKey: label, firstSortKey: label, lastSortKey: label,
      postings: count, occurrences: count, oversized: z.boolean(), bytes: count, gzipBytes: count, sha256: digest })).max(100000),
  });
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`manifesto inválido: ${result.error.issues[0]?.path.join(".") ?? "estrutura"}`);
  const manifest = result.data;
  const files = new Set<string>();
  for (const [index, part] of manifest.partitions.entries()) {
    const previous = manifest.partitions[index - 1];
    if (part.ordinal !== index || files.has(part.file) || part.firstSortKey > part.lastSortKey ||
        (previous && previous.lastSortKey >= part.firstSortKey)) {
      throw new Error("manifesto com partições duplicadas, desordenadas ou sobrepostas");
    }
    files.add(part.file);
  }
  if (manifest.partitions.reduce((sum, part) => sum + part.postings, 0) !== manifest.header.coverage.identities ||
      manifest.partitions.reduce((sum, part) => sum + part.occurrences, 0) !== manifest.header.coverage.occurrences) {
    throw new Error("manifesto com totais de partições inconsistentes");
  }
  return manifest;
}
