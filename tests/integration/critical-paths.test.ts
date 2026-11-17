import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publish } from "../../src/cli/workflow";
import { canAccess } from "../../src/domain/access";
import { StudySchema } from "../../src/domain/editorial/schema";
import { projectStudy } from "../../src/server/contracts/studies";
import { FakeBillingProvider, signWebhook } from "../../src/server/billing/fake-provider";
import { BillingWebhookService } from "../../src/server/billing/webhook-service";

const now = new Date("2026-11-17T12:00:00Z");
const resource = { id: "study", slug: "study", title: "Study", summary: "Preview", access: "premium" as const, status: "published" as const, publishedVersionId: "version" };
const sections = [
  { id: "free", order: 1, title: "Preview", content: "Public content", visibility: "free" as const },
  { id: "premium", order: 2, title: "Private", content: "PREMIUM CONTENT", visibility: "premium" as const },
];

describe("premium access and projection", () => {
  it("denies a reader without an entitlement and excludes premium sections from the projection", () => {
    const authorized = canAccess({ id: "reader", role: "reader" }, "premium_studies", resource, [], now);
    expect(authorized).toBe(false);
    const result = projectStudy(resource, sections, authorized);
    expect(result.preview).toBe(true);
    expect(result.sections).toEqual([sections[0]]);
    expect(JSON.stringify(result)).not.toContain("PREMIUM CONTENT");
  });

  it("allows a matching active entitlement and includes premium sections", () => {
    const grant = { userId: "reader", feature: "premium_studies", resourceId: null, state: "active" as const, startsAt: new Date("2026-11-01T00:00:00Z"), endsAt: null };
    const authorized = canAccess({ id: "reader", role: "reader" }, "premium_studies", resource, [grant], now);
    expect(authorized).toBe(true);
    expect(projectStudy(resource, sections, authorized).sections).toEqual(sections);
  });
});

describe("CLI publication gate", () => {
  it.each([
    ["sources", "Inclua fontes e afirmações verificadas."],
    ["reviewer", "Informe o revisor."],
    ["status", "O estudo precisa estar aprovado."],
  ] as const)("refuses publication without valid %s and leaves the file unchanged", async (missing, expected) => {
    const directory = await mkdtemp(join(tmpdir(), "samjoe-integration-"));
    try {
      const study = StudySchema.parse(JSON.parse(await readFile(join(process.cwd(), "src/content/editorial/pending-example.json"), "utf8")));
      const sourceId = "91111111-1111-4111-8111-111111111111";
      const locationId = "92222222-2222-4222-8222-222222222222";
      const claimId = "93333333-3333-4333-8333-333333333333";
      Object.assign(study, { status: "approved", summary: "Test", level: "Test", author: "Author", reviewer: "Reviewer", changelog: "Test" });
      Object.assign(study.dossier, { scope: "Test", rights_status: "approved" });
      study.dossier.sources = [{ id: sourceId, work: "Test", author: "Test", publisher: "Test", edition: "Test", year: 2000, identifier: "Test", license: "Test", rights_verified: true, reliability: "Test", locations: [{ id: locationId, locator: "Test", permission: "Test" }] }];
      study.dossier.claims = [{ id: claimId, anchor: "Test", source_id: sourceId, location_id: locationId, kind: "editorial_synthesis", verification_note: "Test", synthesis_notice: "Editorial synthesis" }];
      study.sections = [{ id: "94444444-4444-4444-8444-444444444444", title: "Test", content: "Test", visibility: "free", claim_ids: [claimId] }];
      if (missing === "sources") study.dossier.sources = [];
      if (missing === "reviewer") study.reviewer = "";
      if (missing === "status") study.status = "draft";
      const original = JSON.stringify(study);
      const path = join(directory, `${study.id}.json`);
      await writeFile(path, original);
      await expect(publish(directory, study.id)).rejects.toThrow(expected);
      expect(await readFile(path, "utf8")).toBe(original);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("billing webhook", () => {
  it("does not activate a second time when the same verified event is replayed", async () => {
    const provider = new FakeBillingProvider({ payments: [{ id: "payment", status: "approved", planKey: "mensal", userId: "reader" }] });
    const service = new BillingWebhookService({ provider, now: () => now });
    const rawBody = JSON.stringify({ id: "event", type: "payment.updated", data: { paymentId: "payment" } });
    const request = { rawBody, signatureHeader: signWebhook(rawBody, "123") };
    const first = await service.processWebhook(request);
    const second = await service.processWebhook(request);
    expect(first.outcome).toBe("activated");
    expect(second.outcome).toBe("duplicate");
    expect(second.activated).toBe(false);
    expect(service.activationCount("reader")).toBe(1);
    expect(service.processedEvents()).toHaveLength(1);
    expect(provider.serverLookupCount).toBe(1);
  });
});
