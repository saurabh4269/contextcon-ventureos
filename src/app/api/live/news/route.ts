// GET /api/live/news?q="E2B" Agentic AI&mention=E2B → /web/search/live (1 credit). `mention` drops off-topic results.
import { liveRoute } from "@/lib/live/route";
import { searchNews } from "@/lib/live/research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = liveRoute(
  (q) => {
    const query = q.get("q")?.trim();
    return query && query.length <= 200 ? { ok: true, input: { query, mention: q.get("mention")?.trim() || undefined } } : { ok: false, message: "q is required (≤ 200 chars)" };
  },
  (client, { query, mention }) => searchNews(client, query, mention),
);
