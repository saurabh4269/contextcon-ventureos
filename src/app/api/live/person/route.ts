// GET /api/live/person?linkedin=https://www.linkedin.com/in/mlejva → /person/enrich (1 credit).
import { liveRoute } from "@/lib/live/route";
import { enrichPerson } from "@/lib/live/research";
import { normalizeLinkedInUrl } from "@/lib/live/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = liveRoute(
  (q) => {
    const url = normalizeLinkedInUrl(q.get("linkedin"));
    return url ? { ok: true, input: url } : { ok: false, message: "linkedin must be a linkedin.com/in/<handle> profile URL" };
  },
  (client, url) => enrichPerson(client, url),
);
