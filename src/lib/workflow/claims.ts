// Checking a founder's claim against Crustdata: verified / contradicted / unverifiable. Pure.
// Rules (product rules: Crustdata is the source of truth; "no match" is not "wrong"; a proxy is not a verification):
//  - a claim is only ever checked against a like-for-like Crustdata field: headcount growth only for a claim that is
//    about headcount, and only for the window it names (MoM / 6 months / YoY); revenue has no Crustdata field;
//  - money is compared only in USD (no cited exchange rate exists, so rupee / euro claims are unverifiable);
//  - funding: Crustdata has the total raised and the last round, so a claim about one round can be contradicted only
//    when it is the last round, or when it is larger than everything ever raised;
//  - a missing, non-finite or zero headcount / funding figure is "no data", never a contradiction;
//  - tolerance is symmetric (a share of the larger of claim and actual), has an absolute floor for small numbers, and the
//    boundary is inclusive; an approximate claim ("~60") gets twice the slack, "60+" / "over 60" fails only when clearly
//    below, "under 60" only when clearly above, a range ("50-60") is supported when Crustdata is inside it.
import { fmtMoney, money } from "@/lib/format";
import type { LiveCompany } from "@/lib/live/types";
import type { Claim } from "./extract";

/** How far a claim may be from Crustdata and still count as verified (share of the larger of the two values). */
export const CLAIM_TOLERANCE = { headcount: 0.1, raised: 0.1, growth: 0.25 } as const;
/** Absolute slack for small numbers: 5 people vs 6, 2 percentage points of growth. */
export const CLAIM_FLOOR = { headcount: 1, raised: 1, growth: 2 } as const;
/** An approximate claim ("~60", "around 60") gets this many times the slack. */
export const APPROX_FACTOR = 2;

export type Check = { claim: Claim; actual?: number; path: string; status: "verified" | "contradicted" | "unverifiable"; shown: string };

const pct = (v: number | undefined) => (v === undefined ? "unknown" : `${Math.round(v * 10) / 10}%`);
const usd = (v: number | undefined) => (v === undefined ? "unknown" : fmtMoney(money(v, "USD")));
const EPS = 1e-9;
const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Pure numeric comparison of a (possibly bounded or ranged) claim with the actual value. */
export function withinClaim(claim: Pick<Claim, "value" | "high" | "bound">, actual: number, tol: number, floor: number): boolean {
  const k = claim.bound === "approx" ? APPROX_FACTOR : 1;
  const slackFor = (v: number) => Math.max(Math.max(Math.abs(v), Math.abs(actual)) * tol * k, floor * k) + EPS;
  const v = claim.value;
  switch (claim.bound) {
    case "min": return actual >= v - slackFor(v);
    case "max": return actual <= v + slackFor(v);
    case "range": { const hi = claim.high ?? v; return actual >= v - slackFor(v) && actual <= hi + slackFor(hi); }
    default: return Math.abs(actual - v) <= slackFor(v);
  }
}
const usable = (n: number | undefined): n is number => n !== undefined && Number.isFinite(n);

const GROWTH = {
  growth_mom: { get: (co: LiveCompany) => co.headcount.growth.mom, path: "headcount.growth_percent.mom", window: "month-over-month" },
  growth_6m: { get: (co: LiveCompany) => co.headcount.growth.six_months, path: "headcount.growth_percent.six_months", window: "6-month" },
  growth_yoy: { get: (co: LiveCompany) => co.headcount.growth.yoy, path: "headcount.growth_percent.yoy", window: "year-over-year" },
} as const;

export function checkClaims(claims: Claim[], co: LiveCompany | undefined): Check[] {
  return claims.map((cl): Check => {
    const no = (path: string, shown: string, actual?: number): Check => ({ claim: cl, ...(actual !== undefined ? { actual } : {}), path, status: "unverifiable", shown });
    const done = (path: string, actual: number, ok: boolean, shown: string): Check => ({ claim: cl, actual, path, status: ok ? "verified" : "contradicted", shown });

    if (cl.key === "revenue") return no("", "Crustdata has no revenue or ARR figure; cannot check");
    if (cl.key === "growth_unspecified") return no("headcount.growth_percent", "the claim names no time window (MoM / 6 months / YoY), so no Crustdata figure is like-for-like");

    if (cl.key.startsWith("growth")) {
      const g = GROWTH[cl.key as keyof typeof GROWTH];
      if (cl.subject !== "headcount") return no(g.path, `Crustdata only has headcount growth (${g.window}); the claim is ${cl.subject === "other" ? "about something else (revenue, users, ...)" : "not stated to be about headcount"}, so there is no like-for-like figure`);
      const actual = co ? g.get(co) : undefined;
      if (!usable(actual)) return no(g.path, "Crustdata has no value");
      return done(g.path, actual, withinClaim(cl, actual, CLAIM_TOLERANCE.growth, CLAIM_FLOOR.growth), `Crustdata ${g.path}: ${pct(actual)}`);
    }

    if (cl.key === "headcount") {
      const actual = co?.headcount.total;
      const path = "headcount.total";
      if (!usable(actual)) return no(path, "Crustdata has no value");
      if (actual <= 0) return no(path, `Crustdata reports ${actual} employees, which means not indexed rather than a real zero`, actual);
      return done(path, actual, withinClaim(cl, actual, CLAIM_TOLERANCE.headcount, CLAIM_FLOOR.headcount), `Crustdata ${path}: ${actual}`);
    }

    if (cl.key === "founded") {
      const actual = co?.yearFounded;
      const path = "basic_info.year_founded";
      if (!usable(actual)) return no(path, "Crustdata has no value");
      const c = cl.bound === "approx" ? { ...cl, bound: "range" as const, value: cl.value - 1, high: cl.value + 1 } : cl;
      return done(path, actual, withinClaim(c, actual, 0, 0), `Crustdata ${path}: ${actual}`);
    }

    // raised
    const TOTAL = "funding.total_investment_usd", LAST = "funding.last_round_amount_usd";
    if (cl.currency && cl.currency !== "USD") return no(TOTAL, `claimed in ${cl.currency}; Crustdata reports USD and no cited exchange rate is available, so the amounts are not compared`);
    const total = co?.funding.totalUsd;
    const last = co?.funding.lastRoundUsd;
    if (!usable(total) && !usable(last)) return no(TOTAL, "Crustdata has no value");
    const claimHigh = cl.high ?? cl.value;
    const T = (v: number) => withinClaim(cl, v, CLAIM_TOLERANCE.raised, CLAIM_FLOOR.raised);
    // a round cannot be larger than everything ever raised
    const slackOver = (t: number) => Math.max(Math.max(claimHigh, t) * CLAIM_TOLERANCE.raised, CLAIM_FLOOR.raised) + EPS;
    const exceedsTotal = usable(total) && total > 0 && cl.value > total + slackOver(total) && cl.bound !== "max";
    const shownTotal = `Crustdata ${TOTAL}: ${usd(total)}`;
    if (cl.scope === "total") {
      if (!usable(total) || total <= 0) return no(TOTAL, usable(total) ? "Crustdata shows $0 raised, which means not indexed rather than a real zero" : "Crustdata has no value", total);
      return done(TOTAL, total, T(total), shownTotal);
    }
    const lastType = norm(co?.funding.lastRoundType);
    const namedLast = cl.round && lastType ? norm(cl.round) === lastType : undefined;
    if (cl.scope === "round" && usable(last) && last > 0 && (cl.round ? namedLast === true : true) && lastType !== "") {
      return done(LAST, last, T(last), `Crustdata ${LAST}: ${usd(last)} (${co?.funding.lastRoundType})`);
    }
    if (cl.scope === "round" && usable(last) && last > 0 && !cl.round) return done(LAST, last, T(last), `Crustdata ${LAST}: ${usd(last)}`);
    if (exceedsTotal && usable(total)) return done(TOTAL, total, false, `${shownTotal}; a single round cannot exceed the total raised`);
    if (cl.scope === "unspecified") {
      if (usable(total) && total > 0 && T(total)) return done(TOTAL, total, true, shownTotal);
      if (usable(last) && last > 0 && T(last)) return done(LAST, last, true, `Crustdata ${LAST}: ${usd(last)}`);
      if (!usable(total) || total <= 0) return no(TOTAL, "Crustdata has no usable total");
      return no(TOTAL, `${shownTotal}; the claim does not say whether it is the total or one round, and it matches neither the total nor the last round`, total);
    }
    return no(usable(total) ? TOTAL : LAST, `Crustdata has the total (${usd(total)}) and the last round (${usd(last)}${co?.funding.lastRoundType ? `, ${co.funding.lastRoundType}` : ""}) only, not this ${cl.round ?? "round"}`, total);
  });
}
