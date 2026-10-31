// Real connector status for GET /api/integrations/connectors (shape documented in docs/API.md).
// Only the connectors Deal Desk really integrates are listed (Crustdata, AI model, AgentMail, Slack, Fireflies, Gmail,
// Google Calendar/Meet). Catalogue tiles (Affinity, Attio, Carta, PitchBook, …) are UI-only and get no status here.
// Status comes only from configuration and live health checks — never from timers or fixtures:
//   not_configured  required env vars missing
//   connected       a free health call succeeded (Crustdata: GET /account/credits, 0 credits)
//   error           configured, but the health call failed or the integration cannot work in this build
import type { IntegrationInfo, IntegrationStatus } from "./types";
import { GOOGLE_CLIENT_ENV, GoogleApiError, googleConfig, type GoogleConfig } from "@/lib/google/oauth";
import { readStoredToken } from "@/lib/google/token-store";
import { gmailProfile } from "@/lib/google/gmail";
import { primaryCalendar } from "@/lib/google/calendar";

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;
type Check = { ok: true; detail: string } | { ok: false; detail: string };

type Spec = {
  id: string;
  name: string;
  docsUrl: string;
  /** env vars that configure it; `envMode` "all" (default) or "any" */
  env: string[];
  envMode?: "all" | "any";
  /** true when this build calls it */
  wired: boolean;
  /** extra configuration requirement beyond env presence; returns the "not connected" message or null */
  needs?: (env: Env) => string | null;
  /** free, read-only health call; absent ⇒ "configured but not implemented in this build" */
  check?: (env: Env, f: Fetch) => Promise<Check>;
};

const TIMEOUT_MS = 8000;

async function getJson(f: Fetch, url: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await f(url, { ...init, signal: ctl.signal });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text.slice(0, 200);
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

const errMsg = (body: unknown) => {
  const b = body as { error?: string | { message?: string }; message?: string } | null;
  return typeof b?.error === "object" ? b.error?.message : (b?.error ?? b?.message ?? (typeof body === "string" ? body : undefined));
};

async function googleCheck(env: Env, _f: Fetch, run: (cfg: GoogleConfig) => Promise<string>): Promise<Check> {
  const cfg = googleConfig(env);
  if (!cfg) return { ok: false, detail: "Google OAuth env incomplete" };
  try { return { ok: true, detail: await run(cfg) }; }
  catch (e) { return { ok: false, detail: e instanceof GoogleApiError ? e.message : `Google check failed: ${e instanceof Error ? e.message : String(e)}` }; }
}

const tokenSource = (env: Env) => (readStoredToken() ? "signed in from Settings" : env.GOOGLE_REFRESH_TOKEN?.trim() ? "GOOGLE_REFRESH_TOKEN" : "no token");
const googleNeeds = (env: Env) => (googleConfig(env) ? null : "Not connected: click Connect to sign in with Google (or set GOOGLE_REFRESH_TOKEN).");

export const INTEGRATION_SPECS: Spec[] = [
  {
    id: "crustdata",
    name: "Crustdata",
    docsUrl: "https://docs.crustdata.com/api-reference/account-apis/get-account-credit-balance",
    env: ["CRUSTDATA_API_KEY"],
    wired: true,
    check: async (env, f) => {
      const { status, body } = await getJson(f, "https://api.crustdata.com/account/credits", {
        headers: { authorization: `Bearer ${env.CRUSTDATA_API_KEY!.trim()}`, "x-api-version": "2025-11-01" },
      });
      if (status !== 200) return { ok: false, detail: `GET /account/credits → ${status}${errMsg(body) ? `: ${errMsg(body)}` : ""}` };
      const credits = (body as { account?: { credits?: number } } | null)?.account?.credits;
      return { ok: true, detail: `API key valid (GET /account/credits, 0 credits)${typeof credits === "number" ? ` · ${Math.floor(credits).toLocaleString("en-US")} credits left` : ""}` };
    },
  },
  {
    // The "AI model" tile: one connector, satisfied by either provider key (Anthropic checked first).
    id: "llm",
    name: "AI model (Anthropic / OpenAI)",
    docsUrl: "https://docs.anthropic.com/en/api/models-list",
    env: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
    envMode: "any",
    wired: true, // used by the voice greeting (src/lib/voice/greeting.ts) when a key is set
    check: async (env, f) => {
      if (env.ANTHROPIC_API_KEY?.trim()) {
        const { status, body } = await getJson(f, "https://api.anthropic.com/v1/models?limit=1", {
          headers: { "x-api-key": env.ANTHROPIC_API_KEY.trim(), "anthropic-version": "2023-06-01" },
        });
        return status === 200 ? { ok: true, detail: "Anthropic key valid (GET /v1/models)" } : { ok: false, detail: `Anthropic GET /v1/models → ${status}${errMsg(body) ? `: ${errMsg(body)}` : ""}` };
      }
      const { status, body } = await getJson(f, "https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${env.OPENAI_API_KEY!.trim()}` } });
      return status === 200 ? { ok: true, detail: "OpenAI key valid (GET /v1/models)" } : { ok: false, detail: `OpenAI GET /v1/models → ${status}${errMsg(body) ? `: ${errMsg(body)}` : ""}` };
    },
  },
  {
    id: "agentmail",
    name: "AgentMail",
    docsUrl: "https://docs.agentmail.to/api-reference/inboxes/list",
    env: ["AGENTMAIL_API_KEY"],
    wired: false,
    check: async (env, f) => {
      const { status, body } = await getJson(f, "https://api.agentmail.to/v0/inboxes?limit=1", { headers: { authorization: `Bearer ${env.AGENTMAIL_API_KEY!.trim()}` } });
      return status === 200 ? { ok: true, detail: "API key valid (GET /v0/inboxes)" } : { ok: false, detail: `GET /v0/inboxes → ${status}${errMsg(body) ? `: ${errMsg(body)}` : ""}` };
    },
  },
  {
    id: "slack",
    name: "Slack",
    docsUrl: "https://api.slack.com/methods/auth.test",
    env: ["SLACK_BOT_TOKEN"],
    wired: false,
    check: async (env, f) => {
      const { status, body } = await getJson(f, "https://slack.com/api/auth.test", { method: "POST", headers: { authorization: `Bearer ${env.SLACK_BOT_TOKEN!.trim()}` } });
      const b = body as { ok?: boolean; error?: string; team?: string } | null;
      return status === 200 && b?.ok ? { ok: true, detail: `Bot token valid (auth.test${b.team ? ` · ${b.team}` : ""})` } : { ok: false, detail: `auth.test → ${b?.error ?? status}` };
    },
  },
  {
    id: "fireflies",
    name: "Fireflies",
    docsUrl: "https://docs.fireflies.ai/graphql-api/query/user",
    env: ["FIREFLIES_API_KEY"],
    wired: false,
    check: async (env, f) => {
      const { status, body } = await getJson(f, "https://api.fireflies.ai/graphql", {
        method: "POST",
        headers: { authorization: `Bearer ${env.FIREFLIES_API_KEY!.trim()}`, "content-type": "application/json" },
        body: JSON.stringify({ query: "{ user { user_id } }" }),
      });
      const b = body as { data?: { user?: unknown }; errors?: { message?: string }[] } | null;
      return status === 200 && b?.data?.user ? { ok: true, detail: "API key valid (GraphQL user query)" } : { ok: false, detail: `GraphQL user → ${b?.errors?.[0]?.message ?? status}` };
    },
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs (voice)",
    docsUrl: "https://elevenlabs.io/docs/api-reference/voices/search",
    env: ["ELEVENLABS_API_KEY"],
    wired: true,
    // GET /v1/voices works with a TTS-scoped key (GET /v1/user does not), and costs nothing.
    check: async (env, f) => {
      const { status, body } = await getJson(f, "https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY!.trim() } });
      const detail = (body as { detail?: { message?: string } | string } | null)?.detail;
      return status === 200
        ? { ok: true, detail: "API key valid (GET /v1/voices) · used by the voice greeting on Today" }
        : { ok: false, detail: `GET /v1/voices → ${status}${detail ? `: ${typeof detail === "string" ? detail : detail.message}` : ""}` };
    },
  },
  // Google: OAuth client + a stored refresh token (offline access). Health = token refresh + one cheap read.
  {
    id: "gmail",
    name: "Gmail",
    docsUrl: "https://developers.google.com/gmail/api/reference/rest/v1/users/getProfile",
    env: [...GOOGLE_CLIENT_ENV],
    needs: googleNeeds,
    wired: true,
    check: async (env, f) => googleCheck(env, f, async (cfg) => { const p = await gmailProfile(cfg, f); return `Connected as ${p.emailAddress ?? "(unknown account)"} (${tokenSource(env)}; token refresh + GET users/me/profile) · inbox on Today, approved sends from the memo`; }),
  },
  {
    id: "calendar",
    name: "Google Calendar / Meet",
    docsUrl: "https://developers.google.com/calendar/api/v3/reference/calendarList/get",
    env: [...GOOGLE_CLIENT_ENV],
    needs: googleNeeds,
    wired: true,
    check: async (env, f) => googleCheck(env, f, async (cfg) => { const c = await primaryCalendar(cfg, f); return `Connected as ${c.id} (${tokenSource(env)}; token refresh + GET calendarList/primary) · meetings on Today, free slots and approved bookings from the memo`; }),
  },
];

type Cached = { at: number; info: IntegrationInfo };
const g = globalThis as unknown as { __dealdeskIntegrationChecks?: Map<string, Cached> };
const HEALTH_TTL_MS = 5 * 60 * 1000;

/** Missing env var names; for envMode "any", nothing is missing as soon as one is set. */
const missingEnv = (env: Env, spec: Spec) => {
  const missing = spec.env.filter((n) => !env[n]?.trim());
  return spec.envMode === "any" && missing.length < spec.env.length ? [] : missing;
};

export async function checkIntegration(spec: Spec, env: Env, f: Fetch, now = () => new Date()): Promise<IntegrationInfo> {
  const base = { id: spec.id, name: spec.name, wired: spec.wired, env: spec.env, docsUrl: spec.docsUrl };
  const info = (status: IntegrationStatus, mode: IntegrationInfo["mode"], detail: string, checked: boolean): IntegrationInfo => ({
    ...base,
    status,
    mode,
    detail,
    lastCheckedAt: checked ? now().toISOString() : null,
  });
  const missing = missingEnv(env, spec);
  if (missing.length) return info("not_configured", "env", `Not connected: set ${missing.join(spec.envMode === "any" ? " or " : ", ")} on the server.`, false);
  const need = spec.needs?.(env);
  if (need) return info("not_configured", "env", need, false);
  if (!spec.check) return info("error", "env", "Credentials are set, but this build has no OAuth flow for it yet, so nothing can use them.", false);
  try {
    const r = await spec.check(env, f);
    if (!r.ok) return info("error", "live_check", r.detail, true);
    return info("connected", "live_check", spec.wired ? r.detail : `${r.detail} · not used by this build yet`, true);
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return info("error", "live_check", aborted ? `Health check timed out after ${TIMEOUT_MS / 1000}s` : `Health check failed: ${e instanceof Error ? e.message : String(e)}`, true);
  }
}

/** All connectors; successful/failed live checks are cached for 5 minutes per process (keyed by config, not secrets). */
export async function listIntegrations(env: Env = process.env, f: Fetch = fetch, { fresh = false } = {}): Promise<IntegrationInfo[]> {
  const cache = (g.__dealdeskIntegrationChecks ??= new Map());
  return Promise.all(
    INTEGRATION_SPECS.map(async (spec) => {
      // cache key: which env vars are set (never their values) — changing config invalidates it
      const key = `${spec.id}:${spec.env.map((n) => (env[n]?.trim() ? 1 : 0)).join("")}`;
      const hit = cache.get(key);
      if (!fresh && hit && Date.now() - hit.at < HEALTH_TTL_MS) return hit.info;
      const info = await checkIntegration(spec, env, f);
      if (info.mode === "live_check") cache.set(key, { at: Date.now(), info });
      return info;
    }),
  );
}
