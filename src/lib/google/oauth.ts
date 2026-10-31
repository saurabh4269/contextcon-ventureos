// Google OAuth 2.0 (server only): exchange the stored refresh token for short-lived access tokens
// (POST https://oauth2.googleapis.com/token, grant_type=refresh_token — developers.google.com/identity/protocols/oauth2/web-server#offline).
// Access tokens are cached in process memory until shortly before `expires_in`; nothing is persisted or logged.
// The refresh token comes from the in-app sign-in (token-store.ts, gitignored file) or, failing that, GOOGLE_REFRESH_TOKEN.
// The sign-in itself is the standard authorization-code flow (buildAuthUrl → Google consent → exchangeCode).
import { readStoredToken } from "./token-store";
export type GoogleConfig = { clientId: string; clientSecret: string; refreshToken: string };
export const GOOGLE_ENV = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"] as const;
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EARLY_REFRESH_MS = 60_000; // refresh a minute before Google says the token expires

export type GoogleErrorCode = "not_configured" | "expired" | "invalid_client" | "forbidden" | "http" | "network";
export class GoogleApiError extends Error {
  constructor(readonly code: GoogleErrorCode, message: string, readonly httpStatus?: number) {
    super(message);
    this.name = "GoogleApiError";
  }
}

export const GOOGLE_CLIENT_ENV = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const;

export function googleConfig(env: Record<string, string | undefined> = process.env, stored: () => { refreshToken: string } | null = readStoredToken): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim(), clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = stored()?.refreshToken || env.GOOGLE_REFRESH_TOKEN?.trim();
  return clientId && clientSecret && refreshToken ? { clientId, clientSecret, refreshToken } : null;
}

/** The scopes the existing Deal Desk client was granted: Gmail send + modify (drafts, read), Calendar read + events, email. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;
export const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const CALLBACK_PATH = "/api/oauth/google/callback"; // registered on the dealdesk-ventureos Web client

/** GOOGLE_REDIRECT_URI if set, else <origin of this request>/api/oauth/google/callback (must match the OAuth client exactly). */
export const redirectUri = (origin: string, env: Record<string, string | undefined> = process.env) => env.GOOGLE_REDIRECT_URI?.trim() || `${origin.replace(/\/$/, "")}${CALLBACK_PATH}`;

/** Consent URL: offline access + prompt=consent so Google always returns a refresh token; login_hint pre-selects the account. */
export function buildAuthUrl(opts: { clientId: string; redirectUri: string; state: string; loginHint?: string }): string {
  const qs = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: opts.state,
    ...(opts.loginHint ? { login_hint: opts.loginHint } : {}),
  });
  return `${AUTH_URL}?${qs}`;
}

/** Authorization code → tokens (POST oauth2.googleapis.com/token, grant_type=authorization_code). */
export async function exchangeCode(opts: { clientId: string; clientSecret: string; redirectUri: string; code: string }, f: typeof fetch = fetch): Promise<{ refreshToken: string; accessToken: string; expiresIn: number; scopes: string[] }> {
  let r: Response;
  try {
    r = await f(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: opts.clientId, client_secret: opts.clientSecret, redirect_uri: opts.redirectUri, code: opts.code, grant_type: "authorization_code" }),
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
  } catch (e) {
    throw new GoogleApiError("network", `Google token endpoint unreachable: ${e instanceof Error ? e.message : String(e)}`);
  }
  const j = (await r.json().catch(() => null)) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string } | null;
  if (!r.ok || !j?.access_token) {
    if (j?.error === "invalid_client" || j?.error === "unauthorized_client") throw new GoogleApiError("invalid_client", `Google rejected the OAuth client (${j.error}) — check GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.`, r.status);
    if (j?.error === "redirect_uri_mismatch") throw new GoogleApiError("invalid_client", "redirect_uri_mismatch — add the exact callback URL to the OAuth client's Authorized redirect URIs.", r.status);
    throw new GoogleApiError("http", `Google code exchange failed (${r.status}${j?.error ? `: ${j.error}` : ""}${j?.error_description ? ` — ${j.error_description}` : ""}).`, r.status);
  }
  if (!j.refresh_token) throw new GoogleApiError("http", "Google returned no refresh token. Remove Deal Desk at myaccount.google.com/permissions and connect again.", r.status);
  return { refreshToken: j.refresh_token, accessToken: j.access_token, expiresIn: j.expires_in ?? 0, scopes: (j.scope ?? "").split(" ").filter(Boolean) };
}

type Cached = { token: string; expiresAt: number };
const g = globalThis as unknown as { __dealdeskGoogleTokens?: Map<string, Cached> };
const cache = () => (g.__dealdeskGoogleTokens ??= new Map());
export const clearGoogleTokenCache = () => cache().clear();

/** Every Google call is bounded: a hung connection becomes a "network" GoogleApiError instead of a stuck request. */
const GOOGLE_TIMEOUT_MS = 15_000;

export async function getAccessToken(cfg: GoogleConfig, f: typeof fetch = fetch, now: () => number = Date.now): Promise<string> {
  const key = cfg.clientId;
  const hit = cache().get(key);
  if (hit && hit.expiresAt - EARLY_REFRESH_MS > now()) return hit.token;
  let r: Response;
  try {
    r = await f(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: cfg.refreshToken, grant_type: "refresh_token" }),
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
  } catch (e) {
    throw new GoogleApiError("network", `Google token endpoint unreachable: ${e instanceof Error ? e.message : String(e)}`);
  }
  const j = (await r.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: string; error_description?: string } | null;
  if (!r.ok || !j?.access_token) {
    cache().delete(key);
    if (j?.error === "invalid_grant") throw new GoogleApiError("expired", "Google connection expired — reconnect (the refresh token was revoked or has expired).", r.status);
    if (j?.error === "invalid_client" || j?.error === "unauthorized_client") throw new GoogleApiError("invalid_client", `Google rejected the OAuth client (${j.error}) — check GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.`, r.status);
    throw new GoogleApiError("http", `Google token refresh failed (${r.status}${j?.error ? `: ${j.error}` : ""}).`, r.status);
  }
  cache().set(key, { token: j.access_token, expiresAt: now() + (j.expires_in ?? 0) * 1000 });
  return j.access_token;
}

/** Authorized JSON call to a Google API. Maps 401/403 to typed errors with Google's own message. */
export async function googleJson<T>(cfg: GoogleConfig, url: string, init: RequestInit = {}, f: typeof fetch = fetch): Promise<{ status: number; data: T }> {
  const token = await getAccessToken(cfg, f);
  let r: Response;
  try {
    r = await f(url, { signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS), ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}) } });
  } catch (e) {
    throw new GoogleApiError("network", `Google API unreachable: ${e instanceof Error ? e.message : String(e)}`);
  }
  const text = await r.text().catch(() => "");
  let body: unknown = null;
  try {
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    // an HTML error page or a truncated body: say so instead of surfacing a raw SyntaxError
    throw new GoogleApiError("http", `Google API returned a response that is not JSON (${r.status}).`, r.status);
  }
  if (!r.ok) {
    const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? r.statusText;
    if (r.status === 401) { cache().delete(cfg.clientId); throw new GoogleApiError("expired", `Google rejected the access token (401): ${msg}`, 401); }
    if (r.status === 403) throw new GoogleApiError("forbidden", `Google denied access (403): ${msg} — the granted scopes may not cover this call.`, 403);
    throw new GoogleApiError("http", `Google API error (${r.status}): ${msg}`, r.status);
  }
  return { status: r.status, data: body as T };
}
