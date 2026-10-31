// Pre-demo checklist (runner: scripts/preflight.ts). Pure pieces so they can be tested with a fake env and fetch:
//   checkEnv   key presence ("set"/"missing" only — never values, lengths or prefixes) + OUTBOUND_MODE safety
//   runPings   free, read-only health calls (Crustdata /account/credits, model lookup, the local app) — status + ms only
//   format     ✓ / ! / ✗ lines + summary; every printed string goes through redact()
import { CRUSTDATA_API_VERSION, CRUSTDATA_BASE_URL } from "./crustdata/http";

export type Env = Record<string, string | undefined>;
export type CheckStatus = "pass" | "warn" | "fail";
export type CheckResult = { id: string; label: string; status: CheckStatus; detail: string; httpStatus?: number; ms?: number };

/** Env vars whose values must never appear in output (plus any *API_KEY / SECRET / TOKEN / PASSWORD name). */
export const SECRET_ENV = [
  "CRUSTDATA_API_KEY",
  "CRUSTDATA_API_KEY_BACKUP",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DATABASE_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "ELEVENLABS_API_KEY",
] as const;
const SECRET_NAME = /API_KEY|SECRET|TOKEN|PASSWORD/i;

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";
export const DEFAULT_OPENAI_MODEL = "gpt-6.1-sol";
export const DEFAULT_APP_URL = "http://localhost:3240";

const has = (env: Env, k: string) => Boolean(env[k]?.trim());
const presence = (env: Env, k: string) => (has(env, k) ? "set" : "missing");

export function redact(text: string, env: Env): string {
  const names = new Set<string>([...SECRET_ENV, ...Object.keys(env).filter((k) => SECRET_NAME.test(k))]);
  const values = [...names]
    .flatMap((k) => [env[k], env[k]?.trim()])
    .filter((v): v is string => typeof v === "string" && v.length >= 6)
    .sort((a, b) => b.length - a.length);
  let out = text;
  for (const v of values) out = out.split(v).join("[redacted]");
  return out;
}

/** Mirrors the NL agent's modelFromEnv: Anthropic first, else OpenAI. */
export function selectModel(env: Env): { provider: "anthropic" | "openai"; model: string; keyVar: string } | null {
  if (has(env, "ANTHROPIC_API_KEY")) return { provider: "anthropic", model: env.DEALDESK_LLM_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL, keyVar: "ANTHROPIC_API_KEY" };
  if (has(env, "OPENAI_API_KEY")) return { provider: "openai", model: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL, keyVar: "OPENAI_API_KEY" };
  return null;
}

const KNOWN_OUTBOUND = ["dry_run", "live"];

/** `googleStored`: a Google sign-in saved by the in-app Connect flow (.dealdesk/google-token.json) counts as the refresh token. */
export function checkEnv(env: Env, opts: { googleStored?: boolean } = {}): CheckResult[] {
  const out: CheckResult[] = [];
  const crust = has(env, "CRUSTDATA_API_KEY");
  out.push({ id: "env.crustdata", label: "CRUSTDATA_API_KEY", status: crust ? "pass" : "fail", detail: presence(env, "CRUSTDATA_API_KEY") });
  out.push({ id: "env.crustdata_backup", label: "CRUSTDATA_API_KEY_BACKUP", status: has(env, "CRUSTDATA_API_KEY_BACKUP") ? "pass" : "warn", detail: has(env, "CRUSTDATA_API_KEY_BACKUP") ? "set (used automatically if the primary runs out of credits)" : "missing (no failover)" });

  const sel = selectModel(env);
  const keys = `ANTHROPIC_API_KEY ${presence(env, "ANTHROPIC_API_KEY")}, OPENAI_API_KEY ${presence(env, "OPENAI_API_KEY")}`;
  out.push(
    sel
      ? { id: "env.model", label: "Model key", status: "pass", detail: `${keys} → ${sel.provider} · ${sel.model}` }
      : { id: "env.model", label: "Model key", status: "fail", detail: `${keys} — need one` },
  );

  out.push({ id: "env.database", label: "DATABASE_URL", status: has(env, "DATABASE_URL") ? "pass" : "warn", detail: has(env, "DATABASE_URL") ? "set" : "missing (firm memory off)" });
  const client = has(env, "GOOGLE_CLIENT_ID") && has(env, "GOOGLE_CLIENT_SECRET");
  const refresh = has(env, "GOOGLE_REFRESH_TOKEN") || Boolean(opts.googleStored);
  out.push({
    id: "env.google",
    label: "Google OAuth",
    status: client && refresh ? "pass" : "warn",
    detail: client && refresh
      ? `set (${opts.googleStored ? "signed in from Settings" : "GOOGLE_REFRESH_TOKEN"})`
      : client ? "client set, not signed in — Settings › Connectors › Gmail › Connect"
      : `CLIENT_ID ${presence(env, "GOOGLE_CLIENT_ID")}, CLIENT_SECRET ${presence(env, "GOOGLE_CLIENT_SECRET")}, REFRESH_TOKEN ${refresh ? "set" : "missing"}`,
  });
  out.push({ id: "env.elevenlabs", label: "ELEVENLABS_API_KEY", status: has(env, "ELEVENLABS_API_KEY") ? "pass" : "warn", detail: has(env, "ELEVENLABS_API_KEY") ? "set" : "missing (no voice)" });

  // Event rule: nothing goes to third parties. dry_run (default) passes; live is allowed only as a warning because every
  // send is limited to DEMO_RECIPIENT_ALLOWLIST and needs an Approve click (same normalisation as lib/outbound).
  const liveFlag = /^(1|true|yes|on)$/i.test(env.OUTBOUND_LIVE?.trim() ?? "");
  const mode = liveFlag ? "live" : env.OUTBOUND_MODE?.trim().toLowerCase();
  if (!mode) out.push({ id: "env.outbound", label: "OUTBOUND_MODE", status: "pass", detail: "unset (dry_run)" });
  else if (mode === "dry_run") out.push({ id: "env.outbound", label: "OUTBOUND_MODE", status: "pass", detail: "dry_run" });
  else if (mode === "live") {
    const allow = (env.DEMO_RECIPIENT_ALLOWLIST?.trim() ? env.DEMO_RECIPIENT_ALLOWLIST.split(/[,;\s]+/).filter(Boolean) : ["you@example.com", "saurabhgupta0342@gmail.com"]).map((a) => a.toLowerCase());
    out.push({ id: "env.outbound", label: "OUTBOUND_MODE", status: "warn", detail: `live${liveFlag ? " (OUTBOUND_LIVE)" : ""} — real sends, only to ${allow.join(", ")}, each after an Approve click` });
  } else out.push({ id: "env.outbound", label: "OUTBOUND_MODE", status: "fail", detail: `${KNOWN_OUTBOUND.includes(mode) ? mode : "unexpected value"} — must be unset, dry_run or live` });
  return out;
}

type Hit = { ok: true; status: number; ms: number; body: string | null } | { ok: false; ms: number; reason: string };

async function timedGet(f: typeof fetch, url: string, headers: Record<string, string>, timeoutMs: number, readBody: boolean): Promise<Hit> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await f(url, { method: "GET", headers, signal: controller.signal });
    let body: string | null = null;
    if (readBody) body = await res.text();
    else await res.body?.cancel().catch(() => undefined);
    return { ok: true, status: res.status, ms: Date.now() - t0, body };
  } catch (e) {
    if (controller.signal.aborted) return { ok: false, ms: Date.now() - t0, reason: `timeout after ${Math.round(timeoutMs / 1000)} s` };
    const cause = (e as { cause?: { code?: unknown } })?.cause?.code;
    return { ok: false, ms: Date.now() - t0, reason: `${e instanceof Error ? e.message : String(e)}${typeof cause === "string" ? ` (${cause})` : ""}` };
  } finally {
    clearTimeout(timer);
  }
}

/** Remaining credits from GET /account/credits (`{ account: { credits } }`; top-level `credits` tolerated). */
export function parseCredits(body: string | null): number | null {
  if (!body) return null;
  try {
    const j = JSON.parse(body) as { account?: { credits?: unknown }; credits?: unknown } | null;
    const c = j?.account?.credits ?? j?.credits;
    return typeof c === "number" && Number.isFinite(c) ? c : null;
  } catch {
    return null;
  }
}

export function istTime(d: Date): string {
  return `${d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} IST`;
}

/** HTTP status → verdict; `soft` downgrades failures to warnings (optional checks). */
function verdict(hit: Hit, upstream: string, soft: boolean): { status: CheckStatus; detail: string } {
  const bad: CheckStatus = soft ? "warn" : "fail";
  if (!hit.ok) return { status: bad, detail: `unreachable (${hit.reason}) · ${hit.ms} ms` };
  const s = hit.status;
  const what =
    s >= 200 && s < 300 ? "ok"
    : s === 401 || s === 403 ? "key rejected"
    : s === 404 ? "not found"
    : s === 429 ? "rate limited"
    : s >= 500 ? `${upstream} down`
    : "unexpected status";
  const status: CheckStatus = what === "ok" ? "pass" : s === 429 ? "warn" : bad;
  return { status, detail: `${s} ${what} · ${hit.ms} ms` };
}

export async function runPings(env: Env, f: typeof fetch, opts: { timeoutMs?: number; now?: () => Date } = {}): Promise<CheckResult[]> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const now = opts.now ?? (() => new Date());
  const jobs: Promise<CheckResult>[] = [];
  const result = (id: string, label: string, hit: Hit, v: { status: CheckStatus; detail: string }): CheckResult => ({
    id, label, ...v, detail: redact(v.detail, env), ms: hit.ms, ...(hit.ok ? { httpStatus: hit.status } : {}),
  });

  if (has(env, "CRUSTDATA_API_KEY")) {
    jobs.push(
      timedGet(f, `${CRUSTDATA_BASE_URL}/account/credits`, { authorization: `Bearer ${env.CRUSTDATA_API_KEY!.trim()}`, "x-api-version": CRUSTDATA_API_VERSION }, timeoutMs, true).then((hit) => {
        const v = verdict(hit, "Crustdata", false);
        const credits = hit.ok && hit.status === 200 ? parseCredits(hit.body) : null;
        if (credits !== null) v.detail += ` · ${credits.toLocaleString("en-US", { maximumFractionDigits: 2 })} credits left (as returned ${istTime(now())})`;
        return result("ping.crustdata", "Crustdata API", hit, v);
      }),
    );
  }
  if (has(env, "CRUSTDATA_API_KEY_BACKUP") && env.CRUSTDATA_API_KEY_BACKUP!.trim() !== env.CRUSTDATA_API_KEY?.trim()) {
    jobs.push(
      timedGet(f, `${CRUSTDATA_BASE_URL}/account/credits`, { authorization: `Bearer ${env.CRUSTDATA_API_KEY_BACKUP!.trim()}`, "x-api-version": CRUSTDATA_API_VERSION }, timeoutMs, true).then((hit) => {
        const v = verdict(hit, "Crustdata (backup key)", false);
        if (v.status === "fail") v.status = "warn"; // the backup is optional
        const credits = hit.ok && hit.status === 200 ? parseCredits(hit.body) : null;
        if (credits !== null) v.detail += ` · ${credits.toLocaleString("en-US", { maximumFractionDigits: 2 })} credits left (as returned ${istTime(now())})`;
        return result("ping.crustdata_backup", "Crustdata API (backup key)", hit, v);
      }),
    );
  }

  const sel = selectModel(env);
  const models: { provider: "anthropic" | "openai"; keyVar: string; model: string; url: string; headers: Record<string, string> }[] = [];
  if (has(env, "ANTHROPIC_API_KEY")) {
    const model = env.DEALDESK_LLM_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
    models.push({ provider: "anthropic", keyVar: "ANTHROPIC_API_KEY", model, url: `https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`, headers: { "x-api-key": env.ANTHROPIC_API_KEY!.trim(), "anthropic-version": "2023-06-01" } });
  }
  if (has(env, "OPENAI_API_KEY")) {
    const model = env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
    models.push({ provider: "openai", keyVar: "OPENAI_API_KEY", model, url: `https://api.openai.com/v1/models/${encodeURIComponent(model)}`, headers: { authorization: `Bearer ${env.OPENAI_API_KEY!.trim()}` } });
  }
  for (const m of models) {
    const inUse = sel?.provider === m.provider;
    jobs.push(
      timedGet(f, m.url, m.headers, timeoutMs, false).then((hit) => {
        const v = verdict(hit, m.provider, !inUse);
        if (hit.ok && hit.status === 404) v.detail = `404 model not available to this key · ${hit.ms} ms`;
        v.detail = `${m.model}${inUse ? "" : " (fallback)"}: ${v.detail}`;
        return result(`ping.${m.provider}`, m.provider === "anthropic" ? "Anthropic model" : "OpenAI model", hit, v);
      }),
    );
  }

  const appUrl = (env.APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/$/, "");
  jobs.push(
    timedGet(f, `${appUrl}/landing`, {}, timeoutMs, false).then((hit) => {
      const v = verdict(hit, "app", true);
      if (v.status !== "pass") v.detail += ` — is \`npm run dev\` running on ${appUrl}?`;
      return result("ping.app", "App /landing", hit, v);
    }),
  );
  return Promise.all(jobs);
}

const MARK: Record<CheckStatus, string> = { pass: "✓", warn: "!", fail: "✗" };

export function summary(results: CheckResult[]): string {
  const n = (s: CheckStatus) => results.filter((r) => r.status === s).length;
  const failed = n("fail");
  return `${n("pass")} passed · ${n("warn")} warning${n("warn") === 1 ? "" : "s"} · ${failed} failed — ${failed ? "NOT ready to record" : "ready to record"}`;
}

export function format(results: CheckResult[], env: Env = {}): string {
  const w = Math.max(0, ...results.map((r) => r.label.length));
  const lines = results.map((r) => `${MARK[r.status]} ${r.label.padEnd(w)}  ${r.detail}`);
  return redact([...lines, "", summary(results)].join("\n"), env);
}

export function formatJson(results: CheckResult[], env: Env = {}): string {
  const clean = results.map((r) => ({ ...r, label: redact(r.label, env), detail: redact(r.detail, env) }));
  return redact(JSON.stringify(clean, null, 2), env);
}

export const hasFailures = (results: CheckResult[]) => results.some((r) => r.status === "fail");
