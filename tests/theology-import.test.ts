import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertTheologyImportAllowed, TheologyImportManifestSchema } from "../src/domain/bkf/theology-import";
import { importTheologyText } from "../src/cli/import-theology";

const bytes = Buffer.from("Texto sintético autorizado.\n", "utf8");
const hash = createHash("sha256").update(bytes).digest("hex");
const manifest = () => ({ schema_version: 1, edition_id: randomUUID(), work: { title: "Fixture", authors: ["Autor"], language: "pt", edition_label: "Teste", is_translation: false, translator: null }, provenance: { source_url: "https://example.test/source", retrieved_at: "2026-11-17T00:00:00.000Z", original_filename: "fixture.txt", sha256: hash }, rights: { status: "APPROVED_FULL", store: true, automated_processing: true, quote: true, public_distribution: false, evidence_url: "https://example.test/license", verified_by: "Revisor", verified_at: "2026-11-17T00:00:00.000Z", expires_at: null, attribution: "Atribuição de teste" } });

describe("theology import", () => {
  it("imports only an approved UTF-8 source matching its manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "theology-import-"));
    try {
      const source = join(root, "fixture.txt"); const manifestPath = join(root, "manifest.json"); const privateRoot = join(root, "private");
      await writeFile(source, bytes); await writeFile(manifestPath, JSON.stringify(manifest()));
      const result = await importTheologyText({ sourcePath: source, manifestPath, privateRoot });
      expect(await readFile(result.textTarget, "utf8")).toBe(bytes.toString("utf8"));
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("fails closed for missing processing permission, expired rights and altered bytes", () => {
    const noProcessing = manifest(); noProcessing.rights.automated_processing = false;
    expect(() => TheologyImportManifestSchema.parse(noProcessing)).toThrow();
    const expired = TheologyImportManifestSchema.parse({ ...manifest(), rights: { ...manifest().rights, expires_at: "2026-11-18T00:00:00.000Z" } });
    expect(() => assertTheologyImportAllowed(expired, new Date("2026-11-19T00:00:00.000Z"))).toThrow(/expirados/);
  });
});
