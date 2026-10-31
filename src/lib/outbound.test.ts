import { afterEach, describe, expect, it, vi } from "vitest";
import { outboundMode } from "./outbound";
import { POST } from "@/app/api/connectors/calendar/events/route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/memory/store", () => ({ recordMemory: async () => ({ status: "unavailable", reason: "test" }) }));

describe("outbound is dry-run by default", () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.OUTBOUND_MODE; });
  it("defaults to dry_run and rejects unknown modes", () => {
    expect(outboundMode({})).toBe("dry_run");
    expect(outboundMode({ OUTBOUND_MODE: "live" })).toBe("live");
    expect(() => outboundMode({ OUTBOUND_MODE: "yes" })).toThrow();
  });
  it("book-call builds the request but never calls Google", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await POST(new Request("http://x/api/connectors/calendar/events", { method: "POST", body: JSON.stringify({ summary: "Call", start: "2026-11-01T10:00:00Z", end: "2026-11-01T10:15:00Z", attendees: ["you@example.com"] }) }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ transport: "dry_run", label: expect.stringContaining("not sent"), wouldSend: { summary: "Call", attendees: ["you@example.com"], sendUpdates: "none" } });
    expect(f).not.toHaveBeenCalled();
  });
});
