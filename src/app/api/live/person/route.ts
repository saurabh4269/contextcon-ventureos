// GET /api/live/person?linkedin=https://www.linkedin.com/in/mlejva → /person/enrich (1 credit, cached).
// Each lookup is appended to organizational memory ("person.enriched").
import { liveRoute } from "@/lib/live/route";
import { enrichPerson } from "@/lib/live/research";
import { normalizeLinkedInUrl } from "@/lib/live/normalize";
import { recordPersonEnrich } from "@/lib/memory/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = liveRoute(
  (q) => {
    const url = normalizeLinkedInUrl(q.get("linkedin"));
    return url ? { ok: true, input: url } : { ok: false, message: "linkedin must be a linkedin.com/in/<handle> profile URL" };
  },
  async (client, url) => {
    const r = await enrichPerson(client, url);
    await recordPersonEnrich(url, r, "/api/live/person");
    return r;
  },
);
