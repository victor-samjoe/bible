import { z } from "zod";
import type { Role, Viewer } from "../../domain/access";
import type { AuthConfig } from "./config";

export { parseAuthConfig } from "./config";
export type { AuthConfig } from "./config";

/** A request-scoped Supabase client; getUser must verify with the provider. */
export interface SupabaseAuthClient {
  auth: {
    signInWithOtp(input: { email: string }): Promise<{ error: unknown | null }>;
    getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown | null }>;
  };
}

/** This lookup must read server-controlled profiles, never user-editable metadata. */
export type RoleLookup = (userId: string) => Promise<unknown>;
export type AuthResult = { ok: true } | { ok: false; reason: "unavailable" | "invalid_email" | "provider_error" };

const emailSchema = z.email().max(254);
const roleSchema = z.enum(["reader", "editor", "admin"]);
const idSchema = z.uuid();

export function createAuth(config: AuthConfig, client?: SupabaseAuthClient, lookupRole?: RoleLookup) {
  const enabled = config.available && client !== undefined;
  return {
    available: enabled,
    async requestOtp(email: string): Promise<AuthResult> {
      if (!enabled || !client) return { ok: false, reason: "unavailable" };
      const parsed = emailSchema.safeParse(email.trim());
      if (!parsed.success) return { ok: false, reason: "invalid_email" };
      try {
        const result = await client.auth.signInWithOtp({ email: parsed.data });
        return result.error ? { ok: false, reason: "provider_error" } : { ok: true };
      } catch {
        return { ok: false, reason: "provider_error" };
      }
    },
    async getViewer(): Promise<Viewer | null> {
      if (!enabled || !client || !lookupRole) return null;
      try {
        const result = await client.auth.getUser();
        if (result.error || !result.data.user) return null;
        const id = idSchema.safeParse(result.data.user.id);
        if (!id.success) return null;
        const role = roleSchema.safeParse(await lookupRole(id.data));
        return role.success ? { id: id.data, role: role.data } : null;
      } catch {
        return null;
      }
    },
  };
}

export function hasRole(viewer: Viewer | null, required: Role): boolean {
  if (!viewer || !idSchema.safeParse(viewer.id).success) return false;
  const actual = roleSchema.safeParse(viewer.role);
  const target = roleSchema.safeParse(required);
  if (!actual.success || !target.success) return false;
  const rank: Record<Role, number> = { reader: 0, editor: 1, admin: 2 };
  return rank[actual.data] >= rank[target.data];
}
