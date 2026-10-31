// GET /api/portfolio → { status:"ok", companies, storage }: deals that reached the Portfolio stage (src/lib/portfolio.ts),
// from the durable store. No KPI source exists in this build; nothing here calls Crustdata.
import { NextResponse } from "next/server";
import { portfolioFrom } from "@/lib/portfolio";
import { workflowStore } from "@/lib/workflow/store";
import { listStages } from "@/lib/deals/stages";
import { storageInfo } from "@/lib/store/docs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [deals, stages] = await Promise.all([workflowStore.list(), listStages()]);
  return NextResponse.json({ status: "ok", companies: portfolioFrom(deals, stages), storage: storageInfo() }, { headers: { "cache-control": "no-store" } });
}
