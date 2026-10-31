import { describe, expect, it } from "vitest";
import { checkIntegration, INTEGRATION_SPECS, listIntegrations } from "./integrations";

const spec = (id: string) => INTEGRATION_SPECS.find((s) => s.id === id)!;
const respond = (status: number, body: unknown): typeof fetch => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
const never: typeof fetch = async () => { throw new Error("must not call the network"); };

describe("connector status comes from config + health checks only", () => {
  it("not_configured without the key, without any network call", async () => {
    const r = await checkIntegration(spec("crustdata"), {}, never);
    expect(r).toMatchObject({ status: "not_configured", mode: "env", lastCheckedAt: null });
    expect(r.detail).toContain("CRUSTDATA_API_KEY");
  });

  it("connected only after a successful free health call", async () => {
    const r = await checkIntegration(spec("crustdata"), { CRUSTDATA_API_KEY: "k" }, respond(200, { account: { credits: 15218.64 } }));
    expect(r).toMatchObject({ status: "connected", mode: "live_check", wired: true });
    expect(r.detail).toContain("15,218 credits left");
    expect(r.lastCheckedAt).not.toBeNull();
  });

  it("error (not connected, not no-match) when the key is rejected", async () => {
    const r = await checkIntegration(spec("crustdata"), { CRUSTDATA_API_KEY: "bad" }, respond(401, { error: { type: "unauthorized", message: "Invalid API key in request." } }));
    expect(r).toMatchObject({ status: "error" });
    expect(r.detail).toContain("401");
    expect(r.detail).toContain("Invalid API key");
  });

  it("demo when explicitly forced to fixtures and no key is set", async () => {
    expect((await checkIntegration(spec("crustdata"), { DEALDESK_FIXTURES: "1" }, never)).status).toBe("demo");
  });

  it("a valid key for an integration this build does not use says so", async () => {
    const r = await checkIntegration(spec("slack"), { SLACK_BOT_TOKEN: "x" }, respond(200, { ok: true, team: "Northbeam" }));
    expect(r.status).toBe("connected");
    expect(r.wired).toBe(false);
    expect(r.detail).toMatch(/not used by this build/);
  });

  it("Google credentials without an OAuth flow are an error, not connected", async () => {
    expect((await checkIntegration(spec("gmail"), { GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" }, never)).status).toBe("error");
  });

  it("never puts secret values in the response", async () => {
    const env = { CRUSTDATA_API_KEY: "sk-zzKEYVALUEzz", SLACK_BOT_TOKEN: "xoxb-zzKEYVALUEzz" };
    const out = JSON.stringify(await listIntegrations(env, respond(200, { ok: true, account: { credits: 1 } }), { fresh: true }));
    expect(out).not.toContain("zzKEYVALUEzz");
  });
});
