import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publish, submit } from "../src/cli/workflow";
import { StudySchema } from "../src/domain/editorial/schema";
import { validatePublication, validateStudy } from "../src/domain/editorial/validation";

const fixture = async () => StudySchema.parse(JSON.parse(await readFile(join(process.cwd(), "src/content/editorial/pending-example.json"), "utf8")));

describe("editorial publication gate", () => {
  it("blocks an incomplete dossier and validates its strict shape", async () => {
    const study = await fixture();
    expect(validateStudy(study).length).toBeGreaterThan(0);
    expect(validatePublication(study)).toContain("O estudo precisa estar aprovado.");
    expect(StudySchema.safeParse({ ...study, unexpected: true }).success).toBe(false);
  });

  it("requires a reviewer and refuses invented or missing source links", async () => {
    const study = await fixture();
    study.status = "approved";
    study.author = "Pessoa A";
    study.reviewer = "Pessoa A";
    const errors = validatePublication(study);
    expect(errors).toContain("Em equipe, revisor e autor devem ser diferentes.");
    expect(errors).toContain("Inclua fontes e afirmações verificadas.");
    study.reviewer = "";
    expect(validatePublication(study)).toContain("Informe o revisor.");
  });

  it("checks source locations and identifies editorial synthesis", async () => {
    const study = await fixture();
    const sourceId = "91111111-1111-4111-8111-111111111111";
    const locationId = "92222222-2222-4222-8222-222222222222";
    const claimId = "93333333-3333-4333-8333-333333333333";
    // Synthetic identifiers and labels test the gate only; they are not bibliographic data.
    study.summary = "Teste"; study.level = "Teste"; study.author = "A"; study.reviewer = "B"; study.changelog = "Teste";
    study.status = "approved"; study.dossier.scope = "Teste"; study.dossier.rights_status = "approved";
    study.dossier.sources = [{ id: sourceId, work: "Teste", author: "Teste", publisher: "Teste", edition: "Teste", year: 2000, identifier: "Teste", license: "Teste", rights_verified: true, reliability: "Teste", locations: [{ id: locationId, locator: "Teste", permission: "Teste" }] }];
    study.dossier.claims = [{ id: claimId, anchor: "Teste", source_id: sourceId, location_id: locationId, kind: "editorial_synthesis", verification_note: "Teste", synthesis_notice: "" }];
    study.sections = [{ id: "94444444-4444-4444-8444-444444444444", title: "Teste", content: "Teste", visibility: "free", claim_ids: [claimId] }];
    expect(validatePublication(study).some((error) => error.includes("síntese editorial"))).toBe(true);
    study.dossier.claims[0]!.synthesis_notice = "Síntese editorial";
    expect(validatePublication(study)).toEqual([]);
    study.dossier.claims[0]!.location_id = "95555555-5555-4555-8555-555555555555";
    expect(validatePublication(study).some((error) => error.includes("localização ausente"))).toBe(true);
  });

  it("does not change the stored draft on invalid submit or publish", async () => {
    const directory = await mkdtemp(join(tmpdir(), "samjoe-editorial-"));
    try {
      const study = await fixture();
      const file = join(directory, `${study.id}.json`);
      const original = JSON.stringify(study);
      await writeFile(file, original);
      await expect(submit(directory, study.id)).rejects.toThrow();
      await expect(publish(directory, study.id)).rejects.toThrow();
      expect(await readFile(file, "utf8")).toBe(original);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
