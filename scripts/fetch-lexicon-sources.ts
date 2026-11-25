import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  LEXICON_REGISTRY_VERSION,
  LEXICON_SOURCES,
  assertNoLicenseMixing,
  assetUrl,
  looksLikeLfsPointer,
  pinLabel,
  serializeRegistry,
  type LexiconAsset,
  type LexiconSource,
} from "../src/domain/lexicon/source-registry.ts";

/**
 * Coleta das fontes lexicais (LEXICON-INDEX-001, fila C30).
 *
 * Por padrão **não baixa nada**: imprime o plano de coleta a partir do registro
 * versionado e sai. Baixar exige `--collect`, e `--collect` só funciona para
 * fonte cujo registro já diga `approved_for_collection` e cujo pino de commit
 * esteja resolvido. As duas condições são decisão humana registrada, não flag
 * de linha de comando.
 *
 * Regras que o script faz valer:
 * - grava somente em `data/sources/lexicons/<id>/`, caminho ignorado pelo Git;
 * - URL sempre fixada por commit de 40 hex: `main` baixaria coisa diferente a
 *   cada dia e tornaria o SHA-256 inútil como pino;
 * - falha fechada em hash divergente, HTTP ≠ 200 e corpo vazio, sem gravar
 *   manifesto parcial;
 * - não lê variável de ambiente, não envia cabeçalho de autenticação e não
 *   imprime nada além de URL pública, caminho, tamanho e hash.
 *
 * Uso:
 *   node --experimental-strip-types scripts/fetch-lexicon-sources.ts
 *   node --experimental-strip-types scripts/fetch-lexicon-sources.ts --collect --source=macula-hebrew
 *   node --experimental-strip-types scripts/fetch-lexicon-sources.ts --collect --source=X --resolve-pin=<commit40>
 */

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "data", "sources", "lexicons");

const argv = process.argv.slice(2);
const collect = argv.includes("--collect");
const force = argv.includes("--force");
const onlySource = argv.find((item) => item.startsWith("--source="))?.slice("--source=".length);
const resolvePin = argv.find((item) => item.startsWith("--resolve-pin="))?.slice("--resolve-pin=".length);

type AssetRecord = {
  readonly repo_path: string;
  readonly local_path: string;
  readonly url: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly reader_status: LexiconAsset["readerStatus"];
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function registryFingerprint(): string {
  return createHash("sha256").update(serializeRegistry(), "utf8").digest("hex");
}

function pinnedSource(source: LexiconSource): LexiconSource {
  if (!resolvePin) return source;
  if (!/^[0-9a-f]{40}$/u.test(resolvePin)) {
    throw new Error("--resolve-pin exige um commit de 40 caracteres hexadecimais minúsculos");
  }
  return { ...source, pin: { kind: "commit", commit: resolvePin } };
}

async function download(url: string): Promise<Uint8Array> {
  // Sem credencial, sem cookie, sem token: tudo aqui é material público.
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "bible-lexicon-fetcher/1.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error(`corpo vazio em ${url}`);
  return bytes;
}

async function collectAsset(
  source: LexiconSource,
  asset: LexiconAsset,
): Promise<AssetRecord> {
  const url = assetUrl(source, asset);
  const target = join(OUT, source.id, asset.localPath);
  await mkdir(dirname(target), { recursive: true });

  let bytes: Uint8Array;
  if (existsSync(target) && !force) {
    bytes = new Uint8Array(await readFile(target));
  } else {
    bytes = await download(url);
  }
  // Ponteiro de LFS no lugar do dado: congelar este SHA-256 daria um pino que
  // confere para sempre e jamais aponta para o conteúdo. Para aqui.
  if (looksLikeLfsPointer(bytes)) {
    throw new Error(
      `${source.id}/${asset.localPath}: o corpo é um ponteiro Git LFS, não o arquivo ` +
        `(${bytes.byteLength} bytes). Marque o ativo com 'lfs: true' no registro para baixar ` +
        "por media.githubusercontent.com. Nada foi gravado.",
    );
  }
  const digest = sha256(bytes);

  // Pino já congelado no registro: divergência é fim de linha, não aviso.
  if (asset.expectedSha256 && asset.expectedSha256 !== digest) {
    throw new Error(
      `${source.id}/${asset.localPath}: SHA-256 divergente do registro. ` +
        `esperado ${asset.expectedSha256}, obtido ${digest}. Nada foi gravado.`,
    );
  }
  if (!existsSync(target) || force) {
    await writeFile(target, bytes);
  }
  return {
    repo_path: asset.repoPath,
    local_path: asset.localPath,
    url,
    bytes: bytes.byteLength,
    sha256: digest,
    reader_status: asset.readerStatus,
  };
}

function printPlan(source: LexiconSource): void {
  console.log(`\n== ${source.id} — ${source.name}`);
  console.log(`   tipo de ativo: ${source.assetKind} · idioma: ${source.language}`);
  console.log(`   licença: ${source.license.declared} (${source.license.family})`);
  console.log(`   coleta: ${source.collectionStatus} · importável: ${source.importable ? "sim" : "não"}`);
  console.log(`   pino: ${pinLabel(source.pin)}`);
  for (const asset of source.assets) {
    const pinned = asset.expectedSha256 ? `sha256 ${asset.expectedSha256.slice(0, 16)}…` : "sha256 ainda não registrado";
    console.log(`   - ${asset.repoPath} -> ${asset.localPath} (${asset.readerStatus}, ${pinned})`);
  }
  for (const field of source.prohibitedFields) {
    console.log(`   PROIBIDO ler '${field.sourceField}': ${field.reason.slice(0, 120)}…`);
  }
}

async function collectSource(source: LexiconSource): Promise<void> {
  if (!source.importable) {
    throw new Error(`${source.id}: marcada como não importável no registro`);
  }
  if (source.collectionStatus !== "approved_for_collection") {
    throw new Error(
      `${source.id}: coleta não aprovada (${source.collectionStatus}). ` +
        "Registre a aprovação do proprietário em docs/LEXICON_PIPELINE.md e no registro antes de coletar.",
    );
  }
  if (source.assets.length === 0) {
    throw new Error(`${source.id}: nenhum ativo declarado`);
  }

  const assets: AssetRecord[] = [];
  for (const asset of source.assets) {
    const record = await collectAsset(source, asset);
    assets.push(record);
    console.log(`   ${record.local_path}: ${record.bytes} bytes, sha256 ${record.sha256}`);
  }

  const manifest = {
    id: source.id,
    name: source.name,
    registry_version: LEXICON_REGISTRY_VERSION,
    registry_fingerprint: registryFingerprint(),
    repository: source.repository,
    pin: source.pin,
    license_declared: source.license.declared,
    license_family: source.license.family,
    license_url: source.license.url,
    attribution_required: source.attribution,
    asset_kind: source.assetKind,
    selected_fields: source.selectedFields,
    prohibited_fields: source.prohibitedFields,
    collected_at: new Date().toISOString(),
    assets,
    status: "collected_pending_human_approval",
    notes:
      "Bytes coletados e conferidos por checksum. NÃO aprovados para exibição: exigem revisão " +
      "humana de direitos, integridade e amostras antes de qualquer importação.",
  };
  const manifestPath = join(OUT, source.id, "MANIFEST.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`   manifesto: ${source.id}/MANIFEST.json`);
  console.log("   Cole no registro, para congelar a versão:");
  for (const asset of assets) {
    console.log(`     ${asset.local_path}  expectedSha256: "${asset.sha256}"`);
  }
}

async function main(): Promise<void> {
  assertNoLicenseMixing(LEXICON_SOURCES);
  const selected = LEXICON_SOURCES.filter((source) => !onlySource || source.id === onlySource).map(pinnedSource);
  if (selected.length === 0) throw new Error(`nenhuma fonte com id '${onlySource ?? ""}'`);

  console.log(`Registro lexical ${LEXICON_REGISTRY_VERSION} · impressão ${registryFingerprint().slice(0, 16)}…`);
  console.log("Destino dos bytes: data/sources/lexicons/ (ignorado pelo Git)");

  if (!collect) {
    for (const source of selected) printPlan(source);
    console.log("\nPlano apenas. Nada foi baixado: use --collect depois da aprovação registrada.");
    return;
  }

  for (const source of selected) {
    printPlan(source);
    await collectSource(source);
  }
  console.log("\nColeta concluída. Nenhuma fonte está aprovada para exibição.");
}

main().catch((error: unknown) => {
  console.error("FALHA NA COLETA:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
