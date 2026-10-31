// GET /api/deals/:id/decisions → { dealId, companyDomain, decisions, endpoints, fields } (builder contract; see docs/API.md).
// Fit score, screener verdict, valuation, return multiples, comps, diligence verdict and IC memo figures, each a
// ComputedField with citations, or unavailable with the reason. Never a fixture value. Unavailable / partial-input
// decisions are raised to the review queue (/review); values a person enters there come back cited to that item.
import { NextResponse } from "next/server";
import { resolveDealNumbers } from "@/lib/numbers/resolve";
import { localDecisions, withBuilder, type DecisionsResponse } from "@/lib/numbers/decisions";
import { withReview } from "@/lib/exceptions/decisions";
import { exceptionStore } from "@/lib/exceptions/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await resolveDealNumbers((await ctx.params).id);
  if (!r.ok) return r.response;
  const decided = await withBuilder(localDecisions(r.id, r.fields, r.explainable));
  // Person-entered values from /review fill decisions (cited to the review item); open gaps are routed there.
  // ?review=0 reads without recording the run (e.g. scripts).
  const body: DecisionsResponse = withReview(decided, exceptionStore(), { raise: new URL(req.url).searchParams.get("review") !== "0" });
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
