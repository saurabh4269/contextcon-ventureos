// GET /api/live/comps?companyId=1083252&q=Machines for AI agents | ?domain=e2b.dev[&q=] | ?company=<domain, URL or name>[&q=]
// → ranked /company/search (≈0.23 credits/row, limit 5). Without q the description comes from identify + enrich (2 credits).
import { liveRoute } from "@/lib/live/route";
import { lookupCompany, searchComps } from "@/lib/live/research";
import { companyRefParam, resolveCompany, resolvedInfo } from "@/lib/live/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = liveRoute(
  (q) => {
    const ref = companyRefParam(q);
    if (!ref.ok) return ref;
    const query = q.get("q")?.trim() || undefined;
    if (ref.input.kind === "id" && !query) return { ok: false, message: "q (what the company does) is required, or pass domain= instead of companyId=" };
    return { ok: true, input: { ref: ref.input, query } };
  },
  async (client, { ref, query }) => {
    if (ref.kind === "id") return searchComps(client, { id: ref.id, description: query, categories: [] });
    const r = await resolveCompany(client, ref);
    if (r.status !== "ok") return r;
    const resolved = resolvedInfo(r);
    if (query) return { ...(await searchComps(client, { id: r.companyId, description: query, categories: [] })), resolved };
    // no q: describe the company from enrich; the domain lookup reuses the identify above (response cache)
    const domain = ref.kind === "domain" ? ref.domain : r.domain;
    const looked = domain ? await lookupCompany(client, domain) : undefined;
    if (looked?.status === "ok" && looked.company.id === r.companyId) return { ...(await searchComps(client, looked.company)), resolved, enrich: looked.enrich };
    return { ...(await searchComps(client, { id: r.companyId, description: undefined, categories: [] })), resolved };
  },
);
