// GET /api/live/company?domain=e2b.dev → identify (0 credits) + enrich (2 credits); an unknown domain adds "did you mean"
// suggestions (identify by name, 0 credits). See docs/API.md.
import { liveRoute } from "@/lib/live/route";
import { lookupCompany } from "@/lib/live/research";
import { normalizeDomainInput } from "@/lib/live/normalize";
import { suggestForDomain } from "@/lib/live/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = liveRoute(
  (q) => {
    const domain = normalizeDomainInput(q.get("domain"));
    return domain ? { ok: true, input: domain } : { ok: false, message: "domain must be a company domain, e.g. e2b.dev" };
  },
  async (client, domain) => {
    const r = await lookupCompany(client, domain);
    if (r.status !== "no_match") return r;
    // unknown domain (often a typo): "did you mean" suggestions, never auto-picked
    const { suggestions, message, suggest } = await suggestForDomain(client, domain);
    return { ...r, message, suggestions, suggest };
  },
);
