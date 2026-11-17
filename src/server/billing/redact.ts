import type { BillingLogger, ProviderPaymentSnapshot, WebhookIdentity } from "./types";

/** Keys whose values never reach a log, a stored payload or an audit row. */
const DENIED_KEY = /(secret|token|password|passwd|authorization|auth|signature|sign|cookie|session|api[-_]?key|bearer|credential|card|pan|cvv|cvc|cvn|iban|account[-_]?number|routing|cpf|cnpj|ssn|phone|whatsapp|address|birth|payload|body|raw)/i;
const EMAIL = /[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+/g;
const LONG_DIGITS = /\b\d[\d .-]{10,}\d\b/g;
const BEARER = /\b(bearer|basic)\s+[\w.\-+/=]+/gi;
const MAX_STRING = 120;
const MAX_DEPTH = 4;
const MAX_ITEMS = 10;

/** Masks e-mails, card-like digit runs and credential headers inside free text. */
export function maskText(value: string): string {
  const masked = value
    .replace(EMAIL, (match) => `***@${match.slice(match.lastIndexOf("@") + 1)}`)
    .replace(LONG_DIGITS, "[redacted-number]")
    .replace(BEARER, (match) => `${match.split(/\s+/)[0]} [redacted]`);
  return masked.length > MAX_STRING ? `${masked.slice(0, MAX_STRING)}…` : masked;
}

/** Recursively strips denied keys and masks sensitive-looking values. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return maskText(value);
  if (typeof value === "bigint") return "[redacted]";
  if (typeof value === "function" || typeof value === "symbol" || value === undefined) return "[omitted]";
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : "[invalid-date]";
  if (value instanceof Error) return { name: value.name, message: maskText(value.message) };
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((item) => redact(item, depth + 1));
    return value.length > MAX_ITEMS ? [...items, `[+${value.length - MAX_ITEMS} omitted]`] : items;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, MAX_ITEMS * 2)) {
      out[key] = DENIED_KEY.test(key) ? "[redacted]" : redact(item, depth + 1);
    }
    return out;
  }
  return "[omitted]";
}

/** Wraps a sink so every logged field passes through {@link redact}. */
export function createRedactingLogger(sink: BillingLogger): BillingLogger {
  const wrap = (level: keyof BillingLogger) => (event: string, fields?: Readonly<Record<string, unknown>>) =>
    sink[level](event, fields === undefined ? undefined : (redact(fields) as Record<string, unknown>));
  return { info: wrap("info"), warn: wrap("warn"), error: wrap("error") };
}

/** Drops every field to stderr-free silence; used when no sink is configured. */
export const silentLogger: BillingLogger = { info: () => {}, warn: () => {}, error: () => {} };

/**
 * Builds the `payment_events.minimized_payload` value: provider identifiers and state only.
 * The raw webhook body is never persisted.
 */
export function minimizePaymentEvent(
  identity: WebhookIdentity,
  snapshot: ProviderPaymentSnapshot | null,
): Record<string, string | number | boolean | null> {
  return {
    type: maskText(identity.type),
    payment_id: maskText(identity.paymentId),
    provider_status: snapshot === null ? null : snapshot.status,
    subscription_external_id: snapshot === null ? null : maskText(snapshot.subscriptionExternalId),
    plan_key: snapshot === null ? null : maskText(snapshot.planKey),
    verified_server_side: snapshot !== null,
  };
}
