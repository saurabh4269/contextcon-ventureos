import "server-only";
// Memory events for actions handled by API routes. Each helper describes one action in one line plus a small payload;
// the store (or its explicit unavailability) is decided in ./store.
import type { IntegrationInfo, LiveCall, PersonLookup, ResearchResult } from "@/lib/live/types";
import { recordMemory } from "./store";

const sumCredits = (calls: LiveCall[]) => calls.filter((c) => !c.cached).reduce((a, c) => a + (Number(c.creditsUsed) || 0), 0);

export function recordResearchRun(r: ResearchResult, route: string) {
  if (r.status !== "ok" && r.status !== "no_match") return Promise.resolve(null);
  const calls = Object.values(r.calls) as LiveCall[];
  const fresh = calls.filter((c) => !c.cached && c.status !== "skipped");
  const credits = Math.round(sumCredits(calls) * 100) / 100;
  const name = r.status === "ok" ? r.company.name : r.domain;
  return recordMemory({
    kind: "research.run",
    actor: { type: "user" },
    subject: { type: "company", id: r.domain, label: name },
    summary:
      r.status === "ok"
        ? `Researched ${name} (${r.domain}) on Crustdata: ${calls.filter((c) => c.status === "ok").length}/${calls.length} calls returned data, ${fresh.length ? `${fresh.length} fetched live (${credits} credits)` : "all served from cache"}`
        : `Researched ${r.domain} on Crustdata: no company matched`,
    data: { status: r.status, requestedAt: r.requestedAt, calls: calls.map((c) => ({ id: c.id, status: c.status, cached: c.cached, creditsUsed: c.creditsUsed })) },
    source: `api:${route}`,
  });
}

export function recordPersonEnrich(linkedinUrl: string, r: PersonLookup, route: string) {
  if (r.status !== "ok" && r.status !== "no_match") return Promise.resolve(null);
  const name = r.status === "ok" ? r.person.name : null;
  return recordMemory({
    kind: "person.enriched",
    actor: { type: "user" },
    subject: { type: "person", id: linkedinUrl, label: name },
    summary: name ? `Looked up ${name} on Crustdata${r.call.cached ? " (cached)" : ""}` : `No Crustdata profile for ${linkedinUrl}`,
    data: { status: r.status, cached: r.call.cached, creditsUsed: r.call.cached ? "0" : r.call.creditsUsed },
    source: `api:${route}`,
  });
}

/** Only checks that actually ran (not 5-minute cache hits) are recorded. */
export function recordConnectorChecks(infos: IntegrationInfo[], since: Date, route: string) {
  const ran = infos.filter((i) => i.lastCheckedAt && Date.parse(i.lastCheckedAt) >= since.getTime());
  if (!ran.length) return Promise.resolve(null);
  return recordMemory({
    kind: "connector.check",
    actor: { type: "system" },
    subject: ran.length === 1 ? { type: "connector", id: ran[0]!.id, label: ran[0]!.name } : null,
    summary: `Checked ${ran.map((i) => `${i.name}: ${i.status.replace("_", " ")}`).join(" · ")}`,
    data: { results: ran.map((i) => ({ id: i.id, status: i.status, detail: i.detail })) },
    source: `api:${route}`,
  });
}
