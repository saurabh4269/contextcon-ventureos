// GET /api/live/jobs?companyId=1083252 | ?domain=e2b.dev | ?company=<domain, URL or name> → /job/search on company.basic_info.company_id (0.03 credits/row, limit 25).
import { liveRoute } from "@/lib/live/route";
import { searchJobs } from "@/lib/live/research";
import { companyRefParam, runForCompany } from "@/lib/live/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = liveRoute(companyRefParam, (client, ref) => runForCompany(client, ref, (id) => searchJobs(client, id)));
