import { z } from "zod";

const environmentSchema = z.object({
  SUPABASE_URL: z.string().trim().optional().default(""),
  SUPABASE_PUBLISHABLE_KEY: z.string().trim().optional().default(""),
  SUPABASE_ANON_KEY: z.string().trim().optional().default(""),
});

export type AuthConfig =
  | { available: false; reason: "missing_configuration" | "invalid_configuration" }
  | { available: true; url: string; anonKey: string };

/** Validate without exposing values or throwing when configuration is absent. */
export function parseAuthConfig(environment: unknown): AuthConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) return { available: false, reason: "invalid_configuration" };
  const { SUPABASE_URL: url } = result.data;
  // Prefer the current publishable key, retaining legacy anon-key compatibility.
  const anonKey = result.data.SUPABASE_PUBLISHABLE_KEY || result.data.SUPABASE_ANON_KEY;
  if (!url && !anonKey) return { available: false, reason: "missing_configuration" };
  if (!url || !anonKey) return { available: false, reason: "invalid_configuration" };
  const validUrl = z.url().safeParse(url);
  if (!validUrl.success) return { available: false, reason: "invalid_configuration" };
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
    return { available: false, reason: "invalid_configuration" };
  }
  return { available: true, url, anonKey };
}
