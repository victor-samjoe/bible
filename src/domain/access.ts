export type Role = "reader" | "editor" | "admin";
export type StudyStatus = "draft" | "in_review" | "approved" | "published" | "archived";
export type AccessLevel = "free" | "premium";
export interface Viewer { id: string; role: Role }
export interface Entitlement {
  userId: string;
  feature: string;
  resourceId: string | null;
  state: "active" | "revoked";
  startsAt: Date;
  endsAt: Date | null;
}
export interface AccessResource { id: string; status: StudyStatus; access: AccessLevel }

/** Call on the server with entitlements loaded for the authenticated viewer. */
export function canAccess(user: Viewer | null, feature: string, resource: AccessResource, entitlements: readonly Entitlement[] = [], now = new Date()): boolean {
  if (resource.status !== "published") return false;
  if (resource.access === "free") return true;
  if (!user || !Number.isFinite(now.getTime())) return false;
  const time = now.getTime();
  return entitlements.some((grant) => grant.userId === user.id && grant.feature === feature &&
    (grant.resourceId === null || grant.resourceId === resource.id) && grant.state === "active" &&
    Number.isFinite(grant.startsAt.getTime()) && grant.startsAt.getTime() <= time &&
    (grant.endsAt === null || (Number.isFinite(grant.endsAt.getTime()) && time < grant.endsAt.getTime())));
}
