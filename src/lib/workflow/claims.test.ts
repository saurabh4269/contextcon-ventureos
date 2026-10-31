// Business-logic audit of claim extraction (extract.ts) and claim checking (claims.ts). No network.
import { describe, expect, it } from "vitest";
import type { LiveCompany } from "@/lib/live/types";
import { companyDomainFrom, extractClaims, type Claim } from "./extract";
import { checkClaims } from "./run";

const NOW = new Date("2026-10-31T00:00:00Z");
const claims = (t: string) => extractClaims(t, NOW);
const one = (t: string, key: Claim["key"]) => claims(t).filter((c) => c.key === key);
const only = (t: string, key: Claim["key"]) => { const l = one(t, key); expect(l, t).toHaveLength(1); return l[0]!; };

function co(over: { total?: number; mom?: number; six?: number; yoy?: number; founded?: number; raised?: number; last?: number; lastType?: string } = {}): LiveCompany {
  return {
    id: 1, name: "Acme", domain: "acme.ai", yearFounded: over.founded ?? 2022, industries: [], categories: [],
    headcount: { total: over.total, growth: { mom: over.mom, six_months: over.six, yoy: over.yoy }, monthly: [], byFunction: [] },
    funding: { totalUsd: over.raised, lastRoundUsd: over.last, lastRoundType: over.lastType, investors: [] },
  } as unknown as LiveCompany;
}
const status = (text: string, c: LiveCompany, key?: Claim["key"]) => {
  const l = checkClaims(claims(text), c).filter((k) => !key || k.claim.key === key);
  expect(l, text).toHaveLength(1);
  return l[0]!.status;
};

describe("headcount extraction", () => {
  it.each([
    ["we are a team of 60", 60],
    ["team of 60 engineers and operators", 60],
    ["We are 1,200 people across 4 offices", 1200],
    ["a 12 member team", 12],
    ["a 60-person team", 60],
    ["we have sixty employees", 60],
    ["we now have forty-five people", 45],
    ["team of 1,200, mostly in India", 1200],
  ])("%s -> exact %d", (t, v) => { expect(only(t, "headcount")).toMatchObject({ value: v, bound: "exact" }); });
  it("approximations and lower bounds are flagged, not read as exact", () => {
    expect(only("~60 people", "headcount")).toMatchObject({ value: 60, bound: "approx" });
    expect(only("around 60 employees", "headcount")).toMatchObject({ value: 60, bound: "approx" });
    expect(only("60+ employees", "headcount")).toMatchObject({ value: 60, bound: "min" });
    expect(only("over 60 people", "headcount")).toMatchObject({ value: 60, bound: "min" });
    expect(only("at least 60 people", "headcount")).toMatchObject({ value: 60, bound: "min" });
    expect(only("under 60 people", "headcount")).toMatchObject({ value: 60, bound: "max" });
    expect(only("up to 60 people", "headcount")).toMatchObject({ value: 60, bound: "max" });
  });
  it("a range is a range, not its first number", () => {
    expect(only("a team of 50-60 people", "headcount")).toMatchObject({ value: 50, high: 60, bound: "range" });
    expect(only("50 to 60 people", "headcount")).toMatchObject({ value: 50, high: 60, bound: "range" });
  });
  it("a subset of the team is not the headcount", () => {
    expect(only("We are 60 people, 12 engineers and 5 in sales.", "headcount").value).toBe(60);
    expect(one("12 engineers", "headcount")).toHaveLength(0);
  });
  it("people the founder spoke to, and numbers that are not people, are not headcount", () => {
    expect(one("we spoke to 40 people at customers", "headcount")).toHaveLength(0);
    expect(one("team of 2023 goals", "headcount")).toHaveLength(0);
    expect(one("Series A in 2023", "headcount")).toHaveLength(0);
  });
  it("a past headcount is not the current claim", () => {
    expect(one("We were 40 people last year, and are 60 people now.", "headcount").map((c) => c.value)).toEqual([60]);
  });
  it("two different current values are both kept (each is checked), the same value twice is one claim", () => {
    expect(one("We are 40 people. [...] Update: we are 60 people.", "headcount").map((c) => c.value)).toEqual([40, 60]);
    expect(one("team of 60. As said, a team of 60.", "headcount")).toHaveLength(1);
  });
});

describe("growth extraction", () => {
  it("percent spellings", () => {
    expect(only("we grew 40% MoM", "growth_mom")).toMatchObject({ value: 40, bound: "exact" });
    expect(only("40 % month-over-month", "growth_mom").value).toBe(40);
    expect(only("growing 40 percent month on month", "growth_mom").value).toBe(40);
    expect(only("MoM growth of 40%", "growth_mom").value).toBe(40);
    expect(only("40% YoY", "growth_yoy").value).toBe(40);
    expect(only("grew 50% in the last 6 months", "growth_6m").value).toBe(50);
  });
  it("a multiple is converted to percent (2x = 100%)", () => {
    expect(only("3x YoY", "growth_yoy").value).toBe(200);
    expect(only("2x year over year", "growth_yoy").value).toBe(100);
    expect(only("2.5x MoM", "growth_mom").value).toBe(150);
    expect(only("we doubled in the last 6 months", "growth_6m").value).toBe(100);
    expect(only("revenue doubled YoY", "growth_yoy").value).toBe(100);
  });
  it("a multiple with no window is kept as an unspecified-window claim", () => {
    expect(only("10x growth since launch", "growth_unspecified").value).toBe(900);
  });
  it("negative growth keeps its sign; a range of growth is a range", () => {
    expect(only("revenue is down 5% MoM", "growth_mom").value).toBe(-5);
    expect(only("-5% MoM", "growth_mom").value).toBe(-5);
    expect(only("growing 40-50% MoM", "growth_mom")).toMatchObject({ value: 40, high: 50, bound: "range" });
  });
  it("records what grew", () => {
    expect(only("our revenue grew 40% MoM", "growth_mom").subject).toBe("other");
    expect(only("the team grew 40% in the last 6 months", "growth_6m").subject).toBe("headcount");
    expect(only("grew 40% MoM", "growth_mom").subject).toBe("unspecified");
    expect(only("We are a team of 40, growing 20% MoM", "growth_mom").subject).toBe("unspecified"); // "team" is in the previous clause
  });
  it("'annual' alone (annual discount) is not YoY growth", () => {
    expect(one("a 20% annual discount", "growth_yoy")).toHaveLength(0);
  });
});

describe("founded", () => {
  it("founded in a year; launched / since are not the founding year", () => {
    expect(only("Founded in 2021 by two ex-Razorpay engineers", "founded").value).toBe(2021);
    expect(only("incorporated in March 2021", "founded").value).toBe(2021);
    expect(one("We launched in 2024 in the US", "founded")).toHaveLength(0);
    expect(one("profitable since 2023", "founded")).toHaveLength(0);
    expect(one("Series A in 2023", "founded")).toHaveLength(0);
  });
  it("'5 years old' is a one-year range from today's date", () => {
    expect(only("we are 5 years old", "founded").bound).toBe("range");
    expect(only("the company is 5 years old", "founded")).toMatchObject({ value: 2020, high: 2021, bound: "range" });
    expect(one("I am 30 years old", "founded")).toHaveLength(0);
  });
});

describe("money extraction", () => {
  it.each([
    ["raised $3.5M seed", 3_500_000],
    ["raised a $12 million Series A", 12_000_000],
    ["raised $500k", 500_000],
    ["We have raised $2.5 million to date", 2_500_000],
  ])("raised: %s", (t, v) => { expect(only(t, "raised")).toMatchObject({ value: v, currency: "USD" }); });
  it("a unit letter inside a word is not a unit ('$2 more' is $2, not $2M)", () => {
    expect(only("we raised $2 more than planned", "raised").value).toBe(2);
  });
  it("rupee amounts keep their currency and are never read as dollars", () => {
    expect(only("raised ₹4 crore", "raised")).toMatchObject({ value: 40_000_000, currency: "INR" });
    expect(only("raised Rs 5 lakh", "raised")).toMatchObject({ value: 500_000, currency: "INR" });
    expect(only("raised 4 crore in a seed round", "raised")).toMatchObject({ value: 40_000_000, currency: "INR" });
  });
  it("scope: total vs a named round", () => {
    expect(only("raised $3.5M seed", "raised")).toMatchObject({ scope: "round", round: "seed" });
    expect(only("raised a $12 million Series A", "raised")).toMatchObject({ scope: "round", round: "series_a" });
    expect(only("raised $5M in total", "raised").scope).toBe("total");
    expect(only("raised $2M", "raised").scope).toBe("unspecified");
  });
  it("plans to raise are not a claim", () => {
    expect(one("we are raising $10M and want to raise more", "raised")).toHaveLength(0);
  });
  it("revenue claims are extracted (so they show as unverifiable, not silently dropped)", () => {
    expect(only("$2M ARR", "revenue")).toMatchObject({ value: 2_000_000, currency: "USD" });
    expect(only("$2.5 million ARR", "revenue").value).toBe(2_500_000);
    expect(only("ARR of ₹4 crore", "revenue")).toMatchObject({ value: 40_000_000, currency: "INR" });
    expect(only("$150k MRR", "revenue").value).toBe(1_800_000);
  });
});

describe("checkClaims: headcount", () => {
  const c = co({ total: 46 });
  it("tolerance is symmetric and the boundary is inclusive", () => {
    expect(status("team of 50", co({ total: 55 }))).toBe("verified"); // 5 off, 10% of 55
    expect(status("team of 55", co({ total: 50 }))).toBe("verified"); // same distance, other way round
    expect(status("team of 54", co({ total: 60 }))).toBe("verified");
    expect(status("team of 60", co({ total: 54 }))).toBe("verified");
    expect(status("team of 60", co({ total: 53 }))).toBe("contradicted");
    expect(status("team of 53", co({ total: 60 }))).toBe("contradicted");
  });
  it("small numbers get an absolute floor; 10 vs 12 is 20% off and contradicted", () => {
    expect(status("team of 5", co({ total: 6 }))).toBe("verified");
    expect(status("team of 12", co({ total: 10 }))).toBe("contradicted");
    expect(status("team of 3", co({ total: 8 }))).toBe("contradicted");
  });
  it("approximate claims get wider slack; lower bounds fail only when clearly below", () => {
    expect(status("~60 people", co({ total: 50 }))).toBe("verified");
    expect(status("60 people", co({ total: 50 }))).toBe("contradicted");
    expect(status("60+ employees", co({ total: 75 }))).toBe("verified");
    expect(status("60+ employees", co({ total: 58 }))).toBe("verified");
    expect(status("60+ employees", co({ total: 40 }))).toBe("contradicted");
    expect(status("under 100 people", co({ total: 80 }))).toBe("verified");
    expect(status("under 100 people", co({ total: 160 }))).toBe("contradicted");
  });
  it("a range is supported when Crustdata is inside it", () => {
    expect(status("50-60 people", co({ total: 55 }))).toBe("verified");
    expect(status("50-60 people", co({ total: 50 }))).toBe("verified");
    expect(status("50-60 people", co({ total: 60 }))).toBe("verified");
    expect(status("50-60 people", co({ total: 80 }))).toBe("contradicted");
    expect(status("50-60 people", co({ total: 30 }))).toBe("contradicted");
  });
  it("missing, zero or non-finite actual is unverifiable, never contradicted", () => {
    expect(status("team of 60", co({}))).toBe("unverifiable");
    expect(status("team of 60", co({ total: 0 }))).toBe("unverifiable");
    expect(status("team of 60", co({ total: Number.NaN }))).toBe("unverifiable");
    expect(checkClaims(claims("team of 60"), undefined)[0]!.status).toBe("unverifiable");
  });
  it("keeps the shown text and citation path the workflow UI relies on", () => {
    expect(checkClaims(claims("team of 60"), c)[0]).toMatchObject({ status: "contradicted", actual: 46, path: "headcount.total", shown: "Crustdata headcount.total: 46" });
  });
  it("an email that says 40 and then 60 is checked on both (the stale one is flagged)", () => {
    const l = checkClaims(claims("We are 40 people. Update: we are 60 people."), co({ total: 60 }));
    expect(l.map((k) => [k.claim.value, k.status])).toEqual([[40, "contradicted"], [60, "verified"]]);
  });
});

describe("checkClaims: growth windows", () => {
  it("a MoM claim about headcount is not checked against the 6-month figure", () => {
    const k = checkClaims(claims("our team grew 40% MoM"), co({ six: 40, yoy: 40 }))[0]!;
    expect(k.path).toBe("headcount.growth_percent.mom");
    expect(k.status).toBe("unverifiable"); // mom is missing; the 6m / yoy figures are not a proxy
  });
  it("revenue / user growth is unverifiable (Crustdata only has headcount growth), not 'verified' by a proxy", () => {
    const k = checkClaims(claims("our revenue grew 5% MoM"), co({ mom: 5 }))[0]!;
    expect(k.status).toBe("unverifiable");
    expect(k.shown).toMatch(/headcount growth/);
  });
  it("growth with no stated subject is unverifiable", () => {
    expect(status("grew 5% MoM", co({ mom: 5 }))).toBe("unverifiable");
  });
  it("headcount growth is compared in the window it names", () => {
    expect(status("the team grew 50% in the last 6 months", co({ six: 45 }))).toBe("verified");
    expect(status("the team grew 50% in the last 6 months", co({ six: 10 }))).toBe("contradicted");
    expect(status("headcount grew 3x YoY", co({ yoy: 200 }))).toBe("verified"); // 3x == +200%
    expect(status("headcount grew 2x YoY", co({ yoy: 100 }))).toBe("verified"); // 2x == +100%
    expect(status("headcount grew 2x YoY", co({ yoy: 2 }))).toBe("contradicted"); // not "2%"
  });
  it("zero actual growth does not divide by zero", () => {
    expect(status("team grew 40% MoM", co({ mom: 0 }))).toBe("contradicted");
    expect(status("team grew 1% MoM", co({ mom: 0 }))).toBe("verified");
  });
  it("a window-less multiple is unverifiable", () => {
    expect(status("we have seen 10x growth", co({ mom: 900, six: 900, yoy: 900 }))).toBe("unverifiable");
  });
});

describe("checkClaims: founded", () => {
  it("founded in 2021 vs 2022 is contradicted; equal is verified; missing is unverifiable", () => {
    expect(status("founded in 2021", co({ founded: 2022 }))).toBe("contradicted");
    expect(status("founded in 2022", co({ founded: 2022 }))).toBe("verified");
    expect(checkClaims(claims("founded in 2021"), { ...co(), yearFounded: undefined })[0]!.status).toBe("unverifiable");
  });
  it("'5 years old' is supported by 2020 and 2021, not by 2015", () => {
    expect(status("the company is 5 years old", co({ founded: 2021 }))).toBe("verified");
    expect(status("the company is 5 years old", co({ founded: 2020 }))).toBe("verified");
    expect(status("the company is 5 years old", co({ founded: 2015 }))).toBe("contradicted");
  });
});

describe("checkClaims: funding and currency", () => {
  it("rupee and euro claims are never compared with USD", () => {
    const c = co({ raised: 4_000_000 });
    expect(checkClaims(claims("raised ₹4 crore"), c)[0]).toMatchObject({ status: "unverifiable" });
    expect(checkClaims(claims("raised ₹4 crore"), c)[0]!.shown).toMatch(/INR/);
    expect(status("raised Rs 5 lakh", co({ raised: 500_000 }))).toBe("unverifiable");
    expect(status("raised €3M", co({ raised: 3_000_000 }))).toBe("unverifiable");
  });
  it("a round claim is checked against the last round, not the total", () => {
    const c = co({ raised: 15_500_000, last: 12_000_000, lastType: "series_a" });
    expect(status("raised a $12 million Series A", c)).toBe("verified");
    expect(status("raised a $20 million Series A", c)).toBe("contradicted");
  });
  it("an earlier round cannot be judged from total + last round: unverifiable, not contradicted", () => {
    const c = co({ raised: 15_500_000, last: 12_000_000, lastType: "series_a" });
    expect(status("raised $3.5M seed", c)).toBe("unverifiable");
  });
  it("but no round can be larger than the total ever raised", () => {
    expect(status("raised $30M seed", co({ raised: 15_500_000, last: 12_000_000, lastType: "series_a" }))).toBe("contradicted");
  });
  it("'raised $X in total' is checked against the total", () => {
    expect(status("we have raised $15M in total", co({ raised: 15_500_000, last: 12_000_000, lastType: "series_a" }))).toBe("verified");
    expect(status("we have raised $5M in total", co({ raised: 15_500_000, last: 12_000_000, lastType: "series_a" }))).toBe("contradicted");
  });
  it("an unqualified amount matching the total or the last round is verified", () => {
    expect(status("raised $2M", co({ raised: 2_000_000 }))).toBe("verified");
    expect(status("raised $12M", co({ raised: 15_500_000, last: 12_000_000, lastType: "series_a" }))).toBe("verified");
    expect(status("raised $2M", co({ raised: 15_500_000, last: 12_000_000, lastType: "series_a" }))).toBe("unverifiable");
  });
  it("zero or missing funding is no data, not a contradiction", () => {
    expect(status("raised $2M in total", co({ raised: 0 }))).toBe("unverifiable");
    expect(status("raised $2M", co({}))).toBe("unverifiable");
  });
  it("revenue claims are unverifiable", () => {
    expect(status("$2M ARR", co({ raised: 2_000_000 }))).toBe("unverifiable");
  });
});

describe("companyDomainFrom", () => {
  const from = (fromAddress: string | null, body = "", subject = "") => companyDomainFrom({ fromAddress, subject, body });
  it("strips mail subdomains of the sender; keeps country TLDs", () => {
    expect(from("a@mail.acme.com")).toBe("acme.com");
    expect(from("a@em.acme.com")).toBe("acme.com");
    expect(from("a@mail.acme.co.in")).toBe("acme.co.in");
    expect(from("a@acme.co.uk")).toBe("acme.co.uk");
    expect(from("A@ACME.AI")).toBe("acme.ai");
  });
  it("never truncates a country-TLD domain written in the body", () => {
    expect(from("a@gmail.com", "our site is https://www.acme.co.uk/about")).toBe("acme.co.uk");
    expect(from("a@gmail.com", "see acme.co.in.")).toBe("acme.co.in");
  });
  it("freemail (including country variants) is never the company", () => {
    for (const h of ["gmail.com", "yahoo.co.uk", "yahoo.fr", "outlook.in", "hotmail.de", "ymail.com", "msn.com", "icloud.com", "proton.me"]) expect(from(`a@${h}`, "no links"), h).toBeNull();
  });
  it("never returns calendar, video, mail-provider, social or tracking hosts", () => {
    const hosts = ["calendar.google.com", "meet.google.com", "us02web.zoom.us", "teams.microsoft.com", "calendly.com", "cal.com", "docsend.com", "linkedin.com", "click.mailchimp.com", "u123.ct.sendgrid.net", "lnkd.in", "t.co", "outlook.live.com", "mail.google.com", "drive.google.com", "acme.vercel.app", "acme.notion.site"];
    for (const h of hosts) expect(from("a@gmail.com", `join at https://${h}/abc`), h).toBeNull();
    for (const h of ["calendar.google.com", "zoom.us", "mail.yahoo.com", "bounces.sendgrid.net", "mailer.mailchimp.com"]) expect(from(`noreply@${h}`, "no links"), h).toBeNull();
  });
  it("skips infrastructure links and takes the first real company link", () => {
    expect(from("a@gmail.com", "Join https://zoom.us/j/123 deck https://docsend.com/view/x our site https://acme.ai/")).toBe("acme.ai");
  });
  it("a sender on a mail-service domain falls through to the links", () => {
    expect(from("founder@bounces.sendgrid.net", "we are at acme.ai")).toBe("acme.ai");
  });
  it("URLs with ports, paths, query strings and trailing punctuation", () => {
    expect(from("a@gmail.com", "(https://acme.ai:8080/x?y=1),")).toBe("acme.ai");
    expect(from("a@gmail.com", "visit acme.ai!")).toBe("acme.ai");
    expect(from("a@gmail.com", "WWW.ACME.AI")).toBe("acme.ai");
  });
  it("subdomains in a link reduce to the company domain", () => {
    expect(from("a@gmail.com", "https://app.acme.ai/login")).toBe("acme.ai");
  });
  it("an email address in the body is not a website; sentences missing a space are not domains", () => {
    expect(from("a@gmail.com", "cc: partner@myfund.com")).toBeNull();
    expect(from("a@gmail.com", "Thanks.Please see the attached.Regards")).toBeNull();
    expect(from("a@gmail.com", "we use node.js and v2.0 of the sdk")).toBeNull();
  });
  it("IDN domains are not cut at the first non-ASCII letter", () => {
    expect(from("a@gmail.com", "unsere Seite bücher.de")).toBe("xn--bcher-kva.de");
  });
});
