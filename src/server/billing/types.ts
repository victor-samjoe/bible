import type { SubscriptionStatus } from "../../domain/billing";

/**
 * Billing contracts. Nothing in this module may treat a browser redirect as payment
 * evidence: a subscription or entitlement only changes after a signature-verified
 * webhook plus an authoritative server-side lookup at the provider.
 */
export type BillingProviderName = "disabled" | "fake-sandbox" | "mercado_pago";

/** `unavailable` hides the purchase path; `sandbox` must be labelled as a test environment. */
export type CheckoutMode = "unavailable" | "sandbox" | "live";

/** Provider-reported payment state, never taken from the webhook body. */
export type ProviderPaymentStatus = "pending" | "approved" | "declined" | "refunded" | "canceled";

export interface Plan {
  readonly id: string;
  readonly key: string;
  readonly version: number;
  readonly priceMinor: number;
  readonly currency: string;
  readonly period: string;
  readonly status: "active" | "inactive";
  /** Entitlement features granted while the subscription is payable. */
  readonly features: readonly string[];
}

export interface SubscriptionRecord {
  readonly id: string;
  readonly userId: string;
  readonly planId: string;
  readonly status: SubscriptionStatus;
  readonly provider: BillingProviderName;
  readonly externalId: string;
  readonly currentPeriodEnd: Date | null;
}

export interface EntitlementGrant {
  readonly userId: string;
  readonly feature: string;
  readonly resourceId: string | null;
  readonly sourceSubscriptionId: string;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
}

/** Only a plan key crosses the trust boundary; price, currency and period are server-resolved. */
export interface CheckoutRequest {
  readonly planKey: string;
  readonly userId: string;
  readonly idempotencyKey: string;
}

export interface CheckoutSession {
  readonly provider: BillingProviderName;
  /** Provider-side reference stored as `subscriptions.external_id`. */
  readonly externalId: string;
  readonly redirectUrl: string;
  readonly mode: CheckoutMode;
}

export type CheckoutStartResult =
  | { readonly status: "unavailable"; readonly reason: "billing_disabled" | "unknown_plan" | "plan_inactive" | "invalid_request" }
  | {
      readonly status: "started";
      readonly mode: Exclude<CheckoutMode, "unavailable">;
      readonly session: CheckoutSession;
      readonly subscription: SubscriptionRecord;
      /** Server-resolved offer shown to the reader; the client never supplies these. */
      readonly offer: { readonly planKey: string; readonly priceMinor: number; readonly currency: string; readonly period: string };
    };

export interface RawWebhookRequest {
  /** Exact bytes received; signatures are checked against this, not a re-serialised object. */
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
}

/** Minimal identity extracted from a webhook whose signature already verified. */
export interface WebhookIdentity {
  readonly externalEventId: string;
  readonly type: string;
  /** Provider payment id to look up server-side. The body's own status claim is ignored. */
  readonly paymentId: string;
}

/** Authoritative provider state fetched server-side after signature verification. */
export interface ProviderPaymentSnapshot {
  readonly paymentId: string;
  readonly status: ProviderPaymentStatus;
  /** Matches `subscriptions.external_id` created at checkout. */
  readonly subscriptionExternalId: string;
  readonly planKey: string;
  readonly userId: string;
  readonly currentPeriodEnd: Date | null;
}

export interface BillingProvider {
  readonly name: BillingProviderName;
  readonly checkoutMode: CheckoutMode;
  /** True only for a provider configured to move real money. */
  readonly chargesRealMoney: boolean;
  createCheckout(plan: Plan, request: CheckoutRequest): Promise<CheckoutSession>;
  /** Returns null when the signature is absent, malformed or does not match the raw body. */
  verifyWebhook(request: RawWebhookRequest): WebhookIdentity | null;
  /** Returns null when the provider cannot confirm the payment; callers must not grant access. */
  fetchPayment(paymentId: string): Promise<ProviderPaymentSnapshot | null>;
}

export type WebhookResult =
  | "invalid_signature"
  | "invalid_payload"
  | "duplicate_ignored"
  | "provider_unavailable"
  | "unknown_subscription"
  | "mismatch"
  | "invalid_transition"
  | "entitlement_granted"
  | "entitlement_revoked"
  | "no_entitlement_change";

export interface PaymentEventRecord {
  readonly id: string;
  readonly provider: BillingProviderName;
  readonly externalEventId: string;
  readonly type: string;
  readonly subscriptionId: string | null;
  readonly receivedAt: Date;
  readonly processedAt: Date | null;
  readonly result: WebhookResult | null;
}

export interface PaymentEventInsert {
  readonly provider: BillingProviderName;
  readonly externalEventId: string;
  readonly type: string;
  /** Already minimized; must never carry card data, tokens, e-mails or raw payloads. */
  readonly minimizedPayload: Readonly<Record<string, string | number | boolean | null>>;
}

/** `inserted: false` means `UNIQUE(provider, external_event_id)` already held the row. */
export interface PaymentEventClaim {
  readonly record: PaymentEventRecord;
  readonly inserted: boolean;
}

export interface AuditEntry {
  readonly actorId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly result: string;
  readonly minimizedMetadata: Readonly<Record<string, string | number | boolean | null>>;
}

/**
 * Write side of billing persistence. Implementations must run every method of one
 * `transaction` call inside a single database transaction.
 */
export interface BillingStore {
  findPlanByKey(key: string): Promise<Plan | null>;
  findPlanById(id: string): Promise<Plan | null>;
  findSubscriptionByExternalId(provider: BillingProviderName, externalId: string): Promise<SubscriptionRecord | null>;
  createPendingSubscription(input: {
    readonly userId: string;
    readonly planId: string;
    readonly provider: BillingProviderName;
    readonly externalId: string;
  }): Promise<SubscriptionRecord>;
  /** Must rely on `UNIQUE(provider, external_event_id)` rather than a read-then-write check. */
  claimPaymentEvent(event: PaymentEventInsert): Promise<PaymentEventClaim>;
  markPaymentEventProcessed(eventId: string, subscriptionId: string | null, result: WebhookResult, at: Date): Promise<void>;
  updateSubscription(id: string, status: SubscriptionStatus, currentPeriodEnd: Date | null): Promise<SubscriptionRecord>;
  /**
   * Must be idempotent per `(userId, feature, resourceId, sourceSubscriptionId)`: update the
   * existing row instead of inserting a second one. `drizzle/0000_initial.sql` has no unique
   * index for that tuple, so the implementation performs the lookup inside the transaction.
   */
  grantEntitlement(grant: EntitlementGrant): Promise<{ readonly created: boolean }>;
  revokeEntitlements(sourceSubscriptionId: string, at: Date): Promise<{ readonly revoked: number }>;
  appendAuditLog(entry: AuditEntry): Promise<void>;
}

export interface BillingRepository extends BillingStore {
  transaction<T>(work: (tx: BillingStore) => Promise<T>): Promise<T>;
}

/** Structured sink; fields are redacted before they reach it. */
export interface BillingLogger {
  info(event: string, fields?: Readonly<Record<string, unknown>>): void;
  warn(event: string, fields?: Readonly<Record<string, unknown>>): void;
  error(event: string, fields?: Readonly<Record<string, unknown>>): void;
}
