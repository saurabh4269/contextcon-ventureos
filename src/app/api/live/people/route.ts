// GET /api/live/people?companyId=1083252 | ?domain=e2b.dev | ?company=<domain, URL or name> → founders via /person/search filter tree (~0.23 credits/row, limit 5).
import { liveRoute } from "@/lib/live/route";
import { searchFounders } from "@/lib/live/research";
import { companyRefParam, runForCompany } from "@/lib/live/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = liveRoute(companyRefParam, (client, ref) => runForCompany(client, ref, (id) => searchFounders(client, id)));
