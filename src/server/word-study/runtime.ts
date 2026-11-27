/**
 * Portas concretas do serviço de usos (fila Claude 3, item 3).
 *
 * É o único arquivo desta frente que toca disco e `node:crypto`. Fica separado
 * para que `service.ts` continue injetável e testável sem filesystem.
 *
 * A responsabilidade central aqui é **não expor arquivo privado**. A porta de
 * partição só aceita nomes que o manifesto declara, e recusa qualquer outro
 * antes de chegar ao disco. Sem isso, um parâmetro vindo da borda poderia
 * escolher o arquivo a ler, que é a forma mais direta de transformar uma
 * consulta de palavra em leitura arbitrária de arquivo.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { z } from "zod";
import { WORD_STUDY_INDEX_FORMAT } from "../../domain/word-study/inverted-index.ts";

import {
  type DigestPort,
  type IndexManifest,
  type ManifestPort,
  type PartitionPort,
} from "./service.ts";

export class PartitionAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartitionAccessError";
  }
}

export const sha256Digest: DigestPort = (body) =>
  createHash("sha256").update(body, "utf8").digest("hex");

/**
 * Lê `manifest.json` de um diretório. Ausência do arquivo é **ausência de
 * índice** (`null`), não erro; qualquer outra falha é erro, porque "não consegui
 * ler" e "não existe" pedem telas diferentes.
 */
export function createFileManifestPort(directory: string): ManifestPort {
  const root = resolve(directory);
  let cached: IndexManifest | null | undefined;
  return {
    async read() {
      if (cached !== undefined) return cached;
      let raw: string;
      try {
        raw = await readFile(join(root, "manifest.json"), "utf8");
      } catch (error) {
        if (isMissing(error)) {
          cached = null;
          return null;
        }
        throw error;
      }
      const parsed: unknown = JSON.parse(raw);
      const manifest = asManifest(parsed);
      cached = manifest;
      return manifest;
    },
  };
}

/**
 * Lê uma partição, aceitando **apenas** os nomes que o manifesto lista.
 *
 * Três camadas, de propósito redundantes: o nome tem de estar na lista do
 * manifesto; tem de ser um nome simples, sem diretório; e o caminho resolvido
 * tem de continuar dentro da raiz. Qualquer uma sozinha bastaria para o caso
 * conhecido, e as três juntas bastam para o caso que ainda não se pensou.
 */
export function createFilePartitionPort(
  directory: string,
  allowedFiles: readonly string[],
): PartitionPort {
  const root = resolve(directory);
  const allowed = new Set(allowedFiles);
  return {
    async read(file) {
      if (!allowed.has(file)) {
        throw new PartitionAccessError(
          `partição '${file}' não está declarada no manifesto; leitura recusada`,
        );
      }
      if (file !== basename(file)) {
        throw new PartitionAccessError(`partição '${file}' não é nome simples de arquivo`);
      }
      const target = resolve(join(root, file));
      if (target !== join(root, file)) {
        throw new PartitionAccessError(`partição '${file}' sai do diretório do índice`);
      }
      return readFile(target, "utf8");
    },
  };
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

/**
 * Valida a forma do manifesto antes de confiar nele. O manifesto é arquivo em
 * disco: tratá-lo como já conferido faria o serviço quebrar em `undefined` em
 * vez de devolver `error` com motivo.
 */
function asManifest(value: unknown): IndexManifest {
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
  if (!result.success) throw new PartitionAccessError(`manifesto inválido: ${result.error.issues[0]?.path.join(".") ?? "estrutura"}`);
  const manifest = result.data;
  const files = new Set<string>();
  for (const [index, part] of manifest.partitions.entries()) {
    const previous = manifest.partitions[index - 1];
    if (part.ordinal !== index || files.has(part.file) || part.firstSortKey > part.lastSortKey ||
        (previous && previous.lastSortKey >= part.firstSortKey)) {
      throw new PartitionAccessError("manifesto com partições duplicadas, desordenadas ou sobrepostas");
    }
    files.add(part.file);
  }
  if (manifest.partitions.reduce((sum, part) => sum + part.postings, 0) !== manifest.header.coverage.identities ||
      manifest.partitions.reduce((sum, part) => sum + part.occurrences, 0) !== manifest.header.coverage.occurrences) {
    throw new PartitionAccessError("manifesto com totais de partições inconsistentes");
  }
  return manifest;
}

/** Monta serviço completo a partir de um diretório de índice. */
export async function partitionFilesOf(manifest: ManifestPort): Promise<readonly string[]> {
  const loaded = await manifest.read();
  return loaded ? loaded.partitions.map((partition) => partition.file) : [];
}
