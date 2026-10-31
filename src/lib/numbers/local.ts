// Local deal decisions: the firm mandate (Settings → /mandates) scored against live Crustdata research, peers from a
// live Crustdata /company/search, the firm's priors (labelled as assumptions) and firm memory (past review-queue
// decisions on the company). No fixtures and no built-in numbers: every value is computed from those inputs, and
// anything an input is missing for is `unavailable` with the exact reason.
import { ok, unavailable, isOk, type Citation, type ComputedField } from "@/lib/fields";
import { fmtMoney, money } from "@/lib/format";
import type { LiveCall, ResearchResult } from "@/lib/live/types";
import type { ExceptionItem } from "@/lib/exceptions/types";
import { unsetMandateFields, type Mandate } from "@/lib/settings/mandate";
import { ENRICH_ROOT } from "./company-fields";
import type { DealNumbers, DealValuation } from "./deal-numbers";

type Research = Extract<ResearchResult, { status: "ok" }>;
type F = ComputedField<unknown>;

export type Peer = {
  id: number;
  name: string;
  domain?: string;
  country?: string;
  lastRoundType?: string;
  lastRoundUsd?: number;
  lastDate?: string;
  totalUsd?: number;
  revenueLowUsd?: number;
  revenueHighUsd?: number;
};
/** The peer search, and which of sector/stage/geo it kept (dropped ones were relaxed to find enough peers). */
export type PeerSearch = { call: LiveCall<Peer[]>; matched: ("sector" | "stage" | "geo")[] };

const MANDATE_ENDPOINT = "GET /api/settings/mandate";
// A mandate from MANDATE_JSON has no save time; its values are cited to the server env, read at readAt.
const mandateCite = (m: Mandate, path: string): Citation => ({ source: m.origin === "env" ? "Firm mandate (MANDATE_JSON, server env)" : "Firm mandate (entered in Settings)", endpoint: MANDATE_ENDPOINT, path, url: "/settings/mandate", retrievedAt: m.updatedAt ?? m.readAt ?? undefined });
const crust = (call: LiveCall, path: string): Citation => ({ source: "Crustdata", endpoint: `${call.method} ${call.path}`, path, retrievedAt: call.retrievedAt ?? undefined, ...(call.stale ? { stale: true, note: call.note } : {}) });
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const usd = (n: number) => fmtMoney(money(n, "USD"));
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const r1 = (n: number) => Math.round(n * 10) / 10;
/** A multiple for display: one decimal, two below 1× so small multiples do not read as 0×. */
const xm = (n: number) => (n < 1 ? Math.round(n * 100) / 100 : r1(n));
/** Citations without repeats (fields built from other fields would otherwise cite the same source twice). */
const uniq = (cs: Citation[]): Citation[] => {
  const seen = new Set<string>();
  return cs.filter((c) => {
    const k = `${c.source}|${c.endpoint ?? ""}|${c.path ?? ""}|${c.retrievedAt ?? ""}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
};
const UNSET = (what: string) => `The firm mandate has no ${what} set (Settings → Firm mandate, /settings/mandate), so this criterion is not scored.`;

/* ── criteria ── */

export function criterionSector(r: Research, m: Mandate): F {
  if (!m.sectors.length) return unavailable(UNSET("sectors"));
  const c = r.company;
  const tags = [...c.industries, ...c.categories];
  if (!tags.length && !c.description) return unavailable(`Crustdata returned no industries, categories or description for ${c.domain}.`);
  const hay = norm([...tags, c.description ?? ""].join(" | "));
  const hit = m.sectors.find((s) => hay.includes(norm(s)));
  return ok(hit ? "met" : "not met", "Mandate sectors matched against the company's Crustdata industries, categories and description", hit ? `“${hit}” appears in ${c.name}'s taxonomy/description.` : `None of the mandate sectors (${m.sectors.join(", ")}) appear in ${tags.slice(0, 4).join(", ") || "the description"}.`, [crust(r.calls.enrich, `${ENRICH_ROOT}.taxonomy`), mandateCite(m, "sectors")], [
    { name: "mandate sectors", value: m.sectors.join(", ") },
    { name: "company industries/categories", value: tags.slice(0, 6).join(", ") || null },
  ]);
}

export function criterionStage(r: Research, m: Mandate): F {
  if (!m.stages.length) return unavailable(UNSET("stages"));
  const stage = r.company.funding.lastRoundType;
  if (!stage) return unavailable(`Crustdata returned no last round type for ${r.company.domain} (funding.last_round_type).`);
  const hit = m.stages.some((s) => norm(s) === norm(stage));
  return ok(hit ? "met" : "not met", "Company's last round type compared with the mandate stages", `Last round: ${stage}. Mandate stages: ${m.stages.join(", ")}.`, [crust(r.calls.enrich, `${ENRICH_ROOT}.funding.last_round_type`), mandateCite(m, "stages")], [
    { name: "last round type", value: stage },
    { name: "mandate stages", value: m.stages.join(", ") },
  ]);
}

export function criterionGeo(r: Research, m: Mandate): F {
  if (!m.geos.length) return unavailable(UNSET("geographies"));
  const { hq, country } = r.company;
  if (!hq && !country) return unavailable(`Crustdata returned no headquarters or country for ${r.company.domain}.`);
  const where = norm([hq ?? "", country ?? ""].join(" "));
  const hit = m.geos.find((g) => norm(g) === norm(country ?? "") || ` ${where} `.includes(` ${norm(g)} `));
  return ok(hit ? "met" : "not met", "Company headquarters/country compared with the mandate geographies", `HQ ${hq ?? "—"} (${country ?? "—"}); mandate: ${m.geos.join(", ")}.`, [crust(r.calls.enrich, `${ENRICH_ROOT}.locations`), mandateCite(m, "geos")], [
    { name: "headquarters", value: hq ?? null },
    { name: "country", value: country ?? null },
    { name: "mandate geographies", value: m.geos.join(", ") },
  ]);
}

/** Met when the firm's check range fits inside the company's last round (the round is big enough for our check). */
export function criterionCheckSize(r: Research, m: Mandate): F {
  const { min, max } = m.checkSizeUsd;
  if (min == null && max == null) return unavailable(UNSET("check size"));
  const round = r.company.funding.lastRoundUsd;
  if (round == null) return unavailable(`Crustdata returned no last round amount for ${r.company.domain} (funding.last_round_amount_usd), so the check size cannot be compared.`);
  const need = max ?? min!;
  const met = round >= need;
  return ok(met ? "met" : "not met", "Mandate check size compared with the company's last round amount (met when the round can absorb the firm's check)", `Last round ${usd(round)}; firm check ${min != null ? usd(min) : "—"}–${max != null ? usd(max) : "—"}.`, [crust(r.calls.enrich, `${ENRICH_ROOT}.funding.last_round_amount_usd`), mandateCite(m, "checkSizeUsd")], [
    { name: "last round (USD)", value: round },
    { name: "firm check min (USD)", value: min ?? null },
    { name: "firm check max (USD)", value: max ?? null },
  ]);
}

/** Firm memory: people's past review-queue decisions on this company (other runs: shortlists, outreach, research). */
export function criterionMemory(domain: string, history: ExceptionItem[], excludeRunId: string): F {
  const past = history.filter((x) => x.subject?.domain === domain && x.status !== "open" && x.runId !== excludeRunId);
  const cite: Citation = { source: "Deal Desk review queue (firm memory)", endpoint: "GET /api/exceptions?status=all", path: `items[subject.domain=${domain}]`, url: "/review", retrievedAt: past[0]?.resolution?.at ?? new Date().toISOString() };
  if (!past.length) return ok("no prior decisions", "Past review-queue decisions on this company", `The firm has no recorded decisions on ${domain}; this criterion is neutral (not scored).`, [cite], [{ name: "past decisions", value: 0 }]);
  const rejected = past.filter((x) => x.status === "rejected").length;
  const met = rejected * 2 <= past.length;
  return ok(met ? "met" : "not met", "Past review-queue decisions on this company (met unless most were rejections)", `${past.length} past decision(s), ${rejected} rejected.`, [cite], [
    { name: "past decisions", value: past.length },
    { name: "rejected", value: rejected },
  ]);
}

const verdict = (f: F): "met" | "not met" | null => (isOk(f) && (f.value === "met" || f.value === "not met") ? (f.value as "met" | "not met") : null);

export function fitScore(criteria: Record<string, F>, m: Mandate): F {
  const scored = Object.entries(criteria).filter(([, f]) => verdict(f));
  const unset = unsetMandateFields(m);
  if (!scored.length) {
    return unavailable(unset.length === 4 ? "No firm mandate is set (Settings → Firm mandate, /settings/mandate): enter sectors, stages, geographies or check size to score this company." : `No mandate criterion could be scored: ${Object.entries(criteria).map(([k, f]) => `${k}: ${f.status === "unavailable" ? f.reason : f.value}`).join(" ")}`);
  }
  const met = scored.filter(([, f]) => verdict(f) === "met").length;
  const score = Math.round((100 * met) / scored.length);
  const notScored = Object.entries(criteria).filter(([, f]) => !verdict(f)).map(([k]) => k);
  return ok(score, "Share of scored mandate criteria met × 100", `${met} of ${scored.length} scored criteria met.${notScored.length ? ` Not scored: ${notScored.join(", ")}${unset.length ? ` (mandate fields unset: ${unset.join(", ")})` : ""}.` : ""}`, uniq(scored.flatMap(([, f]) => (isOk(f) ? f.citations : []))), Object.entries(criteria).map(([name, f]) => ({ name, value: f })));
}

const HARD = ["Sector", "Stage", "Geography"];
/** Advance when every scored criterion is met; decline when a hard gate (sector/stage/geo) is not met; else review. */
export function screenerVerdict(fit: F, criteria: Record<string, F>): F {
  if (!isOk(fit)) return unavailable(`The screener verdict needs the fit score: ${fit.reason}`);
  const failedHard = HARD.filter((k) => verdict(criteria[k]!) === "not met");
  const missed = Object.entries(criteria).filter(([, f]) => verdict(f) === "not met").map(([k]) => k);
  const v = failedHard.length ? "Decline" : missed.length ? "Review" : "Advance";
  const why = failedHard.length ? `Hard gate(s) not met: ${failedHard.join(", ")}.` : missed.length ? `Fit ${fit.value}/100; not met: ${missed.join(", ")}.` : `Fit ${fit.value}/100; every scored criterion met.`;
  return ok(v, "Advance if every scored mandate criterion is met; Decline if sector, stage or geography is not met; otherwise Review", why, fit.citations, [{ name: "fit score", value: fit.value }, ...Object.entries(criteria).map(([name, f]) => ({ name, value: f }))]);
}

/* ── peers, comps multiple, valuation ── */

const assumption = (m: Mandate, path: string): Citation => ({ ...mandateCite(m, path), note: "Assumption: firm prior entered in Settings, not market data" });

/** Per peer: post-money implied by its last round (round ÷ assumed dilution) over its estimated revenue midpoint. */
export function compsMedianMultiple(peers: PeerSearch, m: Mandate): F {
  const { call } = peers;
  if (call.status === "error") return unavailable(`Peer search failed (${call.method} ${call.path}): ${call.error}`);
  const dil = m.priors.dilutionPct;
  if (!dil) return unavailable("Crustdata has no peer valuations; turning peers' round sizes into post-money needs the firm's dilution prior, which is unset (Settings → Firm mandate, /settings/mandate).");
  const rows = (call.data ?? []).flatMap((p) => {
    const rev = p.revenueLowUsd != null && p.revenueHighUsd != null ? (p.revenueLowUsd + p.revenueHighUsd) / 2 : undefined;
    if (!p.lastRoundUsd || !rev) return [];
    const post = p.lastRoundUsd / (((dil.low + dil.high) / 2) / 100);
    return [{ p, post, rev, multiple: post / rev }];
  });
  const n = (call.data ?? []).length;
  if (rows.length < 2) return unavailable(`Crustdata has no valuation fields for peers, and only ${rows.length} of ${n} peers from ${call.method} ${call.path} (matched on ${peers.matched.join(", ") || "description only"}) have both a last round amount and a revenue estimate; at least 2 are needed for a median.`);
  const med = xm(median(rows.map((x) => x.multiple)));
  return ok(med, `Median over peers of (last round ÷ assumed dilution ${dil.low}–${dil.high}% midpoint) ÷ estimated revenue midpoint`, `${rows.length} peers (matched on ${peers.matched.join(", ") || "description"}): ${rows.slice(0, 5).map((x) => `${x.p.name} ${xm(x.multiple)}×`).join(", ")}. Crustdata has no peer valuations, so post-money is implied from round size and the firm's dilution prior (assumption).`, [crust(call, "companies[].funding.last_round_amount_usd"), crust(call, "companies[].revenue.estimated"), assumption(m, "priors.dilutionPct")], rows.slice(0, 8).map((x) => ({ name: `${x.p.name} (${x.p.domain ?? x.p.id})`, value: `${usd(x.p.lastRoundUsd!)} round, revenue ~${usd(x.rev)}, ${xm(x.multiple)}×` })));
}

/** Valuation range: the target's estimated revenue range × the peer median multiple; without a revenue estimate,
 *  the post-money implied by its own last round and the dilution prior. */
export function valuationRange(r: Research, comps: F, m: Mandate): { low: F; high: F } {
  const c = r.company;
  const rev = c.revenue;
  const enrichRev = crust(r.calls.enrich, `${ENRICH_ROOT}.revenue.estimated`);
  if (isOk(comps) && rev?.lowUsd != null && rev?.highUsd != null) {
    const mult = comps.value as number;
    const mk = (base: number, side: string) => ok(money(Math.round(base * mult), "USD"), "Estimated revenue × peer median multiple", `${side}: ${c.name} revenue estimate ${usd(base)} × ${mult}× (peer median).`, [enrichRev, ...comps.citations], [{ name: "revenue estimate (USD)", value: base }, { name: "peer median multiple", value: comps }]);
    return { low: mk(rev.lowUsd, "Low"), high: mk(rev.highUsd, "High") };
  }
  const dil = m.priors.dilutionPct;
  const round = c.funding.lastRoundUsd;
  if (dil && round) {
    const why = isOk(comps) ? `Crustdata has no revenue estimate for ${c.domain}, so the peer multiple cannot be applied.` : `Peer multiple unavailable (${comps.status === "unavailable" ? comps.reason : ""}).`;
    const mk = (pct: number, side: string) => ok(money(Math.round(round / (pct / 100)), "USD"), "Post-money implied by the last round ÷ assumed dilution", `${side}: ${usd(round)} ${c.funding.lastRoundType ?? "round"}${c.funding.lastDate ? ` (${c.funding.lastDate})` : ""} ÷ ${pct}% dilution (firm prior, assumption). ${why}`, [crust(r.calls.enrich, `${ENRICH_ROOT}.funding.last_round_amount_usd`), assumption(m, "priors.dilutionPct")], [{ name: "last round (USD)", value: round }, { name: "assumed dilution %", value: pct }]);
    return { low: mk(dil.high, "Low"), high: mk(dil.low, "High") };
  }
  const reason = !dil
    ? "Crustdata has no company valuations; the valuation range needs the firm's dilution prior (Settings → Firm mandate, /settings/mandate), which is unset."
    : `Crustdata has no valuation, no last round amount and ${rev?.lowUsd == null ? "no revenue estimate" : "no peer multiple"} for ${c.domain}.`;
  return { low: unavailable(reason), high: unavailable(reason) };
}

export function returnMultiple(m: Mandate, side: "low" | "high"): F {
  const p = m.priors.returnMultiple;
  if (!p) return unavailable("Return multiples are the firm's target-return prior, which is unset (Settings → Firm mandate, /settings/mandate).");
  return ok(p[side], "Assumption: the firm's target return multiple (prior entered in Settings), not a forecast", `Firm prior ${p.low}×–${p.high}× (${side}).`, [assumption(m, `priors.returnMultiple.${side}`)], [{ name: `prior ${side}`, value: p[side] }]);
}

/* ── diligence + IC memo ── */

export function diligenceVerdict(r: Research, screener: F, fields: Record<string, F>): F {
  if (!isOk(screener)) return unavailable(`The diligence verdict follows the screener verdict: ${screener.reason}`);
  const c = r.company;
  const flags: string[] = [];
  const founders = r.calls.founders;
  const nFounders = founders.data?.people.length ?? 0;
  if (founders.status === "ok" && nFounders === 0) flags.push("no founders found on Crustdata");
  const yoy = c.headcount.growth.yoy;
  if (yoy != null && yoy < 0) flags.push(`headcount down ${Math.abs(r1(yoy))}% YoY`);
  if (c.funding.lastDate && Date.now() - Date.parse(c.funding.lastDate) > 2 * 365 * 864e5) flags.push(`last round ${c.funding.lastDate} (over 2 years ago)`);
  const v = screener.value === "Decline" ? "Do not proceed" : flags.length ? "Proceed with flags" : "Proceed to diligence";
  const cites = [...screener.citations, crust(founders, "profiles"), crust(r.calls.enrich, `${ENRICH_ROOT}.headcount.growth_percent`), crust(r.calls.enrich, `${ENRICH_ROOT}.funding.last_fundraise_date`)];
  return ok(v, "Screener verdict, then risk flags from founders found, headcount growth and funding recency", `Screener: ${screener.value}. ${flags.length ? `Flags: ${flags.join("; ")}.` : "No risk flags in founders, growth or funding recency."}`, cites, [
    { name: "screener verdict", value: screener },
    { name: "founders found", value: nFounders },
    { name: "headcount growth YoY %", value: yoy ?? null },
    { name: "last funding date", value: c.funding.lastDate ?? null },
    ...(fields.growthYoY ? [{ name: "growthYoY", value: fields.growthYoY }] : []),
  ]);
}

export function icMemoArr(r: Research): F {
  const rev = r.company.revenue;
  if (rev?.lowUsd == null || rev?.highUsd == null) return unavailable(`Crustdata returned no revenue estimate for ${r.company.domain} (revenue.estimated), and no data room is connected for actual ARR.`);
  const mid = (rev.lowUsd + rev.highUsd) / 2;
  return ok(r1(mid / 1e6), "Midpoint of Crustdata's estimated annual revenue range, USD M (an estimate, not reported ARR)", `${usd(rev.lowUsd)}–${usd(rev.highUsd)} estimated annual revenue.`, [crust(r.calls.enrich, `${ENRICH_ROOT}.revenue.estimated`)], [
    { name: "revenue low (USD)", value: rev.lowUsd },
    { name: "revenue high (USD)", value: rev.highUsd },
  ]);
}

export function icMemoValuation(low: F, high: F): F {
  if (!isOk(low) || !isOk(high)) return unavailable(`The IC memo valuation is the valuation range: ${low.status === "unavailable" ? low.reason : ""}`);
  const a = low.value as { amount: number }, b = high.value as { amount: number };
  return ok(`${usd(a.amount)}–${usd(b.amount)}`, `Valuation range (${low.method})`, `${low.reasoning} ${high.reasoning}`, uniq([...low.citations, ...high.citations]), [{ name: "low", value: low }, { name: "high", value: high }]);
}

export function icMemoCompsLine(peers: PeerSearch, comps: F): F {
  const { call } = peers;
  if (call.status === "error") return unavailable(`Peer search failed (${call.method} ${call.path}): ${call.error}`);
  const list = call.data ?? [];
  if (!list.length) return unavailable(`Crustdata ${call.method} ${call.path} returned no peers for the company's sector, stage and geography.`);
  const names = list.slice(0, 5).map((p) => `${p.name}${p.lastRoundType ? ` (${p.lastRoundType}${p.lastRoundUsd ? `, ${usd(p.lastRoundUsd)}` : ""})` : ""}`).join(", ");
  const line = `${list.length} peers matched on ${peers.matched.join(", ") || "description"}: ${names}${isOk(comps) ? `; median implied multiple ${comps.value}× revenue` : ""}.`;
  return ok(line, "Peers from a live Crustdata company search on the company's sector, stage and geography", isOk(comps) ? comps.reasoning : comps.reason, uniq([crust(call, "companies[]"), ...(isOk(comps) ? comps.citations : [])]), list.slice(0, 8).map((p) => ({ name: p.name, value: p.domain ?? p.id })));
}

/* ── all together ── */

export type LocalDeal = { numbers: Partial<DealNumbers>; valuation: Partial<DealValuation>; screenerVerdict: F };

export function computeLocalDeal(r: Research, m: Mandate, peers: PeerSearch, history: ExceptionItem[], decisionsRunId: string): LocalDeal {
  const criteria = {
    Sector: criterionSector(r, m),
    Stage: criterionStage(r, m),
    Geography: criterionGeo(r, m),
    "Check size": criterionCheckSize(r, m),
    "Firm memory": criterionMemory(r.company.domain, history, decisionsRunId),
  };
  const fit = fitScore(criteria, m);
  const screener = screenerVerdict(fit, criteria);
  const comps = compsMedianMultiple(peers, m);
  const { low, high } = valuationRange(r, comps, m);
  const rml = returnMultiple(m, "low"), rmh = returnMultiple(m, "high");
  return {
    numbers: {
      fitScore: fit,
      criterionSector: criteria.Sector,
      criterionStage: criteria.Stage,
      criterionGeo: criteria.Geography,
      criterionCheckSize: criteria["Check size"],
      criterionMemory: criteria["Firm memory"],
      returnMultipleLow: rml,
      returnMultipleHigh: rmh,
      compsMedianMultiple: comps,
      diligenceVerdict: diligenceVerdict(r, screener, r.fields),
      icMemoArrUsedM: icMemoArr(r),
      icMemoValuation: icMemoValuation(low, high),
      icMemoCompsLine: icMemoCompsLine(peers, comps),
    },
    valuation: { low, high, returnMultipleLow: rml, returnMultipleHigh: rmh, compsMedianMultiple: comps },
    screenerVerdict: screener,
  };
}
