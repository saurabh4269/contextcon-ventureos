import { describe, expect, it } from "vitest";
import { createCrustdataClient } from "./client";
import { buildWatchCompanyBody } from "./watch-body";

describe("Crustdata watch/company request shape", () => {
  it("uses documented entities, track tree, fields, and returns id", async () => {
    const prevForce = process.env.CRUSTDATA_FORCE_FIXTURE;
    delete process.env.CRUSTDATA_FORCE_FIXTURE;
    const client = createCrustdataClient({ apiKey: "test_key_for_watch_contract" });
    expect(client.mode).toBe("live");
    let capturedBody: Record<string, unknown> | undefined;
    const orig = global.fetch;
    global.fetch = async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(JSON.stringify({ id: "watch_live_1" }), { status: 201 });
    };
    try {
      const { data } = await client.watchCompany({
        crustdataCompanyId: 9002001,
        webhookUrl: "https://example.com/hook",
      });
      expect(data.id).toBe("watch_live_1");
    } finally {
      global.fetch = orig;
      if (prevForce !== undefined) process.env.CRUSTDATA_FORCE_FIXTURE = prevForce;
      else process.env.CRUSTDATA_FORCE_FIXTURE = "1";
    }
    expect(capturedBody).toEqual(
      buildWatchCompanyBody({
        crustdataCompanyId: 9002001,
        webhookUrl: "https://example.com/hook",
      }),
    );
  });

  it("throws when webhook URL is missing", async () => {
    const prevPublic = process.env.DEALDESK_PUBLIC_URL;
    delete process.env.DEALDESK_PUBLIC_URL;
    const client = createCrustdataClient({ forceFixture: false, apiKey: "k" });
    await expect(client.watchCompany({ crustdataCompanyId: 1 })).rejects.toThrow(/webhook/i);
    if (prevPublic !== undefined) process.env.DEALDESK_PUBLIC_URL = prevPublic;
  });

  it("fixture watch create returns { id }", async () => {
    const client = createCrustdataClient({ forceFixture: true });
    const { data } = await client.watchCompany({
      crustdataCompanyId: 9002001,
      webhookUrl: "https://example.com/hook",
    });
    expect(data.id).toBeTruthy();
  });
});
