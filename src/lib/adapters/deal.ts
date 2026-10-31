// /api/live/research result → the port DealData (deal page header, Signals graph, Overview / Team / Market sections).
// Every number shown comes from a ComputedField in `research.fields` (value + reasoning + citations, hover via
// explain()) or is a raw Crustdata series value drawn as a chart under a cited card. Nothing is invented: sections the
// API cannot back (claims, cap table, valuation, customers) are not shown, and the fit tile is explicitly unscored.
import type { DealData, DealEvent, DealKpi, DealMetric, DealSection, EvidenceItem, OutlineItem, SignalCall, SignalChip, SignalContribution, SignalEvent, SignalGraphData, SignalSpark, SourceRef, TeamPerson } from "@port/types";
import { explain, isOk, show, type ComputedField } from "@/lib/fields";
import type { LiveCall, LivePerson, Point, ResearchResult } from "@/lib/live/types";
import { CRUSTDATA_API_VERSION } from "@/lib/crustdata/http";
import { fmtAgo, fmtCompact, fmtDate, fmtDateTime, fmtInt, fmtLabel, fmtMoney, fmtMonth, fmtMonthYear, fmtPct, isMoney, money } from "@/lib/format";
import { ENRICH_ROOT } from "@/lib/numbers/company-fields";
import { uncitedOk, whyFromCall, whyFromDecision, whyFromField, type CallMeta, type Why } from "@/lib/provenance";

type Ok = Extract<ResearchResult, { status: "ok" }>;
type F = ComputedField<unknown>;

/* ── formatting (display only; the value itself comes from the field; all formatters live in src/lib/format) ── */
const n = (v: unknown) => (typeof v === "number" ? v : Number(v));
export { fmtInt, fmtPct };
export const fmtRound = fmtLabel;
/** Money field value ({amount, currency}) in its own currency. */
export const fmtM = (v: unknown) => (isMoney(v) ? fmtMoney(v) : "—");
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
const pathOfField = (f: F | undefined) => (isOk(f) ? f.citations[0]?.path : undefined);

/** "2h ago" relative to now; the absolute time stays in requestedAt (shown in IST via fmtDateTime). */
export const relTime = (iso: string, now: Date = new Date()) => fmtAgo(iso, now);

const crust = (label: string, asOf?: string): SourceRef => ({ kind: "crust", label, provider: "crustdata", ...(asOf ? { asOf } : {}) });

/** Person page URL for a founder (live person page enriches by profile URL). */
export const livePersonHref = (p: LivePerson, domain: string) => (p.linkedinUrl ? `/person?linkedin=${encodeURIComponent(p.linkedinUrl)}&domain=${encodeURIComponent(domain)}` : undefined);

/* ── Signals graph ── */
function chip(id: string, field: string, f: F | undefined, fmt: (v: unknown) => string, extra: Partial<SignalChip> = {}): SignalChip | null {
  if (!isOk(f)) return null;
  return { id, field, value: fmt(f.value), path: pathOfField(f) ?? field, ...extra };
}
const chips = (xs: (SignalChip | null)[]) => xs.filter((x): x is SignalChip => !!x);
const spark = (id: string, field: string, label: string, pts: Point[], fmt: (v: number) => string): SignalSpark | null =>
  pts.length >= 2 ? { id, field, label, points: pts.map((p) => ({ date: p.date, v: p.v })), value: fmt(pts[pts.length - 1]!.v) } : null;
/** Crustdata was down and this call was answered from the last good cached response: say so, with when (IST). */
const staleChip = (c: LiveCall): SignalChip[] =>
  c.stale ? [{ id: "stale", field: "cached", value: "stale", path: c.note?.split(" · ")[0] ?? `cached at ${fmtDateTime(c.retrievedAt)}`, short: "cached" }] : [];
const errChip = (c: LiveCall): SignalChip[] => (c.status === "error" ? [{ id: "err", field: "error", value: "failed", path: c.error ?? "request failed" }] : c.status === "skipped" ? [{ id: "skip", field: "skipped", value: "—", path: c.note ?? "skipped" }] : []);

export function toSignalGraph(r: Ok, now: Date = new Date()): SignalGraphData {
  const c = r.company, f = r.fields, k = r.calls;
  const traffic = `web_traffic.domain_traffic["${c.web.domain ?? c.domain}"]`;
  const topFn = c.headcount.byFunction[0];
  const founder = k.founders.data?.people[0];
  const pastOf = (p?: LivePerson) => p?.past.find((e) => e.company && e.company !== c.name);
  const news0 = k.news.data?.results[0];
  const comp0 = k.comps.data?.[0];
  const body = (x: LiveCall) => JSON.stringify(x.body ?? {});
  const call = (x: LiveCall, extra: Omit<SignalCall, "id" | "method" | "path" | "body" | "ms" | "chips"> & { chips: SignalChip[] }): SignalCall => ({
    id: x.id,
    method: x.method,
    path: x.path,
    body: body(x),
    ms: x.ms,
    ...extra,
    chips: [...(extra.chips.length ? extra.chips : errChip(x).length ? errChip(x) : [{ id: "none", field: "results", value: "none", path: "no data returned" }]), ...staleChip(x)],
    lead: extra.chips.length ? extra.lead : (errChip(x)[0]?.id ?? "none"),
  });

  const calls: SignalCall[] = [
    call(k.identify, {
      place: "tl", icon: "identify", lead: "conf",
      chips: chips([
        k.identify.data?.confidence != null ? { id: "conf", field: "confidence_score", value: String(k.identify.data.confidence), short: "match", path: "[0].matches[0].confidence_score" } : null,
        { id: "cid", field: "crustdata_company_id", value: String(c.id), path: "[0].matches[0].company_data.crustdata_company_id" },
        k.identify.data?.matchType ? { id: "mt", field: "match_type", value: k.identify.data.matchType, path: "[0].match_type" } : null,
      ]),
    }),
    call(k.enrich, {
      place: "l", icon: "company", lead: "htot",
      chips: chips([
        chip("htot", "headcount.total", f.headcountLatest, fmtInt, { short: "headcount" }),
        chip("hc6", "headcount.growth_percent.six_months", f.headcountGrowth6m, fmtPct, { tone: isOk(f.headcountGrowth6m) && n(f.headcountGrowth6m.value) < 0 ? "down" : "up", short: "6-mo growth" }),
        chip("round", "funding.last_round_type", f.lastRoundType, fmtRound, { short: "last round" }),
        chip("raised", "funding.total_investment_usd", f.fundingTotal, fmtM, { short: "raised" }),
        chip("webqoq", `${traffic}.qoq_pct`, f.webTrafficQoQ, fmtPct, { tone: isOk(f.webTrafficQoQ) && n(f.webTrafficQoQ.value) < 0 ? "down" : "up", short: "web traffic 3mo" }),
      ]),
      sparks: [
        spark("hcts", "headcount.timeseries", "headcount", c.headcount.monthly, fmtInt),
        topFn ? spark("fnts", `headcount.by_function_timeseries.CURRENT_FUNCTION.${topFn.label}`, `${topFn.label.toLowerCase()} headcount`, topFn.monthly, fmtInt) : null,
        spark("web", `${traffic}.monthly_visitors_timeseries`, "monthly_visitors", c.web.monthly, (v) => fmtCompact(v)),
      ].filter((x): x is SignalSpark => !!x),
    }),
    call(k.founders, {
      place: "bl", icon: "person", note: "founders", lead: founder ? "name" : "count",
      chips: chips([
        founder ? { id: "name", field: "profiles[0].basic_profile.name", value: founder.name, short: founder.title ?? "founder", path: "profiles[0].basic_profile.name" } : null,
        chip("count", "profiles[]", f.foundersFound, fmtInt, { short: "founders" }),
        pastOf(founder) ? { id: "past", field: "experience.employment_details.past", value: `${pastOf(founder)!.company}${pastOf(founder)!.title ? ` · ${pastOf(founder)!.title}` : ""}`, short: "past:", path: "profiles[0].experience.employment_details.past[] (latest role at another company)" } : null,
      ]),
    }),
    call(k.jobs, {
      place: "br", icon: "job", lead: "total",
      chips: chips([
        chip("total", "total_count", f.openRoles, fmtInt, { short: "open roles", tone: "up" }),
        chip("eng", "job_listings[].job_details.category", f.engineeringRolesSample, (v) => `Engineering × ${fmtInt(v)}`, { short: "engineering (sample)" }),
      ]),
    }),
    call(k.news, {
      place: "tr", icon: "web", lead: news0 ? "title" : "count",
      chips: chips([
        news0 ? { id: "title", field: "results[].title", value: news0.title.length > 42 ? `${news0.title.slice(0, 41)}…` : news0.title, short: "news", path: `results[] (first mentioning "${c.name}").title` } : null,
        k.news.status === "ok" ? { id: "count", field: "results[]", value: `${k.news.data?.results.length ?? 0} on-topic`, short: "results", path: `results[] mentioning "${c.name}"` } : null,
      ]),
    }),
    call(k.comps, {
      place: "b", icon: "company", note: "comparables", lead: comp0 ? "first" : "count",
      chips: chips([
        comp0 ? { id: "first", field: "companies[].basic_info.name", value: comp0.name, short: "closest", path: "companies[] (first with id and name).basic_info.name" } : null,
        chip("count", "companies[]", f.compsFound, fmtInt, { short: "comparables" }),
      ]),
    }),
  ];

  // Replay timeline from the real latencies, compressed so the slowest call (web search, 4–7 s live) lands at ~4.5 s.
  const longest = Math.max(1, ...calls.map((x) => x.ms));
  const scale = Math.min(1, 3600 / longest);
  const t: SignalEvent[] = [{ at: 0, type: "query" }, { at: 650, type: "fanout" }];
  const idDone = 900 + Math.max(250, k.identify.ms * scale);
  let last = 0;
  calls.forEach((x, i) => {
    const start = x.id === "identify" ? 900 : idDone + 100 + i * 120;
    const done = start + Math.max(300, x.ms * scale);
    t.push({ at: start, type: "call", call: x.id });
    x.chips.forEach((ch, j) => t.push({ at: done - 200 + j * 70, type: "chip", call: x.id, chip: ch.id }));
    t.push({ at: done + x.chips.length * 70, type: "done", call: x.id });
    last = Math.max(last, done + x.chips.length * 70);
  });
  if (isOk(f.headcountLatest)) t.push({ at: idDone + 900, type: "stream", who: c.name, text: `${fmtInt(f.headcountLatest.value)} people on Crustdata` });
  if (isOk(f.openRoles)) t.push({ at: idDone + 1500, type: "stream", who: c.name, text: `${fmtInt(f.openRoles.value)} open roles` });
  t.push({ at: last + 400, type: "decide" });
  t.sort((a, b) => a.at - b.at);
  const end = last + 400;

  const g6 = f.headcountGrowth6m;
  return {
    company: { id: c.domain, name: c.name, initial: c.name[0]!.toUpperCase(), line: c.categories[0] ?? c.industries[0], domain: c.domain, ...(c.logoUrl ? { logoUrl: c.logoUrl } : {}) },
    provider: {
      name: "Crustdata", graphLabel: "The Crustdata Graph", apiVersion: CRUSTDATA_API_VERSION, markUrl: "/logos/tools/crustdata-mark.svg",
      stats: [],
      sources: ["headcount", "funding", "web traffic", "people", "job posts", "news"],
    },
    eyebrow: "Signals · live research",
    headline: isOk(f.headcountLatest)
      ? { pre: `${fmtInt(f.headcountLatest.value)} people`, hl: isOk(g6) ? `, ${fmtPct(g6.value)} in 6 months` : "", post: "" } // data-literal-ok: window of the Crustdata field (growth_percent.six_months / web_traffic qoq_pct)
      : { pre: `${c.name} on Crustdata` },
    requestedAt: r.requestedAt,
    requestedAgo: relTime(r.requestedAt, now),
    calls,
    fit: {
      label: "Signal score",
      unscored: { reason: explain(f.signalScore).replace(/^Unavailable: /, "") },
      base: { label: "No firm thesis configured", value: null },
      bands: { strong: "Strong", maybe: "Possible", weak: "Weak" },
      contributions: [],
      recommendation: {
        label: "Review the evidence",
        why: "No score without a thesis: read the team and hiring signals directly.",
        actions: [
          { id: "team", label: "Review team", done: "Opened team", primary: true },
          { id: "overview", label: "Open overview", done: "Opened overview" },
        ],
      },
    },
    timeline: t,
    frames: [350, idDone, idDone + 600, Math.round((idDone + end) / 2), end - 200, end + 300],
  };
}

/* ── Deal page ── */
/** Last round fact: amount, type and date, each with its own field and source. */
function lastRoundWhy(f: Record<string, F>, calls: CallMeta[]): Why {
  const parts = [f.lastFunding, f.lastRoundType, f.lastFundingDate].map((x) => whyFromField(x, calls));
  const okParts = parts.filter((w) => w.status === "ok");
  if (!okParts.length) return parts[0]!;
  return { status: "ok", summary: okParts.map((w) => w.summary).join(" "), method: "Read as reported (three funding fields)", evidence: [], sources: okParts.flatMap((w) => w.sources) };
}
/** A comparable's raised amount, read from its row in the comps search. 0 is how Crustdata reports "not known". */
function compWhy(x: { id: number; name: string; totalUsd?: number }, i: number, call: LiveCall): Why {
  if (!x.totalUsd) return { status: "unavailable", summary: `Crustdata reports ${x.totalUsd === 0 ? "0" : "no"} funding.total_investment_usd for ${x.name}; shown as unknown rather than as zero.`, evidence: [], sources: [] };
  return whyFromCall(call, `companies[] (crustdata_company_id ${x.id}).funding.total_investment_usd`, `${x.name}: ${fmtMoney(money(x.totalUsd, "USD"))} raised in total, as indexed (USD per the field name; not converted).`);
}

const metric = (id: string, label: string, f: F | undefined, fmt: (v: unknown) => string, calls: CallMeta[], sub?: string): DealMetric => ({ id, label, value: show(f, fmt), ...(sub ? { sub } : {}), hint: explain(f), why: whyFromField(f, calls) });

function teamPerson(p: LivePerson, i: number, domain: string, companyName: string, retrieved: string, call: LiveCall): TeamPerson {
  const prev = p.past.find((e) => e.company !== companyName);
  const cur = p.current.find((e) => e.company === companyName) ?? p.current[0];
  return {
    id: p.id != null ? String(p.id) : `f${i}`,
    name: p.name,
    initials: initials(p.name),
    role: p.title ?? cur?.title ?? "Founder",
    prev: prev ? `${prev.company}${prev.title ? ` · ${prev.title}` : ""}` : "No earlier role indexed",
    tenure: cur?.start ? `Since ${fmtMonthYear(cur.start) ?? cur.start}${p.schools[0] ? ` · ${p.schools[0].school}` : ""}` : (p.schools[0]?.school ?? "—"),
    check: { label: "Crustdata profile", ok: true },
    href: livePersonHref(p, domain),
    founder: true,
    hint: `Crustdata /person/search · profiles[${i}] · retrieved ${fmtDateTime(retrieved)}`,
    why: whyFromCall(call, `profiles[${i}]`, `${p.name} was returned by the founder search (current company_id + title contains "Founder"); title and earlier roles are as indexed on that profile.`, { url: p.linkedinUrl }),
  };
}

export function toLiveDeal(r: Ok, now: Date = new Date()): DealData {
  const c = r.company, f = r.fields, k = r.calls;
  const calls: CallMeta[] = Object.values(k);
  const company = { id: c.domain, name: c.name, initial: c.name[0]!.toUpperCase(), line: c.categories[0] ?? c.industries[0], domain: c.domain, ...(c.logoUrl ? { logoUrl: c.logoUrl } : {}) };
  const asOf = `retrieved ${relTime(k.enrich.retrievedAt ?? r.requestedAt, now)}`;
  const enrichSrc = crust("Crustdata · company enrich", asOf);
  const sub = [c.categories[0] ?? c.industries[0], show(f.lastRoundType, fmtRound) !== "—" ? show(f.lastRoundType, fmtRound) : null, c.hq].filter(Boolean).join(" · ");

  const founders = k.founders.data?.people ?? [];
  const months = c.headcount.monthly.slice(-6);
  const fnSeries = c.headcount.byFunction.slice(0, 3);
  const fnMonths = fnSeries[0]?.monthly.map((p) => p.date) ?? [];

  const events: DealEvent[] = [
    ...(isOk(f.foundedYear) ? [{ id: "e-founded", at: String(f.foundedYear.value), label: "Company founded", detail: explain(f.foundedYear).split("\n")[0], by: "person" as const, who: "—" }] : []),
    ...(isOk(f.lastFundingDate) ? [{ id: "e-round", at: fmtDate(String(f.lastFundingDate.value)), label: `Raised ${show(f.lastRoundType, fmtRound)}`, detail: isOk(f.lastFunding) ? `${fmtM(f.lastFunding.value)} · Crustdata funding` : "Crustdata funding", by: "person" as const, who: "$" }] : []),
    { id: "e-research", at: fmtDateTime(r.requestedAt), label: `Researched ${c.domain} on Crustdata`, detail: `${Object.values(k).filter((x) => x.status === "ok").length} of ${Object.values(k).length} calls succeeded`, by: "agent", who: "Live research", tone: "ok" },
  ];

  const kpi = (id: string, label: string, fl: F | undefined, fmt: (v: unknown) => string, subText: string, trend?: Point[]): DealKpi => ({
    id, label, value: show(fl, fmt), sub: isOk(fl) ? subText : explain(fl).replace(/^Unavailable: /, ""), verified: isOk(fl) && uncitedOk(fl).length === 0, hint: explain(fl), why: whyFromField(fl, calls), ...(trend && trend.length >= 2 ? { trend: trend.map((p) => p.v) } : {}),
  });

  const sections: Record<string, DealSection> = {
    overview: {
      kind: "overview", id: "overview", eyebrow: "Overview", source: enrichSrc,
      headline: { pre: c.description ? `${c.description}` : c.name, hl: "", post: "" },
      kpis: [
        kpi("hc", "Headcount", f.headcountLatest, fmtInt, `${show(f.headcountGrowth6m, fmtPct)} in 6 months`, c.headcount.monthly), // data-literal-ok: window of the Crustdata field (growth_percent.six_months / web_traffic qoq_pct)
        kpi("raised", "Total raised", f.fundingTotal, fmtM, `Last round ${show(f.lastRoundType, fmtRound)}`),
        kpi("roles", "Open roles", f.openRoles, fmtInt, "Crustdata job search"),
        kpi("web", "Monthly visitors", f.webMonthlyVisitors, (v) => fmtCompact(v), `${show(f.webTrafficQoQ, fmtPct)} over 3 months`, c.web.monthly), // data-literal-ok: window of the Crustdata field (growth_percent.six_months / web_traffic qoq_pct)
      ],
      facts: [
        { k: "Founded", v: show(f.foundedYear, String), why: whyFromField(f.foundedYear, calls) },
        { k: "HQ", v: c.hq ?? "—", ...(c.hq ? { why: whyFromCall(k.enrich, `${ENRICH_ROOT}.locations.headquarters`, `Headquarters as indexed: ${c.hq}.`) } : {}) },
        { k: "Team", v: c.employeeRange ? `${c.employeeRange} (range)` : "—", ...(c.employeeRange ? { why: whyFromCall(k.enrich, `${ENRICH_ROOT}.basic_info.employee_count_range`, `Crustdata's employee-count band (${c.employeeRange}); the exact latest headcount is in the Headcount tile.`) } : {}) },
        { k: "Last round", v: [show(f.lastRoundType, fmtRound), show(f.lastFunding, fmtM), show(f.lastFundingDate, (v) => fmtDate(String(v)))].filter((x) => x !== "—").join(" · ") || "—", why: lastRoundWhy(f, calls) },
        { k: "Investors", v: c.funding.investors.slice(0, 3).join(", ") || "—", ...(c.funding.investors.length ? { why: whyFromCall(k.enrich, `${ENRICH_ROOT}.funding.investors`, `${c.funding.investors.length} investor(s) indexed: ${c.funding.investors.join(", ")}.`) } : {}) },
        { k: "Website", v: c.website?.replace(/^https?:\/\//, "") ?? c.domain, why: whyFromCall(k.enrich, c.website ? `${ENRICH_ROOT}.basic_info.website` : `${ENRICH_ROOT}.basic_info.primary_domain`, `Website as indexed for ${c.name}.`, c.website ? { url: c.website } : {}) },
      ],
      thesis: [],
      timeline: events,
    },
    team: {
      kind: "team", id: "team", eyebrow: "Team", source: crust("Crustdata · people", asOf),
      headline: isOk(f.foundersFound) ? { pre: `${fmtInt(f.foundersFound.value)} founder${n(f.foundersFound.value) === 1 ? "" : "s"} found`, hl: isOk(f.headcountLatest) ? `, ${fmtInt(f.headcountLatest.value)} people` : "", post: "" } : { pre: "Founders unavailable" },
      stats: [
        { id: "hc", label: "Headcount", value: show(f.headcountLatest, fmtInt), hint: explain(f.headcountLatest), why: whyFromField(f.headcountLatest, calls) },
        { id: "g", label: "6-mo growth", value: show(f.headcountGrowth6m, fmtPct), hint: explain(f.headcountGrowth6m), why: whyFromField(f.headcountGrowth6m, calls) },
        { id: "open", label: "Open roles", value: show(f.openRoles, fmtInt), hint: explain(f.openRoles), why: whyFromField(f.openRoles, calls) },
        { id: "fnd", label: "Founders found", value: show(f.foundersFound, fmtInt), hint: explain(f.foundersFound), why: whyFromField(f.foundersFound, calls) },
      ],
      people: founders.map((p, i) => teamPerson(p, i, c.domain, c.name, k.founders.retrievedAt ?? r.requestedAt, k.founders)),
      hiring: fnSeries.length
        ? { months: fnMonths.map(fmtMonth), series: fnSeries.map((s) => ({ id: s.label, label: s.label, values: fnMonths.map((d) => s.monthly.find((p) => p.date === d)?.v ?? 0) })) }
        : { months: months.map((p) => fmtMonth(p.date)), series: months.length ? [{ id: "total", label: "Total", values: months.map((p) => p.v) }] : [] },
    },
  };
  if (k.comps.status === "ok" && k.comps.data?.length) {
    sections.market = {
      kind: "market", id: "market", eyebrow: "Market", source: crust("Crustdata · company search", `retrieved ${relTime(k.comps.retrievedAt ?? r.requestedAt, now)}`),
      headline: { pre: `Top ${k.comps.data.length} similar companies on Crustdata search`, hl: "", post: "" },
      note: explain(f.compsFound),
      sizes: [],
      comps: [
        { id: "us", company, stage: show(f.lastRoundType, fmtRound), raised: show(f.fundingTotal, fmtM), multiple: "—", note: "This company", us: true, why: whyFromField(f.fundingTotal, calls) },
        ...k.comps.data.map((x, i) => ({
          id: String(x.id), company: { id: x.domain ?? String(x.id), name: x.name, initial: x.name[0]!.toUpperCase(), ...(x.domain ? { domain: x.domain } : {}) },
          stage: x.lastRoundType ? fmtRound(x.lastRoundType) : "—", raised: x.totalUsd ? fmtMoney(money(x.totalUsd, "USD")) : "—", multiple: "—",
          why: compWhy(x, i, k.comps),
          note: [x.description, x.yearFounded ? `founded ${x.yearFounded}` : null].filter(Boolean).join(" · ") || "—",
        })),
      ],
    };
  }

  const outline: OutlineItem[] = [
    { id: "overview", label: "Overview", state: "done" },
    { id: "team", label: "Team", state: k.founders.status === "ok" ? "done" : "warn", ...(founders.length ? { count: founders.length } : {}) },
    ...(sections.market ? [{ id: "market", label: "Market", state: "done" as const, count: k.comps.data!.length }] : []),
  ];

  const evidence: EvidenceItem[] = c.news.slice(0, 3).map((x, i) => ({
    id: `news${i}`, kind: "doc", source: { kind: "web", label: x.publisher?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "News" }, where: x.date ? fmtDate(x.date) : "date not reported", highlight: x.title, ...(x.url ? { href: x.url } : {}),
  }));

  return {
    header: {
      company, stageLabel: "Live research", subtitle: sub || c.domain, files: { reviewed: 0, total: 0 }, icLabel: "Not scheduled", flags: [],
      metrics: [
        metric("hc", "Headcount", f.headcountLatest, fmtInt, calls, isOk(f.headcountGrowth6m) ? `${fmtPct(f.headcountGrowth6m.value)} 6 mo` : undefined),
        metric("raised", "Total raised", f.fundingTotal, fmtM, calls),
        metric("round", "Last round", f.lastRoundType, fmtRound, calls),
        metric("roles", "Open roles", f.openRoles, fmtInt, calls),
        metric("web", "Monthly visitors", f.webMonthlyVisitors, (v) => fmtCompact(v), calls),
      ],
    },
    outline,
    section: {
      eyebrow: "Claims", confidence: "Low", headline: { pre: "No deck claims yet — no data room is connected" },
      bridgeNote: "", bridge: [], claims: [], ask: { text: "Upload a data room to check the founder's claims", action: { id: "room", label: "Open data room" } },
    },
    sections,
    evidence: { agreeNote: evidence.length ? `${evidence.length} news items · Crustdata` : "No news indexed", items: evidence },
    team: { members: [], sourcedBy: { initials: "DD", name: "Deal Desk", via: "Live research · Crustdata", at: fmtDate(r.requestedAt), locked: false }, suggestion: null, canClaim: false, ownerRule: "ask_first" },
    signals: toSignalGraph(r, now),
  };
}

/** Header-only shell for loading / error / no-match states (the screen needs a company name to render chrome). */
export function placeholderDeal(domain: string): DealData {
  const name = domain;
  return {
    header: { company: { id: domain, name, initial: name[0]!.toUpperCase(), domain }, stageLabel: "Live research", subtitle: domain, files: { reviewed: 0, total: 0 }, icLabel: "Not scheduled", flags: [] },
    outline: [],
    section: { eyebrow: "", confidence: "Low", headline: { pre: "" }, bridgeNote: "", bridge: [], claims: [], ask: { text: "", action: { id: "none", label: "" } } },
    evidence: { agreeNote: "", items: [] },
    team: { members: [], sourcedBy: { initials: "DD", name: "Deal Desk", via: "Live research", at: "", locked: false }, suggestion: null, canClaim: false, ownerRule: "ask_first" },
  };
}

/** Signals graph shell for the no-match state: the screen renders "No Crustdata match for <domain>" from it. */
export function noMatchSignals(domain: string, identify: LiveCall, requestedAt: string): SignalGraphData {
  return {
    company: { id: domain, name: domain, initial: domain[0]!.toUpperCase(), domain },
    provider: { name: "Crustdata", graphLabel: "The Crustdata Graph", apiVersion: CRUSTDATA_API_VERSION, markUrl: "/logos/tools/crustdata-mark.svg", stats: [], sources: [] },
    eyebrow: "Signals · live research",
    headline: { pre: `No Crustdata match for ${domain}` },
    requestedAt,
    requestedAgo: fmtAgo(requestedAt),
    calls: [
      {
        id: "identify", method: identify.method, path: identify.path, body: JSON.stringify(identify.body), ms: identify.ms, icon: "identify",
        // identify.note carries the route's "did you mean" suggestions for a typo'd domain (never auto-picked)
        chips: [{ id: "m", field: "matches", value: "[]", path: "[0].matches" }, ...staleChip(identify), ...(identify.note && /Did you mean /.test(identify.note) ? [{ id: "dym", field: "did you mean", value: identify.note.replace(/^.*Did you mean /, "").replace(/\?$/, ""), path: identify.note, short: "did you mean" }] : [])],
      },
    ],
    fit: { label: "Signal score", unscored: { reason: "No company matched, so there is nothing to score." }, base: { label: "—", value: null }, bands: { strong: "Strong", maybe: "Possible", weak: "Weak" }, contributions: [], recommendation: { label: "", why: "", actions: [] } },
    timeline: [{ at: 0, type: "query" }],
    frames: [0],
  };
}

/* ── Decisions + valuation (GET /api/deals/:id/decisions → fields; /valuation → explainable is accepted too) ── */
type ValuationKey = "low" | "high" | "cap" | "ask" | "returnMultipleLow" | "returnMultipleHigh" | "compsMedianMultiple";
type CriterionKey = "criterionSector" | "criterionStage" | "criterionGeo" | "criterionCheckSize" | "criterionMemory";
type Explainable = Partial<Record<ValuationKey | CriterionKey | "valuationLow" | "valuationHigh" | "valuationCap" | "founderAsk" | "fitScore" | "screenerVerdict" | "diligenceVerdict", F>>;
const CRITERIA: [CriterionKey, string][] = [["criterionSector", "Sector"], ["criterionStage", "Stage"], ["criterionGeo", "Geography"], ["criterionCheckSize", "Check size"], ["criterionMemory", "Firm memory"]];
const fmtX = (v: unknown) => `${n(v)}×`;
const fmtMoneyOrNum = (v: unknown) => (isMoney(v) ? fmtMoney(v) : String(v));
const fmtScore = (v: unknown) => `${fmtInt(v)} / 100`; // data-literal-ok: score scale of the decision engine's fitScore
const MISSING: F = { status: "unavailable", reason: "Not provided by the API." };

/** Decision + valuation section: every stat from a ComputedField ("—" + reason on hover when unavailable); no chart without values. */
export function toValuationSection(x: Explainable): DealSection {
  const stat = (id: string, label: string, f: F, fmt: (v: unknown) => string) => ({ id, label, value: show(f, fmt), hint: explain(f), why: whyFromField(f) });
  const lo = x.valuationLow ?? x.low ?? MISSING, hi = x.valuationHigh ?? x.high ?? MISSING;
  const priced = isOk(lo) && isOk(hi);
  // Fit and screener verdict: the sources panel shows the decision plus each mandate criterion it was decided on.
  const criteria = CRITERIA.map(([k, name]) => ({ name, field: x[k] }));
  const decided = (id: string, label: string, f: F, fmt: (v: unknown) => string) => ({ ...stat(id, label, f, fmt), why: whyFromDecision(f, criteria) });
  const decision = [
    ...(x.fitScore ? [decided("fit", "Fit score", x.fitScore, fmtScore)] : []),
    ...(x.screenerVerdict ? [decided("screener", "Screener verdict", x.screenerVerdict, String)] : []),
    ...(x.diligenceVerdict ? [stat("diligence", "Diligence verdict", x.diligenceVerdict, String)] : []),
  ];
  return {
    kind: "valuation", id: "valuation", eyebrow: decision.length ? "Decision · valuation" : "Valuation",
    headline: priced ? { pre: `${fmtMoneyOrNum(lo.value)}–${fmtMoneyOrNum(hi.value)}` } : { pre: "No valuation for this deal yet" },
    stats: [
      ...decision,
      stat("low", "Low", lo, fmtMoneyOrNum),
      stat("high", "High", hi, fmtMoneyOrNum),
      stat("ask", "Founder ask", x.founderAsk ?? x.ask ?? MISSING, fmtMoneyOrNum),
      stat("rml", "Return multiple (low)", x.returnMultipleLow ?? MISSING, fmtX),
      stat("rmh", "Return multiple (high)", x.returnMultipleHigh ?? MISSING, fmtX),
      stat("comps", "Comps median multiple", x.compsMedianMultiple ?? MISSING, fmtX),
    ],
    unavailable: priced ? undefined : explain(lo).replace(/^Unavailable: /, ""),
  };
}

type FitInputs = Partial<Record<CriterionKey, F>> & { fitScore?: F; screenerVerdict?: F };
const criterionVerdict = (f: F | undefined) => (isOk(f) && (f.value === "met" || f.value === "not met") ? (f.value as "met" | "not met") : null);

/**
 * Per-criterion contributions to an ok fitScore ("share of scored mandate criteria met × 100", src/lib/numbers/local.ts):
 * the score is split over the met criteria (largest remainder, so the weights sum to the score exactly); not met and
 * not-scored criteria contribute 0 and carry their reason. Returns null when the criteria do not reproduce the score
 * (e.g. a builder-supplied score with its own model): then no split is shown rather than a made-up one.
 */
export function fitContributions(x: FitInputs, score: number): SignalContribution[] | null {
  const rows = CRITERIA.map(([k, name]) => ({ k, name, f: x[k], v: criterionVerdict(x[k]) }));
  const scored = rows.filter((r) => r.v), met = scored.filter((r) => r.v === "met");
  if (!scored.length || Math.round((100 * met.length) / scored.length) !== score) return null;
  const each = met.length ? Math.floor(score / met.length) : 0;
  let extra = met.length ? score - each * met.length : 0;
  const chipOf: Partial<Record<CriterionKey, string>> = { criterionStage: "round" };
  return rows.map(({ k, name, f, v }) => {
    const weight = v === "met" ? each + (extra-- > 0 ? 1 : 0) : 0;
    const state = v ?? (isOk(f) ? `${String(f.value)} · not scored` : "not scored");
    const why = isOk(f) ? f.reasoning || f.method : f ? f.reason : "Not provided by the API.";
    const cite = isOk(f) ? f.citations[0] : undefined;
    return { id: k, label: `${name} · ${state}`, call: cite?.endpoint === "POST /company/enrich" ? "enrich" : "", chip: chipOf[k] ?? "", weight, source: why };
  });
}

/** Score events after the last call result (so each contribution lands on the tile), then the decision. */
function scoreTimeline(g: SignalGraphData, contributions: SignalContribution[]): Pick<SignalGraphData, "timeline" | "frames"> {
  const rest = g.timeline.filter((e) => e.type !== "decide" && e.type !== "score");
  const after = Math.max(0, ...rest.map((e) => e.at)) + 250;
  const scores: SignalEvent[] = contributions.map((k, i) => ({ at: after + i * 250, type: "score", contribution: k.id }));
  const decide = after + Math.max(0, contributions.length - 1) * 250 + 1000;
  const frames = [...g.frames.slice(0, 4), after + Math.floor(contributions.length / 2) * 250, decide + 700];
  const done: SignalEvent = { at: decide, type: "decide" };
  return { timeline: [...rest, ...scores, done].sort((a, b) => a.at - b.at), frames };
}

/** While GET /api/deals/:id/decisions is in flight: the tile reads "…" with what it is waiting for (no number). */
export function withFitPending(d: DealData): DealData {
  if (!d.signals) return d;
  return { ...d, signals: { ...d.signals, fit: { ...d.signals.fit, label: "Fit score", unscored: { reason: "Scoring against the firm mandate…", pending: true }, base: { ...d.signals.fit.base, value: null } } } };
}

/**
 * Fit tile + header pill from the decision engine's fitScore / screenerVerdict (pass the decisions response `fields`,
 * which also carry the mandate criteria). An ok numeric fitScore becomes the header pill and the tile's score: split
 * into per-criterion contributions when the criteria reproduce it (base 0), else as the tile's base score. Otherwise
 * the tile stays unscored with the decision's own reason.
 */
export function withDecisionFit(d: DealData, decisions: FitInputs): DealData {
  const fit = decisions.fitScore;
  if (!d.signals || !fit) return d;
  const verdict = decisions.screenerVerdict;
  if (isOk(fit) && Number.isFinite(n(fit.value))) {
    const score = Math.round(n(fit.value));
    const contributions = fitContributions(decisions, score);
    const met = contributions?.filter((k) => k.weight > 0).length ?? 0, scored = CRITERIA.filter(([k]) => criterionVerdict(decisions[k])).length;
    return {
      ...d,
      header: { ...d.header, fit: { score } },
      signals: {
        ...d.signals,
        ...(contributions ? scoreTimeline(d.signals, contributions) : {}),
        fit: {
          ...d.signals.fit,
          label: "Fit score",
          unscored: undefined,
          base: contributions ? { label: `Mandate criteria · ${met} of ${scored} scored met`, value: 0 } : { label: fit.method, value: score },
          contributions: contributions ?? [],
          recommendation: { ...d.signals.fit.recommendation, ...(isOk(verdict) ? { label: String(verdict.value), why: verdict.reasoning || fit.reasoning } : { why: fit.reasoning }) },
        },
      },
    };
  }
  return { ...d, signals: { ...d.signals, fit: { ...d.signals.fit, unscored: { reason: explain(fit).replace(/^Unavailable: /, "") } } } };
}
