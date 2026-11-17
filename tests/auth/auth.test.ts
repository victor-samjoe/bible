import { describe, expect, it, vi } from "vitest";
import { createAuth, hasRole, parseAuthConfig, type SupabaseAuthClient } from "../../src/server/auth";

const id = "b4627467-c03c-4dd6-9ba4-a4267758332f";
const config = parseAuthConfig({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "public-key" });

function client(): SupabaseAuthClient {
  return { auth: { signInWithOtp: vi.fn().mockResolvedValue({ error: null }), getUser: vi.fn().mockResolvedValue({ data: { user: { id } }, error: null }) } };
}

describe("optional authentication", () => {
  it("fails closed with missing or invalid configuration", async () => {
    expect(parseAuthConfig({})).toEqual({ available: false, reason: "missing_configuration" });
    for (const value of [{ SUPABASE_URL: "http://example.com", SUPABASE_ANON_KEY: "key" }, { SUPABASE_URL: "https://example.com" }, { SUPABASE_URL: 3 }]) {
      expect(parseAuthConfig(value).available).toBe(false);
    }
    const c = client();
    const auth = createAuth(parseAuthConfig({}), c, async () => "admin");
    expect(await auth.requestOtp("person@example.com")).toEqual({ ok: false, reason: "unavailable" });
    expect(await auth.getViewer()).toBeNull();
    expect(c.auth.getUser).not.toHaveBeenCalled();
    expect(c.auth.signInWithOtp).not.toHaveBeenCalled();
    expect(createAuth(config).available).toBe(false);
  });

  it("requests OTP only with valid input and reports provider errors without leaking them", async () => {
    const c = client();
    const auth = createAuth(config, c);
    expect(await auth.requestOtp("invalid")).toEqual({ ok: false, reason: "invalid_email" });
    expect(await auth.requestOtp(" person@example.com ")).toEqual({ ok: true });
    expect(c.auth.signInWithOtp).toHaveBeenCalledWith({ email: "person@example.com" });
    vi.mocked(c.auth.signInWithOtp).mockRejectedValue(new Error("secret"));
    expect(await auth.requestOtp("person@example.com")).toEqual({ ok: false, reason: "provider_error" });
  });

  it("uses verified identity and trusted role lookup, denying missing or invalid data", async () => {
    const c = client();
    const lookup = vi.fn().mockResolvedValue("editor");
    expect(await createAuth(config, c, lookup).getViewer()).toEqual({ id, role: "editor" });
    expect(lookup).toHaveBeenCalledWith(id);
    expect(await createAuth(config, c).getViewer()).toBeNull();
    lookup.mockResolvedValue("superadmin");
    expect(await createAuth(config, c, lookup).getViewer()).toBeNull();
    lookup.mockRejectedValue(new Error("database unavailable"));
    expect(await createAuth(config, c, lookup).getViewer()).toBeNull();
    vi.mocked(c.auth.getUser).mockResolvedValue({ data: { user: { id } }, error: new Error("invalid token") });
    expect(await createAuth(config, c, lookup).getViewer()).toBeNull();
  });

  it("checks roles hierarchically and denies anonymous or invalid roles", () => {
    expect(hasRole(null, "reader")).toBe(false);
    expect(hasRole({ id, role: "editor" }, "reader")).toBe(true);
    expect(hasRole({ id, role: "editor" }, "admin")).toBe(false);
    expect(hasRole({ id, role: "admin" }, "admin")).toBe(true);
    expect(hasRole({ id, role: "other" as "admin" }, "reader")).toBe(false);
  });
});
