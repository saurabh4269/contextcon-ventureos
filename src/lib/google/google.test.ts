import { beforeEach, describe, expect, it } from "vitest";
import { clearGoogleTokenCache, getAccessToken, GoogleApiError, googleConfig, TOKEN_URL } from "./oauth";
import { listInboxThreads, parseFrom } from "./gmail";
import { deleteEvent, insertEvent, listUpcoming } from "./calendar";

const cfg = { clientId: "cid", clientSecret: "secret", refreshToken: "rt" };
const json = (status: number, body: unknown) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
type Call = { url: string; init?: RequestInit };
const mock = (handler: (url: string, init?: RequestInit) => Response) => {
  const calls: Call[] = [];
  const f = (async (u: RequestInfo | URL, init?: RequestInit) => { calls.push({ url: String(u), init }); return handler(String(u), init); }) as typeof fetch;
  return { f, calls };
};
const tokenOk = (url: string) => (url === TOKEN_URL ? json(200, { access_token: "at-1", expires_in: 3600, token_type: "Bearer" }) : null);

beforeEach(() => clearGoogleTokenCache());

describe("Google OAuth refresh", () => {
  it("needs all three env vars", () => {
    expect(googleConfig({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" })).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", GOOGLE_REFRESH_TOKEN: "c" })).toEqual({ clientId: "a", clientSecret: "b", refreshToken: "c" });
  });
  it("exchanges the refresh token (form-encoded grant_type=refresh_token) and caches until shortly before expiry", async () => {
    const { f, calls } = mock((u) => tokenOk(u)!);
    let t = 0;
    expect(await getAccessToken(cfg, f, () => t)).toBe("at-1");
    const body = new URLSearchParams(String(calls[0]!.init!.body));
    expect(Object.fromEntries(body)).toEqual({ client_id: "cid", client_secret: "secret", refresh_token: "rt", grant_type: "refresh_token" });
    t = 3_000_000; // 50 min later: still cached
    await getAccessToken(cfg, f, () => t);
    expect(calls).toHaveLength(1);
    t = 3_560_000; // within the early-refresh margin
    await getAccessToken(cfg, f, () => t);
    expect(calls).toHaveLength(2);
  });
  it("invalid_grant → typed 'expired — reconnect' error", async () => {
    const { f } = mock(() => json(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }));
    await expect(getAccessToken(cfg, f)).rejects.toMatchObject({ code: "expired", message: expect.stringContaining("reconnect") });
  });
  it("invalid_client → typed error naming the env vars", async () => {
    const { f } = mock(() => json(401, { error: "invalid_client" }));
    const e = await getAccessToken(cfg, f).catch((x) => x);
    expect(e).toBeInstanceOf(GoogleApiError);
    expect(e.code).toBe("invalid_client");
  });
});

describe("Gmail", () => {
  it("lists INBOX threads after a time and reads metadata only", async () => {
    const { f, calls } = mock((u) => tokenOk(u) ?? (u.includes("/threads?")
      ? json(200, { threads: [{ id: "t1", snippet: "See the deck" }, { id: "t2" }], resultSizeEstimate: 2 })
      : u.includes("/threads/t1") ? json(200, { id: "t1", messages: [{ internalDate: "1761872400000", labelIds: ["INBOX", "UNREAD"], payload: { headers: [{ name: "From", value: "Ana Ruiz <ana@example.com>" }, { name: "Subject", value: "Deck" }] } }] })
      : json(200, { id: "t2", messages: [{ internalDate: "1761868800000", labelIds: ["INBOX"], payload: { headers: [{ name: "From", value: "bob@example.com" }] } }] })));
    const r = await listInboxThreads(cfg, { after: new Date("2026-10-30T18:30:00Z"), max: 5 }, f);
    const list = calls.find((c) => c.url.includes("/threads?"))!.url;
    expect(list).toContain("labelIds=INBOX");
    expect(decodeURIComponent(list)).toContain(`q=after:${Date.parse("2026-10-30T18:30:00Z") / 1000}`);
    expect(calls.filter((c) => c.url.includes("/threads/")).every((c) => c.url.includes("format=metadata"))).toBe(true);
    expect(calls.every((c) => !/messages\/send|\/send/.test(c.url))).toBe(true);
    expect(r.threads).toEqual([
      { id: "t1", from: "Ana Ruiz", fromAddress: "ana@example.com", subject: "Deck", snippet: "See the deck", companyDomain: "example.com", lastMessageAt: "2025-10-31T01:00:00.000Z", messages: 1, unread: true },
      { id: "t2", from: "bob@example.com", fromAddress: "bob@example.com", subject: "(no subject)", snippet: "", companyDomain: "example.com", lastMessageAt: "2025-10-31T00:00:00.000Z", messages: 1, unread: false },
    ]);
    expect((calls[1]!.init!.headers as Record<string, string>).authorization).toBe("Bearer at-1");
  });
  it("parses From headers", () => {
    expect(parseFrom('"Doe, Jane" <jane@x.io>')).toEqual({ name: "Doe, Jane", address: "jane@x.io" });
  });
  it("403 → forbidden with Google's message", async () => {
    const { f } = mock((u) => tokenOk(u) ?? json(403, { error: { message: "Request had insufficient authentication scopes." } }));
    await expect(listInboxThreads(cfg, { max: 1 }, f)).rejects.toMatchObject({ code: "forbidden", httpStatus: 403 });
  });
});

describe("Calendar", () => {
  it("lists upcoming single events ordered by start time", async () => {
    const { f, calls } = mock((u) => tokenOk(u) ?? json(200, { items: [{ id: "e1", summary: "IC", start: { dateTime: "2026-11-01T10:00:00+05:30" }, end: { dateTime: "2026-11-01T10:30:00+05:30" }, attendees: [{}, {}] }, { id: "e2", start: { date: "2026-11-02" }, end: { date: "2026-11-03" } }] }));
    const from = new Date("2026-10-31T07:00:00Z");
    const ev = await listUpcoming(cfg, { from, max: 5 }, f);
    const url = new URL(calls[1]!.url);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ timeMin: from.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "5" });
    expect(ev[0]).toMatchObject({ id: "e1", start: "2026-11-01T04:30:00.000Z", attendees: 2, allDay: false });
    expect(ev[1]).toMatchObject({ summary: "(no title)", allDay: true, start: "2026-11-02" });
  });
  it("inserts with sendUpdates=none and deletes (204, or 410 when already gone)", async () => {
    const { f, calls } = mock((u, init) => tokenOk(u) ?? (init?.method === "POST" ? json(200, { id: "new1", summary: "x", start: { dateTime: "2026-11-01T10:00:00Z" }, end: { dateTime: "2026-11-01T10:15:00Z" } }) : u.includes("never") ? json(404, { error: { message: "Not Found" } }) : u.includes("gone") ? json(410, { error: { message: "Resource has been deleted" } }) : json(204, null)));
    const m = await insertEvent(cfg, { summary: "x", start: "2026-11-01T10:00:00Z", end: "2026-11-01T10:15:00Z" }, f);
    expect(m.id).toBe("new1");
    expect(calls[1]!.url).toContain("sendUpdates=none");
    expect(JSON.parse(String(calls[1]!.init!.body))).not.toHaveProperty("attendees");
    expect(await deleteEvent(cfg, "new1", f)).toBe(204);
    expect(await deleteEvent(cfg, "gone", f)).toBe(410);
    expect(await deleteEvent(cfg, "never", f)).toBe(404); // unknown id is not a 502
  });
});
