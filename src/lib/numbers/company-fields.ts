// Explainable company numbers computed from live Crustdata responses. Each field names its inputs, the formula,
// and the endpoint + JSON path it was read from. Nothing here uses invented constants: anything that needs a firm
// thesis, the deal pipeline or an LLM is `unavailable` with the reason.
import { ok, unavailable, type Citation, type ComputedField } from "@/lib/fields";
import type { LiveCall, ResearchResult } from "@/lib/live/types";
import { fmtMoney, money } from "@/lib/format";

type Research = Extract<ResearchResult, { status: "ok" }>;

export const ENRICH_ROOT = "[0].matches[0].company_data";
const cite = (call: LiveCall, path: string, url?: string): Citation => ({
  source: "Crustdata",
  endpoint: `${call.method} ${call.path}`,
  path,
  retrievedAt: call.retrievedAt ?? undefined,
  ...(url ? { url } : {}),
});
const missing = (what: string, call: LiveCall) =>
  unavailable(call.status === "error" ? `${call.method} ${call.path} failed: ${call.error}` : `Crustdata returned no ${what} for this company (${call.method} ${call.path}).`);
const round1 = (n: number) => Math.round(n * 10) / 10;

export type CompanyFieldKey =
  | "headcountLatest"
  | "headcountGrowth6m"
  | "growthYoY"
  | "headcountGrowthQoQ"
  | "fundingTotal"
  | "lastFunding"
  | "lastRoundType"
  | "lastFundingDate"
  | "webMonthlyVisitors"
  | "webTrafficQoQ"
  | "followers"
  | "openRoles"
  | "engineeringRolesSample"
  | "foundersFound"
  | "foundedYear"
  | "compsFound"
  | "signalScore";

export type CompanyFields = Record<CompanyFieldKey, ComputedField<unknown>>;

export function companyFields(r: Research): CompanyFields {
  const c = r.company;
  const en = r.calls.enrich;
  const { jobs, founders, comps } = r.calls;
  const traffic = `${ENRICH_ROOT}.web_traffic.domain_traffic["${c.web.domain ?? c.domain}"]`;
  const pct = (key: "six_months" | "yoy" | "qoq", label: string) => {
    const v = c.headcount.growth[key];
    return v == null
      ? missing(`headcount.growth_percent.${key}`, en)
      : ok(round1(v), "Read as reported (Crustdata computes it from its headcount history)", `Headcount ${label} change: ${round1(v)}%.`, [cite(en, `${ENRICH_ROOT}.headcount.growth_percent.${key}`)], [{ name: `headcount.growth_percent.${key}`, value: v }]);
  };
  const jobsOk = jobs.status === "ok" && jobs.data;
  const eng = jobsOk ? jobs.data!.byCategory.find((b) => b.category.toLowerCase() === "engineering")?.count ?? 0 : undefined;
  return {
    headcountLatest:
      c.headcount.total == null
        ? missing("headcount.total", en)
        : ok(c.headcount.total, "Read as reported", `${c.name} has ${c.headcount.total} employees on Crustdata's latest index.`, [cite(en, `${ENRICH_ROOT}.headcount.total`)], [{ name: "headcount.total", value: c.headcount.total }]),
    headcountGrowth6m: pct("six_months", "6-month"),
    growthYoY: pct("yoy", "year-over-year"),
    headcountGrowthQoQ: pct("qoq", "quarter-over-quarter"),
    // Money stays {amount, currency}: Crustdata reports these fields in USD (the `_usd` suffix), so the currency is USD.
    fundingTotal:
      c.funding.totalUsd == null
        ? missing("funding.total_investment_usd", en)
        : ok(money(c.funding.totalUsd, "USD"), "Read as reported; currency USD per the field name (total_investment_usd)", `Total raised across all rounds: ${fmtMoney(money(c.funding.totalUsd, "USD"))}.`, [cite(en, `${ENRICH_ROOT}.funding.total_investment_usd`)], [{ name: "funding.total_investment_usd", value: c.funding.totalUsd }]),
    lastFunding:
      c.funding.lastRoundUsd == null
        ? missing("funding.last_round_amount_usd", en)
        : ok(money(c.funding.lastRoundUsd, "USD"), "Read as reported; currency USD per the field name (last_round_amount_usd)", `Last round (${c.funding.lastRoundType ?? "type unknown"}${c.funding.lastDate ? `, ${c.funding.lastDate}` : ""}): ${fmtMoney(money(c.funding.lastRoundUsd, "USD"))}.`, [cite(en, `${ENRICH_ROOT}.funding.last_round_amount_usd`)], [
            { name: "funding.last_round_amount_usd", value: c.funding.lastRoundUsd },
            { name: "funding.last_round_type", value: c.funding.lastRoundType ?? null },
          ]),
    lastRoundType: c.funding.lastRoundType
      ? ok(c.funding.lastRoundType, "Read as reported", `Last round type: ${c.funding.lastRoundType}.`, [cite(en, `${ENRICH_ROOT}.funding.last_round_type`)], [{ name: "funding.last_round_type", value: c.funding.lastRoundType }])
      : missing("funding.last_round_type", en),
    lastFundingDate: c.funding.lastDate
      ? ok(c.funding.lastDate, "Read as reported (date part)", `Last fundraise on ${c.funding.lastDate}.`, [cite(en, `${ENRICH_ROOT}.funding.last_fundraise_date`)], [{ name: "funding.last_fundraise_date", value: c.funding.lastDate }])
      : missing("funding.last_fundraise_date", en),
    webMonthlyVisitors:
      c.web.monthlyVisitors == null
        ? missing("web traffic", en)
        : ok(Math.round(c.web.monthlyVisitors), "Read as reported, rounded to whole visitors", `${Math.round(c.web.monthlyVisitors).toLocaleString("en-US")} monthly visitors to ${c.web.domain ?? c.domain}.`, [cite(en, `${traffic}.monthly_visitors`)], [{ name: "monthly_visitors", value: c.web.monthlyVisitors }]),
    webTrafficQoQ:
      c.web.qoqPct == null
        ? missing("web traffic qoq_pct", en)
        : ok(round1(c.web.qoqPct), "Read as reported", `Web traffic changed ${round1(c.web.qoqPct)}% quarter over quarter.`, [cite(en, `${traffic}.qoq_pct`)], [{ name: "qoq_pct", value: c.web.qoqPct }]),
    followers:
      c.followers.count == null
        ? missing("followers.count", en)
        : ok(c.followers.count, "Read as reported", `${c.followers.count.toLocaleString("en-US")} followers on the company's professional-network page.`, [cite(en, `${ENRICH_ROOT}.followers.count`)], [{ name: "followers.count", value: c.followers.count }]),
    openRoles: jobsOk
      ? ok(jobs.data!.total, "total_count of the job search on company.basic_info.company_id", `${jobs.data!.total} open roles indexed for ${c.name}.`, [cite(jobs, "total_count")], [{ name: "total_count", value: jobs.data!.total }])
      : missing("job listings", jobs),
    engineeringRolesSample: jobsOk
      ? ok(eng!, "count of job_details.category == \"Engineering\" over the returned listings", `${eng} of the ${jobs.data!.listings.length} most recent listings are Engineering (sample, not all ${jobs.data!.total}).`, [cite(jobs, "job_listings[].job_details.category")], [
          { name: "listings returned", value: jobs.data!.listings.length },
          { name: "total_count", value: jobs.data!.total },
        ])
      : missing("job listings", jobs),
    foundersFound:
      founders.status === "ok" && founders.data
        ? ok(founders.data.people.length, "number of profiles returned by the founder filter tree (current company_id + title contains \"Founder\")", `${founders.data.people.length} founder profile(s): ${founders.data.people.map((p) => p.name).join(", ") || "none"}.`, [cite(founders, "profiles[]")], [{ name: "total_count", value: founders.data.total }])
        : missing("founder profiles", founders),
    foundedYear: c.yearFounded
      ? ok(c.yearFounded, "Read as reported", `Founded in ${c.yearFounded}.`, [cite(en, `${ENRICH_ROOT}.basic_info.year_founded`)], [{ name: "basic_info.year_founded", value: c.yearFounded }])
      : missing("basic_info.year_founded", en),
    compsFound:
      comps.status === "ok" && comps.data
        ? ok(comps.data.length, "number of companies returned by ranked /company/search on the company's description (target excluded)", `${comps.data.length} comparable companies: ${comps.data.map((x) => x.name).join(", ") || "none"}.`, [cite(comps, "companies[]")], [{ name: "query", value: (comps.body as { search?: { query?: string } } | null)?.search?.query ?? null }])
        : comps.status === "skipped"
          ? unavailable(comps.note ?? "Comparable search was skipped.")
          : missing("comparable companies", comps),
    signalScore: unavailable(
      "A fit/signal score needs the firm's thesis and the Deal Desk scoring model (builder pipeline); this build has neither, so no score is computed from Crustdata signals alone.",
    ),
  };
}
