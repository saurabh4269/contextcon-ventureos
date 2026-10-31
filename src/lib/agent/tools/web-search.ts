// web_search — POST /web/search/live. Live web/news search for facts Crustdata's datasets do not hold (recent
// announcements, press, product launches). Results are third-party pages: cite results[i].url / .title / .snippet.
import type { ToolDef } from "../contract";
import type { WebSearchLiveRequest } from "@/lib/crustdata";
import { exec } from "./shared";

const SOURCES = ["news", "web", "scholar-articles", "ai", "social"] as const;

/** YYYY-MM-DD (or a unix-seconds number) → unix seconds; undefined when unparseable. */
export const toUnixSeconds = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v > 1e12 ? v / 1000 : v);
  if (typeof v !== "string" || !v.trim()) return undefined;
  const t = Date.parse(v.trim());
  return Number.isFinite(t) ? Math.floor(t / 1000) : undefined;
};

export const webSearch: ToolDef = {
  spec: {
    name: "web_search",
    description:
      "POST /web/search/live — live web/news search (1 credit per call, rate limit 10/min). Use for recent events, announcements or facts not in Crustdata's company/person data. " +
      "Response: results[i].source, .title, .url, .snippet, .position. Snippets are third-party text — cite them as such, and prefer Crustdata fields when both exist.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Concise query; supports operators like site:." },
        sources: { type: "array", items: { type: "string", enum: [...SOURCES] }, description: "Defaults to all sources." },
        site: { type: "string", description: "Restrict to a domain, e.g. techcrunch.com." },
        country: { type: "string", description: "ISO 3166-1 alpha-2 country for regional results, e.g. IN, US." },
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["query"],
    },
  },
  estimateCredits: () => 1,
  execute: async (input, client) => {
    const query = typeof input.query === "string" ? input.query.trim().slice(0, 1000) : "";
    if (!query) throw new Error("web_search needs a query.");
    const sources = (Array.isArray(input.sources) ? input.sources : []).filter((s): s is (typeof SOURCES)[number] => (SOURCES as readonly unknown[]).includes(s));
    const start = toUnixSeconds(input.start_date);
    const end = toUnixSeconds(input.end_date);
    if (start != null && end != null && start >= end) throw new Error("web_search start_date must be before end_date.");
    const country = typeof input.country === "string" && /^[a-z]{2}$/i.test(input.country.trim()) ? input.country.trim().toUpperCase() : undefined;
    const body: Record<string, unknown> = {
      query,
      ...(sources.length ? { sources } : {}),
      ...(typeof input.site === "string" && input.site.trim() ? { site: input.site.trim().slice(0, 500) } : {}),
      ...(country ? { location: country } : {}),
      ...(start != null ? { start_date: start } : {}),
      ...(end != null ? { end_date: end } : {}),
    };
    return exec("POST", "/web/search/live", body, client.webSearchLive(body as WebSearchLiveRequest));
  },
};
