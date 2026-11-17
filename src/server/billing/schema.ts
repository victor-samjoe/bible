import { z } from "zod";

const text = z.string().trim().min(1).max(200);

/** Checkout input accepted from a client: a plan key and an idempotency key, nothing priced. */
export const CheckoutRequestSchema = z
  .object({
    planKey: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9_-]*$/, "Chave de plano inválida."),
    userId: z.string().uuid(),
    idempotencyKey: text,
  })
  .strict();

/**
 * Envelope of the sandbox webhook. `status` is deliberately absent: the body never
 * decides payment state, the server-side lookup does.
 */
export const SandboxWebhookBodySchema = z
  .object({
    event_id: text,
    type: text,
    payment_id: text,
    sent_at: z.string().datetime().optional(),
  })
  .strict();

/** Provider lookup response for the sandbox adapter. */
export const SandboxPaymentSchema = z
  .object({
    payment_id: text,
    status: z.enum(["pending", "approved", "declined", "refunded", "canceled"]),
    subscription_external_id: text,
    plan_key: text,
    user_id: z.string().uuid(),
    current_period_end: z.string().datetime().nullable().default(null),
  })
  .strict();

export type CheckoutRequestInput = z.infer<typeof CheckoutRequestSchema>;
export type SandboxWebhookBody = z.infer<typeof SandboxWebhookBodySchema>;
export type SandboxPayment = z.infer<typeof SandboxPaymentSchema>;
