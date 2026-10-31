// GET /api/integrations/connectors[?fresh=1] → real connector status from env + free health checks. See docs/API.md.
// Health results are cached 5 min; checks that actually ran are appended to organizational memory ("connector.check").
import { NextResponse } from "next/server";
import { listIntegrations } from "@/lib/live/integrations";
import { recordConnectorChecks } from "@/lib/memory/record";
import type { IntegrationsResponse } from "@/lib/live/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const started = new Date();
  const connectors = await listIntegrations(process.env, fetch, { fresh });
  await recordConnectorChecks(connectors, started, "/api/integrations/connectors");
  const body: IntegrationsResponse = { checkedAt: new Date().toISOString(), connectors };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
