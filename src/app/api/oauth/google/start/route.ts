// GET /api/oauth/google/start → 302 to Google's consent screen (Gmail send/modify, Calendar read/events, email).
//   ?format=json returns { status:"ok", url, redirectUri } instead of redirecting (used by the setup check).
// The redirect URI is GOOGLE_REDIRECT_URI or <this origin>/api/oauth/google/callback; it must be registered on the
// OAuth client (the dealdesk-ventureos Web client has http://localhost:3000/api/oauth/google/callback).
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildAuthUrl, redirectUri } from "@/lib/google/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const STATE_COOKIE = "dd_google_oauth_state";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET?.trim())
    return NextResponse.json({ status: "not_configured", message: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local, then restart the app." }, { status: 503 });
  const state = randomBytes(16).toString("base64url");
  const redirect = redirectUri(url.origin);
  const auth = buildAuthUrl({ clientId, redirectUri: redirect, state, loginHint: process.env.GOOGLE_LOGIN_HINT?.trim() || undefined });
  const res = url.searchParams.get("format") === "json" ? NextResponse.json({ status: "ok", url: auth, redirectUri: redirect }) : NextResponse.redirect(auth, 302);
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", path: "/api/oauth/google", maxAge: 600, secure: url.protocol === "https:" });
  return res;
}
