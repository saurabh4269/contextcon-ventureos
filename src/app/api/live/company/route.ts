// GET /api/live/company?domain=e2b.dev → identify (0 credits) + enrich (2 credits). See docs/API.md.
import { liveRoute } from "@/lib/live/route";
import { lookupCompany } from "@/lib/live/research";
import { normalizeDomainInput } from "@/lib/live/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = liveRoute(
  (q) => {
    const domain = normalizeDomainInput(q.get("domain"));
    return domain ? { ok: true, input: domain } : { ok: false, message: "domain must be a company domain, e.g. e2b.dev" };
  },
  (client, domain) => lookupCompany(client, domain),
);
