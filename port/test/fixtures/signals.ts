/**
 * v4 · Signal graph + Live research for Helio Sensors (deal page › Signals).
 * Endpoints and field names are real Crustdata API names (x-api-version 2025-11-01, see inspo/crustdata/CRUSTDATA_NOTES.md);
 * every value is invented. The animation reads only `timeline`, so live API calls can emit the same events later.
 *
 * Canonical "now" for Helio is Today's work row (fit 72, "Growth is 22%/mo, not 40%") and the founder page: headcount
 * 22 → 31 in six months, 9 open roles (6 engineering), ex-Bosch IoT platforms lead, 22%/mo verified from HDFC deposits
 * vs the deck's 40%. The fit count-up lands exactly on Today's score: the thesis prior is derived from the weights.
 */
import type { DealData, SignalContribution, SignalGraphData } from "../types";
import { helioCo, helioDeal, helioFit as helioFitCanon } from "./helio";

const pts = (vs: number[]) => vs.map((v, i) => ({ date: `2026-${String(5 + i).padStart(2, "0")}-01`, v }));

/** Helio's canonical fit (shared with Today's row and the deal header) is the target the graph must reach. */
const helioFit = helioFitCanon.score;

// Order = list order in the side card; the weights sum to +14 so the count-up lands on Today's 72.
const contributions: SignalContribution[] = [
  { id: "c1", label: "Headcount 22 → 31 in 6 mo", call: "enrich", chip: "hc6", weight: 8 },
  { id: "c5", label: "Eng headcount +31% in 6 mo", call: "enrich", chip: "engts", weight: 3 },
  { id: "c3", label: "Web traffic flat for 3 mo", call: "enrich", chip: "webqoq", weight: -3 },
  { id: "c4", label: "Founder: ex-Bosch IoT lead", call: "person", chip: "past", weight: 7 },
  { id: "c2", label: "9 open roles, 6 in engineering", call: "jobs", chip: "cat", weight: 6 },
  { id: "c6", label: "Steel-plant pilot in news", call: "news", chip: "title", weight: 3 },
  { id: "c7", label: "Pre-seed: fits our entry", call: "enrich", chip: "round", weight: 2 },
  { id: "c8", label: "Deck 40%/mo · verified 22%", call: "enrich", chip: "webqoq", weight: -12, source: "HDFC deposits Jul–Oct + web_traffic" },
];

const ID = 4821937, WEB = `web_traffic.domain_traffic["heliosensors.in"]`;

export const helioSignals: SignalGraphData = {
  company: { ...helioCo, domain: "heliosensors.in" },
  provider: {
    name: "Crustdata", graphLabel: "The Crustdata Graph", apiVersion: "2025-11-01", markUrl: "/logos/tools/crustdata-mark.svg",
    stats: [{ id: "p", label: "1B+ people", icon: "people" }, { id: "c", label: "60M+ companies", icon: "companies" }, { id: "a", label: "REST API", icon: "api" }],
    // only sources these calls actually read (no social_posts on this plan, no GitHub dataset)
    sources: ["news", "funding", "job posts", "web traffic", "headcount", "people"],
  },
  eyebrow: "Signals · live research",
  headline: { pre: "Team is real; ", hl: "growth is half the deck", post: "" },
  requestedAt: "2026-10-29T07:10:00+05:30",
  requestedAgo: "2h ago",
  calls: [
    {
      id: "identify", method: "POST", path: "/company/identify", place: "tl", lead: "conf", icon: "identify", ms: 350,
      body: `{"domains":["heliosensors.in"]}`,
      chips: [
        { id: "conf", field: "confidence_score", value: "0.98", short: "match", path: "[0].matches[0].confidence_score" },
        { id: "cid", field: "crustdata_company_id", value: String(ID), path: "[0].matches[0].company_data.crustdata_company_id" },
        { id: "mt", field: "match_type", value: "domain", path: "[0].match_type" },
      ],
    },
    {
      id: "enrich", method: "POST", path: "/company/enrich", place: "l", lead: "htot", icon: "company", ms: 600,
      body: `{"domains":["heliosensors.in"],"fields":["headcount","funding","web_traffic"]}`,
      chips: [
        { id: "htot", field: "headcount.timeseries", value: "22 → 31", tone: "up", short: "headcount" },
        { id: "hc6", field: "headcount.growth_percent.six_months", value: "+41%", tone: "up" },
        { id: "engts", field: "headcount.by_function_timeseries.CURRENT_FUNCTION.Engineering", value: "13 → 17 · +31%", tone: "up", short: "eng headcount" },
        { id: "round", field: "funding.last_round_type", value: "pre_seed", short: "last round" },
        { id: "webqoq", field: `${WEB}.qoq_pct`, value: "−2%", tone: "down", short: "web traffic 3mo" },
      ],
      sparks: [
        { id: "hcts", field: "headcount.timeseries", label: "headcount", points: pts([22, 23, 25, 27, 29, 31]), value: "31" },
        { id: "engs", field: "headcount.by_function_timeseries.CURRENT_FUNCTION.Engineering", label: "eng headcount", points: pts([13, 13, 14, 15, 16, 17]), value: "17" },
        { id: "web", field: `${WEB}.monthly_visitors_timeseries`, label: "monthly_visitors", points: pts([16.2, 17.4, 18.5, 18.6, 18.3, 18.2]), value: "18.2K" },
      ],
    },
    {
      id: "person", method: "POST", path: "/person/enrich", note: "founders", place: "bl", lead: "past", icon: "person", ms: 680,
      body: `{"professional_network_profile_urls":["…/in/ananya-rao"]}`,
      chips: [
        { id: "past", field: "experience.employment_details.past", value: "Bosch · IoT lead", tone: "up", short: "past:" },
        { id: "edu", field: "education.schools", value: "IIT Bombay" },
      ],
    },
    {
      id: "jobs", method: "POST", path: "/job/search", place: "br", lead: "total", icon: "job", ms: 590,
      body: `{"filters":{"field":"company.basic_info.company_id","type":"=","value":${ID}},"sorts":[{"field":"metadata.date_added","order":"desc"}]}`,
      chips: [
        { id: "total", field: "total_count", value: "9", tone: "up", short: "open roles" },
        { id: "cat", field: "job_listings[].job_details.category", value: "Engineering × 6", tone: "up", short: "engineering" },
      ],
    },
    {
      id: "news", method: "POST", path: "/web/search/live", place: "tr", lead: "title", icon: "web", ms: 4800,
      body: `{"query":"\\"Helio Sensors\\"","sources":["news"]}`,
      chips: [{ id: "title", field: "results[0].title", value: "steel-plant pilot", tone: "up", short: "news" }, { id: "src", field: "results[0].source", value: "news" }],
    },
    {
      id: "watch", method: "POST", path: "/watch/company", note: "hourly", place: "b", lead: "change", icon: "watch", ms: 800,
      body: `{"entities":{"crustdata_company_ids":[${ID}]},"track":{"field":"headcount.total","type":"changed"},"config":{"trigger":{"type":"interval","every_hours":1}},"notifications":[{"type":"webhook","url":"https://…/api/webhooks/crustdata"}],"fields":["basic_info","headcount"]}`,
      chips: [
        // changes arrive later on the webhook, not in the create response
        { id: "change", field: "headcount.total", value: "30 → 31", short: "webhook change", path: "results[0].changes[0].from→to" },
        { id: "status", field: "status", value: "active" },
      ],
    },
  ],
  fit: {
    label: "Fit score",
    base: { label: "Thesis match · Seed industrial IoT", value: helioFit - contributions.reduce((a, k) => a + k.weight, 0) },
    threshold: { value: 80, label: "IC-ready" },
    bands: { strong: "Strong fit", maybe: "Possible fit", weak: "Weak fit" },
    contributions,
    recommendation: {
      label: "Verify growth before IC",
      why: "Growth is half the deck’s 40%. Check with Ananya before the 3 pm IC.",
      actions: [
        { id: "verify", label: "Verify with founder", done: "Draft held for you", primary: true },
        { id: "raw", label: "Request raw data", done: "Request drafted" },
      ],
    },
  },
  // Compressed replay with live relative order: identify 350 ms, enrich 600, person 680, jobs 590, watch 800, and
  // /web/search/live (4.8 s) visibly the slowest, finishing last.
  timeline: [
    { at: 0, type: "query" },
    { at: 650, type: "fanout" },
    { at: 900, type: "call", call: "identify" },
    { at: 1250, type: "chip", call: "identify", chip: "conf" },
    { at: 1330, type: "chip", call: "identify", chip: "cid" },
    { at: 1400, type: "chip", call: "identify", chip: "mt" },
    { at: 1450, type: "done", call: "identify" },
    { at: 1550, type: "call", call: "enrich" },
    { at: 1650, type: "call", call: "news" },
    { at: 1800, type: "call", call: "person" },
    { at: 2050, type: "call", call: "jobs" },
    { at: 2250, type: "chip", call: "enrich", chip: "htot" },
    { at: 2330, type: "chip", call: "enrich", chip: "hc6" },
    { at: 2400, type: "chip", call: "enrich", chip: "engts" },
    { at: 2400, type: "call", call: "watch" },
    { at: 2500, type: "stream", who: "Helio Sensors", text: "hired 4 engineers" },
    { at: 2550, type: "chip", call: "enrich", chip: "round" },
    { at: 2620, type: "chip", call: "enrich", chip: "webqoq" },
    { at: 2700, type: "done", call: "enrich" },
    { at: 2750, type: "chip", call: "person", chip: "past" },
    { at: 2850, type: "chip", call: "person", chip: "edu" },
    { at: 2950, type: "done", call: "person" },
    { at: 3000, type: "chip", call: "jobs", chip: "total" },
    { at: 3120, type: "chip", call: "jobs", chip: "cat" },
    { at: 3200, type: "done", call: "jobs" },
    { at: 3250, type: "stream", who: "Helio Sensors", text: "posted a firmware role" },
    { at: 3350, type: "chip", call: "watch", chip: "status" },
    { at: 3450, type: "chip", call: "watch", chip: "change" },
    { at: 3550, type: "done", call: "watch" },
    { at: 4250, type: "chip", call: "news", chip: "title" },
    { at: 4350, type: "chip", call: "news", chip: "src" },
    { at: 4450, type: "done", call: "news" },
    { at: 4500, type: "stream", who: "Helio Sensors", text: "named in a steel-plant pilot" },
    { at: 4650, type: "score", contribution: "c1" },
    { at: 4900, type: "score", contribution: "c5" },
    { at: 5150, type: "score", contribution: "c3" },
    { at: 5400, type: "score", contribution: "c4" },
    { at: 5650, type: "score", contribution: "c2" },
    { at: 5900, type: "score", contribution: "c6" },
    { at: 6150, type: "score", contribution: "c7" },
    { at: 6450, type: "score", contribution: "c8" },
    { at: 7450, type: "decide" },
  ],
  frames: [350, 1300, 2450, 3700, 5750, 8150],
};

export const helioDealSignals: DealData = { ...helioDeal, signals: helioSignals };
