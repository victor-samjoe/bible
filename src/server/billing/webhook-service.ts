import { createHash } from "node:crypto";
import type { Entitlement } from "../../domain/access";
import { type SubscriptionStatus, subscriptionAllowsEntitlement, transitionSubscription } from "../../domain/billing";
import { type BillingProvider, type ProviderPayment, subscriptionStatusForPayment } from "./fake-provider";

/**
 * Processes billing webhooks: verify signature, record the event idempotently,
 * re-read the payment on the server and only then decide the entitlement.
 * State is in memory; a persistent implementation must keep the same rules
 * behind the unique `(provider, external_event_id)` index.
 */
export type WebhookOutcome =
  | "activated"
  | "already_active"
  | "duplicate"
  | "not_activated"
  | "revoked"
  | "rejected_signature"
  | "rejected_payload"
  | "payment_not_found"
  | "untrusted_source";

export interface EntitlementDecision {
  outcome: WebhookOutcome;
  /** Signature verified, envelope valid and event recorded. */
  accepted: boolean;
  /** The event id had already been processed. */
  duplicate: boolean;
  /** This call created a new activation. */
  activated: boolean;
  /** The resulting entitlement grants premium access at `now`. */
  entitled: boolean;
  eventId: string | null;
  paymentId: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  entitlement: Entitlement | null;
  reason: string;
}

export interface WebhookRequest {
  /** Exact bytes received; the signature covers this string, not a re-encoding. */
  rawBody: string;
  signatureHeader: string | null | undefined;
}

export interface ProcessedEvent {
  provider: string;
  externalEventId: string;
  type: string;
  payloadHash: string;
  receivedAt: Date;
  processedAt: Date;
  result: WebhookOutcome;
}

export interface WebhookServiceOptions {
  provider: BillingProvider;
  now?: () => Date;
}

function decision(partial: Partial<EntitlementDecision> & { outcome: WebhookOutcome; reason: string }): EntitlementDecision {
  return {
    accepted: false,
    duplicate: false,
    activated: false,
    entitled: false,
    eventId: null,
    paymentId: null,
    subscriptionStatus: null,
    entitlement: null,
    ...partial,
  };
}

export class BillingWebhookService {
  private readonly provider: BillingProvider;
  private readonly clock: () => Date;
  /** Idempotency ledger keyed by `provider:external_event_id`. */
  private readonly events = new Map<string, ProcessedEvent>();
  private readonly decisions = new Map<string, EntitlementDecision>();
  private readonly subscriptions = new Map<string, SubscriptionStatus>();
  private readonly entitlements = new Map<string, Entitlement>();
  private readonly activationLog: Entitlement[] = [];

  constructor(options: WebhookServiceOptions) {
    this.provider = options.provider;
    this.clock = options.now ?? (() => new Date());
  }

  async processWebhook(request: WebhookRequest): Promise<EntitlementDecision> {
    const receivedAt = this.clock();
    if (!this.provider.verifyWebhookSignature(request.rawBody, request.signatureHeader)) {
      return decision({ outcome: "rejected_signature", reason: "Webhook signature did not verify" });
    }

    let envelope;
    try {
      envelope = this.provider.parseWebhook(request.rawBody);
    } catch {
      return decision({ outcome: "rejected_payload", reason: "Webhook payload failed schema validation" });
    }

    const key = `${this.provider.name}:${envelope.id}`;
    const previous = this.decisions.get(key);
    if (previous) {
      /** Replay: no second activation, the first decision stands. */
      return { ...previous, outcome: "duplicate", duplicate: true, activated: false, reason: `Event ${envelope.id} was already processed` };
    }

    /** The payload status is a hint only; the provider read below is the evidence. */
    const payment = await this.provider.getPayment(envelope.data.paymentId);
    const result = payment
      ? this.decide(envelope.id, payment)
      : decision({ outcome: "payment_not_found", accepted: true, eventId: envelope.id, paymentId: envelope.data.paymentId, reason: "Provider has no such payment" });

    this.events.set(key, {
      provider: this.provider.name,
      externalEventId: envelope.id,
      type: envelope.type,
      payloadHash: createHash("sha256").update(request.rawBody, "utf8").digest("hex"),
      receivedAt,
      processedAt: this.clock(),
      result: result.outcome,
    });
    this.decisions.set(key, result);
    return result;
  }

  private decide(eventId: string, payment: ProviderPayment): EntitlementDecision {
    const plan = this.provider.getPlan(payment.planKey);
    if (!plan) {
      return decision({ outcome: "not_activated", accepted: true, eventId, paymentId: payment.id, reason: `Unknown plan ${payment.planKey}` });
    }
    if (payment.amountMinor !== plan.priceMinor || payment.currency !== plan.currency) {
      return decision({ outcome: "not_activated", accepted: true, eventId, paymentId: payment.id, reason: "Payment amount does not match the server-side plan price" });
    }

    /** MVP keeps one subscription per user. */
    const from = this.subscriptions.get(payment.userId) ?? "pending";
    const target = subscriptionStatusForPayment(payment.status);
    if (target === "pending") {
      return decision({ outcome: "not_activated", accepted: true, eventId, paymentId: payment.id, subscriptionStatus: from, entitlement: this.currentEntitlement(payment.userId, plan.feature), entitled: this.isEntitled(payment.userId, plan.feature), reason: "Payment is still pending at the provider" });
    }

    let status: SubscriptionStatus;
    try {
      status = transitionSubscription(from, target);
    } catch {
      return decision({ outcome: "not_activated", accepted: true, eventId, paymentId: payment.id, subscriptionStatus: from, entitlement: this.currentEntitlement(payment.userId, plan.feature), entitled: this.isEntitled(payment.userId, plan.feature), reason: `Invalid subscription transition: ${from} -> ${target}` });
    }
    this.subscriptions.set(payment.userId, status);

    const entitlementKey = `${payment.userId}:${plan.feature}`;
    if (payment.status !== "approved") {
      const revoked = this.entitlements.get(entitlementKey);
      if (revoked) this.entitlements.set(entitlementKey, { ...revoked, state: "revoked" });
      return decision({
        outcome: revoked ? "revoked" : "not_activated",
        accepted: true,
        eventId,
        paymentId: payment.id,
        subscriptionStatus: status,
        entitlement: this.entitlements.get(entitlementKey) ?? null,
        entitled: false,
        reason: `Payment ${payment.status}: access not granted`,
      });
    }

    const existing = this.entitlements.get(entitlementKey);
    if (existing && existing.state === "active") {
      return decision({ outcome: "already_active", accepted: true, eventId, paymentId: payment.id, subscriptionStatus: status, entitlement: existing, entitled: this.isEntitled(payment.userId, plan.feature), reason: "Entitlement was already active for this user and feature" });
    }

    const startsAt = this.clock();
    const entitlement: Entitlement = {
      userId: payment.userId,
      feature: plan.feature,
      resourceId: null,
      state: "active",
      startsAt,
      endsAt: new Date(startsAt.getTime() + plan.periodDays * 24 * 60 * 60 * 1000),
    };
    this.entitlements.set(entitlementKey, entitlement);
    this.activationLog.push(entitlement);
    return decision({
      outcome: "activated",
      accepted: true,
      activated: true,
      entitled: subscriptionAllowsEntitlement(status, entitlement.endsAt, startsAt),
      eventId,
      paymentId: payment.id,
      subscriptionStatus: status,
      entitlement,
      reason: "Verified webhook plus server-side payment read granted access",
    });
  }

  /**
   * A browser redirect after checkout is not payment evidence: report it for
   * UI purposes only and never change entitlement from it.
   */
  assessBrowserReturn(input: { userId: string; feature: string; checkoutSessionId?: string }): EntitlementDecision {
    const entitlement = this.currentEntitlement(input.userId, input.feature);
    return decision({
      outcome: "untrusted_source",
      accepted: false,
      entitled: this.isEntitled(input.userId, input.feature),
      entitlement,
      reason: `Browser return for ${input.checkoutSessionId ?? "checkout"} is informational; only a verified webhook can activate access`,
    });
  }

  currentEntitlement(userId: string, feature: string): Entitlement | null {
    return this.entitlements.get(`${userId}:${feature}`) ?? null;
  }

  isEntitled(userId: string, feature: string, now: Date = this.clock()): boolean {
    const entitlement = this.currentEntitlement(userId, feature);
    if (!entitlement || entitlement.state !== "active") return false;
    const status = this.subscriptionStatus(userId);
    return subscriptionAllowsEntitlement(status, entitlement.endsAt, now) && entitlement.startsAt.getTime() <= now.getTime();
  }

  subscriptionStatus(userId: string): SubscriptionStatus {
    return this.subscriptions.get(userId) ?? "pending";
  }

  /** Number of activations recorded; a replayed event must not increase it. */
  activationCount(userId?: string): number {
    return userId ? this.activationLog.filter((entry) => entry.userId === userId).length : this.activationLog.length;
  }

  processedEvents(): readonly ProcessedEvent[] {
    return [...this.events.values()];
  }
}
