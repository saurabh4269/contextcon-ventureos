// Google OAuth 2.0 (server only): exchange the stored refresh token for short-lived access tokens
// (POST https://oauth2.googleapis.com/token, grant_type=refresh_token — developers.google.com/identity/protocols/oauth2/web-server#offline).
// Access tokens are cached in process memory until shortly before `expires_in`; nothing is persisted or logged.
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

export function googleConfig(env: Record<string, string | undefined> = process.env): GoogleConfig | null {
  const [clientId, clientSecret, refreshToken] = GOOGLE_ENV.map((k) => env[k]?.trim());
  return clientId && clientSecret && refreshToken ? { clientId, clientSecret, refreshToken } : null;
}

type Cached = { token: string; expiresAt: number };
const g = globalThis as unknown as { __dealdeskGoogleTokens?: Map<string, Cached> };
const cache = () => (g.__dealdeskGoogleTokens ??= new Map());
export const clearGoogleTokenCache = () => cache().clear();

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
    r = await f(url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}) } });
  } catch (e) {
    throw new GoogleApiError("network", `Google API unreachable: ${e instanceof Error ? e.message : String(e)}`);
  }
  const text = await r.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!r.ok) {
    const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? r.statusText;
    if (r.status === 401) { cache().delete(cfg.clientId); throw new GoogleApiError("expired", `Google rejected the access token (401): ${msg}`, 401); }
    if (r.status === 403) throw new GoogleApiError("forbidden", `Google denied access (403): ${msg} — the granted scopes may not cover this call.`, 403);
    throw new GoogleApiError("http", `Google API error (${r.status}): ${msg}`, r.status);
  }
  return { status: r.status, data: body as T };
}
