// /api/live/research result → the port DealData (deal page header, Signals graph, Overview / Team / Market sections).
// Every number shown comes from a ComputedField in `research.fields` (value + reasoning + citations, hover via
// explain()) or is a raw Crustdata series value drawn as a chart under a cited card. Nothing is invented: sections the
// API cannot back (claims, cap table, valuation, customers) are not shown, and the fit tile is explicitly unscored.
import type { DealData, DealEvent, DealKpi, DealMetric, DealSection, EvidenceItem, OutlineItem, SignalCall, SignalChip, SignalEvent, SignalGraphData, SignalSpark, SourceRef, TeamPerson } from "@port/types";
import { explain, isOk, show, type ComputedField } from "@/lib/fields";
import type { LiveCall, LivePerson, Point, ResearchResult } from "@/lib/live/types";
import { CRUSTDATA_API_VERSION } from "@/lib/crustdata/http";

type Ok = Extract<ResearchResult, { status: "ok" }>;
type F = ComputedField<unknown>;

/* ── formatting (display only; the value itself comes from the field) ── */
const n = (v: unknown) => (typeof v === "number" ? v : Number(v));
export const fmtInt = (v: unknown) => n(v).toLocaleString("en-US");
export const fmtPct = (v: unknown) => `${n(v) > 0 ? "+" : n(v) < 0 ? "−" : ""}${Math.abs(Math.round(n(v)))}%`;
export const fmtUsdM = (v: unknown) => `$${n(v) >= 10 ? Math.round(n(v)) : n(v)}M`;
export const fmtRound = (v: unknown) => String(v).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtCompact = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(Math.round(v)));
const monthLabel = (iso: string) => new Date(`${iso.slice(0, 7)}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
const pathOfField = (f: F | undefined) => (isOk(f) ? f.citations[0]?.path : undefined);

/** "2h ago" relative to now; the absolute time stays in requestedAt. */
export function relTime(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
}

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
    chips: extra.chips.length ? extra.chips : errChip(x).length ? errChip(x) : [{ id: "none", field: "results", value: "none", path: "no data returned" }],
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
        chip("raised", "funding.total_investment_usd", f.fundingTotalUsdM, fmtUsdM, { short: "raised" }),
        chip("webqoq", `${traffic}.qoq_pct`, f.webTrafficQoQ, fmtPct, { tone: isOk(f.webTrafficQoQ) && n(f.webTrafficQoQ.value) < 0 ? "down" : "up", short: "web traffic 3mo" }),
      ]),
      sparks: [
        spark("hcts", "headcount.timeseries", "headcount", c.headcount.monthly, fmtInt),
        topFn ? spark("fnts", `headcount.by_function_timeseries.CURRENT_FUNCTION.${topFn.label}`, `${topFn.label.toLowerCase()} headcount`, topFn.monthly, fmtInt) : null,
        spark("web", `${traffic}.monthly_visitors_timeseries`, "monthly_visitors", c.web.monthly, fmtCompact),
      ].filter((x): x is SignalSpark => !!x),
    }),
    call(k.founders, {
      place: "bl", icon: "person", note: "founders", lead: founder ? "name" : "count",
      chips: chips([
        founder ? { id: "name", field: "profiles[0].basic_profile.name", value: founder.name, short: founder.title ?? "founder", path: "profiles[0].basic_profile.name" } : null,
        chip("count", "profiles[]", f.foundersFound, fmtInt, { short: "founders" }),
        pastOf(founder) ? { id: "past", field: "experience.employment_details.past", value: `${pastOf(founder)!.company}${pastOf(founder)!.title ? ` · ${pastOf(founder)!.title}` : ""}`, short: "past:", path: "profiles[0].experience.employment_details.past[0]" } : null,
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
        news0 ? { id: "title", field: "results[0].title", value: news0.title.length > 42 ? `${news0.title.slice(0, 41)}…` : news0.title, short: "news", path: "results[0].title" } : null,
        k.news.status === "ok" ? { id: "count", field: "results[]", value: `${k.news.data?.results.length ?? 0} on-topic`, short: "results", path: `results[] mentioning "${c.name}"` } : null,
      ]),
    }),
    call(k.comps, {
      place: "b", icon: "company", note: "comparables", lead: comp0 ? "first" : "count",
      chips: chips([
        comp0 ? { id: "first", field: "companies[0].basic_info.name", value: comp0.name, short: "closest", path: "companies[0].basic_info.name" } : null,
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
      stats: [{ id: "p", label: "1B+ people", icon: "people" }, { id: "c", label: "60M+ companies", icon: "companies" }, { id: "a", label: "REST API", icon: "api" }],
      sources: ["headcount", "funding", "web traffic", "people", "job posts", "news"],
    },
    eyebrow: "Signals · live research",
    headline: isOk(f.headcountLatest)
      ? { pre: `${fmtInt(f.headcountLatest.value)} people`, hl: isOk(g6) ? `, ${fmtPct(g6.value)} in 6 months` : "", post: "" }
      : { pre: `${c.name} on Crustdata` },
    requestedAt: r.requestedAt,
    requestedAgo: relTime(r.requestedAt, now),
    calls,
    fit: {
      label: "Signal score",
      unscored: { reason: explain(f.signalScore).replace(/^Unavailable: /, "") },
      base: { label: "No firm thesis configured", value: 0 },
      threshold: { value: 75, label: "Strong" },
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
const metric = (id: string, label: string, f: F | undefined, fmt: (v: unknown) => string, sub?: string): DealMetric => ({ id, label, value: show(f, fmt), ...(sub ? { sub } : {}), hint: explain(f) });

function teamPerson(p: LivePerson, i: number, domain: string, companyName: string, retrieved: string): TeamPerson {
  const prev = p.past.find((e) => e.company !== companyName);
  const cur = p.current.find((e) => e.company === companyName) ?? p.current[0];
  return {
    id: p.id != null ? String(p.id) : `f${i}`,
    name: p.name,
    initials: initials(p.name),
    role: p.title ?? cur?.title ?? "Founder",
    prev: prev ? `${prev.company}${prev.title ? ` · ${prev.title}` : ""}` : "No earlier role indexed",
    tenure: cur?.start ? `Since ${cur.start.slice(0, 7)}${p.schools[0] ? ` · ${p.schools[0].school}` : ""}` : (p.schools[0]?.school ?? "—"),
    check: { label: "Crustdata profile", ok: true },
    href: livePersonHref(p, domain),
    founder: true,
    hint: `Crustdata /person/search · profiles[${i}] · retrieved ${retrieved.slice(0, 16).replace("T", " ")}Z`,
  };
}

export function toLiveDeal(r: Ok, now: Date = new Date()): DealData {
  const c = r.company, f = r.fields, k = r.calls;
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
    ...(isOk(f.lastFundingDate) ? [{ id: "e-round", at: String(f.lastFundingDate.value), label: `Raised ${show(f.lastRoundType, fmtRound)}`, detail: isOk(f.lastFundingUsdM) ? `${fmtUsdM(f.lastFundingUsdM.value)} · Crustdata funding` : "Crustdata funding", by: "person" as const, who: "$" }] : []),
    { id: "e-research", at: new Date(r.requestedAt).toISOString().slice(0, 10), label: `Researched ${c.domain} on Crustdata`, detail: `${Object.values(k).filter((x) => x.status === "ok").length} of ${Object.values(k).length} calls returned data`, by: "agent", who: "Live research", tone: "ok" },
  ];

  const kpi = (id: string, label: string, fl: F | undefined, fmt: (v: unknown) => string, subText: string, trend?: Point[]): DealKpi => ({
    id, label, value: show(fl, fmt), sub: isOk(fl) ? subText : explain(fl).replace(/^Unavailable: /, ""), verified: isOk(fl), hint: explain(fl), ...(trend && trend.length >= 2 ? { trend: trend.map((p) => p.v) } : {}),
  });

  const sections: Record<string, DealSection> = {
    overview: {
      kind: "overview", id: "overview", eyebrow: "Overview", source: enrichSrc,
      headline: { pre: c.description ? `${c.description}` : c.name, hl: "", post: "" },
      kpis: [
        kpi("hc", "Headcount", f.headcountLatest, fmtInt, `${show(f.headcountGrowth6m, fmtPct)} in 6 months`, c.headcount.monthly),
        kpi("raised", "Total raised", f.fundingTotalUsdM, fmtUsdM, `Last round ${show(f.lastRoundType, fmtRound)}`),
        kpi("roles", "Open roles", f.openRoles, fmtInt, "Crustdata job search"),
        kpi("web", "Monthly visitors", f.webMonthlyVisitors, (v) => fmtCompact(n(v)), `${show(f.webTrafficQoQ, fmtPct)} over 3 months`, c.web.monthly),
      ],
      facts: [
        { k: "Founded", v: show(f.foundedYear, String) },
        { k: "HQ", v: c.hq ?? "—" },
        { k: "Team", v: c.employeeRange ? `${c.employeeRange} (range)` : "—" },
        { k: "Last round", v: [show(f.lastRoundType, fmtRound), show(f.lastFundingUsdM, fmtUsdM), show(f.lastFundingDate, String)].filter((x) => x !== "—").join(" · ") || "—" },
        { k: "Investors", v: c.funding.investors.slice(0, 3).join(", ") || "—" },
        { k: "Website", v: c.website?.replace(/^https?:\/\//, "") ?? c.domain },
      ],
      thesis: [],
      timeline: events,
    },
    team: {
      kind: "team", id: "team", eyebrow: "Team", source: crust("Crustdata · people", asOf),
      headline: isOk(f.foundersFound) ? { pre: `${fmtInt(f.foundersFound.value)} founder${n(f.foundersFound.value) === 1 ? "" : "s"} found`, hl: isOk(f.headcountLatest) ? `, ${fmtInt(f.headcountLatest.value)} people` : "", post: "" } : { pre: "Founders unavailable" },
      stats: [
        { id: "hc", label: "Headcount", value: show(f.headcountLatest, fmtInt), hint: explain(f.headcountLatest) },
        { id: "g", label: "6-mo growth", value: show(f.headcountGrowth6m, fmtPct), hint: explain(f.headcountGrowth6m) },
        { id: "open", label: "Open roles", value: show(f.openRoles, fmtInt), hint: explain(f.openRoles) },
        { id: "fnd", label: "Founders found", value: show(f.foundersFound, fmtInt), hint: explain(f.foundersFound) },
      ],
      people: founders.map((p, i) => teamPerson(p, i, c.domain, c.name, k.founders.retrievedAt ?? r.requestedAt)),
      hiring: fnSeries.length
        ? { months: fnMonths.map(monthLabel), series: fnSeries.map((s) => ({ id: s.label, label: s.label, values: fnMonths.map((d) => s.monthly.find((p) => p.date === d)?.v ?? 0) })) }
        : { months: months.map((p) => monthLabel(p.date)), series: months.length ? [{ id: "total", label: "Total", values: months.map((p) => p.v) }] : [] },
    },
  };
  if (k.comps.status === "ok" && k.comps.data?.length) {
    sections.market = {
      kind: "market", id: "market", eyebrow: "Market", source: crust("Crustdata · company search", `retrieved ${relTime(k.comps.retrievedAt ?? r.requestedAt, now)}`),
      headline: { pre: `${k.comps.data.length} companies doing similar work`, hl: "", post: "" },
      note: explain(f.compsFound),
      sizes: [],
      comps: [
        { id: "us", company, stage: show(f.lastRoundType, fmtRound), raised: show(f.fundingTotalUsdM, fmtUsdM), multiple: "—", note: "This company", us: true },
        ...k.comps.data.map((x) => ({
          id: String(x.id), company: { id: x.domain ?? String(x.id), name: x.name, initial: x.name[0]!.toUpperCase(), ...(x.domain ? { domain: x.domain } : {}) },
          stage: x.lastRoundType ? fmtRound(x.lastRoundType) : "—", raised: x.totalUsd != null ? fmtUsdM(Math.round(x.totalUsd / 1e5) / 10) : "—", multiple: "—",
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
    id: `news${i}`, kind: "doc", source: { kind: "web", label: x.publisher?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "News" }, where: x.date ?? "", highlight: x.title, ...(x.url ? { href: x.url } : {}),
  }));

  return {
    header: {
      company, stageLabel: "Live research", subtitle: sub || c.domain, files: { reviewed: 0, total: 0 }, icLabel: "Not scheduled", flags: [],
      metrics: [
        metric("hc", "Headcount", f.headcountLatest, fmtInt, isOk(f.headcountGrowth6m) ? `${fmtPct(f.headcountGrowth6m.value)} 6 mo` : undefined),
        metric("raised", "Total raised", f.fundingTotalUsdM, fmtUsdM),
        metric("round", "Last round", f.lastRoundType, fmtRound),
        metric("roles", "Open roles", f.openRoles, fmtInt),
        metric("web", "Monthly visitors", f.webMonthlyVisitors, (v) => fmtCompact(n(v))),
      ],
    },
    outline,
    section: {
      eyebrow: "Claims", confidence: "Low", headline: { pre: "No deck claims yet — no data room is connected" },
      bridgeNote: "", bridge: [], claims: [], ask: { text: "Upload a data room to check the founder's claims", action: { id: "room", label: "Open data room" } },
    },
    sections,
    evidence: { agreeNote: evidence.length ? `${evidence.length} news items · Crustdata` : "No news indexed", items: evidence },
    team: { members: [], sourcedBy: { initials: "DD", name: "Deal Desk", via: "Live research · Crustdata", at: new Date(r.requestedAt).toISOString().slice(0, 10), locked: false }, suggestion: null, canClaim: false, ownerRule: "ask_first" },
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
export function noMatchSignals(domain: string, identify: LiveCall): SignalGraphData {
  return {
    company: { id: domain, name: domain, initial: domain[0]!.toUpperCase(), domain },
    provider: { name: "Crustdata", graphLabel: "The Crustdata Graph", apiVersion: CRUSTDATA_API_VERSION, markUrl: "/logos/tools/crustdata-mark.svg", stats: [], sources: [] },
    eyebrow: "Signals · live research",
    headline: { pre: `No Crustdata match for ${domain}` },
    requestedAt: new Date().toISOString(),
    requestedAgo: "just now",
    calls: [{ id: "identify", method: identify.method, path: identify.path, body: JSON.stringify(identify.body), ms: identify.ms, icon: "identify", chips: [{ id: "m", field: "matches", value: "[]", path: "[0].matches" }] }],
    fit: { label: "Signal score", unscored: { reason: "No company matched, so there is nothing to score." }, base: { label: "—", value: 0 }, threshold: { value: 75, label: "Strong" }, bands: { strong: "Strong", maybe: "Possible", weak: "Weak" }, contributions: [], recommendation: { label: "", why: "", actions: [] } },
    timeline: [{ at: 0, type: "query" }],
    frames: [0],
  };
}
