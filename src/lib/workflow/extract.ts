// Pure helpers: which company an inbound email is about, and which checkable claims it makes.
import { pickCompanyDomain } from "@/lib/inbox/company";

/** The company website for a mail: the sender's registrable domain (mail.x.com -> x.com, x.co.in stays) unless it is
 *  consumer mail, a calendar / video / social / tracking host; else the first company-looking host in subject + body. */
export function companyDomainFrom(email: { fromAddress: string | null; subject: string; body: string }): string | null {
  return pickCompanyDomain(email.fromAddress, [email.subject, email.body]);
}

export type ClaimKey = "growth_mom" | "growth_6m" | "growth_yoy" | "growth_unspecified" | "headcount" | "founded" | "raised" | "revenue";
/** How the founder phrased the number: exact, "~60" (approx), "60+"/"over 60" (min), "under 60" (max), "50-60" (range). */
export type ClaimBound = "exact" | "approx" | "min" | "max" | "range";
export type Claim = {
  key: ClaimKey;
  /** the words that made the claim, for display */
  text: string;
  /** the value (the low end of a range); growth is always in percent (3x = 200), money in whole units of `currency` */
  value: number;
  /** upper end of a range */
  high?: number;
  bound?: ClaimBound;
  /** money claims: ISO-like code ("USD", "INR", "EUR", "GBP", "CAD"...). Anything but USD cannot be compared with Crustdata USD */
  currency?: string;
  /** funding claims: "total" (to date / in total), "round" (a named round or "a round"), "unspecified" */
  scope?: "total" | "round" | "unspecified";
  /** funding claims naming a round: seed, series_a ... */
  round?: string;
  /** growth claims: what grew. "headcount" only when the sentence says team / headcount / employees / hiring */
  subject?: "headcount" | "other" | "unspecified";
};

// ---------- number tokens ----------
const ONES: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const WORD = `(?:${[...Object.keys(TENS)].join("|")})(?:[- ](?:${Object.keys(ONES).slice(1, 10).join("|")}))?|${Object.keys(ONES).join("|")}|(?:one |a )?hundred`;
const NUM = `(?:\\d[\\d,]*(?:\\.\\d+)?|\\.\\d+|${WORD})`;
function toNum(s: string): number {
  const t = s.trim().toLowerCase();
  if (/^[\d.,]+$/.test(t)) return Number(t.replace(/,/g, "").replace(/\.$/, ""));
  if (/hundred$/.test(t)) return 100;
  const [a, b] = t.split(/[- ]/);
  return (TENS[a!] ?? ONES[a!] ?? NaN) + (b ? (ONES[b] ?? NaN) : 0);
}

const QUAL_MAP: [RegExp, ClaimBound][] = [
  [/^(?:~|≈|around|about|approx(?:imately|\.)?|roughly|circa|c\.|close to|nearly|almost|some)$/i, "approx"],
  [/^(?:over|more than|north of|above|exceeding|at least|minimum(?: of)?|min\.?|upwards of)$/i, "min"],
  [/^(?:under|less than|below|fewer than|up ?to|at most|max(?:imum)?(?: of)?|no more than)$/i, "max"],
];
const QUAL = "(?:~|≈|around|about|approx(?:imately|\\.)?|roughly|circa|close to|nearly|almost|over|more than|north of|above|exceeding|at least|minimum(?: of)?|upwards of|under|less than|below|fewer than|up ?to|at most|maximum(?: of)?|no more than)";
const CUR = "(?:US\\$|USD|[CSAN]Z?\\$|\\$|₹|Rs\\.?|INR|€|EUR|£|GBP|CAD|AUD|SGD|AED)";
const UNIT = "(?:crores?|cr|lakhs?|lacs?|million|mn|mil|billion|bn|thousand|[mkb])(?![a-z])";
const SEP = "(?:-|–|—|to)";
const currencyOf = (c: string | undefined): string | undefined => {
  if (!c) return undefined;
  const u = c.toUpperCase().replace(/\.$/, "");
  if (u === "$" || u === "US$" || u === "USD") return "USD";
  if (u === "₹" || u === "RS" || u === "INR") return "INR";
  if (u === "€" || u === "EUR") return "EUR";
  if (u === "£" || u === "GBP") return "GBP";
  if (u.endsWith("$")) return u === "C$" || u === "CAD" ? "CAD" : u === "A$" || u === "AUD" ? "AUD" : u === "S$" || u === "SGD" ? "SGD" : u;
  return u;
};
function unitMult(u: string | undefined): number {
  const x = (u ?? "").toLowerCase();
  if (!x) return 1;
  if (x.startsWith("cr")) return 1e7;
  if (x.startsWith("lakh") || x.startsWith("lac")) return 1e5;
  if (x.startsWith("b")) return 1e9;
  if (x.startsWith("m")) return 1e6;
  if (x.startsWith("k") || x.startsWith("t")) return 1e3;
  return 1;
}
const boundOf = (q: string | undefined): ClaimBound | undefined => (q ? QUAL_MAP.find(([re]) => re.test(q.trim()))?.[1] : undefined);

type Amount = { qual?: string; cur?: string; n1: string; u1?: string; n2?: string; u2?: string; plus?: string; neg?: string };
/** Regex source for an amount with optional qualifier, currency, unit, range and trailing plus. Named groups: qual cur n1 u1 n2 u2 plus. */
const AMT = (opts: { money?: boolean } = {}) =>
  `(?:(?<qual>${QUAL})\\s*)?(?<neg>[-−])?${opts.money ? `(?:(?<cur>${CUR})\\s*)?` : ""}(?<n1>${NUM})${opts.money ? `\\s*(?<u1>${UNIT})?` : ""}(?:\\s*${SEP}\\s*${opts.money ? `(?:${CUR}\\s*)?` : ""}(?<n2>${NUM})${opts.money ? `\\s*(?<u2>${UNIT})?` : ""})?(?<plus>\\s?\\+)?`;

function shape(a: Amount, scale = 1): { value: number; high?: number; bound: ClaimBound } | null {
  let lo = toNum(a.n1), hi = a.n2 ? toNum(a.n2) : undefined;
  if (!Number.isFinite(lo) || (hi !== undefined && !Number.isFinite(hi))) return null;
  // "2-3M": the unit at the end applies to both ends
  const m1 = unitMult(a.u1 ?? (a.n2 ? a.u2 : undefined)), m2 = unitMult(a.u2);
  lo *= m1 * scale;
  if (hi !== undefined) hi *= m2 * scale;
  if (a.neg) lo = -lo;
  if (hi !== undefined && hi < lo) [lo, hi] = [hi, lo];
  if (hi !== undefined && hi !== lo) return { value: lo, high: hi, bound: "range" };
  return { value: lo, bound: a.plus ? "min" : (boundOf(a.qual) ?? "exact") };
}

// ---------- extraction ----------
const MOM = "(?:mom|m-o-m|m/m|month[- ]?(?:over|on)[- ]?month|monthly|per month|a month|every month|each month|/mo(?:nth)?)";
const YOY = "(?:yoy|y-o-y|y/y|year[- ]?(?:over|on)[- ]?year|annually|annual growth|per year|a year|yearly|every year|/yr)";
const SIX = "(?:(?:in|over|across|within)\\s+(?:the\\s+)?(?:last|past)\\s+(?:6|six)\\s+months|(?:in|over)\\s+(?:6|six)\\s+months|6[- ]month|six[- ]month)";
const WINDOWS: [ClaimKey, string][] = [["growth_mom", MOM], ["growth_6m", SIX], ["growth_yoy", YOY]];
const PCT = "(?:\\s*%|\\s*per ?cent|\\s*percent)";
const MULT = "(?:\\s*[x×](?![a-z0-9]))";
const GROWTH_VERB = "(?:grew|growing|grown|growth(?: of| at| rate of| is| was)?|up|increase of|increased|increasing|rose|climbing|compounding)";
const DOWN_VERB = /\b(?:down|declin\w*|shrank|shrunk|shrinking|fell|falling|dropp?\w*|decreas\w*|contract\w*)\s*(?:by|of|at)?\s*$/i;
const FIRST_PERSON_PAST = /(?:last year|a year ago|\d+\s*(?:months?|years?|weeks?)\s*ago|previously|used to (?:be|have)|we were|we had|was only|started with|started as|began with)[^.!?\n]{0,40}$/i;
/** The clause (up to the nearest . ! ? newline , ; around the match) the match sits in: "we are a team of 40, growing 20% MoM"
 *  must not make the growth a headcount claim just because the previous clause says "team". */
const sentenceAround = (text: string, i: number, len: number) => {
  const a = Math.max(...[".", "\n", "!", "?", ",", ";"].map((c) => text.lastIndexOf(c, i - 1)));
  const rest = text.slice(i + len);
  const b = rest.search(/[.!?\n,;](?:\s|$)/);
  return text.slice(a + 1, b === -1 ? text.length : i + len + b);
};
const HEAD_WORDS = /\b(?:team|head ?count|employees?|staff|hir(?:e|ed|ing)|workforce|engineers?|people|FTEs?)\b/i;
const OTHER_WORDS = /\b(?:revenue|ARR|MRR|sales|users?|MAU|DAU|GMV|GMV|customers?|clients?|bookings|AUM|usage|traffic|signups?|volume|TPV|pipeline|downloads|subscribers|orders|transactions)\b/i;
function subjectOf(clause: string): "headcount" | "other" | "unspecified" {
  const other = OTHER_WORDS.test(clause);
  const head = HEAD_WORDS.test(clause);
  if (head && !other) return "headcount";
  return other ? "other" : "unspecified";
}

type Hit = { index: number; end: number; claim: Claim };

export function extractClaims(text: string, now: Date = new Date()): Claim[] {
  const hits: Hit[] = [];
  const add = (m: RegExpMatchArray, claim: Claim) => {
    const index = m.index ?? 0, end = index + m[0].length;
    if (!Number.isFinite(claim.value) || (claim.high !== undefined && !Number.isFinite(claim.high))) return;
    if (hits.some((h) => index < h.end && end > h.index && h.claim.key === claim.key)) return; // overlap of the same claim kind
    hits.push({ index, end, claim: { ...claim, text: m[0].trim().replace(/\s+/g, " ") } });
  };
  const groups = (m: RegExpMatchArray): Amount => m.groups as unknown as Amount;
  const isPast = (m: RegExpMatchArray) => { // a past-tense marker earlier in the same clause ("we were 40 last year")
    const i = m.index ?? 0;
    const before = text.slice(Math.max(text.lastIndexOf("\n", i - 1), text.lastIndexOf(".", i - 1), 0), i);
    return FIRST_PERSON_PAST.test(before.split(/[,;]|\b(?:and|but|now|today|currently)\b/i).pop() ?? "");
  };

  // growth: "grew 40% MoM", "40 % month-over-month", "3x YoY", "MoM growth of 40%", "doubled in the last 6 months"
  for (const [key, win] of WINDOWS) {
    const forms = [
      new RegExp(`(?:${GROWTH_VERB}\\s*(?:by\\s+|at\\s+|about\\s+)?)?${AMT()}${PCT}\\s*(?:growth\\s*)?${win}`, "gi"),
      new RegExp(`${win}\\s+growth\\s+(?:of|is|at|was|rate of)?\\s*${AMT()}${PCT}`, "gi"),
    ];
    for (const re of forms) for (const m of text.matchAll(re)) {
      const s = shape(groups(m));
      if (!s) continue;
      const before = text.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0);
      const sign = DOWN_VERB.test(before) || DOWN_VERB.test(m[0].slice(0, m[0].search(/\d|\.\d/) === -1 ? 0 : m[0].search(/\d|\.\d/))) ? -1 : 1;
      add(m, { key, text: m[0], value: s.value * (s.value < 0 ? 1 : sign), ...(s.high !== undefined ? { high: s.high * sign } : {}), bound: s.bound, subject: subjectOf(sentenceAround(text, m.index ?? 0, m[0].length)) });
    }
    // multiples: "3x YoY" = +200%
    const mult = new RegExp(`${AMT()}${MULT}\\s*(?:growth\\s*)?${win}`, "gi");
    for (const m of text.matchAll(mult)) {
      const s = shape(groups(m));
      if (!s || s.value <= 0) continue;
      add(m, { key, text: m[0], value: (s.value - 1) * 100, ...(s.high !== undefined ? { high: (s.high - 1) * 100 } : {}), bound: s.bound, subject: subjectOf(sentenceAround(text, m.index ?? 0, m[0].length)) });
    }
    // "doubled / tripled in the last 6 months", "doubled YoY"
    const dbl = new RegExp(`\\b(doubled|tripled|quadrupled)\\s*(?:our\\s+\\w+\\s+)?${win}`, "gi");
    for (const m of text.matchAll(dbl)) {
      const times = { doubled: 2, tripled: 3, quadrupled: 4 }[m[1]!.toLowerCase() as "doubled"];
      add(m, { key, text: m[0], value: (times - 1) * 100, bound: "exact", subject: subjectOf(sentenceAround(text, m.index ?? 0, m[0].length)) });
    }
  }
  // growth with no window ("10x growth"): kept, but never checkable
  for (const m of text.matchAll(new RegExp(`${AMT()}${MULT}\\s*growth\\b(?!\\s*(?:${MOM}|${YOY}))`, "gi"))) {
    const s = shape(groups(m));
    if (s && s.value > 0 && !hits.some((h) => (m.index ?? 0) < h.end && (m.index ?? 0) + m[0].length > h.index && h.claim.key.startsWith("growth"))) add(m, { key: "growth_unspecified", text: m[0], value: (s.value - 1) * 100, bound: s.bound, subject: subjectOf(sentenceAround(text, m.index ?? 0, m[0].length)) });
  }

  // headcount: "team of 60", "60+ employees", "~60 people", "a 12 member team", "60-person team", "we are 1,200 people"
  const HC_NOUN = "(?:full[- ]time\\s+)?(?:employees|people|persons|team ?members|team|members|staff|FTEs?|strong)";
  const headForms = [
    new RegExp(`(?:team|head ?count|team size|staff|company size)\\s*(?:of|is|at|was|stands at|:)\\s*${AMT()}(?![\\d.]*\\s*(?:%|x\\b|[mkb]\\b|million|crore|lakh))(?!\\s*(?:months?|years?|weeks?|days?|hours?|k\\b))`, "gi"),
    new RegExp(`${AMT()}[- ]?(?:person|people|member|strong)\\s+(?:team|strong|company|startup|org)\\b`, "gi"),
    new RegExp(`${AMT()}\\s*${HC_NOUN}\\b(?!\\s*(?:at|from|in|across)\\s+(?:customer|client))`, "gi"),
  ];
  for (const re of headForms) for (const m of text.matchAll(re)) {
    const g = groups(m);
    if (!g.n2 && /^\d{4}$/.test(g.n1.trim()) && /^(19|20)/.test(g.n1)) continue; // "team of 2023"
    const before = text.slice(Math.max(0, (m.index ?? 0) - 30), m.index ?? 0);
    if (/(?:interview\w*|spoke (?:to|with)|talked (?:to|with)|met|surveyed|ask(?:ed)?|call(?:ed)?)\s+(?:with\s+)?(?:about\s+)?$/i.test(before)) continue; // people we spoke to
    if (isPast(m)) continue;
    const s = shape(g);
    if (!s || s.value <= 0) continue; // zero / negative headcount is not a claim
    add(m, { key: "headcount", text: m[0], ...s });
  }

  // founded: "founded in 2021", "founded in March 2021", "we started in 2021", "5 years old" (a range: the year is not exact)
  const MONTHS = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?,?\\s*";
  for (const m of text.matchAll(new RegExp(`\\b(?:founded|incorporated|established|(?:we|company|startup) (?:was )?started|started (?:the company )?)\\s*(?:in\\s+|on\\s+)?(?:${MONTHS})?(?:\\d{1,2}(?:st|nd|rd|th)?,?\\s*)?((?:19|20)\\d{2})\\b`, "gi"))) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0);
    add(m, { key: "founded", text: m[0], value: Number(m[1]), bound: /\b(?:around|about|circa|roughly)\b/i.test(before) ? "approx" : "exact" });
  }
  for (const m of text.matchAll(/\b(?:company|startup|we(?:'re| are)|business)\s+(?:is\s+)?(?:about\s+|around\s+|almost\s+|nearly\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*[- ]?years?[- ]old\b/gi)) {
    const age = toNum(m[1]!);
    if (!Number.isFinite(age)) continue;
    const y = now.getUTCFullYear();
    add(m, { key: "founded", text: m[0], value: y - age - 1, high: y - age, bound: "range" });
  }

  // revenue: "$2M ARR", "$2.5 million ARR", "ARR of ₹4 crore", "$150k MRR" (MRR is annualised x12)
  const REV = "(?<kind>ARR|MRR|annual(?:ised|ized)? recurring revenue|monthly recurring revenue|annual revenue|revenue run[- ]?rate|run[- ]?rate)";
  const revForms = [
    new RegExp(`${AMT({ money: true })}\\s*${REV}\\b`, "gi"),
    new RegExp(`\\b${REV}\\s*(?:of|is|at|was|:|=|around|about|~)?\\s*${AMT({ money: true })}`, "gi"),
  ];
  for (const re of revForms) for (const m of text.matchAll(re)) {
    const g = m.groups as unknown as Amount & { kind: string };
    const s = shape(g);
    if (!s || s.value <= 0) continue;
    const monthly = /^m|monthly/i.test(g.kind);
    const k = monthly ? 12 : 1;
    const cur = currencyOf(g.cur) ?? (/(crore|lakh|lac|\bcr\b)/i.test(`${g.u1 ?? ""} ${g.u2 ?? ""}`) ? "INR" : undefined);
    add(m, { key: "revenue", text: m[0], value: s.value * k, ...(s.high !== undefined ? { high: s.high * k } : {}), bound: s.bound, ...(cur ? { currency: cur } : { currency: "USD" }) });
  }

  // raised: "raised $3.5M seed", "raised a $12 million Series A", "raised $500k", "raised ₹4 crore", "raised Rs 5 lakh"
  const ROUND = "(?<round>pre[- ]?seed|seed|angel|bridge|series\\s*[a-h]\\b|round)";
  const raisedRe = new RegExp(`\\b(?:raised|closed|secured|landed)\\s+(?:a\\s+|an\\s+|our\\s+|the\\s+)?(?:total\\s+of\\s+|combined\\s+|about\\s+|~\\s*)?(?:(?<qual0>${QUAL})\\s*)?(?:(?<cur>${CUR})\\s*)?(?<n1>${NUM})\\s*(?<u1>${UNIT})?(?:\\s*${SEP}\\s*(?:${CUR}\\s*)?(?<n2>${NUM})\\s*(?<u2>${UNIT})?)?(?:\\s*(?<cur3>USD|INR|EUR|GBP|rupees|dollars))?(?<tail>[^.!?\\n]{0,40})`, "gi");
  for (const m of text.matchAll(raisedRe)) {
    const g = m.groups as unknown as Amount & { qual0?: string; cur3?: string; tail?: string };
    const curWord = g.cur3?.toLowerCase();
    const cur = currencyOf(g.cur) ?? (curWord === "rupees" ? "INR" : curWord === "dollars" ? "USD" : currencyOf(g.cur3)) ?? (/(crore|lakh|lac|^cr$)/i.test(`${g.u1 ?? ""} ${g.u2 ?? ""}`) ? "INR" : undefined);
    if (!cur) continue; // "raised 5 million" with no currency named: not comparable, not a claim
    const s = shape({ ...g, qual: g.qual0 });
    if (!s || s.value <= 0) continue;
    const tail = g.tail ?? "";
    const rm = new RegExp(ROUND, "i").exec(tail);
    const total = /\b(?:in total|total|to date|so far|altogether|overall|since inception|combined)\b/i.test(`${m[0]}`);
    const round = rm?.groups?.round?.toLowerCase().replace(/\s+/g, "_").replace(/^pre-?_?seed$/, "pre_seed");
    const scope: Claim["scope"] = total ? "total" : round ? "round" : "unspecified";
    // the claim text ends at the amount (or the round name), not at the tail's end
    const textEnd = rm ? m[0].length - tail.length + (rm.index + rm[0].length) : m[0].length - tail.length;
    const claim: Claim = { key: "raised", text: m[0].slice(0, textEnd), value: s.value, ...(s.high !== undefined ? { high: s.high } : {}), bound: s.bound, currency: cur, scope, ...(round && round !== "round" ? { round } : {}) };
    const index = m.index ?? 0;
    if (!hits.some((h) => index < h.end && index + m[0].length > h.index && h.claim.key === "raised")) hits.push({ index, end: index + textEnd, claim: { ...claim, text: claim.text.trim().replace(/\s+/g, " ") } });
  }

  // same claim twice (email repeats itself): keep one. Different values are all kept: each is checked on its own.
  hits.sort((a, b) => a.index - b.index);
  const out: Claim[] = [];
  for (const h of hits) {
    const c = h.claim;
    if (out.some((o) => o.key === c.key && o.value === c.value && o.high === c.high && o.bound === c.bound && o.currency === c.currency && o.scope === c.scope)) continue;
    out.push(c);
  }
  return out;
}
