// GET /api/integrations/connectors[?fresh=1] → real connector status from env + free health checks. See docs/API.md.
// Works in both data modes (it reports configuration, it does not serve data). Health results are cached 5 min.
import { NextResponse } from "next/server";
import { resolveDataMode } from "@/lib/datamode";
import { listIntegrations } from "@/lib/live/integrations";
import type { IntegrationsResponse } from "@/lib/live/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const body: IntegrationsResponse = { dataMode: resolveDataMode(), checkedAt: new Date().toISOString(), connectors: await listIntegrations(process.env, fetch, { fresh }) };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
