// GET /api/deals/:id/valuation → { explainable } with ComputedFields for the football field (see docs/API.md).
import { NextResponse } from "next/server";
import { resolveDealNumbers } from "@/lib/numbers/resolve";
import type { ValuationResponse } from "@/lib/numbers/deal-numbers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await resolveDealNumbers((await ctx.params).id);
  if (!r.ok) return r.response;
  const body: ValuationResponse = { id: r.id, source: r.source, explainable: r.explainable };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
