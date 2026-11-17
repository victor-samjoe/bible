import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { TheologyImportManifestSchema, assertTheologyImportAllowed } from "../domain/bkf/theology-import.ts";

function inside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function decodeUtf8(bytes: Buffer): void {
  new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function importTheologyText(input: { manifestPath: string; sourcePath: string; privateRoot: string }) {
  const sourcePath = resolve(input.sourcePath);
  const manifestPath = resolve(input.manifestPath);
  const privateRoot = resolve(input.privateRoot);
  const source = await stat(sourcePath);
  if (!source.isFile()) throw new Error("Fonte deve ser um arquivo regular TXT UTF-8.");
  if (!sourcePath.toLowerCase().endsWith(".txt")) throw new Error("A fonte deve usar extensão .txt.");

  const manifest = TheologyImportManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
  assertTheologyImportAllowed(manifest);
  const bytes = await readFile(sourcePath);
  decodeUtf8(bytes);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== manifest.provenance.sha256) throw new Error("Checksum divergente: a fonte não corresponde ao manifesto aprovado.");

  const artifactRoot = resolve(privateRoot, "sha256", hash);
  if (!inside(privateRoot, artifactRoot)) throw new Error("Caminho privado inválido.");
  await mkdir(artifactRoot, { recursive: true });
  const textTarget = resolve(artifactRoot, "original.txt");
  const manifestTarget = resolve(artifactRoot, "manifest.json");
  if (!inside(artifactRoot, textTarget) || !inside(artifactRoot, manifestTarget)) throw new Error("Tentativa de path traversal bloqueada.");

  try {
    await stat(textTarget);
  } catch {
    const temporary = resolve(artifactRoot, `.original-${randomUUID()}.tmp`);
    await copyFile(sourcePath, temporary);
    await rename(temporary, textTarget);
  }
  const tempManifest = resolve(artifactRoot, `.manifest-${randomUUID()}.tmp`);
  await writeFile(tempManifest, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(tempManifest, manifestTarget);
  return { editionId: manifest.edition_id, sha256: hash, artifactRoot, textTarget, manifestTarget };
}

async function main() {
  const [manifestPath, sourcePath] = process.argv.slice(2);
  const privateRoot = process.env.THEOLOGY_PRIVATE_ROOT;
  if (!manifestPath || !sourcePath || !privateRoot) {
    throw new Error("Uso: THEOLOGY_PRIVATE_ROOT=<diretório privado> importar-teologia <manifest.json> <fonte.txt>");
  }
  const result = await importTheologyText({ manifestPath, sourcePath, privateRoot });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1]?.endsWith("import-theology.ts")) main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
