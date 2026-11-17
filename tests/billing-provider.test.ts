import { describe, expect, it } from "vitest";
import {
  BILLING_PLANS,
  FakeBillingProvider,
  signWebhook,
  subscriptionStatusForPayment,
} from "../src/server/billing/fake-provider";
import { BillingWebhookService } from "../src/server/billing/webhook-service";

const SECRET = "test-webhook-secret";
const NOW = new Date("2026-11-17T12:00:00Z");
const clock = () => NOW;

function setup(payments: Parameters<FakeBillingProvider["setPayment"]>[0][] = []) {
  const provider = new FakeBillingProvider({ secret: SECRET, now: clock, payments });
  const service = new BillingWebhookService({ provider, now: clock });
  return { provider, service };
}

function event(id: string, paymentId: string, status?: string) {
  const rawBody = JSON.stringify({ id, type: "payment.updated", data: status ? { paymentId, status } : { paymentId } });
  return { rawBody, signatureHeader: signWebhook(rawBody, "1763380800", SECRET) };
}

describe("FakeBillingProvider checkout", () => {
  it("resolves price server-side and is deterministic per idempotency key", async () => {
    const { provider } = setup();
    const first = await provider.createCheckout({ planKey: "mensal", userId: "u1", idempotencyKey: "k1" });
    const again = await provider.createCheckout({ planKey: "mensal", userId: "u1", idempotencyKey: "k1" });
    const other = await provider.createCheckout({ planKey: "anual", userId: "u1", idempotencyKey: "k2" });

    expect(first.id).toBe(again.id);
    expect(first.priceMinor).toBe(BILLING_PLANS.mensal.priceMinor);
    expect(other.priceMinor).toBe(BILLING_PLANS.anual.priceMinor);
    expect(first.id).not.toBe(other.id);
    expect(first.expiresAt.getTime()).toBeGreaterThan(NOW.getTime());
    // The session starts without any payment evidence.
    await expect(provider.getPayment(provider.paymentIdFor(first.id))).resolves.toMatchObject({ status: "pending" });
  });

  it("rejects prices, unknown plans and unexpected fields coming from the client", async () => {
    const { provider } = setup();
    await expect(provider.createCheckout({ planKey: "vitalicio", userId: "u1", idempotencyKey: "k" })).rejects.toThrow();
    await expect(provider.createCheckout({ planKey: "mensal", userId: "", idempotencyKey: "k" })).rejects.toThrow();
    await expect(provider.createCheckout({ planKey: "mensal", userId: "u1", idempotencyKey: "k", priceMinor: 1 })).rejects.toThrow();
    expect(provider.getPlan("mensal")).toEqual(BILLING_PLANS.mensal);
    expect(provider.getPlan("vitalicio")).toBeNull();
  });
});

describe("FakeBillingProvider webhook signature", () => {
  it("verifies deterministically and rejects tampering, wrong secret and bad headers", () => {
    const { provider } = setup();
    const rawBody = JSON.stringify({ id: "evt_1", type: "payment.updated", data: { paymentId: "fake_pay_1" } });
    const signature = signWebhook(rawBody, "1763380800", SECRET);

    expect(signature).toBe(signWebhook(rawBody, "1763380800", SECRET));
    expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(true);
    expect(provider.verifyWebhookSignature(`${rawBody} `, signature)).toBe(false);
    // A signature is bound to its timestamp and cannot be replayed under another one.
    const otherTimestamp = signWebhook(rawBody, "1763380801", SECRET);
    expect(provider.verifyWebhookSignature(rawBody, otherTimestamp.replace("t=1763380801", "t=1763380800"))).toBe(false);
    expect(provider.verifyWebhookSignature(rawBody, otherTimestamp)).toBe(true);
    expect(provider.verifyWebhookSignature(rawBody, signWebhook(rawBody, "1763380800", "other-secret"))).toBe(false);
    expect(provider.verifyWebhookSignature(rawBody, "t=1763380800,v1=deadbeef")).toBe(false);
    expect(provider.verifyWebhookSignature(rawBody, "v1=deadbeef")).toBe(false);
    expect(provider.verifyWebhookSignature(rawBody, null)).toBe(false);
    expect(provider.verifyWebhookSignature(rawBody, "")).toBe(false);
  });

  it("parses only the documented envelope", () => {
    const { provider } = setup();
    expect(provider.parseWebhook(JSON.stringify({ id: "evt_1", type: "payment.updated", data: { paymentId: "p1" } }))).toEqual({
      id: "evt_1",
      type: "payment.updated",
      data: { paymentId: "p1" },
    });
    expect(() => provider.parseWebhook("{not json")).toThrow();
    expect(() => provider.parseWebhook(JSON.stringify({ id: "evt_1", type: "chargeback", data: { paymentId: "p1" } }))).toThrow();
    expect(() => provider.parseWebhook(JSON.stringify({ id: "evt_1", type: "payment.updated", data: {} }))).toThrow();
  });
});

describe("BillingWebhookService", () => {
  it("activates entitlement for an approved payment confirmed server-side", async () => {
    const { provider, service } = setup([{ id: "pay_ok", status: "approved", planKey: "mensal", userId: "u1" }]);
    const before = provider.serverLookupCount;

    const result = await service.processWebhook(event("evt_ok", "pay_ok"));

    expect(result.outcome).toBe("activated");
    expect(result.activated).toBe(true);
    expect(result.entitled).toBe(true);
    expect(result.subscriptionStatus).toBe("active");
    expect(result.entitlement).toMatchObject({ userId: "u1", feature: BILLING_PLANS.mensal.feature, state: "active" });
    expect(result.entitlement?.endsAt?.getTime()).toBe(NOW.getTime() + BILLING_PLANS.mensal.periodDays * 86_400_000);
    expect(provider.serverLookupCount).toBe(before + 1);
    expect(service.activationCount("u1")).toBe(1);
    expect(service.isEntitled("u1", BILLING_PLANS.mensal.feature)).toBe(true);
  });

  it("does not activate a declined payment", async () => {
    const { service } = setup([{ id: "pay_no", status: "declined", planKey: "mensal", userId: "u2" }]);

    const result = await service.processWebhook(event("evt_no", "pay_no"));

    expect(result.outcome).toBe("not_activated");
    expect(result.activated).toBe(false);
    expect(result.entitled).toBe(false);
    expect(result.entitlement).toBeNull();
    expect(result.subscriptionStatus).toBe("past_due");
    expect(service.activationCount("u2")).toBe(0);
    expect(service.isEntitled("u2", BILLING_PLANS.mensal.feature)).toBe(false);
  });

  it("treats a replayed event as duplicate without a second activation", async () => {
    const { service } = setup([{ id: "pay_dup", status: "approved", planKey: "anual", userId: "u3" }]);
    const delivery = event("evt_dup", "pay_dup");

    const first = await service.processWebhook(delivery);
    const second = await service.processWebhook(delivery);
    const third = await service.processWebhook(delivery);

    expect(first.outcome).toBe("activated");
    expect(second.outcome).toBe("duplicate");
    expect(second.duplicate).toBe(true);
    expect(second.activated).toBe(false);
    expect(second.entitlement).toEqual(first.entitlement);
    expect(third.outcome).toBe("duplicate");
    expect(service.activationCount("u3")).toBe(1);
    expect(service.processedEvents()).toHaveLength(1);
  });

  it("does not create a second activation for a distinct event on an active entitlement", async () => {
    const { service } = setup([{ id: "pay_a", status: "approved", planKey: "mensal", userId: "u4" }]);

    await service.processWebhook(event("evt_a1", "pay_a"));
    const repeat = await service.processWebhook(event("evt_a2", "pay_a"));

    expect(repeat.outcome).toBe("already_active");
    expect(repeat.activated).toBe(false);
    expect(repeat.entitled).toBe(true);
    expect(service.activationCount("u4")).toBe(1);
    expect(service.processedEvents()).toHaveLength(2);
  });

  it("rejects an unverified signature or malformed payload without touching entitlements", async () => {
    const { provider, service } = setup([{ id: "pay_x", status: "approved", planKey: "mensal", userId: "u5" }]);
    const good = event("evt_x", "pay_x");
    const lookupsBefore = provider.serverLookupCount;

    const forged = await service.processWebhook({ rawBody: good.rawBody, signatureHeader: "t=1763380800,v1=00" });
    const unsigned = await service.processWebhook({ rawBody: good.rawBody, signatureHeader: null });
    const tampered = await service.processWebhook({
      rawBody: JSON.stringify({ id: "evt_x", type: "payment.updated", data: { paymentId: "pay_x" }, grant: true }),
      signatureHeader: signWebhook(
        JSON.stringify({ id: "evt_x", type: "payment.updated", data: { paymentId: "pay_x" }, grant: true }),
        "1763380800",
        SECRET,
      ),
    });

    expect(forged.outcome).toBe("rejected_signature");
    expect(unsigned.outcome).toBe("rejected_signature");
    expect(tampered.outcome).toBe("rejected_payload");
    for (const result of [forged, unsigned, tampered]) {
      expect(result.accepted).toBe(false);
      expect(result.activated).toBe(false);
      expect(result.entitled).toBe(false);
    }
    expect(provider.serverLookupCount).toBe(lookupsBefore);
    expect(service.processedEvents()).toHaveLength(0);
    expect(service.isEntitled("u5", BILLING_PLANS.mensal.feature)).toBe(false);
  });

  it("ignores the status inside the payload and trusts only the server-side read", async () => {
    const { service } = setup([{ id: "pay_lie", status: "declined", planKey: "mensal", userId: "u6" }]);

    const lying = await service.processWebhook(event("evt_lie", "pay_lie", "approved"));

    expect(lying.activated).toBe(false);
    expect(lying.entitled).toBe(false);
    expect(service.activationCount("u6")).toBe(0);
  });

  it("does not activate when the provider has no such payment or the amount is wrong", async () => {
    const { provider, service } = setup();
    provider.setPayment({ id: "pay_cheap", status: "approved", planKey: "anual", userId: "u7", amountMinor: 1 });

    const missing = await service.processWebhook(event("evt_missing", "pay_ghost"));
    const cheap = await service.processWebhook(event("evt_cheap", "pay_cheap"));

    expect(missing.outcome).toBe("payment_not_found");
    expect(missing.accepted).toBe(true);
    expect(missing.activated).toBe(false);
    expect(cheap.outcome).toBe("not_activated");
    expect(cheap.activated).toBe(false);
    expect(service.activationCount("u7")).toBe(0);
  });

  it("revokes access on a refund after activation", async () => {
    const { provider, service } = setup([{ id: "pay_ref", status: "approved", planKey: "mensal", userId: "u8" }]);
    await service.processWebhook(event("evt_ref1", "pay_ref"));
    provider.setPayment({ id: "pay_ref", status: "refunded", planKey: "mensal", userId: "u8" });

    const refund = await service.processWebhook(event("evt_ref2", "pay_ref"));

    expect(refund.outcome).toBe("revoked");
    expect(refund.subscriptionStatus).toBe("refunded");
    expect(refund.entitled).toBe(false);
    expect(service.isEntitled("u8", BILLING_PLANS.mensal.feature)).toBe(false);
    expect(service.activationCount("u8")).toBe(1);
  });

  it("never grants access from a browser return", async () => {
    const { service } = setup([{ id: "pay_br", status: "approved", planKey: "mensal", userId: "u9" }]);

    const returned = service.assessBrowserReturn({ userId: "u9", feature: BILLING_PLANS.mensal.feature, checkoutSessionId: "fake_cs_1" });

    expect(returned.outcome).toBe("untrusted_source");
    expect(returned.accepted).toBe(false);
    expect(returned.activated).toBe(false);
    expect(returned.entitled).toBe(false);
    expect(service.activationCount("u9")).toBe(0);
    expect(service.subscriptionStatus("u9")).toBe("pending");
  });
});

describe("payment status mapping", () => {
  it("only an approved payment maps to an active subscription", () => {
    expect(subscriptionStatusForPayment("approved")).toBe("active");
    expect(subscriptionStatusForPayment("declined")).toBe("past_due");
    expect(subscriptionStatusForPayment("refunded")).toBe("refunded");
    expect(subscriptionStatusForPayment("pending")).toBe("pending");
  });
});
