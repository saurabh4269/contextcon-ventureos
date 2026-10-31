import { describe, expect, it } from "vitest";
import { checkEnv, format, formatJson, hasFailures, parseCredits, redact, runPings, SECRET_ENV, type CheckResult, type Env } from "./preflight";

const SECRET = "sk-fake-secret-1234567890";
const full: Env = { CRUSTDATA_API_KEY: SECRET, ANTHROPIC_API_KEY: "sk-ant-fake-abcdef", DATABASE_URL: "postgres://u:pw-fake-xyz@h/db" };
const byId = (rs: CheckResult[], id: string) => rs.find((r) => r.id === id)!;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/** Fake fetch routed by host; never touches the network. */
const fakeFetch = (routes: Record<string, (init?: RequestInit) => Promise<Response>>) =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    const host = new URL(String(url)).host;
    const route = routes[host];
    if (!route) throw new Error(`no route for ${host}`);
    return route(init);
  }) as typeof fetch;
const ok = () => Promise.resolve(new Response("ok"));

describe("preflight env checks", () => {
  it("reports presence only and the model that will be used", () => {
    const rs = checkEnv(full);
    expect(byId(rs, "env.crustdata")).toMatchObject({ status: "pass", detail: "set" });
    expect(byId(rs, "env.model")).toMatchObject({ status: "pass", detail: expect.stringContaining("anthropic · claude-sonnet-5-5") });
    expect(byId(rs, "env.database").status).toBe("pass");
    expect(byId(rs, "env.google")).toMatchObject({ status: "warn", detail: expect.stringContaining("CLIENT_ID missing") });
    expect(byId(rs, "env.elevenlabs").status).toBe("warn");
    expect(hasFailures(rs)).toBe(false);
    expect(byId(checkEnv({ CRUSTDATA_API_KEY: "x", OPENAI_API_KEY: "y" }), "env.model").detail).toContain("openai · gpt-6.1-sol");
  });

  it("missing Crustdata key or no model key fails", () => {
    expect(byId(checkEnv({ ANTHROPIC_API_KEY: "a" }), "env.crustdata")).toMatchObject({ status: "fail", detail: "missing" });
    expect(byId(checkEnv({ CRUSTDATA_API_KEY: "c", OPENAI_API_KEY: "  " }), "env.model").status).toBe("fail");
  });

  it("OUTBOUND_MODE: unset/dry_run pass, live warns with the allowlist, anything else fails", () => {
    expect(byId(checkEnv({ ...full }), "env.outbound").status).toBe("pass");
    expect(byId(checkEnv({ ...full, OUTBOUND_MODE: "dry_run" }), "env.outbound").status).toBe("pass");
    expect(byId(checkEnv({ ...full, OUTBOUND_MODE: "live" }), "env.outbound")).toMatchObject({ status: "warn", detail: expect.stringContaining("you@example.com") });
    expect(byId(checkEnv({ ...full, OUTBOUND_LIVE: "1", DEMO_RECIPIENT_ALLOWLIST: "a@x.com" }), "env.outbound")).toMatchObject({ status: "warn", detail: expect.stringMatching(/^live \(OUTBOUND_LIVE\).*only to a@x\.com/) });
    const odd = byId(checkEnv({ ...full, OUTBOUND_MODE: "sendit-now" }), "env.outbound");
    expect(odd).toMatchObject({ status: "fail", detail: expect.stringContaining("unexpected value") });
    expect(odd.detail).not.toContain("sendit");
  });
});

describe("preflight: backup key and stored Google sign-in", () => {
  it("backup Crustdata key is optional (warn when missing)", () => {
    expect(byId(checkEnv({ ...full }), "env.crustdata_backup").status).toBe(full.CRUSTDATA_API_KEY_BACKUP ? "pass" : "warn");
    expect(byId(checkEnv({ ...full, CRUSTDATA_API_KEY_BACKUP: "b" }), "env.crustdata_backup").status).toBe("pass");
    expect(SECRET_ENV).toContain("CRUSTDATA_API_KEY_BACKUP");
  });
  it("a stored sign-in stands in for GOOGLE_REFRESH_TOKEN", () => {
    const env = { CRUSTDATA_API_KEY: "c", OPENAI_API_KEY: "o", GOOGLE_CLIENT_ID: "i", GOOGLE_CLIENT_SECRET: "s" };
    expect(byId(checkEnv(env), "env.google")).toMatchObject({ status: "warn", detail: expect.stringContaining("not signed in") });
    expect(byId(checkEnv(env, { googleStored: true }), "env.google")).toMatchObject({ status: "pass", detail: expect.stringContaining("signed in from Settings") });
  });
});

describe("preflight pings", () => {
  it("parses the credits figure and sends the app's headers", async () => {
    let headers: Record<string, string> = {};
    const f = fakeFetch({
      "api.crustdata.com": async (init) => { headers = init?.headers as Record<string, string>; return json(200, { account: { credits: 1234.5 } }); },
      "api.anthropic.com": () => Promise.resolve(json(200, { id: "claude-sonnet-5-5" })),
      "localhost:3240": ok,
    });
    const rs = await runPings(full, f, { now: () => new Date("2026-10-31T08:30:00Z") });
    expect(headers).toMatchObject({ authorization: `Bearer ${SECRET}`, "x-api-version": "2025-11-01" });
    expect(byId(rs, "ping.crustdata")).toMatchObject({ status: "pass", httpStatus: 200, detail: expect.stringContaining("1,234.5 credits left") });
    expect(byId(rs, "ping.crustdata").detail).toContain("14:00 IST");
    expect(byId(rs, "ping.anthropic").status).toBe("pass");
    expect(byId(rs, "ping.app").status).toBe("pass");
    expect(parseCredits("not json")).toBeNull();
  });

  it("maps 401 → key rejected, 404 model → not available, app down → warn only", async () => {
    const f = fakeFetch({
      "api.crustdata.com": () => Promise.resolve(json(401, { error: "bad key" })),
      "api.anthropic.com": () => Promise.resolve(json(404, {})),
    });
    const rs = await runPings(full, f);
    expect(byId(rs, "ping.crustdata")).toMatchObject({ status: "fail", detail: expect.stringContaining("401 key rejected") });
    expect(byId(rs, "ping.anthropic")).toMatchObject({ status: "fail", detail: expect.stringContaining("model not available to this key") });
    expect(byId(rs, "ping.app")).toMatchObject({ status: "warn", detail: expect.stringContaining("unreachable") });
  });

  it("timeout → unreachable", async () => {
    const hang = (init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    const rs = await runPings({ CRUSTDATA_API_KEY: "c" }, fakeFetch({ "api.crustdata.com": hang, "localhost:3240": hang }), { timeoutMs: 20 });
    expect(byId(rs, "ping.crustdata")).toMatchObject({ status: "fail", detail: expect.stringContaining("unreachable (timeout") });
  });

  it("never prints a secret, even when fetch throws one", async () => {
    const env: Env = { ...full, OPENAI_API_KEY: "sk-openai-fake-999999" };
    const leak = () => Promise.reject(new Error(`boom ${SECRET} ${env.OPENAI_API_KEY} ${env.DATABASE_URL}`));
    const rs = await runPings(env, fakeFetch({ "api.crustdata.com": leak, "api.anthropic.com": leak, "api.openai.com": leak, "localhost:3240": leak }));
    const all = [...checkEnv(env), ...rs];
    for (const out of [format(all, env), formatJson(all, env)]) {
      expect(out).toContain("[redacted]");
      for (const v of [SECRET, env.ANTHROPIC_API_KEY!, env.OPENAI_API_KEY!, env.DATABASE_URL!, "pw-fake-xyz"]) expect(out).not.toContain(v);
    }
    expect(format(all, env)).toMatch(/failed — NOT ready to record$/);
    expect(redact("short abc", { CRUSTDATA_API_KEY: "abc" })).toBe("short abc");
  });
});
