import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("a medição em lotes reproduz os bytes do gerador no recorte das fontes", () => {
  const dir = mkdtempSync(join(tmpdir(), "samjoe-audit-test-"));
  const hebrew = join(dir, "macula-hebrew");
  const greek = join(dir, "macula-greek");
  const out = join(dir, "index");
  mkdirSync(hebrew); mkdirSync(greek);
  const h = join(hebrew, "macula-hebrew.tsv"), g = join(greek, "macula-greek-SBLGNT.tsv");
  try {
    copyFileSync("tests/fixtures/lexicons/macula-hebrew-gen1-1.sample.tsv", h);
    copyFileSync("tests/fixtures/lexicons/macula-greek-jhn1-1.sample.tsv", g);
    const common = ["--max-old-space-size=128", "--experimental-strip-types"];
    const audit = JSON.parse(execFileSync(process.execPath, [...common, "scripts/audit-word-study-corpus.ts"], {
      encoding: "utf8", env: { ...process.env, WORD_STUDY_CORPUS_DIR: dir }, stdio: ["ignore", "pipe", "ignore"],
    }));
    execFileSync(process.execPath, [...common, "scripts/build-word-study-index.ts", `--out=${out}`], {
      encoding: "utf8", env: { ...process.env, WORD_STUDY_CORPUS_DIR: "" }, stdio: ["ignore", "pipe", "ignore"],
    });
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    expect(audit.partitionMeasurement.partitions).toBe(1);
    expect(audit.partitionMeasurement.concatenatedSha256).toBe(manifest.partitions[0].sha256);
    expect(audit.partitionMeasurement.totalRaw).toBe(manifest.partitions[0].bytes);
    expect(audit.partitionMeasurement.totalGzip).toBe(manifest.partitions[0].gzipBytes);
  } finally {
    for (const file of [h, g, join(out, "manifest.json"), join(out, "postings-0000.ndjson")]) {
      try { unlinkSync(file); } catch { /* teste pode ter falhado antes da criação */ }
    }
    for (const directory of [hebrew, greek, out, dir]) {
      try { rmdirSync(directory); } catch { /* preserva resíduos inesperados para inspeção */ }
    }
  }
}, 20000);
