// GET /api/oauth/google/callback?code&state → exchanges the code, stores the refresh token locally (gitignored
// .dealdesk/google-token.json, 0600), then 302 to /settings?section=connectors&google=connected|error.
// The token is never logged or returned to the browser.
import { NextResponse } from "next/server";
import { clearGoogleTokenCache, exchangeCode, GoogleApiError, redirectUri } from "@/lib/google/oauth";
import { gmailProfile } from "@/lib/google/gmail";
import { writeStoredToken } from "@/lib/google/token-store";
import { recordMemory } from "@/lib/memory/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const STATE_COOKIE = "dd_google_oauth_state";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (outcome: "connected" | "error", message?: string) => {
    const to = new URL("/settings", url.origin);
    to.searchParams.set("section", "connectors");
    to.searchParams.set("google", outcome);
    if (message) to.searchParams.set("message", message.slice(0, 300));
    const res = NextResponse.redirect(to, 302);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/oauth/google" });
    return res;
  };
  const err = url.searchParams.get("error");
  if (err) return back("error", err === "access_denied" ? "Google sign-in was cancelled (or this account is not a test user on the consent screen)." : `Google returned ${err}.`);
  const code = url.searchParams.get("code"), state = url.searchParams.get("state");
  const expected = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${STATE_COOKIE}=`))?.slice(STATE_COOKIE.length + 1);
  if (!code || !state || !expected || state !== expected) return back("error", "Sign-in state did not match (expired or opened in another browser). Click Connect again.");
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim(), clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return back("error", "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set on the server.");
  try {
    const t = await exchangeCode({ clientId, clientSecret, redirectUri: redirectUri(url.origin), code });
    clearGoogleTokenCache();
    const profile = await gmailProfile({ clientId, clientSecret, refreshToken: t.refreshToken }).catch(() => null);
    writeStoredToken({ refreshToken: t.refreshToken, email: profile?.emailAddress ?? null, scopes: t.scopes, connectedAt: new Date().toISOString() });
    await recordMemory({ kind: "connector.connected", actor: { type: "user" }, subject: null, summary: `Google connected${profile?.emailAddress ? ` as ${profile.emailAddress}` : ""}`, data: { scopes: t.scopes.length }, source: "api:/api/oauth/google/callback" }).catch(() => undefined);
    return back("connected");
  } catch (e) {
    return back("error", e instanceof GoogleApiError ? e.message : `Google sign-in failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
