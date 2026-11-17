import { describe, expect, it } from "vitest";
import { canAccess } from "../../src/domain/access";
import { subscriptionAllowsEntitlement, transitionSubscription } from "../../src/domain/billing";
import { transitionStudy } from "../../src/domain/editorial";
import { projectStudy } from "../../src/server/contracts/studies";

const now = new Date("2026-11-17T12:00:00Z");
const user = { id: "a", role: "reader" as const };
const resource = { id: "study", status: "published" as const, access: "premium" as const };
const grant = { userId: "a", feature: "study", resourceId: null, state: "active" as const, startsAt: new Date("2026-11-01T00:00:00Z"), endsAt: new Date("2026-12-01T00:00:00Z") };
describe("canAccess", () => {
  it("requires a matching current grant belonging to the viewer", () => {
    expect(canAccess(null, "study", resource, [grant], now)).toBe(false);
    expect(canAccess({ ...user, id: "b" }, "study", resource, [grant], now)).toBe(false);
    expect(canAccess(user, "study", resource, [grant], now)).toBe(true);
    expect(canAccess(user, "study", resource, [{ ...grant, resourceId: "other" }], now)).toBe(false);
    expect(canAccess(user, "study", resource, [{ ...grant, endsAt: now }], now)).toBe(false);
    expect(canAccess(user, "study", { ...resource, status: "draft" }, [grant], now)).toBe(false);
    expect(canAccess(null, "study", { ...resource, access: "free" }, [], now)).toBe(true);
  });
});
describe("subscription", () => {
  it("rejects unsupported transitions and does not grant pending or refunded access", () => {
    expect(transitionSubscription("pending", "active")).toBe("active");
    expect(() => transitionSubscription("refunded", "active")).toThrow();
    expect(subscriptionAllowsEntitlement("pending", null, now)).toBe(false);
    expect(subscriptionAllowsEntitlement("refunded", null, now)).toBe(false);
    expect(subscriptionAllowsEntitlement("canceled", grant.endsAt, now)).toBe(true);
    expect(subscriptionAllowsEntitlement("canceled", now, now)).toBe(false);
  });
});
describe("editorial", () => {
  it("requires review and admin publication with sources", () => {
    const ctx = { role: "admin" as const, authorId: "a", reviewerId: "b", sourcesValid: true, hasPublishableSection: true };
    expect(transitionStudy("approved", "published", ctx)).toBe("published");
    expect(() => transitionStudy("draft", "published", ctx)).toThrow();
    expect(() => transitionStudy("approved", "published", { ...ctx, sourcesValid: false })).toThrow();
    expect(() => transitionStudy("approved", "published", { ...ctx, role: "editor" })).toThrow();
  });
});
describe("preview", () => {
  it("never serializes premium sections for an unauthorized viewer", () => {
    const study = { ...resource, slug: "s", title: "Title", summary: "Summary", publishedVersionId: "v" };
    const sections = [{ id: "1", order: 1, title: "Preview", content: "public", visibility: "free" as const }, { id: "2", order: 2, title: "Private", content: "SECRET PREMIUM", visibility: "premium" as const }];
    expect(JSON.stringify(projectStudy(study, sections, false))).not.toContain("SECRET PREMIUM");
    expect(projectStudy(study, sections, false).preview).toBe(true);
    expect(projectStudy(study, sections, true).sections).toHaveLength(2);
  });
});
