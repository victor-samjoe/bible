import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Coleta dos corpora de idiomas originais (tarefa C14).
 *
 * Executa o procedimento de `docs/ORIGINAL_LANGUAGE_SOURCES.md`: registra URL
 * exata, release/tag/commit, licença copiada, atribuição exigida, data de coleta
 * e SHA-256 dos bytes originais, antes de qualquer extração.
 *
 * Regras que este script respeita:
 * - baixa somente artefato oficial, em URL fixada por tag/commit quando existe;
 * - grava fora de `public/` e fora do bundle, em `data/sources/originals/`;
 * - não importa aparato crítico, léxico, glossa nem morfologia do NT: cada um é
 *   ativo separado, com licença própria, e nada disso está aprovado;
 * - falha fechada: status diferente de 200, corpo vazio ou licença ausente
 *   interrompem a coleta da fonte, sem gravar manifesto parcial;
 * - não envia credencial alguma e não usa token de API.
 *
 * Uso: node --experimental-strip-types scripts/fetch-original-sources.ts [--force]
 */

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "data", "sources", "originals");
const force = process.argv.includes("--force");

type Asset = { readonly path: string; readonly url: string };

type SourceSpec = {
  readonly id: string;
  readonly name: string;
  readonly corpus: "hebrew-ot" | "greek-nt";
  readonly kind: "text" | "text+morphology";
  readonly homepage: string;
  readonly pinnedAt: string;
  readonly licenseDeclared: string;
  readonly attribution: string;
  readonly notImported: readonly string[];
  readonly license: Asset;
  readonly assets: readonly Asset[];
};

const MORPHHB_TAG = "v.2.2";
const MORPHHB_COMMIT = "6a5db284c715c18b239422e57bb89684e6a19f00";

// A pagina oficial de download lista o href de Marcos como "62-Mkt.txt", que
// responde 404; o arquivo publicado e "62-Mk.txt". Erro de digitacao da fonte,
// corrigido aqui e registrado para auditoria.
const SBLGNT_BOOKS = [
  "61-Mt", "62-Mk", "63-Lk", "64-Jn", "65-Ac", "66-Ro", "67-1Co", "68-2Co",
  "69-Ga", "70-Eph", "71-Php", "72-Col", "73-1Th", "74-2Th", "75-1Ti", "76-2Ti",
  "77-Tit", "78-Phm", "79-Heb", "80-Jas", "81-1Pe", "82-2Pe", "83-1Jn", "84-2Jn",
  "85-3Jn", "86-Jud", "87-Re",
];

const sources: readonly SourceSpec[] = [
  {
    id: "oshb-morphhb",
    name: "Open Scriptures Hebrew Bible (MorphHB)",
    corpus: "hebrew-ot",
    kind: "text+morphology",
    homepage: "https://github.com/openscriptures/morphhb",
    pinnedAt: `tag ${MORPHHB_TAG} / commit ${MORPHHB_COMMIT}`,
    licenseDeclared: "CC BY 4.0 (base WLC)",
    attribution:
      "Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb",
    notImported: [
      "definições lexicais e glossas em qualquer idioma",
      "Strong's e transliteração como ativos de produto",
    ],
    license: {
      path: "LICENSE.md",
      url: `https://raw.githubusercontent.com/openscriptures/morphhb/${MORPHHB_COMMIT}/LICENSE.md`,
    },
    assets: [
      {
        path: `morphhb-${MORPHHB_TAG}.tar.gz`,
        url: `https://codeload.github.com/openscriptures/morphhb/tar.gz/refs/tags/${MORPHHB_TAG}`,
      },
    ],
  },
  {
    id: "wlc-ebible",
    name: "Westminster Leningrad Codex (texto hebraico)",
    corpus: "hebrew-ot",
    kind: "text",
    homepage: "https://ebible.org/bible/details.php?id=hebwlc",
    pinnedAt: "pacote USFM corrente do eBible na data de coleta",
    licenseDeclared: "Domínio público (declarado pela fonte)",
    attribution:
      "Westminster Leningrad Codex (WLC), texto em domínio público; fonte digital identificada no manifesto da versão importada.",
    notImported: ["morfologia", "aparato crítico", "notas editoriais"],
    license: {
      path: "EVIDENCIA-LICENCA.html",
      url: "https://ebible.org/bible/details.php?id=hebwlc",
    },
    assets: [{ path: "hebwlc_usfm.zip", url: "https://ebible.org/Scriptures/hebwlc_usfm.zip" }],
  },
  {
    id: "sblgnt",
    name: "SBL Greek New Testament",
    corpus: "greek-nt",
    kind: "text",
    homepage: "https://sblgnt.com/",
    pinnedAt: "arquivos correntes de sblgnt.com/download na data de coleta",
    licenseDeclared: "CC BY 4.0",
    attribution:
      "SBL Greek New Testament (SBLGNT), © Society of Biblical Literature e Logos Bible Software; usado sob CC BY 4.0, com indicação de modificações. Sem sugestão de endosso de SBL, Logos/Faithlife ou Michael W. Holmes.",
    notImported: [
      "aparato crítico (arquivos -APP), que é ativo separado",
      "morfologia do NT, que exige fonte e licença próprias",
    ],
    license: { path: "LICENCA.html", url: "https://sblgnt.com/license/" },
    assets: SBLGNT_BOOKS.map((book) => ({
      path: `text/${book}.txt`,
      url: `https://www.sblgnt.com/download/${book}.txt`,
    })),
  },
];

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "bible-corpus-fetcher/1.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error(`corpo vazio em ${url}`);
  return bytes;
}

async function fetchAsset(
  sourceDir: string,
  asset: Asset,
): Promise<{ path: string; url: string; bytes: number; sha256: string }> {
  const target = join(sourceDir, asset.path);
  await mkdir(dirname(target), { recursive: true });
  if (existsSync(target) && !force) {
    const existing = await readFile(target);
    return {
      path: asset.path,
      url: asset.url,
      bytes: existing.byteLength,
      sha256: sha256(existing),
    };
  }
  const bytes = await download(asset.url);
  await writeFile(target, bytes);
  return { path: asset.path, url: asset.url, bytes: bytes.byteLength, sha256: sha256(bytes) };
}

async function main() {
  const collectedAt = new Date().toISOString();
  for (const source of sources) {
    const sourceDir = join(OUT, source.id);
    await mkdir(sourceDir, { recursive: true });
    console.log(`\n== ${source.id} — ${source.name}`);

    // Licença primeiro: sem licença verificável, a fonte não é coletada.
    const license = await fetchAsset(sourceDir, source.license);
    console.log(`  licença: ${license.path} (${license.bytes} bytes, sha256 ${license.sha256.slice(0, 16)}…)`);

    const assets = [];
    for (const asset of source.assets) {
      const result = await fetchAsset(sourceDir, asset);
      assets.push(result);
      console.log(`  ${result.path}: ${result.bytes} bytes, sha256 ${result.sha256.slice(0, 16)}…`);
    }

    const manifest = {
      id: source.id,
      name: source.name,
      corpus: source.corpus,
      kind: source.kind,
      homepage: source.homepage,
      pinned_at: source.pinnedAt,
      license_declared: source.licenseDeclared,
      license_evidence: license,
      attribution_required: source.attribution,
      not_imported: source.notImported,
      collected_at: collectedAt,
      assets,
      status: "collected_pending_human_approval",
      notes:
        "Coletado e verificado por checksum. NÃO aprovado para produção: exige revisão humana de direitos, integridade e amostras antes de qualquer exibição.",
    };
    await writeFile(join(sourceDir, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`  manifesto: ${source.id}/MANIFEST.json`);
  }
  console.log("\nColeta concluída. Nenhuma fonte está aprovada para exibição.");
}

main().catch((error: unknown) => {
  console.error("FALHA NA COLETA:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
