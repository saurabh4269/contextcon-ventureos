// GET /api/live/people?companyId=1083252 → founders via /person/search filter tree (~0.23 credits/row, limit 5).
import { companyIdParam, liveRoute } from "@/lib/live/route";
import { searchFounders } from "@/lib/live/research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = liveRoute(companyIdParam, (client, id) => searchFounders(client, id));
