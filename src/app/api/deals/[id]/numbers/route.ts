// GET /api/deals/:id/numbers → one ComputedField per deal number (builder contract; see docs/API.md).
import { NextResponse } from "next/server";
import { resolveDealNumbers } from "@/lib/numbers/resolve";
import type { NumbersResponse } from "@/lib/numbers/deal-numbers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await resolveDealNumbers((await ctx.params).id);
  if (!r.ok) return r.response;
  const body: NumbersResponse = { id: r.id, source: r.source, fields: r.fields };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
