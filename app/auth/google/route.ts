import { getAuthConfig } from "@/src/server/auth/runtime";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VERIFIER_COOKIE = "samjoe_oauth_verifier";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export async function GET(request: Request): Promise<Response> {
  const config = await getAuthConfig();
  if (!config.available || config.siteUrl === null) return NextResponse.redirect(new URL("/entrar?erro=google", request.url), 303);
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = base64Url(bytes);
  const authorize = new URL(`${config.url.replace(/\/+$/, "")}/auth/v1/authorize`);
  authorize.searchParams.set("provider", "google");
  authorize.searchParams.set("redirect_to", `${config.siteUrl}/auth/callback`);
  authorize.searchParams.set("code_challenge", await challengeFor(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");
  const response = NextResponse.redirect(authorize, 303);
  response.cookies.set(VERIFIER_COOKIE, verifier, { httpOnly: true, maxAge: 600, path: "/auth/callback", sameSite: "lax", secure: config.siteUrl.startsWith("https:") });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
