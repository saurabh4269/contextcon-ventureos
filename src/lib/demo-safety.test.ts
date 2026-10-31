// Real-demo setup: recipient allowlist, approval gate, the approved email/calendar routes, Google sign-in URL,
// RFC 2822 message building, free-slot finder, and the Crustdata backup-key failover.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRecipients, clearApprovals, consumeApproval, createApproval, APPROVAL_TTL_MS, outboundMode, recipientAllowlist } from "./outbound";
import { buildAuthUrl, clearGoogleTokenCache, googleConfig, redirectUri, GOOGLE_SCOPES } from "./google/oauth";
import { buildRawMessage } from "./google/gmail";
import { freeSlots } from "./google/calendar";
import { createCrustdataClient, BACKUP_KEY_NOTE } from "./crustdata/client";
import { POST as emailPOST, GET as emailGET } from "@/app/api/outbound/email/route";
import { POST as calendarPOST } from "@/app/api/connectors/calendar/events/route";
import { GET as startGET } from "@/app/api/oauth/google/start/route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/memory/store", () => ({ recordMemory: async () => ({ status: "unavailable", reason: "test" }) }));

const ENV_KEYS = ["OUTBOUND_MODE", "OUTBOUND_LIVE", "DEMO_RECIPIENT_ALLOWLIST", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "GOOGLE_REDIRECT_URI", "GOOGLE_LOGIN_HINT"];
const saved: Record<string, string | undefined> = {};
beforeEach(() => { for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; } process.env.DEMO_RECIPIENT_ALLOWLIST = TEAM.DEMO_RECIPIENT_ALLOWLIST; clearApprovals(); clearGoogleTokenCache(); });
afterEach(() => { for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } vi.unstubAllGlobals(); });

const ME = "you@example.com";
const MATE = "teammate@example.com";
const TEAM = { DEMO_RECIPIENT_ALLOWLIST: `${ME},${MATE}` };
const post = (url: string, body: unknown) => new Request(`http://localhost:3000${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const mail = { to: [ME], subject: "Deal Desk · IC memo · e2b.dev", body: "Headcount: 42" };

describe("outbound mode and recipient allowlist", () => {
  it("OUTBOUND_LIVE=1 is live; default dry_run", () => {
    expect(outboundMode({})).toBe("dry_run");
    expect(outboundMode({ OUTBOUND_LIVE: "1" })).toBe("live");
    expect(outboundMode({ OUTBOUND_LIVE: "0", OUTBOUND_MODE: "dry_run" })).toBe("dry_run");
  });
  it("has no built-in addresses (unset blocks everyone); env list is parsed and lowercased", () => {
    expect(recipientAllowlist({})).toEqual([]);
    expect(checkRecipients([ME], {}).ok).toBe(false);
    expect(recipientAllowlist({ DEMO_RECIPIENT_ALLOWLIST: " A@x.com; b@y.io  c@z.dev" })).toEqual(["a@x.com", "b@y.io", "c@z.dev"]);
  });
  it("allows team addresses (case-insensitive), blocks anyone else with a clear message", () => {
    expect(checkRecipients(["You@Example.com"], TEAM)).toMatchObject({ ok: true });
    const r = checkRecipients([ME, "founder@startup.com"], TEAM);
    expect(r).toMatchObject({ ok: false, blocked: ["founder@startup.com"] });
    if (!r.ok) expect(r.message).toMatch(/founder@startup\.com is not on the demo allowlist/);
    expect(checkRecipients([], {}).ok).toBe(false);
    expect(checkRecipients(["not-an-email"], {}).ok).toBe(false);
  });
});

describe("approval gate", () => {
  it("is single use and bound to the exact payload", () => {
    const a = createApproval("k", { x: 1, y: [2] });
    expect(consumeApproval(a.token, "k", { y: [2], x: 1 })).toEqual({ ok: true }); // key order doesn't matter
    expect(consumeApproval(a.token, "k", { x: 1, y: [2] })).toMatchObject({ ok: false, reason: "unknown" });
    const b = createApproval("k", { x: 1 });
    expect(consumeApproval(b.token, "k", { x: 2 })).toMatchObject({ ok: false, reason: "mismatch" });
    const c = createApproval("k", { x: 1 });
    expect(consumeApproval(c.token, "other", { x: 1 })).toMatchObject({ ok: false, reason: "mismatch" });
  });
  it("rejects missing and expired tokens", () => {
    expect(consumeApproval(undefined, "k", {})).toMatchObject({ ok: false, reason: "missing" });
    let t = 1_000;
    const a = createApproval("k", {}, () => t);
    t += APPROVAL_TTL_MS + 1;
    expect(consumeApproval(a.token, "k", {}, () => t)).toMatchObject({ ok: false, reason: "expired" });
  });
});

describe("POST /api/outbound/email", () => {
  it("GET reports mode and allowlist", async () => {
    expect(await (await emailGET()).json()).toMatchObject({ mode: "dry_run", allowlist: [ME, MATE] });
  });
  it("blocks a non-allowlisted recipient at preview (403) — even in live mode, Google is never called", async () => {
    process.env.OUTBOUND_MODE = "live";
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    const r = await emailPOST(post("/api/outbound/email", { ...mail, action: "preview", to: ["vc@fund.com"] }));
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ status: "blocked", blocked: ["vc@fund.com"] });
    expect(f).not.toHaveBeenCalled();
  });
  it("send without the preview's approval token is refused (428)", async () => {
    process.env.OUTBOUND_MODE = "live";
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    const r = await emailPOST(post("/api/outbound/email", { ...mail, action: "send" }));
    expect(r.status).toBe(428);
    expect(await r.json()).toMatchObject({ status: "not_approved", reason: "missing" });
    expect(f).not.toHaveBeenCalled();
  });
  it("an approval for one message can't send an edited one", async () => {
    const p = await (await emailPOST(post("/api/outbound/email", { ...mail, action: "preview" }))).json();
    const r = await emailPOST(post("/api/outbound/email", { ...mail, body: "something else", action: "send", approvalToken: p.approval.token }));
    expect(r.status).toBe(428);
    expect((await r.json()).reason).toBe("mismatch");
  });
  it("dry run: preview → approve returns the would-send message and calls nothing", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    const p = await (await emailPOST(post("/api/outbound/email", { ...mail, action: "preview" }))).json();
    expect(p).toMatchObject({ status: "ok", mode: "dry_run", approval: { token: expect.any(String) } });
    const r = await emailPOST(post("/api/outbound/email", { ...mail, action: "send", approvalToken: p.approval.token }));
    expect(await r.json()).toMatchObject({ transport: "dry_run", wouldSend: { to: [ME], subject: mail.subject } });
    expect(f).not.toHaveBeenCalled();
  });
  it("live: preview → approve sends exactly that message through Gmail", async () => {
    Object.assign(process.env, { OUTBOUND_MODE: "live", GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "cs", GOOGLE_REFRESH_TOKEN: "rt" });
    const sent: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }), { status: 200 });
      if (url.endsWith("/gmail/v1/users/me/messages/send")) { sent.push(JSON.parse(String(init?.body)).raw); return new Response(JSON.stringify({ id: "m1", threadId: "t1" }), { status: 200 }); }
      return new Response("{}", { status: 404 });
    }));
    const p = await (await emailPOST(post("/api/outbound/email", { ...mail, action: "preview" }))).json();
    expect(sent).toHaveLength(0); // preview never sends
    const r = await emailPOST(post("/api/outbound/email", { ...mail, action: "send", approvalToken: p.approval.token }));
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ transport: "live", message: { id: "m1" } });
    expect(sent).toHaveLength(1);
    expect(Buffer.from(sent[0]!, "base64url").toString("utf8")).toContain(`To: ${ME}`);
    // the token is spent: replaying it sends nothing
    const again = await emailPOST(post("/api/outbound/email", { ...mail, action: "send", approvalToken: p.approval.token }));
    expect(again.status).toBe(428);
    expect(sent).toHaveLength(1);
  });
});

describe("calendar booking gate", () => {
  const ev = { summary: "Follow-up", start: "2026-11-02T05:30:00Z", end: "2026-11-02T06:00:00Z", attendees: [ME] };
  it("blocks non-allowlisted attendees", async () => {
    const r = await calendarPOST(post("/api/connectors/calendar/events", { ...ev, attendees: ["x@y.com"] }));
    expect(r.status).toBe(403);
  });
  it("live insert needs the approval token", async () => {
    Object.assign(process.env, { OUTBOUND_MODE: "live", GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "cs", GOOGLE_REFRESH_TOKEN: "rt" });
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    const r = await calendarPOST(post("/api/connectors/calendar/events", ev));
    expect(r.status).toBe(428);
    expect(f).not.toHaveBeenCalled();
    const p = await (await calendarPOST(post("/api/connectors/calendar/events", { ...ev, action: "preview" }))).json();
    expect(p).toMatchObject({ mode: "live", approval: { token: expect.any(String) } });
  });
});

describe("Google sign-in", () => {
  it("start route returns the consent URL for the registered callback with offline access", async () => {
    Object.assign(process.env, { GOOGLE_CLIENT_ID: "cid.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "cs", GOOGLE_LOGIN_HINT: ME });
    const r = await startGET(new Request("http://localhost:3000/api/oauth/google/start?format=json"));
    const j = await r.json();
    expect(j.redirectUri).toBe("http://localhost:3000/api/oauth/google/callback");
    const u = new URL(j.url);
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ client_id: "cid.apps.googleusercontent.com", redirect_uri: j.redirectUri, response_type: "code", access_type: "offline", prompt: "consent", login_hint: ME });
    expect(u.searchParams.get("scope")!.split(" ")).toEqual([...GOOGLE_SCOPES]);
    expect(r.headers.get("set-cookie")).toContain(`dd_google_oauth_state=${u.searchParams.get("state")}`);
  });
  it("start route without a client is not_configured (503)", async () => {
    expect((await startGET(new Request("http://localhost:3000/api/oauth/google/start"))).status).toBe(503);
  });
  it("redirectUri prefers GOOGLE_REDIRECT_URI; buildAuthUrl omits an empty hint", () => {
    expect(redirectUri("http://localhost:3240", {})).toBe("http://localhost:3240/api/oauth/google/callback");
    expect(redirectUri("http://x", { GOOGLE_REDIRECT_URI: "http://localhost:3000/api/oauth/google/callback" })).toBe("http://localhost:3000/api/oauth/google/callback");
    expect(new URL(buildAuthUrl({ clientId: "c", redirectUri: "r", state: "s" })).searchParams.has("login_hint")).toBe(false);
  });
  it("a stored sign-in takes precedence over GOOGLE_REFRESH_TOKEN", () => {
    const env = { GOOGLE_CLIENT_ID: "c", GOOGLE_CLIENT_SECRET: "s", GOOGLE_REFRESH_TOKEN: "env" };
    expect(googleConfig(env, () => ({ refreshToken: "stored" }))?.refreshToken).toBe("stored");
    expect(googleConfig(env, () => null)?.refreshToken).toBe("env");
    expect(googleConfig({ GOOGLE_CLIENT_ID: "c", GOOGLE_CLIENT_SECRET: "s" }, () => null)).toBeNull();
  });
});

describe("Gmail message and free slots", () => {
  it("builds an RFC 2822 message, encoding a non-ASCII subject", () => {
    const raw = Buffer.from(buildRawMessage({ to: [ME], subject: "IC memo · E2B", body: "Hi\nthere" }), "base64url").toString("utf8");
    expect(raw).toMatch(/^To: you@example\.com\r\n/);
    expect(raw).toContain("Subject: =?UTF-8?B?");
    expect(raw).toContain("Content-Type: text/plain; charset=UTF-8");
  });
  it("skips busy time and weekends, inside 10:00–19:00 IST", () => {
    const now = new Date("2026-10-30T03:30:00Z"); // Fri 09:00 IST
    const busy = [{ start: "2026-10-30T04:30:00Z", end: "2026-10-30T05:30:00Z" }]; // 10:00–11:00 IST
    expect(freeSlots(busy, { now, minutes: 30, count: 3, days: 5 }).map((s) => s.start)).toEqual(["2026-10-30T05:30:00.000Z", "2026-10-30T06:00:00.000Z", "2026-10-30T06:30:00.000Z"]);
    const late = new Date("2026-10-30T13:15:00Z"); // Fri 18:45 IST → next is Mon 10:00 IST
    expect(freeSlots([], { now: late, minutes: 30, count: 1, days: 5 })[0]!.start).toBe("2026-11-02T04:30:00.000Z");
  });
});

describe("Crustdata backup key failover", () => {
  const ok = () => new Response(JSON.stringify([{ matches: [] }]), { status: 200, headers: { "content-type": "application/json" } });
  const fakeFetch = (primary: () => Response) => {
    const auth: string[] = [];
    const f = (async (_url: string, init: RequestInit) => {
      const a = (init.headers as Record<string, string>).authorization ?? (init.headers as Record<string, string>).Authorization;
      auth.push(a === "Bearer primary-k" ? "primary" : a === "Bearer backup-k" ? "backup" : "other");
      return a === "Bearer primary-k" ? primary() : ok();
    }) as unknown as typeof fetch;
    return { f, auth };
  };
  it("402 on the primary switches to the backup, labels the result, and stays on the backup", async () => {
    const { f, auth } = fakeFetch(() => new Response(JSON.stringify({ error: "Insufficient credits" }), { status: 402 }));
    const events: { status: string; key?: string; error?: string }[] = [];
    const c = createCrustdataClient({ apiKey: "primary-k", backupApiKey: "backup-k", fetchImpl: f, sleep: async () => {}, onLiveCall: (e) => events.push(e) });
    const r = await c.identifyCompany({ query_company_website: "e2b.dev" } as never);
    expect(r.meta).toMatchObject({ keyUsed: "backup", keyNote: BACKUP_KEY_NOTE, cached: false });
    expect(events.map((e) => [e.status, e.key])).toEqual([["error", "primary"], ["ok", "backup"]]);
    expect(events[0]!.error).toMatch(/switching to CRUSTDATA_API_KEY_BACKUP/);
    await c.identifyCompany({ query_company_website: "openai.com" } as never);
    expect(auth.filter((a) => a === "primary")).toHaveLength(1); // sticky
    expect(auth.filter((a) => a === "backup")).toHaveLength(2);
  });
  it("a plain 429 rate limit does not burn the backup key", async () => {
    const { f, auth } = fakeFetch(() => new Response(JSON.stringify({ error: "Too many requests" }), { status: 429, headers: { "retry-after": "0" } }));
    const c = createCrustdataClient({ apiKey: "primary-k", backupApiKey: "backup-k", fetchImpl: f, sleep: async () => {} });
    await expect(c.identifyCompany({ query_company_website: "e2b.dev" } as never)).rejects.toThrow();
    expect(auth).not.toContain("backup");
  });
  it("without a backup key the 402 surfaces as before", async () => {
    const { f } = fakeFetch(() => new Response(JSON.stringify({ error: "Insufficient credits" }), { status: 402 }));
    const c = createCrustdataClient({ apiKey: "primary-k", backupApiKey: "", fetchImpl: f, sleep: async () => {} });
    await expect(c.identifyCompany({ query_company_website: "e2b.dev" } as never)).rejects.toThrow();
  });
});
