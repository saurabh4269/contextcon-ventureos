import { describe, expect, it } from "vitest";
import { connectors } from "@port/fixtures/connectors";
import { toLiveConnectors } from "./connectors";
import type { IntegrationInfo, IntegrationsResponse } from "@/lib/live/types";

const now = new Date("2026-10-31T06:00:00Z");
const info = (id: string, status: IntegrationInfo["status"], over: Partial<IntegrationInfo> = {}): IntegrationInfo => ({
  id, name: id, status, mode: status === "connected" ? "live_check" : "env", wired: id === "crustdata", detail: `${id} detail`, env: [`${id.toUpperCase()}_KEY`], docsUrl: "https://x", lastCheckedAt: status === "connected" ? "2026-10-31T05:58:00Z" : null, ...over,
});
const res = (list: IntegrationInfo[]): IntegrationsResponse => ({ dataMode: "live", checkedAt: now.toISOString(), connectors: list });
const ids = ["crustdata", "llm", "agentmail", "slack", "fireflies", "gmail", "calendar"];

describe("toLiveConnectors", () => {
  it("nothing is connected when nothing is configured — no fixture statuses survive", () => {
    const out = toLiveConnectors(connectors, res(ids.map((i) => info(i, "not_configured"))), now);
    expect(out.items.filter((c) => c.status === "connected")).toEqual([]);
    expect(out.items.every((c) => !c.activity)).toBe(true);
    expect(out.items.find((c) => c.id === "crustdata")?.scope).toContain("CRUSTDATA_KEY");
    expect(out.featured?.uses.every((u) => u.stat === "Not connected")).toBe(true);
  });

  it("Crustdata connected only from a successful health check; invented call counts become per-call costs", () => {
    const out = toLiveConnectors(connectors, res([info("crustdata", "connected"), ...ids.slice(1).map((i) => info(i, "not_configured"))]), now);
    const c = out.items.find((x) => x.id === "crustdata")!;
    expect(c).toMatchObject({ status: "connected", lastSynced: "2m ago", lastLabel: "Checked" });
    expect(c.api?.endpoints.find((e) => e.path === "/company/enrich")?.calls).toBe("2 cr");
    expect(out.featured?.uses.some((u) => /this week/.test(u.stat))).toBe(false);
  });

  it("a valid key that this build doesn't use needs attention; errors surface their detail", () => {
    const out = toLiveConnectors(connectors, res([info("slack", "connected", { wired: false }), info("crustdata", "error", { detail: "GET /account/credits → 401" })]), now);
    expect(out.items.find((x) => x.id === "slack")).toMatchObject({ status: "attention", issue: "Key valid · not used by this build yet" });
    expect(out.items.find((x) => x.id === "crustdata")).toMatchObject({ status: "attention", issue: "GET /account/credits → 401" });
  });

  it("calendar status drives the Meet tile; catalogue tiles are never connected", () => {
    const out = toLiveConnectors(connectors, res([info("calendar", "not_configured")]), now);
    expect(out.items.find((x) => x.id === "googlemeet")?.status).toBe("available");
    expect(out.items.find((x) => x.id === "affinity")?.status).toBe("available");
  });
});
