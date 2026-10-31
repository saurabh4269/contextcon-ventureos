// GET /api/live/research?domain=e2b.dev → identify + enrich, then founders / jobs / web search / comparables.
// Used by the deal page (signals graph + sections). See docs/API.md for the response shape and credit costs.
import { liveRoute } from "@/lib/live/route";
import { researchCompany } from "@/lib/live/research";
import { normalizeDomainInput } from "@/lib/live/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = liveRoute(
  (q) => {
    const domain = normalizeDomainInput(q.get("domain") ?? q.get("company"));
    return domain ? { ok: true, input: domain } : { ok: false, message: "domain must be a company domain, e.g. e2b.dev" };
  },
  (client, domain) => researchCompany(client, domain),
);
