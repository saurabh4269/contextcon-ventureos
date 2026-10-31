// The deliverable as files: a markdown memo (every figure footnoted to its source) and a CSV (one row per company,
// each value followed by its source column). Built only from the cited rows the run produced.
import { fmtDateTime, fmtMoney } from "@/lib/format";
import type { Citation, ComputedField } from "@/lib/fields";
import type { AgentRow, Founder, RunSummary } from "./run";
import { WINDOW_MONTHS } from "./parse";

export const citeText = (c: Citation | undefined): string =>
  c ? [c.source, c.endpoint, c.record as string | undefined, c.path, c.url, c.retrievedAt ? `fetched ${fmtDateTime(String(c.retrievedAt))}` : null].filter(Boolean).join(" · ") : "";

const val = <T,>(f: ComputedField<T> | { status: "pending" }, fmt: (v: T) => string): string =>
  f.status === "ok" ? fmt(f.value) : f.status === "pending" ? "pending" : `not reported (${f.reason.replace(/^not reported:\s*/i, "")})`;
const firstCite = (f: ComputedField<unknown> | { status: "pending" }) => (f.status === "ok" ? f.citations[0] : undefined);

export const fmtFunding = (v: { total: { amount: number; currency: string } | null; lastRound: string | null; lastDate: string | null }) =>
  [v.total ? `${fmtMoney(v.total, { compact: true })} raised` : null, v.lastRound ? `last: ${v.lastRound.replace(/_/g, " ")}${v.lastDate ? ` (${v.lastDate})` : ""}` : null].filter(Boolean).join(", ") || "no amounts reported";
export const fmtFounder = (f: Founder) => `${f.name}${f.title ? ` (${f.title})` : ""}${f.prior.length ? ` — before: ${f.prior.map((p) => p.company).join(", ")}` : " — no prior employers reported"}`;

export function toMarkdown(rows: AgentRow[], summary: RunSummary | null, request: string): string {
  const notes: string[] = [];
  const fn = (c: Citation | undefined) => {
    if (!c) return "";
    const t = citeText(c);
    let i = notes.indexOf(t);
    if (i < 0) { notes.push(t); i = notes.length - 1; }
    return `[^${i + 1}]`;
  };
  const out: string[] = [`# Sourcing memo`, "", `**Request:** ${request}`, ""];
  if (summary) out.push(`${summary.sentence}`, "", `_${summary.rankingReason} ${summary.credits} Crustdata credits; generated ${fmtDateTime(summary.finishedAt)}._`, "");
  for (const r of rows) {
    const w = WINDOW_MONTHS[r.growthWindow];
    out.push(`## ${r.rank}. ${r.name}${r.domain ? ` (${r.domain})` : ""}`);
    if (r.relaxed.length) out.push(`_Matched after: ${r.relaxed.join("; ")}._`);
    out.push(
      `- Founded: ${val(r.founded, String)}${fn(firstCite(r.founded))}`,
      `- HQ: ${val(r.hq, String)}${fn(firstCite(r.hq))}`,
      `- Headcount: ${r.headcountThen.status === "ok" ? `${r.headcountThen.value.value} (${r.headcountThen.value.date}) → ` : ""}${val(r.headcountNow, String)}${fn(firstCite(r.headcountNow))}`,
      `- ${w}-month growth: ${val(r.growth, (v) => `${v > 0 ? "+" : ""}${v}%`)}${fn(firstCite(r.growth))}`,
      `- Funding: ${val(r.funding, fmtFunding)}${fn(firstCite(r.funding))}`,
    );
    if (r.founders.status === "ok") {
      out.push(`- Founders:`);
      for (const f of r.founders.value) out.push(`  - ${fmtFounder(f)}${fn(f.citations.at(-1))}`);
    } else out.push(`- Founders: ${r.founders.status === "pending" ? "pending" : r.founders.reason}`);
    if (r.errors.length) out.push(`- Issues: ${r.errors.join("; ")}`);
    out.push("");
  }
  if (notes.length) out.push("---", "", ...notes.map((n, i) => `[^${i + 1}]: ${n}`));
  return out.join("\n");
}

const csvCell = (s: unknown) => {
  const t = s == null ? "" : String(s);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function toCsv(rows: AgentRow[]): string {
  const head = ["rank", "company", "domain", "founded", "founded_source", "hq", "hq_source", "headcount_then", "headcount_then_date", "headcount_now", "headcount_source", "growth_pct", "growth_window_months", "growth_source", "funding", "funding_source", "founders", "founders_source", "relaxed_constraints", "issues", "deal_url"];
  const lines = [head.join(",")];
  for (const r of rows) {
    const founders = r.founders.status === "ok" ? r.founders.value.map(fmtFounder).join(" | ") : r.founders.status === "pending" ? "pending" : `not reported (${r.founders.reason})`;
    lines.push([
      r.rank, r.name, r.domain ?? "",
      val(r.founded, String), citeText(firstCite(r.founded)),
      val(r.hq, String), citeText(firstCite(r.hq)),
      r.headcountThen.status === "ok" ? r.headcountThen.value.value : "", r.headcountThen.status === "ok" ? r.headcountThen.value.date : "",
      val(r.headcountNow, String), citeText(firstCite(r.headcountNow)),
      r.growth.status === "ok" ? r.growth.value : val(r.growth, String), WINDOW_MONTHS[r.growthWindow], citeText(firstCite(r.growth)),
      val(r.funding, fmtFunding), citeText(firstCite(r.funding)),
      founders, r.founders.status === "ok" ? r.founders.value.map((f) => citeText(f.citations.at(-1))).join(" | ") : "",
      r.relaxed.join("; "), r.errors.join("; "), r.domain ? `/deal?domain=${r.domain}` : "",
    ].map(csvCell).join(","));
  }
  return lines.join("\n");
}
