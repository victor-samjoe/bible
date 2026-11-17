import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { SubscriptionStatus } from "../../domain/billing";

/**
 * Deterministic in-memory billing provider for tests and for running the MVP
 * while no sandbox credentials exist. It performs no network call and never
 * charges. The `BillingProvider` contract lives here because this is the only
 * adapter so far; a real adapter (Mercado Pago) must satisfy the same shape.
 */
export type ProviderPaymentStatus = "pending" | "approved" | "declined" | "refunded";
export type PlanKey = "mensal" | "anual";

export interface BillingPlan {
  key: PlanKey;
  /** Server-side price; never accepted from the client. */
  priceMinor: number;
  currency: "BRL";
  periodDays: number;
  feature: string;
}

/** The catalog is server-side: a checkout request carries only an allowed plan key. */
export const BILLING_PLANS: Readonly<Record<PlanKey, BillingPlan>> = Object.freeze({
  mensal: { key: "mensal", priceMinor: 2990, currency: "BRL", periodDays: 30, feature: "premium_studies" },
  anual: { key: "anual", priceMinor: 29900, currency: "BRL", periodDays: 365, feature: "premium_studies" },
});

export const planKeySchema = z.enum(["mensal", "anual"]);

export const checkoutRequestSchema = z.strictObject({
  planKey: planKeySchema,
  userId: z.string().min(1),
  /** Idempotency key for the critical operation; a repeat reuses the same session. */
  idempotencyKey: z.string().min(1),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export interface CheckoutSession {
  id: string;
  provider: string;
  url: string;
  planKey: PlanKey;
  userId: string;
  /** Resolved from the catalog on the server, not from the request. */
  priceMinor: number;
  currency: "BRL";
  expiresAt: Date;
  status: "open";
}

/** Authoritative payment record, reachable only through a server-side lookup. */
export interface ProviderPayment {
  id: string;
  status: ProviderPaymentStatus;
  planKey: PlanKey;
  userId: string;
  amountMinor: number;
  currency: "BRL";
  checkoutSessionId: string | null;
  externalSubscriptionId: string | null;
}

export const webhookEnvelopeSchema = z.strictObject({
  id: z.string().min(1),
  type: z.enum(["payment.created", "payment.updated", "subscription.updated"]),
  /** Reference only: a status inside the payload is never trusted. */
  data: z.strictObject({ paymentId: z.string().min(1), status: z.string().min(1).optional() }),
});
export type WebhookEnvelope = z.infer<typeof webhookEnvelopeSchema>;

export interface BillingProvider {
  readonly name: string;
  getPlan(planKey: string): BillingPlan | null;
  /** Creates the payment intent server-side; the browser only receives a redirect URL. */
  createCheckout(input: unknown): Promise<CheckoutSession>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null | undefined): boolean;
  parseWebhook(rawBody: string): WebhookEnvelope;
  /** Server-side re-read of the payment: the only accepted payment evidence. */
  getPayment(paymentId: string): Promise<ProviderPayment | null>;
}

export interface FakeProviderSeedPayment {
  id: string;
  status: ProviderPaymentStatus;
  planKey: PlanKey;
  userId: string;
  amountMinor?: number;
  checkoutSessionId?: string | null;
  externalSubscriptionId?: string | null;
}

export interface FakeProviderOptions {
  /** Test-only secret; a real adapter reads its secret from the environment. */
  secret?: string;
  /** Fixed clock so sessions and identifiers stay deterministic. */
  now?: () => Date;
  sessionTtlMs?: number;
  payments?: readonly FakeProviderSeedPayment[];
}

const DEFAULT_SECRET = "fake-provider-test-secret";
const DEFAULT_TTL_MS = 30 * 60 * 1000;

function digest(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** Header shape `t=<timestamp>,v1=<hmac>` signed over `<timestamp>.<rawBody>`. */
export function signWebhook(rawBody: string, timestamp: string, secret: string = DEFAULT_SECRET): string {
  return `t=${timestamp},v1=${digest(secret, `${timestamp}.${rawBody}`)}`;
}

function parseSignatureHeader(header: string): { timestamp: string; signature: string } | null {
  const parts = new Map<string, string>();
  for (const chunk of header.split(",")) {
    const index = chunk.indexOf("=");
    if (index <= 0) return null;
    parts.set(chunk.slice(0, index).trim(), chunk.slice(index + 1).trim());
  }
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return null;
  return { timestamp, signature };
}

function equalHex(received: string, expected: string): boolean {
  if (received.length !== expected.length || received.length === 0) return false;
  if (!/^[0-9a-f]+$/i.test(received) || !/^[0-9a-f]+$/i.test(expected)) return false;
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

export class FakeBillingProvider implements BillingProvider {
  readonly name = "fake";
  private readonly secret: string;
  private readonly clock: () => Date;
  private readonly sessionTtlMs: number;
  private readonly payments = new Map<string, ProviderPayment>();
  private readonly sessions = new Map<string, CheckoutSession>();
  private lookups = 0;

  constructor(options: FakeProviderOptions = {}) {
    this.secret = options.secret ?? DEFAULT_SECRET;
    this.clock = options.now ?? (() => new Date());
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_TTL_MS;
    for (const seed of options.payments ?? []) this.setPayment(seed);
  }

  /** Test seam: declares what a server-side read would answer for this payment. */
  setPayment(seed: FakeProviderSeedPayment): ProviderPayment {
    const plan = BILLING_PLANS[seed.planKey];
    const payment: ProviderPayment = {
      id: seed.id,
      status: seed.status,
      planKey: seed.planKey,
      userId: seed.userId,
      amountMinor: seed.amountMinor ?? plan.priceMinor,
      currency: plan.currency,
      checkoutSessionId: seed.checkoutSessionId ?? null,
      externalSubscriptionId: seed.externalSubscriptionId ?? null,
    };
    this.payments.set(payment.id, payment);
    return payment;
  }

  getPlan(planKey: string): BillingPlan | null {
    const parsed = planKeySchema.safeParse(planKey);
    return parsed.success ? BILLING_PLANS[parsed.data] : null;
  }

  async createCheckout(input: unknown): Promise<CheckoutSession> {
    const { planKey, userId, idempotencyKey } = checkoutRequestSchema.parse(input);
    const plan = BILLING_PLANS[planKey];
    const id = `fake_cs_${digest(this.secret, `${userId}|${planKey}|${idempotencyKey}`).slice(0, 24)}`;
    const existing = this.sessions.get(id);
    if (existing) return existing;
    const session: CheckoutSession = {
      id,
      provider: this.name,
      url: `https://fake-provider.invalid/checkout/${id}`,
      planKey,
      userId,
      priceMinor: plan.priceMinor,
      currency: plan.currency,
      expiresAt: new Date(this.clock().getTime() + this.sessionTtlMs),
      status: "open",
    };
    this.sessions.set(id, session);
    /** The payment stays pending until a verified webhook plus a server-side read. */
    this.setPayment({ id: this.paymentIdFor(id), status: "pending", planKey, userId, checkoutSessionId: id });
    return session;
  }

  /** Deterministic payment id attached to a checkout session. */
  paymentIdFor(checkoutSessionId: string): string {
    return `fake_pay_${checkoutSessionId.replace(/^fake_cs_/, "")}`;
  }

  getCheckoutSession(id: string): CheckoutSession | null {
    return this.sessions.get(id) ?? null;
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null | undefined): boolean {
    if (typeof signatureHeader !== "string" || signatureHeader.length === 0) return false;
    const parsed = parseSignatureHeader(signatureHeader);
    if (!parsed) return false;
    return equalHex(parsed.signature, digest(this.secret, `${parsed.timestamp}.${rawBody}`));
  }

  parseWebhook(rawBody: string): WebhookEnvelope {
    let json: unknown;
    try {
      json = JSON.parse(rawBody) as unknown;
    } catch {
      throw new Error("Malformed webhook body");
    }
    return webhookEnvelopeSchema.parse(json);
  }

  async getPayment(paymentId: string): Promise<ProviderPayment | null> {
    this.lookups += 1;
    const payment = this.payments.get(paymentId);
    return payment ? { ...payment } : null;
  }

  /** Test seam: proves an activation required a server-side consult. */
  get serverLookupCount(): number {
    return this.lookups;
  }
}

/** Maps a verified, server-read payment status onto the subscription machine. */
export function subscriptionStatusForPayment(status: ProviderPaymentStatus): SubscriptionStatus {
  switch (status) {
    case "approved":
      return "active";
    case "declined":
      return "past_due";
    case "refunded":
      return "refunded";
    default:
      return "pending";
  }
}
