// GET /api/live/jobs?companyId=1083252 → /job/search on company.basic_info.company_id (0.03 credits/row, limit 25).
import { companyIdParam, liveRoute } from "@/lib/live/route";
import { searchJobs } from "@/lib/live/research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = liveRoute(companyIdParam, (client, id) => searchJobs(client, id));
