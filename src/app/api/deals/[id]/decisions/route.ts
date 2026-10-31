// GET /api/deals/:id/decisions → { dealId, companyDomain, decisions, endpoints, fields } (builder contract; see docs/API.md).
// Fit score, screener verdict, valuation, return multiples, comps, diligence verdict and IC memo figures, each a
// ComputedField with citations, or unavailable with the reason. Never a fixture value.
import { NextResponse } from "next/server";
import { resolveDealNumbers } from "@/lib/numbers/resolve";
import { localDecisions, withBuilder, type DecisionsResponse } from "@/lib/numbers/decisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await resolveDealNumbers((await ctx.params).id);
  if (!r.ok) return r.response;
  const body: DecisionsResponse = await withBuilder(localDecisions(r.id, r.fields, r.explainable));
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
