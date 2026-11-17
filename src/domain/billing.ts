export type SubscriptionStatus = "pending" | "active" | "grace" | "past_due" | "canceled" | "expired" | "refunded";
const transitions: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  pending: ["active", "past_due", "canceled", "expired"],
  active: ["grace", "past_due", "canceled", "expired", "refunded"],
  grace: ["active", "past_due", "canceled", "expired", "refunded"],
  past_due: ["active", "canceled", "expired", "refunded"],
  canceled: ["expired", "refunded"],
  expired: ["refunded"],
  refunded: [],
};
/** Only call after provider verification; browser redirects are not payment evidence. */
export function transitionSubscription(from: SubscriptionStatus, to: SubscriptionStatus): SubscriptionStatus {
  if (from === to) return from;
  if (!transitions[from].includes(to)) throw new Error(`Invalid subscription transition: ${from} -> ${to}`);
  return to;
}
/** A canceled subscription retains its paid grant only until its explicit end. */
export function subscriptionAllowsEntitlement(status: SubscriptionStatus, endAt: Date | null, now = new Date()): boolean {
  if (!Number.isFinite(now.getTime())) return false;
  if (status === "canceled") return endAt !== null && Number.isFinite(endAt.getTime()) && now < endAt;
  if (status !== "active" && status !== "grace") return false;
  return endAt === null || (Number.isFinite(endAt.getTime()) && now < endAt);
}
