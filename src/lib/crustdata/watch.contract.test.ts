import { describe, expect, it } from "vitest";
import { createCrustdataClient } from "./client";
import { buildWatchCompanyBody } from "./watch-body";

describe("Crustdata watch/company request shape", () => {
  it("uses documented entities, track tree, fields, and returns id", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const fetchImpl: typeof fetch = async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(JSON.stringify({ id: "watch_live_1" }), { status: 201 });
    };
    const client = createCrustdataClient({ apiKey: "test_key_for_watch_contract", fetchImpl });
    const { data } = await client.watchCompany({
      crustdataCompanyId: 9002001,
      webhookUrl: "https://example.com/hook",
    });
    expect(data.id).toBe("watch_live_1");
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
    const client = createCrustdataClient({ apiKey: "k" });
    await expect(client.watchCompany({ crustdataCompanyId: 1 })).rejects.toThrow(/webhook/i);
    if (prevPublic !== undefined) process.env.DEALDESK_PUBLIC_URL = prevPublic;
  });

});
