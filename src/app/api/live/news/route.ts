// GET /api/live/news?q="E2B" Agentic AI&mention=E2B | ?domain=e2b.dev | ?company=<domain, URL or name> → /web/search/live (1 credit).
// `mention` drops off-topic results; a domain is resolved to the company name with identify (0 credits).
import { liveRoute } from "@/lib/live/route";
import { searchNews } from "@/lib/live/research";
import { companyRefParam, resolveCompany, resolvedInfo, type CompanyRef } from "@/lib/live/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NewsInput = { query: string; mention?: string } | { ref: Exclude<CompanyRef, { kind: "id" }> };

export const GET = liveRoute<NewsInput>(
  (q) => {
    if (q.has("q") || !(q.has("domain") || q.has("company"))) {
      const query = q.get("q")?.trim();
      return query && query.length <= 200 ? { ok: true, input: { query, mention: q.get("mention")?.trim() || undefined } } : { ok: false, message: q.has("q") ? "q is required (≤ 200 chars)" : "q is required (≤ 200 chars), or pass domain= or company=" };
    }
    const ref = companyRefParam(q);
    if (!ref.ok) return ref;
    if (ref.input.kind === "id") return { ok: false, message: "news takes q, domain or company (not companyId)" };
    return { ok: true, input: { ref: ref.input } };
  },
  async (client, input) => {
    if ("query" in input) return searchNews(client, input.query, input.mention);
    const { ref } = input;
    if (ref.kind === "name") return searchNews(client, `"${ref.name}"`, ref.name);
    const r = await resolveCompany(client, ref);
    if (r.status !== "ok") return r;
    const name = r.name ?? ref.domain;
    return { ...(await searchNews(client, `"${name}"`, name)), resolved: resolvedInfo(r) };
  },
);
