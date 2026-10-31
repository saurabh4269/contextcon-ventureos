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
  const headers = { "cache-control": "no-store" };
  try {
    const [deals, stages] = await Promise.all([workflowStore.list(), listStages()]);
    return NextResponse.json({ status: "ok", companies: portfolioFrom(deals, stages), storage: storageInfo() }, { headers });
  } catch (e) {
    // an unreadable store is an error, not an empty portfolio
    console.error(`[portfolio] store error: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ status: "error", message: "The deal store could not be read (see server log).", storage: storageInfo() }, { status: 502, headers });
  }
}
