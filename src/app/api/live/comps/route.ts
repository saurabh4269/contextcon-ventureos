// GET /api/live/comps?companyId=1083252&q=Machines for AI agents → ranked /company/search (≈0.23 credits/row, limit 5).
import { companyIdParam, liveRoute } from "@/lib/live/route";
import { searchComps } from "@/lib/live/research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = liveRoute(
  (q) => {
    const id = companyIdParam(q);
    if (!id.ok) return id;
    const query = q.get("q")?.trim();
    return query && query.length <= 500 ? { ok: true, input: { id: id.input, query } } : { ok: false, message: "q (what the company does) is required (≤ 500 chars)" };
  },
  (client, { id, query }) => searchComps(client, { id, description: query, categories: [] }),
);
