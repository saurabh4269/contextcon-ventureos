// Deterministic request parser for the Sourcing agent. There is no LLM in this build, so a free-text request is read
// with explicit rules: every constraint it extracts names the exact phrase it came from, every assumption is labelled
// as one, and words it could not use are returned as `ignored` so the UI can show what was (not) understood.
//
// Output field names and operators follow docs/crustdata/openapi/company.yaml (/company/search SearchCondition):
// locations.country takes an ISO 3166-1 alpha-3 code, basic_info.year_founded / headcount.total / headcount.growth_percent.{1m,3m,6m,12m}
// are numeric with "=>" / "=<", funding.last_round_type takes "in" with values like "seed", "series_a".

export type GrowthWindow = "1m" | "3m" | "6m" | "12m";
export const WINDOW_MONTHS: Record<GrowthWindow, number> = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 };

export type Interpretation = {
  /** stable key, e.g. "country", "founded", "growth" */
  key: string;
  /** what the agent will do, e.g. "India" or "founded ≥ 2023" */
  label: string;
  /** the exact words of the request it came from ("" for defaults) */
  phrase: string;
  /** filter: hard constraint sent to Crustdata · query: ranked-search terms · output: what to return · default/assumption: not said by the user */
  kind: "filter" | "query" | "output" | "default" | "assumption" | "correction";
};

export type SearchPlan = {
  raw: string;
  count: number;
  countries: { code: string; name: string }[];
  cities: string[];
  keywords: string[];
  foundedMin?: number;
  foundedMax?: number;
  growth?: { minPct: number; window: GrowthWindow };
  headcountMin?: number;
  headcountMax?: number;
  /** true when headcountMin is our default floor (not the user's) — relaxed first */
  headcountFloorIsDefault?: boolean;
  stages: string[];
  fundingMinUsd?: number;
  wantFounders: boolean;
  wantBackground: boolean;
  interpretation: Interpretation[];
  ignored: string[];
};

export type ParseResult =
  | { kind: "search"; plan: SearchPlan }
  | { kind: "company"; raw: string; domain?: string; name?: string; interpretation: Interpretation[] }
  | { kind: "refuse"; raw: string; message: string; ignored: string[] };

export const MAX_COUNT = 25;
export const DEFAULT_COUNT = 10;
/** With a growth filter and no size given, tiny teams (2 → 4 people = +100%) swamp the results; this floor is stated as an assumption and relaxed first. */
export const DEFAULT_GROWTH_HEADCOUNT_FLOOR = 10;
const UPPER_BOUND = /\b(?:under|below|less than|fewer than|at most|no more than|up to|slower than|max(?:imum)?)\b|<|≤/i;
const FAST_GROWTH_DEFAULT_PCT = 30;

/* ───────────── vocabulary ───────────── */

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  "twenty five": 25, "twenty-five": 25, thirty: 30, forty: 40, fifty: 50, hundred: 100, "a dozen": 12, dozen: 12, "half a dozen": 6, "a couple of": 2, "a couple": 2, couple: 2, a: 1, an: 1,
};
const NUM = String.raw`(\d{1,3}|half a dozen|a dozen|dozen|a couple(?: of)?|twenty[- ]five|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|hundred)`;
const toNum = (s: string): number | undefined => {
  const t = s.trim().toLowerCase().replace(/-/g, " ");
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  return NUM_WORDS[t] ?? NUM_WORDS[t.replace(/ /g, "-")];
};

type Place = { re: RegExp; label: string; codes: string[]; cities?: string[] };
const SEA = ["SGP", "IDN", "MYS", "THA", "VNM", "PHL"];
const EUROPE = ["GBR", "DEU", "FRA", "NLD", "ESP", "ITA", "SWE", "IRL", "CHE", "DNK", "FIN", "NOR", "POL", "PRT", "BEL", "AUT", "EST"];
const LATAM = ["BRA", "MEX", "ARG", "COL", "CHL", "PER"];
const AFRICA = ["NGA", "KEN", "ZAF", "EGY", "GHA", "RWA"];
// Cities first (they also set the country). Order matters: the first match wins for overlapping phrases.
const CITIES: Place[] = [
  { re: /\b(bengaluru|bangalore|blr)\b/, label: "Bengaluru", codes: ["IND"], cities: ["Bengaluru", "Bangalore"] },
  { re: /\b(mumbai|bombay)\b/, label: "Mumbai", codes: ["IND"], cities: ["Mumbai"] },
  { re: /\b(delhi ncr|new delhi|delhi|ncr|gurgaon|gurugram|noida)\b/, label: "Delhi NCR", codes: ["IND"], cities: ["Delhi", "Gurugram", "Gurgaon", "Noida"] },
  { re: /\b(hyderabad)\b/, label: "Hyderabad", codes: ["IND"], cities: ["Hyderabad"] },
  { re: /\b(pune)\b/, label: "Pune", codes: ["IND"], cities: ["Pune"] },
  { re: /\b(chennai|madras)\b/, label: "Chennai", codes: ["IND"], cities: ["Chennai"] },
  { re: /\b(kolkata|calcutta)\b/, label: "Kolkata", codes: ["IND"], cities: ["Kolkata"] },
  { re: /\b(ahmedabad)\b/, label: "Ahmedabad", codes: ["IND"], cities: ["Ahmedabad"] },
  { re: /\b(san francisco|bay area|silicon valley|sf)\b/, label: "San Francisco Bay Area", codes: ["USA"], cities: ["San Francisco", "Palo Alto", "Mountain View", "San Jose", "Oakland"] },
  { re: /\b(new york|nyc)\b/, label: "New York", codes: ["USA"], cities: ["New York"] },
  { re: /\b(london)\b/, label: "London", codes: ["GBR"], cities: ["London"] },
  { re: /\b(berlin)\b/, label: "Berlin", codes: ["DEU"], cities: ["Berlin"] },
  { re: /\b(paris)\b/, label: "Paris", codes: ["FRA"], cities: ["Paris"] },
  { re: /\b(tel aviv)\b/, label: "Tel Aviv", codes: ["ISR"], cities: ["Tel Aviv"] },
  { re: /\b(dubai)\b/, label: "Dubai", codes: ["ARE"], cities: ["Dubai"] },
  { re: /\b(toronto)\b/, label: "Toronto", codes: ["CAN"], cities: ["Toronto"] },
  { re: /\b(jakarta)\b/, label: "Jakarta", codes: ["IDN"], cities: ["Jakarta"] },
];
const COUNTRIES: Place[] = [
  { re: /\b(india|indian|indians|bharat)\b/, label: "India", codes: ["IND"] },
  { re: /\b(usa|u\.s\.a\.?|u\.s\.|united states|america|american|us-based|us based)\b/, label: "United States", codes: ["USA"] },
  { re: /\b(uk|u\.k\.|united kingdom|britain|british|england|english)\b/, label: "United Kingdom", codes: ["GBR"] },
  { re: /\b(south[- ]?east asia|southeast asian|sea|asean)\b/, label: "Southeast Asia", codes: SEA },
  { re: /\b(singapore|singaporean)\b/, label: "Singapore", codes: ["SGP"] },
  { re: /\b(indonesia|indonesian)\b/, label: "Indonesia", codes: ["IDN"] },
  { re: /\b(vietnam|vietnamese)\b/, label: "Vietnam", codes: ["VNM"] },
  { re: /\b(malaysia|malaysian)\b/, label: "Malaysia", codes: ["MYS"] },
  { re: /\b(thailand|thai)\b/, label: "Thailand", codes: ["THA"] },
  { re: /\b(philippines|filipino|philippine)\b/, label: "Philippines", codes: ["PHL"] },
  { re: /\b(germany|german)\b/, label: "Germany", codes: ["DEU"] },
  { re: /\b(france|french)\b/, label: "France", codes: ["FRA"] },
  { re: /\b(netherlands|dutch|holland)\b/, label: "Netherlands", codes: ["NLD"] },
  { re: /\b(spain|spanish)\b/, label: "Spain", codes: ["ESP"] },
  { re: /\b(sweden|swedish)\b/, label: "Sweden", codes: ["SWE"] },
  { re: /\b(europe|european|eu)\b/, label: "Europe", codes: EUROPE },
  { re: /\b(canada|canadian)\b/, label: "Canada", codes: ["CAN"] },
  { re: /\b(israel|israeli)\b/, label: "Israel", codes: ["ISR"] },
  { re: /\b(uae|emirates|emirati)\b/, label: "United Arab Emirates", codes: ["ARE"] },
  { re: /\b(australia|australian)\b/, label: "Australia", codes: ["AUS"] },
  { re: /\b(japan|japanese)\b/, label: "Japan", codes: ["JPN"] },
  { re: /\b(china|chinese)\b/, label: "China", codes: ["CHN"] },
  { re: /\b(south korea|korea|korean)\b/, label: "South Korea", codes: ["KOR"] },
  { re: /\b(brazil|brazilian)\b/, label: "Brazil", codes: ["BRA"] },
  { re: /\b(mexico|mexican)\b/, label: "Mexico", codes: ["MEX"] },
  { re: /\b(latam|latin america|latin american)\b/, label: "Latin America", codes: LATAM },
  { re: /\b(nigeria|nigerian)\b/, label: "Nigeria", codes: ["NGA"] },
  { re: /\b(kenya|kenyan)\b/, label: "Kenya", codes: ["KEN"] },
  { re: /\b(africa|african)\b/, label: "Africa", codes: AFRICA },
];

/** Sector / business-model words → the term sent to ranked search. */
const SECTORS: { re: RegExp; term: string }[] = [
  { re: /\b(b2b|b-2-b|business[- ]to[- ]business|enterprise)\b/, term: "B2B" },
  { re: /\b(b2c|business[- ]to[- ]consumer|consumer)\b/, term: "B2C consumer" },
  { re: /\b(d2c|dtc|direct[- ]to[- ]consumer)\b/, term: "D2C brand" },
  { re: /\b(saas|software[- ]as[- ]a[- ]service)\b/, term: "SaaS" },
  { re: /\b(software)\b/, term: "software" },
  { re: /\b(fin[- ]?tech|payments?|lending|neo[- ]?banks?|banking)\b/, term: "fintech" },
  { re: /\b(gen[- ]?ai|generative ai|artificial intelligence|machine learning|llms?|agentic|ai[- ]native|ai|a\.i\.|ml)\b/, term: "AI" },
  { re: /\b(dev[- ]?tools?|developer tools?|developer platforms?|devops)\b/, term: "developer tools" },
  { re: /\b(health[- ]?tech|healthcare|digital health|medtech)\b/, term: "healthtech" },
  { re: /\b(ed[- ]?tech|education)\b/, term: "edtech" },
  { re: /\b(climate[- ]?tech|clean[- ]?tech|climate|sustainability|renewables?)\b/, term: "climate tech" },
  { re: /\b(e-?commerce|ecom|retail tech)\b/, term: "e-commerce" },
  { re: /\b(logistics|supply chain|freight)\b/, term: "logistics" },
  { re: /\b(cyber[- ]?security|security|infosec)\b/, term: "cybersecurity" },
  { re: /\b(hr[- ]?tech|hr|recruiting|hiring platform)\b/, term: "HR tech" },
  { re: /\b(insur[- ]?tech|insurance)\b/, term: "insurtech" },
  { re: /\b(prop[- ]?tech|real estate)\b/, term: "proptech" },
  { re: /\b(agri[- ]?tech|ag[- ]?tech|agriculture)\b/, term: "agritech" },
  { re: /\b(gaming|games)\b/, term: "gaming" },
  { re: /\b(robotics|robots?)\b/, term: "robotics" },
  { re: /\b(bio[- ]?tech|life sciences)\b/, term: "biotech" },
  { re: /\b(deep[- ]?tech)\b/, term: "deep tech" },
  { re: /\b(marketplaces?)\b/, term: "marketplace" },
  { re: /\b(data infrastructure|data platforms?|analytics|data)\b/, term: "data analytics" },
  { re: /\b(infra|infrastructure|cloud)\b/, term: "infrastructure" },
  { re: /\b(legal[- ]?tech)\b/, term: "legaltech" },
  { re: /\b(mar[- ]?tech|marketing tech|marketing)\b/, term: "marketing tech" },
  { re: /\b(web3|crypto|blockchain)\b/, term: "web3" },
  { re: /\b(space[- ]?tech|aerospace|space)\b/, term: "space tech" },
  { re: /\b(ev|electric vehicles?|mobility)\b/, term: "mobility EV" },
  { re: /\b(semiconductors?|chips?)\b/, term: "semiconductors" },
  { re: /\b(food[- ]?tech)\b/, term: "foodtech" },
  { re: /\b(travel[- ]?tech|travel)\b/, term: "travel tech" },
  { re: /\b(api[- ]first|apis?)\b/, term: "API" },
];

const STAGES: { re: RegExp; label: string; values: string[] }[] = [
  { re: /\b(pre[- ]?seed)\b/, label: "Pre-seed", values: ["pre_seed"] },
  { re: /\b(?<!pre[- ]?)(seed)(?:[- ]stage| round| funded)?\b/, label: "Seed", values: ["seed"] },
  { re: /\bseries[- ]?a\b/, label: "Series A", values: ["series_a"] },
  { re: /\bseries[- ]?b\b/, label: "Series B", values: ["series_b"] },
  { re: /\bseries[- ]?c\b/, label: "Series C", values: ["series_c"] },
  { re: /\bseries[- ]?d\b/, label: "Series D", values: ["series_d"] },
  { re: /\bangel[- ]?(?:funded|round|stage|backed)?\b/, label: "Angel", values: ["angel"] },
  { re: /\bearly[- ]stage\b/, label: "Early stage (pre-seed to Series A)", values: ["pre_seed", "seed", "series_a"] },
  { re: /\b(growth[- ]stage|late[- ]stage)\b/, label: "Growth stage (Series C+)", values: ["series_c", "series_d", "series_e"] },
];

/** Words we understand structurally; typo correction snaps unknown tokens onto these. */
const VOCAB = [
  "india", "indian", "bangalore", "bengaluru", "mumbai", "hyderabad", "chennai", "singapore", "american", "british", "european", "germany", "indonesia",
  "founded", "founders", "founder", "cofounder", "companies", "company", "startups", "startup", "employees", "headcount", "months", "month", "quarter", "years",
  "doubled", "tripled", "grew", "grown", "growth", "growing", "series", "seed", "software", "since", "after", "before", "between", "fintech", "healthtech", "edtech",
  "saas", "previously", "background", "enterprise", "consumer", "payments", "logistics", "security", "climate", "robotics", "infrastructure", "marketplace",
  "developer", "insurance", "agriculture", "education", "healthcare", "analytics", "increased", "expanded", "team", "people", "least", "under", "over",
];
const STOP = new Set(
  ("find get give show list me us the a an of and or in on at to for with that which whose who whom their its it is are was were be been being has have had by from " +
    "tell what did do does they them he she each every all any some also please based located headquartered hq companies company startups startup cos co firms businesses " +
    "orgs organisations organizations players names targets ventures last past previous trailing over within during this year years month months team teams headcount employees " +
    "people staff workforce grew grown growing growth increased expanded scaled size founded started launched established incorporated founders founder cofounders co-founders " +
    "before after since than more less at least about around roughly approximately top best want need looking look for i we our my can could would should will just only " +
    "new young recently recent percent per cent half by into as such like other others ones one each those these there here where how many much stage stages funded backed raised " +
    "growth-stage early-stage early late round rounds did do doing done work worked working before previously prior background history career what ceo ceos cto leaders " +
    "fast-growing fast high-growth rapidly quickly quick list identify surface pull bring up so not no yes very most some lot lots bunch couple dozen ten").split(/\s+/),
);

/* ───────────── typo correction ───────────── */

/** Damerau-Levenshtein (optimal string alignment) distance, capped for speed. */
export function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  return d[m]![n]!;
}

const SYNONYMS: Record<string, string> = { cos: "companies", cmpanies: "companies", startps: "startups", yrs: "years", yr: "year", mos: "months", mo: "months", emps: "employees", ppl: "people", hc: "headcount", blr: "bengaluru" };

function correctTypos(text: string): { text: string; corrections: { from: string; to: string }[] } {
  const corrections: { from: string; to: string }[] = [];
  const out = text.replace(/[a-z][a-z-]*/g, (tok) => {
    if (SYNONYMS[tok]) {
      if (SYNONYMS[tok] !== tok && !["blr"].includes(tok)) corrections.push({ from: tok, to: SYNONYMS[tok]! });
      return SYNONYMS[tok]!;
    }
    if (tok.length < 4 || STOP.has(tok) || VOCAB.includes(tok)) return tok;
    if (SECTORS.some((s) => s.re.test(tok)) || COUNTRIES.some((c) => c.re.test(tok))) return tok;
    const limit = tok.length >= 7 ? 2 : 1;
    let best: string | undefined, bestD = limit + 1;
    for (const v of VOCAB) {
      const dd = editDistance(tok, v);
      if (dd < bestD) { best = v; bestD = dd; }
    }
    if (best && bestD <= limit) { corrections.push({ from: tok, to: best }); return best; }
    return tok;
  });
  return { text: out, corrections };
}

/* ───────────── helpers ───────────── */

type Span = [number, number];
class Reader {
  readonly spans: Span[] = [];
  constructor(readonly text: string) {}
  /** First match of `re` not overlapping an already-claimed span. */
  find(re: RegExp): RegExpExecArray | null {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    for (let m; (m = g.exec(this.text)); ) {
      if (m[0].length === 0) { g.lastIndex++; continue; }
      const s = m.index, e = s + m[0].length;
      if (!this.spans.some(([a, b]) => s < b && e > a)) return m;
    }
    return null;
  }
  claim(m: RegExpExecArray) {
    this.spans.push([m.index, m.index + m[0].length]);
    return m[0].trim();
  }
  /** Words not covered by any claimed span and not stop words, grouped into phrases. */
  leftovers(): string[] {
    const out: string[] = [];
    let cur: string[] = [];
    const flush = () => { if (cur.length) out.push(cur.join(" ")); cur = []; };
    const re = /[a-z0-9][a-z0-9.'&+-]*/g;
    for (let m; (m = re.exec(this.text)); ) {
      const s = m.index, e = s + m[0].length;
      const covered = this.spans.some(([a, b]) => s >= a && e <= b);
      const w = m[0].replace(/[.'-]+$/, "");
      if (covered || STOP.has(w) || !w) { flush(); continue; }
      cur.push(w);
    }
    flush();
    return out;
  }
}

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
/** "asdf", "qwerty", "jjjj", "zxcv" … */
export function looksLikeMash(s: string): boolean {
  const t = s.toLowerCase().replace(/[^a-z]/g, "");
  if (!t) return true;
  if (/^(.)\1{2,}$/.test(t)) return true;
  if (t.length >= 3 && KEYBOARD_ROWS.some((r) => r.includes(t.slice(0, 4)) && t.length <= 12 && [...t].every((c) => r.includes(c)))) return true;
  if (t.length >= 5 && !/[aeiouy]/.test(t)) return true;
  return false;
}

const DOMAIN_RE = /^(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9-]{1,63})*\.[a-z]{2,24})(?:[/?#].*)?$/i;
const RESEARCH_RE = /^(?:research|tell me about|look ?up|analy[sz]e|deep[- ]dive(?: on| into)?|what about|who is|profile|diligence|open)\s+(.+?)\s*\??$/i;

export const EXAMPLE_HINT = "Try e.g. “ten Indian B2B software companies founded since 2023 whose team grew by half in the last six months, with their founders”.";

/* ───────────── main ───────────── */

export function parseRequest(input: unknown, now: Date = new Date()): ParseResult {
  const raw = typeof input === "string" ? input.replace(/\s+/g, " ").trim().slice(0, 600) : "";
  if (raw.length < 2) return { kind: "refuse", raw, message: `Type what you are looking for. ${EXAMPLE_HINT}`, ignored: [] };

  // A bare domain or URL → company research.
  const dm = DOMAIN_RE.exec(raw);
  if (dm && !/\s/.test(raw)) {
    const domain = dm[1]!.toLowerCase();
    return { kind: "company", raw, domain, interpretation: [{ key: "company", label: `Research ${domain}`, phrase: raw, kind: "output" }] };
  }

  const lower = raw.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-");
  const { text, corrections } = correctTypos(lower);
  const r = new Reader(text);
  const interp: Interpretation[] = corrections.map((c) => ({ key: "typo", label: `read “${c.from}” as “${c.to}”`, phrase: c.from, kind: "correction" }));
  const year = now.getUTCFullYear();

  // "research razorpay" / "tell me about Zepto" → company research by name or domain.
  const rm = RESEARCH_RE.exec(raw);
  if (rm) {
    const target = rm[1]!.replace(/[?.!]+$/, "").trim();
    const d = DOMAIN_RE.exec(target);
    if (d && !/\s/.test(target)) return { kind: "company", raw, domain: d[1]!.toLowerCase(), interpretation: [{ key: "company", label: `Research ${d[1]!.toLowerCase()}`, phrase: target, kind: "output" }] };
    if (target.split(/\s+/).length <= 4 && !looksLikeMash(target)) return { kind: "company", raw, name: target, interpretation: [{ key: "company", label: `Research “${target}”`, phrase: target, kind: "output" }] };
  }

  /* places: cities first, then countries */
  const countries: SearchPlan["countries"] = [];
  const cities: string[] = [];
  const addCountry = (codes: string[], label: string) => {
    for (const code of codes) if (!countries.some((c) => c.code === code)) countries.push({ code, name: codes.length === 1 ? label : code });
  };
  for (const c of CITIES) {
    const m = r.find(c.re);
    if (!m) continue;
    const phrase = r.claim(m);
    cities.push(...c.cities!);
    addCountry(c.codes, c.label === "San Francisco Bay Area" || c.label === "New York" ? "United States" : countryName(c.codes[0]!));
    interp.push({ key: "city", label: `HQ in ${c.label}`, phrase, kind: "filter" });
  }
  // "IN" in capitals as a country code (lower-case "in" is a preposition)
  if (/(^|[\s,(])IN([\s,.)]|$)/.test(raw) && !countries.some((c) => c.code === "IND")) {
    addCountry(["IND"], "India");
    interp.push({ key: "country", label: "India", phrase: "IN", kind: "filter" });
  }
  // "US" in capitals
  if (/(^|[\s,(])US([\s,.)]|$)/.test(raw) && !countries.some((c) => c.code === "USA")) {
    addCountry(["USA"], "United States");
    interp.push({ key: "country", label: "United States", phrase: "US", kind: "filter" });
  }
  for (const c of COUNTRIES) {
    const m = r.find(c.re);
    if (!m) continue;
    const phrase = r.claim(m);
    if (c.codes.every((code) => countries.some((x) => x.code === code))) continue;
    addCountry(c.codes, c.label);
    interp.push({ key: "country", label: c.codes.length > 1 ? `${c.label} (${c.codes.join(", ")})` : c.label, phrase, kind: "filter" });
  }

  /* founded year */
  let foundedMin: number | undefined, foundedMax: number | undefined;
  const Y = String.raw`((?:19|20)\d{2})`;
  const FV = String.raw`(?:founded|started|incorporated|launched|established|born|set up|formed|created)`;
  const okYear = (y: number) => y >= 1900 && y <= year + 1;
  const foundedRules: { re: RegExp; apply: (m: RegExpExecArray) => string | undefined }[] = [
    { re: new RegExp(String.raw`(?:${FV}\s+)?(?:between\s+)?(?:in\s+)?${Y}\s*(?:-|to|and|through|until)\s*${Y}`), apply: (m) => { const a = +m[1]!, b = +m[2]!; if (!okYear(a) || !okYear(b)) return; foundedMin = Math.min(a, b); foundedMax = Math.max(a, b); return `founded ${foundedMin}–${foundedMax}`; } },
    { re: new RegExp(String.raw`(?:${FV}\s+)?(?:in\s+or\s+after|on\s+or\s+after|in\s+or\s+since|since|from|>=|≥|starting)\s+(?:the\s+start\s+of\s+)?${Y}`), apply: (m) => { const y = +m[1]!; if (!okYear(y)) return; foundedMin = y; return `founded ≥ ${y}`; } },
    { re: new RegExp(String.raw`(?:${FV}\s+)?(?:after|post[- ]?|>|later than)\s*${Y}`), apply: (m) => { const y = +m[1]!; if (!okYear(y)) return; foundedMin = y + 1; return `founded ≥ ${y + 1}`; } },
    { re: new RegExp(String.raw`(?:${FV}\s+)?(?:in\s+)?${Y}\s*(?:or\s+later|or\s+after|onwards|and\s+later|and\s+after|\+|or\s+newer)`), apply: (m) => { const y = +m[1]!; if (!okYear(y)) return; foundedMin = y; return `founded ≥ ${y}`; } },
    { re: new RegExp(String.raw`(?:${FV}\s+)?(?:before|prior\s+to|pre[- ]?|<|earlier\s+than)\s*${Y}`), apply: (m) => { const y = +m[1]!; if (!okYear(y)) return; foundedMax = y - 1; return `founded ≤ ${y - 1}`; } },
    { re: new RegExp(String.raw`(?:${FV}\s+)?(?:in\s+or\s+before|by|until|up\s+to)\s+${Y}`), apply: (m) => { const y = +m[1]!; if (!okYear(y)) return; foundedMax = y; return `founded ≤ ${y}`; } },
    { re: new RegExp(String.raw`${FV}\s+(?:in\s+)?${Y}`), apply: (m) => { const y = +m[1]!; if (!okYear(y)) return; foundedMin = y; foundedMax = y; return `founded in ${y}`; } },
    { re: new RegExp(String.raw`${FV}\s+(?:in\s+)?(?:the\s+)?(?:last|past)\s+${NUM}\s+years?`), apply: (m) => { const n = toNum(m[1]!); if (!n || n > 50) return; foundedMin = year - n; return `founded ≥ ${year - n}`; } },
    { re: /\b(?:founded|started)\s+(?:this|in the current)\s+year\b/, apply: () => { foundedMin = year; return `founded ≥ ${year}`; } },
    { re: /\bfounded\s+last\s+year\b/, apply: () => { foundedMin = year - 1; foundedMax = year - 1; return `founded in ${year - 1}`; } },
  ];
  for (const rule of foundedRules) {
    const m = r.find(rule.re);
    if (!m) continue;
    const label = rule.apply(m);
    if (!label) continue;
    interp.push({ key: "founded", label, phrase: r.claim(m), kind: "filter" });
    break;
  }

  /* headcount growth */
  let growth: SearchPlan["growth"] | undefined;
  let growthPhrase = "";
  const GROW = String.raw`(?:grew|grown|grow|growing|growth|increased?|increasing|expanded|expand|jumped|jump|rose|risen|scaled|added|up)`;
  const growthRules: { re: RegExp; pct: (m: RegExpExecArray) => number | undefined }[] = [
    { re: /\b(quadrupled|4x|four[- ]?fold)\b/, pct: () => 300 },
    { re: /\b(tripled|triple|3x|three[- ]?fold)\b/, pct: () => 200 },
    { re: /\b(doubled|double|doubling|2x|two[- ]?fold)\b/, pct: () => 100 },
    { re: /\b1\.5x\b/, pct: () => 50 },
    { re: new RegExp(String.raw`${GROW}\s+(?:\w+\s+){0,3}?(?:by\s+)?(?:at\s+least\s+|over\s+|more\s+than\s+|>\s*|≥\s*)?(?:a\s+|one[- ])?half\b|\bhalf\s+again\b`), pct: () => 50 },
    { re: new RegExp(String.raw`${GROW}\s+(?:\w+\s+){0,3}?(?:by\s+)?(?:at\s+least\s+|over\s+|more\s+than\s+)?(?:a|one)[- ]third\b`), pct: () => 33 },
    { re: new RegExp(String.raw`${GROW}\s+(?:\w+\s+){0,3}?(?:by\s+)?(?:at\s+least\s+|over\s+|more\s+than\s+)?(?:a|one)[- ]quarter\b`), pct: () => 25 },
    { re: new RegExp(String.raw`${GROW}\s+(?:\w+\s+){0,4}?(?:by\s+)?(?:at\s+least\s+|over\s+|more\s+than\s+|>\s*|≥\s*|\+\s*)?(\d{1,4}(?:\.\d+)?)\s*(?:%|percent|per cent|pc)`), pct: (m) => Number(m[1]) },
    { re: /(?:\+|>\s*|≥\s*|at least\s+|over\s+|more than\s+)?(\d{1,4}(?:\.\d+)?)\s*(?:%|percent|per cent)\s*\+?\s*(?:or more\s+)?(?:\w+\s+){0,2}?(?:headcount|team|employee|staff|workforce|hiring)?\s*(?:growth|increase|up|yoy|qoq|mom)/, pct: (m) => Number(m[1]) },
    { re: /(?:headcount|team|employees?|staff|workforce)\s+(?:growth\s+)?(?:of\s+|up\s+|\+\s*)?(?:>\s*|≥\s*|over\s+|above\s+|at least\s+)?(\d{1,4}(?:\.\d+)?)\s*(?:%|percent)\s*\+?/, pct: (m) => Number(m[1]) },
    { re: /\b(\d{1,4})\s*%\s*\+/, pct: (m) => Number(m[1]) },
  ];
  for (const rule of growthRules) {
    const m = r.find(rule.re);
    if (!m) continue;
    // "growth under 10%" is an upper bound; the plan only has minimums, so the phrase is left unread (shown as not used)
    // instead of being turned into "10% or more"
    if (UPPER_BOUND.test(m[0])) break;
    const pct = rule.pct(m);
    if (pct == null || !Number.isFinite(pct) || pct <= 0 || pct > 5000) continue;
    growthPhrase = r.claim(m);
    growth = { minPct: pct, window: "6m" };
    break;
  }
  let fastDefault = false;
  if (!growth) {
    const m = r.find(/\b(fast[- ]growing|high[- ]growth|rapidly growing|hyper[- ]?growth|growing fast|scaling fast|fastest[- ]growing|growing quickly)\b/);
    if (m) { growthPhrase = r.claim(m); growth = { minPct: FAST_GROWTH_DEFAULT_PCT, window: "6m" }; fastDefault = true; }
  }
  // window
  let windowPhrase = "";
  if (growth) {
    const wm = r.find(new RegExp(String.raw`\b(?:(?:in|over|during|within|across)\s+)?(?:the\s+)?(?:(?:last|past|previous|trailing|prior|recent)\s+)?(?:${NUM}\s*)?(?:months?|mos?|quarters?|years?|yrs?)\b|\b(?:yoy|qoq|mom|year[- ]over[- ]year|quarter[- ]over[- ]quarter|month[- ]over[- ]month|this year|half[- ]year)\b`));
    if (wm && /(month|mo|quarter|year|yr|yoy|qoq|mom)/.test(wm[0])) {
      const w = wm[0];
      let months: number | undefined;
      if (/yoy|year[- ]over|this year/.test(w)) months = 12;
      else if (/qoq|quarter[- ]over/.test(w)) months = 3;
      else if (/mom|month[- ]over/.test(w)) months = 1;
      else if (/half[- ]year/.test(w)) months = 6;
      else {
        const n = wm[1] ? toNum(wm[1]) : 1;
        const unit = /quarter/.test(w) ? 3 : /year|yr/.test(w) ? 12 : 1;
        months = (n ?? 1) * unit;
      }
      const win: GrowthWindow = months <= 1 ? "1m" : months <= 4 ? "3m" : months <= 8 ? "6m" : "12m";
      growth.window = win;
      windowPhrase = r.claim(wm);
      if (WINDOW_MONTHS[win] !== months) interp.push({ key: "window", label: `Crustdata reports growth over 1, 3, 6 or 12 months: using ${WINDOW_MONTHS[win]} months for “${windowPhrase}”`, phrase: windowPhrase, kind: "assumption" });
    }
  }
  if (growth) {
    const winLabel = `${WINDOW_MONTHS[growth.window]} mo`;
    interp.push({ key: "growth", label: `headcount +${growth.minPct}% or more in ${winLabel}`, phrase: [growthPhrase, windowPhrase].filter(Boolean).join(" … "), kind: "filter" });
    if (fastDefault) interp.push({ key: "growth-default", label: `“fast-growing” read as ≥ ${FAST_GROWTH_DEFAULT_PCT}% headcount growth`, phrase: growthPhrase, kind: "assumption" });
    if (!windowPhrase) interp.push({ key: "window-default", label: `no time window given: using ${WINDOW_MONTHS[growth.window]} months`, phrase: "", kind: "assumption" });
  }

  /* headcount size */
  let headcountMin: number | undefined, headcountMax: number | undefined;
  const PEOPLE = String.raw`(?:employees|employee|people|persons?|staff|headcount|fte?s?|members|team members|engineers|team size|strong)`;
  const K = (s: string) => (/k$/i.test(s) ? Number(s.slice(0, -1)) * 1000 : Number(s));
  const NUMK = String.raw`(\d{1,6}(?:\.\d+)?k?)`;
  const sizeRules: { re: RegExp; apply: (m: RegExpExecArray) => string | undefined }[] = [
    { re: new RegExp(String.raw`(?:between\s+)?${NUMK}\s*(?:-|to|and)\s*${NUMK}\s*${PEOPLE}`), apply: (m) => { const a = K(m[1]!), b = K(m[2]!); headcountMin = Math.min(a, b); headcountMax = Math.max(a, b); return `${headcountMin}–${headcountMax} employees`; } },
    { re: new RegExp(String.raw`(?:under|fewer than|less than|below|up to|at most|<|no more than|max(?:imum)?(?: of)?)\s*${NUMK}\s*${PEOPLE}`), apply: (m) => { headcountMax = K(m[1]!) - (/^(?:under|fewer than|less than|below|<)/.test(m[0]) ? 1 : 0); return `≤ ${headcountMax} employees`; } }, // "fewer than 50" excludes 50
    { re: new RegExp(String.raw`(?:over|more than|at least|above|>|min(?:imum)?(?: of)?|bigger than|larger than)\s*${NUMK}\s*${PEOPLE}`), apply: (m) => { headcountMin = K(m[1]!) + (/^(?:over|more than|above|>|bigger than|larger than)/.test(m[0]) ? 1 : 0); return `≥ ${headcountMin} employees`; } }, // "more than 200" excludes 200
    { re: new RegExp(String.raw`${NUMK}\s*\+\s*${PEOPLE}`), apply: (m) => { headcountMin = K(m[1]!); return `≥ ${headcountMin} employees`; } },
    { re: new RegExp(String.raw`(?:with|of|having)\s+${NUMK}\s+${PEOPLE}`), apply: (m) => { headcountMin = K(m[1]!); return `≥ ${headcountMin} employees`; } },
  ];
  for (const rule of sizeRules) {
    const m = r.find(rule.re);
    if (!m) continue;
    const label = rule.apply(m);
    if (label) { interp.push({ key: "headcount", label, phrase: r.claim(m), kind: "filter" }); break; }
  }
  let headcountFloorIsDefault = false;
  if (growth && headcountMin == null) {
    headcountMin = DEFAULT_GROWTH_HEADCOUNT_FLOOR;
    headcountFloorIsDefault = true;
    interp.push({ key: "headcount-default", label: `≥ ${DEFAULT_GROWTH_HEADCOUNT_FLOOR} employees, so a growth % means real hiring (relaxed first if too few match)`, phrase: "", kind: "assumption" });
  }

  /* funding stage */
  const stages: string[] = [];
  for (const s of STAGES) {
    const m = r.find(s.re);
    if (!m) continue;
    const phrase = r.claim(m);
    for (const v of s.values) if (!stages.includes(v)) stages.push(v);
    interp.push({ key: "stage", label: `last round: ${s.label}`, phrase, kind: "filter" });
  }

  /* funding amount (USD only: Crustdata reports funding in USD; no FX conversion is invented) */
  let fundingMinUsd: number | undefined;
  const fm = r.find(/(?:raised|funding|funded|raise)\s+(?:of\s+)?(?:over|more than|at least|above|>)?\s*(\$|usd\s*|₹|inr\s*|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(k|m|mn|million|b|bn|billion|cr|crores?|lakhs?)?\b/);
  if (fm && (fm[1] || fm[3])) {
    const phrase = r.claim(fm);
    const cur = fm[1]?.trim() ?? "";
    const unit = fm[3] ?? "";
    if (/₹|inr|rs/.test(cur) || /cr|lakh/.test(unit)) {
      interp.push({ key: "funding", label: "funding amount in INR not applied: Crustdata reports funding in USD and no exchange rate is assumed", phrase, kind: "assumption" });
    } else {
      const mult = /^k$/.test(unit) ? 1e3 : /^(m|mn|million)$/.test(unit) ? 1e6 : /^(b|bn|billion)$/.test(unit) ? 1e9 : 1;
      fundingMinUsd = Number(fm[2]) * mult;
      interp.push({ key: "funding", label: `total raised ≥ USD ${fundingMinUsd.toLocaleString("en-US")}`, phrase, kind: "filter" });
    }
  }

  /* founders / background (outputs) */
  const fo = r.find(/\b(co-?founders?|founders?|founding team|founded by|who (?:founded|started|runs|leads|built|founded each|started each)|team behind|ceos?)\b(?:\s+(?:each|it|them|of each|of them))?/);
  const wantFounders = !!fo;
  if (fo) interp.push({ key: "founders", label: "founders of each company", phrase: r.claim(fo), kind: "output" });
  const bg = r.find(/\b(what (?:they|he|she|each) (?:did|worked on|was doing) (?:before|previously|earlier)|backgrounds?|previous(?:ly)? (?:roles?|jobs?|companies|employers?|experience)|prior (?:roles?|jobs?|experience|employers?|companies)|past (?:roles?|jobs?|experience|employers?)|where (?:they|he|she) worked|worked (?:at|before)|career|pedigree|ex-\w+|alumni)\b(?:\s+before)?/);
  const wantBackground = !!bg;
  if (bg) interp.push({ key: "background", label: "each founder's prior employers", phrase: r.claim(bg), kind: "output" });

  /* sector & business-model keywords → ranked search query */
  const keywords: string[] = [];
  for (const s of SECTORS) {
    const m = r.find(s.re);
    if (!m) continue;
    const phrase = r.claim(m);
    if (keywords.includes(s.term)) continue;
    keywords.push(s.term);
    interp.push({ key: "keyword", label: s.term, phrase, kind: "query" });
  }

  /* count (after years / sizes / percents are claimed so their digits are not read as a count) */
  let count = DEFAULT_COUNT;
  let countSaid = false;
  const NOUNS = String.raw`(?:companies|company|startups|startup|firms|businesses|orgs|organisations|organizations|players|names|targets|leads|candidates|ventures|teams|options|results|ideas|picks)`;
  const countRules = [
    new RegExp(String.raw`\b(?:top|find|list|show(?:\s+me)?|give(?:\s+me)?|get(?:\s+me)?|identify|surface|pull|need|want|suggest|name)\s+(?:me\s+)?(?:the\s+)?(?:top\s+|best\s+)?${NUM}\b(?!\s*(?:%|percent|months?|years?|employees|people))`),
    new RegExp(String.raw`\b${NUM}\s+(?:[a-z0-9-]+\s+){0,5}?${NOUNS}\b`),
    new RegExp(String.raw`^${NUM}\b(?!\s*(?:%|percent|months?|years?|employees|people))`),
  ];
  for (const re of countRules) {
    const m = r.find(re);
    if (!m) continue;
    const n = toNum(m[1]!);
    if (n == null || n < 1 || m[1] === "a" || m[1] === "an") continue;
    count = Math.min(Math.round(n), MAX_COUNT);
    countSaid = true;
    const numPhrase = m[1]!;
    // claim only the number itself so the nouns/keywords after it stay readable
    r.spans.push([m.index + m[0].indexOf(numPhrase), m.index + m[0].indexOf(numPhrase) + numPhrase.length]);
    interp.unshift({ key: "count", label: n > MAX_COUNT ? `${MAX_COUNT} companies (capped from ${n})` : `${count} companies`, phrase: numPhrase, kind: "output" });
    break;
  }
  if (!countSaid) interp.unshift({ key: "count", label: `${DEFAULT_COUNT} companies (default)`, phrase: "", kind: "default" });

  // claim structural nouns so they are not reported as ignored
  for (const re of [/\b(companies|company|startups|startup|firms|businesses)\b/g]) { for (let m; (m = r.find(re)); ) r.claim(m); }

  const ignored = r.leftovers();
  const hasConstraint = countries.length > 0 || foundedMin != null || foundedMax != null || growth != null || stages.length > 0 || fundingMinUsd != null || (headcountMin != null && !headcountFloorIsDefault) || headcountMax != null;

  if (!hasConstraint && keywords.length === 0) {
    // Nothing usable. A short, word-like input is probably a company name → resolve it on Crustdata (identify is free).
    const words = raw.split(/\s+/);
    if (words.length <= 3 && !looksLikeMash(raw) && /[a-z]/i.test(raw) && !wantFounders) {
      return { kind: "company", raw, name: raw.replace(/[?.!]+$/, ""), interpretation: [{ key: "company", label: `Look up “${raw}” as a company name`, phrase: raw, kind: "output" }] };
    }
    return {
      kind: "refuse",
      raw,
      message: looksLikeMash(raw)
        ? `“${raw.slice(0, 40)}” doesn't read as a request. ${EXAMPLE_HINT}`
        : `I couldn't find anything to search on (a sector, country, founding year, growth or stage). ${EXAMPLE_HINT}`,
      ignored,
    };
  }

  const plan: SearchPlan = {
    raw,
    count,
    countries,
    cities: [...new Set(cities)],
    keywords,
    foundedMin,
    foundedMax,
    growth,
    headcountMin,
    headcountMax,
    headcountFloorIsDefault,
    stages,
    fundingMinUsd,
    wantFounders,
    wantBackground,
    interpretation: interp,
    ignored,
  };
  return { kind: "search", plan };
}

function countryName(code: string): string {
  return ({ IND: "India", USA: "United States", GBR: "United Kingdom", DEU: "Germany", FRA: "France", ISR: "Israel", ARE: "United Arab Emirates", CAN: "Canada", IDN: "Indonesia", SGP: "Singapore" } as Record<string, string>)[code] ?? code;
}

/* ───────────── plan → /company/search body ───────────── */

export type Relaxation = "headcount-floor" | "stage" | "city" | "headcount" | "keywords" | "funding";
export const RELAX_ORDER: Relaxation[] = ["headcount-floor", "stage", "city", "headcount", "funding", "keywords"];

/** Whether relaxing `r` would change the plan's search at all. */
export function canRelax(plan: SearchPlan, r: Relaxation): boolean {
  switch (r) {
    case "headcount-floor": return !!plan.headcountFloorIsDefault && plan.headcountMin != null;
    case "stage": return plan.stages.length > 0;
    case "city": return plan.cities.length > 0;
    case "headcount": return !plan.headcountFloorIsDefault && (plan.headcountMin != null || plan.headcountMax != null);
    case "funding": return plan.fundingMinUsd != null;
    case "keywords": return plan.keywords.length > 0 && (plan.countries.length > 0 || plan.foundedMin != null || plan.growth != null || plan.stages.length > 0);
  }
}

export function describeRelaxation(plan: SearchPlan, r: Relaxation): string {
  switch (r) {
    case "headcount-floor": return `dropped the default ≥ ${plan.headcountMin} employees floor`;
    case "stage": return `dropped the funding-stage filter (${plan.stages.join(", ")})`;
    case "city": return `widened the city (${plan.cities[0]}) to the whole country`;
    case "headcount": return "dropped the team-size filter";
    case "funding": return "dropped the minimum-funding filter";
    case "keywords": return `stopped ranking on “${plan.keywords.join(" ")}” (filters only)`;
  }
}

type Cond = { field: string; type: string; value: unknown } | { op: "and" | "or"; conditions: Cond[] };

/** The /company/search request for a plan, minus any relaxed constraints. `fields` are base-price + headcount (premium) only. */
export function toSearchBody(plan: SearchPlan, relaxed: Relaxation[] = [], limit = plan.count * 2) {
  const conds: Cond[] = [];
  const off = (r: Relaxation) => relaxed.includes(r);
  if (plan.countries.length === 1) conds.push({ field: "locations.country", type: "=", value: plan.countries[0]!.code });
  else if (plan.countries.length > 1) conds.push({ field: "locations.country", type: "in", value: plan.countries.map((c) => c.code) });
  if (plan.cities.length && !off("city")) conds.push(plan.cities.length === 1 ? { field: "locations.headquarters", type: "(.)", value: plan.cities[0]! } : { op: "or", conditions: plan.cities.map((c) => ({ field: "locations.headquarters", type: "(.)", value: c })) });
  if (plan.foundedMin != null) conds.push({ field: "basic_info.year_founded", type: "=>", value: plan.foundedMin });
  if (plan.foundedMax != null) conds.push({ field: "basic_info.year_founded", type: "=<", value: plan.foundedMax });
  if (plan.growth) conds.push({ field: `headcount.growth_percent.${plan.growth.window}`, type: "=>", value: plan.growth.minPct });
  const floorOff = plan.headcountFloorIsDefault ? off("headcount-floor") : off("headcount");
  if (plan.headcountMin != null && !floorOff) conds.push({ field: "headcount.total", type: "=>", value: plan.headcountMin });
  if (plan.headcountMax != null && !off("headcount")) conds.push({ field: "headcount.total", type: "=<", value: plan.headcountMax });
  if (plan.stages.length && !off("stage")) conds.push({ field: "funding.last_round_type", type: "in", value: plan.stages });
  if (plan.fundingMinUsd != null && !off("funding")) conds.push({ field: "funding.total_investment_usd", type: "=>", value: plan.fundingMinUsd });
  const query = plan.keywords.length && !off("keywords") ? `${plan.keywords.join(" ")} companies` : undefined;
  const fields = ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain", "headcount.total", "headcount.growth_percent"];
  const cap = Math.max(1, Math.min(query ? 100 : 1000, limit));
  const body: Record<string, unknown> = { fields, limit: cap };
  if (conds.length) body.filters = conds.length === 1 ? conds[0] : { op: "and", conditions: conds };
  if (query) body.search = { query, mode: "hybrid" };
  // Filter-only search can sort; ranked search cannot (company.yaml SearchSort). Bigger teams first when no query ranks them.
  else body.sorts = [{ field: "headcount.total", order: "desc" }];
  return body;
}
