import { convertCorpus } from "../src/importers/blivre.ts";

async function main() {
  const translationId = process.argv[2];
  if (!translationId) throw new Error("Uso: converter <translation_id UUID> [diretório USFM]");
  const result = await convertCorpus(process.argv[3] ?? "data/source/porbr2018_usfm", translationId);
  process.stdout.write(JSON.stringify(result));
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
