// GET /api/integrations/connectors → the Settings › Connectors UI (port ConnectorsData).
// Only the real connectors (API ids below) take their status from the API. Catalogue tiles (Affinity, Attio, Carta,
// PitchBook, HubSpot, Notion …) stay "available" and have no status/login/test wiring. Content that
// would read as live activity (feeds, call counts, sync times) does not exist in the catalogue (src/lib/connectors/catalogue.ts).
import type { Connector, ConnectorsData } from "@port/types";
import { CREDIT_COSTS } from "@/lib/crustdata/credits";
import type { IntegrationInfo, IntegrationsResponse } from "@/lib/live/types";
import { fmtAgo } from "@/lib/format";

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

/** "3m ago" from the last health check (absolute time is in the API response). */
export const ago = (iso: string | null, now: Date = new Date()) => fmtAgo(iso, now);

/** Per-call cost labels for the Crustdata manage sheet (documented pricing; replaces invented call counts). */
const CRUSTDATA_COST: Record<string, string> = {
  "/company/identify": `${CREDIT_COSTS.identify} cr`,
  "/company/enrich": `${CREDIT_COSTS.enrichCompany} cr`,
  "/person/enrich": `${CREDIT_COSTS.personEnrich} cr`,
  "/person/search": `${CREDIT_COSTS.personSearchFounderPerRow} cr/row`,
  "/job/search": `${CREDIT_COSTS.jobSearchPerRow} cr/row`,
  "/web/search/live": `${CREDIT_COSTS.webSearchLive} cr`,
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
    return { ...c, status: "available" as const, catalogueOnly: true, activity: undefined, syncing: false, lastSynced: undefined, issue: undefined };
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
              ? `${CREDIT_COSTS.enrichCompany} credits / company`
              : u.id === "person"
                ? `${CREDIT_COSTS.personEnrich} credit / profile`
                : u.id === "jobs"
                  ? `${CREDIT_COSTS.jobSearchPerRow} credits / role`
                  : u.id === "web"
                    ? `${CREDIT_COSTS.webSearchLive} credit / search`
                    : "Live",
      })),
  };
  return { ...catalogue, items, featured };
}
