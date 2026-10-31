// GET /api/integrations/connectors → the Settings › Connectors UI (port ConnectorsData).
// Only the real connectors (API ids below) take their status from the API. Catalogue tiles (Affinity, Attio, Carta,
// PitchBook, HubSpot, Notion …) stay "available" and have no status/login/test wiring. Fixture-only content that would
// read as live activity (invented activity feeds, "412 this week" call counts) is removed in live mode.
import type { Connector, ConnectorsData } from "@port/types";
import { FIXTURE_CREDITS } from "@/lib/crustdata/credits";
import type { IntegrationInfo, IntegrationsResponse } from "@/lib/live/types";

/** API connector id → the UI connector ids it drives (Google Calendar status also drives the Meet tile). */
export const UI_IDS_BY_API_ID: Record<string, string[]> = {
  crustdata: ["crustdata"],
  llm: ["model"],
  agentmail: ["agentmail"],
  slack: ["slack"],
  fireflies: ["fireflies"],
  gmail: ["gmail"],
  calendar: ["calendar", "googlemeet"],
};

/** "3m ago" style; deterministic given `now`. */
export function ago(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** Per-call cost labels for the Crustdata manage sheet (documented pricing; replaces invented call counts). */
const CRUSTDATA_COST: Record<string, string> = {
  "/company/identify": `${FIXTURE_CREDITS.identify} cr`,
  "/company/enrich": `${FIXTURE_CREDITS.enrichCompany} cr`,
  "/person/enrich": `${FIXTURE_CREDITS.personEnrich} cr`,
  "/person/search": `${FIXTURE_CREDITS.personSearchFounderPerRow} cr/row`,
  "/job/search": `${FIXTURE_CREDITS.jobSearchPerRow} cr/row`,
  "/web/search/live": `${FIXTURE_CREDITS.webSearchLive} cr`,
  "/watch/company": "not used",
};

function applyStatus(c: Connector, info: IntegrationInfo, now: Date): Connector {
  const base: Connector = { ...c, activity: undefined, syncing: false };
  const hint = `${info.detail}`;
  switch (info.status) {
    case "connected":
      return info.wired
        ? { ...base, status: "connected", lastLabel: "Checked", lastSynced: ago(info.lastCheckedAt, now), issue: undefined }
        : // a valid key that nothing in this build uses is not a working connector
          { ...base, status: "attention", lastSynced: ago(info.lastCheckedAt, now), issue: "Key valid · not used by this build yet" };
    case "not_configured":
      return { ...base, status: "available", lastSynced: undefined, issue: undefined, usedBy: undefined, scope: `Not connected · set ${info.env.join(" or ")}` };
    case "error":
      return { ...base, status: "attention", lastSynced: ago(info.lastCheckedAt, now), issue: hint };
    case "demo":
      return { ...base, status: "attention", lastSynced: "never", issue: "Fixture mode · no live calls" };
  }
}

export function toLiveConnectors(catalogue: ConnectorsData, res: IntegrationsResponse, now: Date = new Date()): ConnectorsData {
  const byUi = new Map<string, IntegrationInfo>();
  for (const info of res.connectors) for (const ui of UI_IDS_BY_API_ID[info.id] ?? []) byUi.set(ui, info);
  const items = catalogue.items.map((c) => {
    const info = byUi.get(c.id);
    if (info) {
      const out = applyStatus(c, info, now);
      if (c.id === "crustdata" && out.api) {
        out.api = { ...out.api, endpoints: out.api.endpoints.map((e) => ({ ...e, calls: CRUSTDATA_COST[e.path] ?? "—" })) };
      }
      return out;
    }
    // catalogue-only tile: never connected in this build
    return { ...c, status: "available" as const, activity: undefined, syncing: false, lastSynced: undefined, issue: undefined };
  });
  const crust = byUi.get("crustdata");
  const featured = catalogue.featured && {
    ...catalogue.featured,
    uses: catalogue.featured.uses
      .filter((u) => u.id !== "watch") // watches are not created by this build
      .map((u) => ({
        ...u,
        stat:
          crust?.status !== "connected"
            ? "Not connected"
            : u.id === "company"
              ? `${FIXTURE_CREDITS.enrichCompany} credits / company`
              : u.id === "person"
                ? `${FIXTURE_CREDITS.personEnrich} credit / profile`
                : u.id === "jobs"
                  ? `${FIXTURE_CREDITS.jobSearchPerRow} credits / role`
                  : u.id === "web"
                    ? `${FIXTURE_CREDITS.webSearchLive} credit / search`
                    : "Live",
      })),
  };
  return { ...catalogue, items, featured };
}
