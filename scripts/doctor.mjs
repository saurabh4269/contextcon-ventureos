#!/usr/bin/env node
// Deal Desk doctor: verifies the real connectors with read-only calls. Prints ✓/✗ and status only — never a key/token.
//   node scripts/doctor.mjs        (reads .env.local; exit 1 if a required check fails)
// Checks: Google token refresh, Gmail read (profile + 1 message id), Calendar read (primary + next events),
// Crustdata credits (primary and backup), OpenAI model lookup. Sends nothing, creates nothing.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
for (const f of [".env.local"]) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2];
    if (v.length >= 2 && v[0] === v.at(-1) && `"'`.includes(v[0])) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
const env = (k) => process.env[k]?.trim() || "";
const secrets = Object.entries(process.env).filter(([k, v]) => v && v.length >= 8 && /KEY|SECRET|TOKEN|PASSWORD|CLIENT_ID/.test(k)).map(([, v]) => v);
const redact = (s) => secrets.reduce((a, v) => a.split(v).join("[redacted]"), String(s));
let failed = 0;
const line = (ok, label, detail, required = true) => { if (!ok && required) failed++; console.log(`${ok ? "✓" : required ? "✗" : "!"} ${label.padEnd(26)} ${redact(detail)}`); };
async function get(url, init = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    const text = await r.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: r.status, ok: r.ok, body, ms: Date.now() - t0 };
  } catch (e) { return { status: 0, ok: false, body: String(e?.cause?.code || e?.message || e), ms: Date.now() - t0 }; }
}
const why = (r) => r.status === 0 ? `unreachable (${r.body})` : `HTTP ${r.status}${typeof r.body === "object" && r.body?.error ? ` ${typeof r.body.error === "string" ? r.body.error : r.body.error.status || r.body.error.message || ""}` : ""}`;

console.log("Deal Desk doctor (values never printed)\n");

// Google
let token = null;
const tokenFile = path.join(root, ".dealdesk", "google-token.json");
let refresh = env("GOOGLE_REFRESH_TOKEN"), source = "GOOGLE_REFRESH_TOKEN";
try { const s = JSON.parse(fs.readFileSync(tokenFile, "utf8")); if (s.refreshToken) { refresh = s.refreshToken; source = "Settings sign-in"; secrets.push(s.refreshToken); } } catch {}
if (!env("GOOGLE_CLIENT_ID") || !env("GOOGLE_CLIENT_SECRET") || !refresh) {
  line(false, "Google token", `missing: ${["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter((k) => !env(k)).concat(refresh ? [] : ["GOOGLE_REFRESH_TOKEN"]).join(", ")}`);
} else {
  const r = await get("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), refresh_token: refresh, grant_type: "refresh_token" }) });
  token = r.ok ? r.body.access_token : null;
  if (token) secrets.push(token);
  line(!!token, "Google token", token ? `refreshed (${source}) · scopes: ${String(r.body.scope || "").split(" ").map((s) => s.split("/").pop()).join(", ")}` : `${why(r)}${r.body?.error === "invalid_grant" ? " — reconnect: Settings › Connectors › Gmail › Connect" : ""}`);
}
if (token) {
  const auth = { authorization: `Bearer ${token}` };
  const p = await get("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: auth });
  const l = p.ok ? await get("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1", { headers: auth }) : null;
  line(p.ok && l?.ok, "Gmail read", p.ok ? `${p.body.emailAddress} · ${p.body.messagesTotal} messages · list ${l?.ok ? "ok" : why(l)}` : why(p));
  const c = await get("https://www.googleapis.com/calendar/v3/calendars/primary", { headers: auth });
  const e = c.ok ? await get(`https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=3&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(new Date().toISOString())}`, { headers: auth }) : null;
  line(c.ok && e?.ok, "Calendar read", c.ok ? `${c.body.id} (${c.body.timeZone}) · ${e?.ok ? `${e.body.items?.length ?? 0} upcoming` : why(e)}` : why(c));
}

// Crustdata
for (const [k, required] of [["CRUSTDATA_API_KEY", true], ["CRUSTDATA_API_KEY_BACKUP", false]]) {
  if (!env(k)) { line(false, k, "missing", required); continue; }
  const r = await get("https://api.crustdata.com/account/credits", { headers: { authorization: `Bearer ${env(k)}`, "x-api-version": "2025-11-01" } });
  const credits = r.ok ? (r.body?.account?.credits ?? r.body?.credits ?? r.body?.remaining_credits) : null;
  line(r.ok, `Crustdata ${required ? "(primary)" : "(backup)"}`, r.ok ? `${credits ?? "?"} credits · ${r.ms} ms` : why(r), required);
}

// OpenAI
if (env("OPENAI_API_KEY")) {
  const model = env("OPENAI_MODEL") || "gpt-6.1-sol";
  const r = await get(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, { headers: { authorization: `Bearer ${env("OPENAI_API_KEY")}` } });
  line(r.ok, "OpenAI model", r.ok ? `${model} reachable` : `${model}: ${why(r)} (the /agent page works without a model)`);
} else line(false, "OpenAI model", "OPENAI_API_KEY missing (the /agent page works without a model)", false);

const mode = /^(1|true|yes|on)$/i.test(env("OUTBOUND_LIVE")) ? "live" : env("OUTBOUND_MODE") || "dry_run";
line(true, "Outbound", mode === "live" ? `LIVE — only to ${env("DEMO_RECIPIENT_ALLOWLIST") || "you@example.com,saurabhgupta0342@gmail.com"}, each after an Approve click` : "dry_run (approving shows the email; nothing is sent)");
console.log(failed ? `\n${failed} required check(s) failed.` : "\nAll required checks passed.");
process.exit(failed ? 1 : 0);
