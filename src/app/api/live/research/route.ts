// GET /api/live/research?domain=e2b.dev → identify + enrich, then founders / jobs / web search / comparables.
// Used by the deal page (signals graph + sections). See docs/API.md for the response shape and credit costs.
// Each run is appended to organizational memory ("research.run").
import { liveRoute } from "@/lib/live/route";
import { researchCompany } from "@/lib/live/research";
import { normalizeDomainInput } from "@/lib/live/normalize";
import { recordResearchRun } from "@/lib/memory/record";
import { suggestForDomain } from "@/lib/live/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = liveRoute(
  (q) => {
    const domain = normalizeDomainInput(q.get("domain") ?? q.get("company"));
    return domain ? { ok: true, input: domain } : { ok: false, message: "domain must be a company domain, e.g. e2b.dev" };
  },
  async (client, domain) => {
    const r = await researchCompany(client, domain);
    await recordResearchRun(r, "/api/live/research");
    if (r.status !== "no_match") return r;
    // unknown domain (often a typo): "did you mean" suggestions, never auto-picked
    const { suggestions, message, suggest } = await suggestForDomain(client, domain);
    return { ...r, message, suggestions, calls: { ...r.calls, suggest } };
  },
  { deadlineMs: 55_000 }, // maxDuration 60
);
