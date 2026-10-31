// The Sourcing agent: free-text request → plan → /company/search (relaxing one constraint at a time if too few match)
// → /company/enrich to verify each candidate (growth recomputed from the monthly headcount series) → /person/search for
// founders and their prior employers (→ /person/enrich when a profile has no work history) → ranked, cited rows.
//
// Every value in a row is a ComputedField with a citation (endpoint, JSON path, record id, URL, fetched-at time).
// Missing data is `unavailable` with the reason, never zero. One company failing never stops the run; its row (or
// its `dropped` entry) carries the reason. Progress is reported as events so the API can stream a live step trace.
import type { CrustdataClient } from "@/lib/crustdata/client";
import { CrustdataApiError } from "@/lib/crustdata/http";
import { founderPersonSearchBody, linkedInPersonEnrichBody } from "@/lib/crustdata/person-queries";
import type { CompanyEnrichData, CrustdataCallMeta, PersonSearchProfile } from "@/lib/crustdata/types";
import { ok, unavailable, type Citation, type ComputedField } from "@/lib/fields";
import { money, type Money } from "@/lib/format";
import { clean, normalizeCompany, normalizePerson } from "@/lib/live/normalize";
import type { LiveEmployment, LivePerson } from "@/lib/live/types";
import { canRelax, describeRelaxation, parseRequest, RELAX_ORDER, toSearchBody, WINDOW_MONTHS, type GrowthWindow, type ParseResult, type Relaxation, type SearchPlan } from "./parse";

/* ───────────── event contract (NDJSON lines of POST /api/sourcing/run) ───────────── */

export type StepStatus = "running" | "done" | "failed" | "skipped";
export type AgentStep = {
  id: string;
  label: string;
  /** parser | crustdata | ranker */
  tool: string;
  /** e.g. "POST /company/search" ("local" for in-process steps) */
  endpoint: string;
  status: StepStatus;
  startedAt: string;
  ms?: number;
  /** credits charged by Crustdata for this step's live calls (X-Credits-Used); cache hits cost 0 */
  credits?: number;
  /** number of calls served from the response cache */
  cachedCalls?: number;
  calls?: number;
  /** items returned / processed */
  count?: number;
  detail?: string;
};

export type Founder = {
  name: string;
  title?: string;
  linkedinUrl?: string;
  personId?: number;
  /** prior employers (newest first), excluding the company itself */
  prior: { company: string; title?: string; start?: string; end?: string }[];
  /** where `prior` was read from */
  priorSource: "person/search" | "person/enrich" | "none";
  citations: Citation[];
};

export type AgentRow = {
  id: number;
  rank: number;
  name: string;
  domain?: string;
  logoUrl?: string;
  linkedinUrl?: string;
  description?: string;
  /** constraints relaxed before this company matched (empty = matched the request as written) */
  relaxed: string[];
  founded: ComputedField<number>;
  hq: ComputedField<string>;
  headcountNow: ComputedField<number>;
  headcountThen: ComputedField<{ value: number; date: string }>;
  growth: ComputedField<number>;
  growthWindow: GrowthWindow;
  /** monthly headcount (oldest first), for the sparkline; cited by `growth`/`headcountNow` */
  series: { date: string; v: number }[];
  funding: ComputedField<{ total: Money | null; lastRound: string | null; lastDate: string | null; lastAmount: Money | null }>;
  founders: ComputedField<Founder[]> | { status: "pending" };
  checks: { label: string; ok: boolean | null; detail: string }[];
  /** set when part of this row failed (the rest is still shown) */
  errors: string[];
  sourceCitation: Citation;
};

export type Dropped = { id?: number; name: string; domain?: string; reason: string };

export type RunSummary = {
  runId: string;
  request: string;
  sentence: string;
  requested: number;
  returned: number;
  dropped: number;
  relaxed: string[];
  rankingReason: string;
  credits: number;
  liveCalls: number;
  cachedCalls: number;
  failedCalls: number;
  startedAt: string;
  finishedAt: string;
  ms: number;
  rowOrder: number[];
};

export type AgentEvent =
  | { type: "plan"; runId: string; startedAt: string; parse: ParseResult }
  | { type: "step"; step: AgentStep }
  | { type: "row"; row: AgentRow }
  | { type: "dropped"; item: Dropped }
  | { type: "redirect"; href: string; label: string; reason: string }
  | { type: "refuse"; message: string; ignored: string[] }
  | { type: "done"; summary: RunSummary }
  | { type: "error"; kind: "not_connected" | "upstream" | "bad_request"; message: string };

export type RunDeps = {
  /** null when Crustdata is not configured (the run reports "not connected" honestly) */
  client: CrustdataClient | null;
  emit: (e: AgentEvent) => void;
  now?: () => Date;
  signal?: AbortSignal;
  /** id generator (tests pin it) */
  runId?: string;
  /** cap on concurrent per-company calls (rate limits: person search 30 RPM, enrich 15 RPM) */
  concurrency?: number;
};

/* ───────────── helpers ───────────── */

const ENRICH_GROUPS = ["basic_info", "headcount", "funding", "locations", "taxonomy"];
const ENRICH_FALLBACK_GROUPS = ["basic_info", "headcount", "locations"];
const SEARCH_MIN_FIELDS = ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain"];
const MAX_RELAX_SEARCHES = 3;
const VERIFY_EXTRA = 3;
const ENRICH_CHUNK = 5;
const MAX_PERSON_ENRICH = 5;

const round1 = (n: number) => Math.round(n * 10) / 10;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isDenied = (e: unknown) => e instanceof CrustdataApiError && e.status === 403 && /field|permission|denied|not enabled/i.test(e.message);

export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

type Meta = CrustdataCallMeta;
const citeOf = (meta: Meta, path: string, record: string, url?: string): Citation => ({
  source: "Crustdata",
  endpoint: `POST ${meta.path}`,
  path,
  record,
  retrievedAt: meta.retrievedAt,
  cached: meta.cached,
  ...(meta.requestId ? { requestId: meta.requestId } : {}),
  ...(url ? { url } : {}),
});

/** Growth over `window` recomputed from the raw monthly series: (latest − point `window` months earlier) / earlier. */
export function growthFromSeries(points: { date?: string | null; employee_count?: number | null }[], window: GrowthWindow) {
  const pts = points
    .filter((p) => p.date && typeof p.employee_count === "number")
    .map((p) => ({ date: String(p.date).slice(0, 10), v: p.employee_count as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = pts.at(-1);
  if (!last) return undefined;
  const months = WINDOW_MONTHS[window];
  const target = new Date(`${last.date}T00:00:00Z`);
  target.setUTCMonth(target.getUTCMonth() - months);
  const t = target.getTime();
  let best: { date: string; v: number } | undefined, bestD = Infinity;
  for (const p of pts) {
    const d = Math.abs(new Date(`${p.date}T00:00:00Z`).getTime() - t);
    if (d < bestD) { bestD = d; best = p; }
  }
  if (!best || bestD > 45 * 86400e3 || best.date === last.date) return { last, then: undefined, pct: undefined, pts };
  if (best.v <= 0) return { last, then: best, pct: undefined, pts };
  return { last, then: best, pct: round1(((last.v - best.v) / best.v) * 100), pts };
}

const REPORTED_KEY: Record<GrowthWindow, string> = { "1m": "mom", "3m": "qoq", "6m": "six_months", "12m": "yoy" };

/* ───────────── the run ───────────── */

export async function runAgent(input: unknown, deps: RunDeps): Promise<RunSummary | null> {
  const now = deps.now ?? (() => new Date());
  const t0 = Date.now();
  const startedAt = now().toISOString();
  const runId = deps.runId ?? `run_${t0.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const emit = deps.emit;
  const conc = deps.concurrency ?? 3;
  let credits = 0, liveCalls = 0, cachedCalls = 0, failedCalls = 0;

  /** One step wrapper: emits running → done/failed with timing, credits and cache counts. */
  const step = async <T>(id: string, label: string, endpoint: string, tool: string, fn: (track: (m: Meta) => void, set: (p: Partial<AgentStep>) => void) => Promise<T>): Promise<T> => {
    const s: AgentStep = { id, label, tool, endpoint, status: "running", startedAt: now().toISOString(), credits: 0, cachedCalls: 0, calls: 0 };
    emit({ type: "step", step: { ...s } });
    const st = Date.now();
    const track = (m: Meta) => {
      s.calls = (s.calls ?? 0) + 1;
      if (m.cached) { s.cachedCalls = (s.cachedCalls ?? 0) + 1; cachedCalls++; }
      else { const c = Number(m.creditsUsed) || 0; s.credits = Math.round(((s.credits ?? 0) + c) * 100) / 100; credits += c; liveCalls++; }
    };
    const set = (p: Partial<AgentStep>) => Object.assign(s, p);
    try {
      const out = await fn(track, set);
      if (s.status === "running") s.status = "done";
      s.ms = Date.now() - st;
      emit({ type: "step", step: { ...s } });
      return out;
    } catch (e) {
      s.status = "failed";
      s.ms = Date.now() - st;
      s.detail = errMsg(e);
      failedCalls++;
      emit({ type: "step", step: { ...s } });
      throw e;
    }
  };
  const aborted = () => deps.signal?.aborted === true;

  /* 1 · parse */
  const parsed = parseRequest(input, now());
  emit({ type: "plan", runId, startedAt, parse: parsed });
  emit({ type: "step", step: { id: "parse", label: "Read the request", tool: "parser", endpoint: "local", status: "done", startedAt, ms: Date.now() - t0, count: parsed.kind === "search" ? parsed.plan.interpretation.length : 0, detail: parsed.kind === "search" ? `${parsed.plan.interpretation.length} constraints understood${parsed.plan.ignored.length ? `, ${parsed.plan.ignored.length} phrase(s) not used` : ""}` : parsed.kind } });

  if (parsed.kind === "refuse") {
    emit({ type: "refuse", message: parsed.message, ignored: parsed.ignored });
    return null;
  }
  if (parsed.kind === "company" && parsed.domain) {
    emit({ type: "redirect", href: `/deal?domain=${encodeURIComponent(parsed.domain)}`, label: parsed.domain, reason: "That's a single company: opening company research." });
    return null;
  }
  if (!deps.client) {
    emit({ type: "error", kind: "not_connected", message: "Crustdata is not connected: CRUSTDATA_API_KEY is not set on the server, so nothing can be searched." });
    return null;
  }
  const client = deps.client;

  if (parsed.kind === "company") {
    // a name → /company/identify (free) → the deal page for its domain
    const name = parsed.name!;
    try {
      const hit = await step("identify", `Resolve “${name}” to a company`, "POST /company/identify", "crustdata", async (track, set) => {
        const { data, meta } = await client.identifyCompany({ names: [name] } as never);
        track(meta);
        const m = (data as unknown as { matches?: { company_data?: { basic_info?: { primary_domain?: string; name?: string } } }[] }[])[0]?.matches?.[0]?.company_data?.basic_info;
        set({ count: m ? 1 : 0 });
        return m;
      });
      if (hit?.primary_domain) emit({ type: "redirect", href: `/deal?domain=${encodeURIComponent(hit.primary_domain)}`, label: `${clean(hit.name) ?? name} (${hit.primary_domain})`, reason: `“${name}” matched one company on Crustdata: opening its research.` });
      else emit({ type: "refuse", message: `No company named “${name}” on Crustdata, and no search criteria (sector, country, founding year, growth or stage) in the request. Try a fuller request, or paste the company's domain.`, ignored: [] });
    } catch (e) {
      emit({ type: "error", kind: "upstream", message: `Couldn't resolve “${name}”: ${errMsg(e)}` });
    }
    return null;
  }

  const plan = parsed.plan;
  const window: GrowthWindow = plan.growth?.window ?? "6m";

  /* 2 · search (+ relax) */
  type Cand = { id: number; name: string; domain?: string; relaxed: string[]; meta: Meta; idx: number };
  const cands: Cand[] = [];
  const relaxed: Relaxation[] = [];
  const relaxedLabels: string[] = [];
  let searchFields: string[] | undefined;
  let lastSearchError: unknown;

  const runSearch = async (id: string, label: string) => {
    const body = toSearchBody(plan, relaxed, Math.min(100, plan.count * 2));
    body.fields = searchFields ?? SEARCH_MIN_FIELDS;
    return step(id, label, "POST /company/search", "crustdata", async (track, set) => {
      let res;
      try {
        res = await client.searchCompanies(body as never);
      } catch (e) {
        if (!isDenied(e)) throw e;
        // a denied field makes the whole call 403: retry with the base fields only
        body.fields = SEARCH_MIN_FIELDS;
        searchFields = SEARCH_MIN_FIELDS;
        res = await client.searchCompanies(body as never);
        set({ detail: "a requested field was denied (403); retried with base fields only" });
      }
      track(res.meta);
      let added = 0;
      for (const c of res.data.companies ?? []) {
        const cid = c.crustdata_company_id;
        if (cid == null || cands.some((x) => x.id === cid)) continue;
        cands.push({ id: cid, name: clean(c.basic_info?.name) ?? clean(c.basic_info?.primary_domain) ?? `company ${cid}`, domain: clean(c.basic_info?.primary_domain)?.toLowerCase(), relaxed: [...relaxedLabels], meta: res.meta, idx: cands.length });
        added++;
      }
      const total = res.data.total_count;
      set({ count: added, detail: [`${added} new candidate(s)`, typeof total === "number" ? `${total.toLocaleString("en-US")} match in total` : null, body.search ? `ranked on “${(body.search as { query: string }).query}”` : "filters only, largest teams first", (res.data as { next_cursor?: string | null }).next_cursor == null && added < plan.count ? "no more results" : null].filter(Boolean).join(" · ") });
      return res;
    });
  };

  try {
    await runSearch("search", "Search companies");
  } catch (e) {
    lastSearchError = e;
  }
  let relaxSearches = 0;
  for (const r of RELAX_ORDER) {
    if (aborted() || cands.length >= plan.count || relaxSearches >= MAX_RELAX_SEARCHES) break;
    if (!canRelax(plan, r)) continue;
    relaxed.push(r);
    const what = describeRelaxation(plan, r);
    relaxedLabels.push(what);
    relaxSearches++;
    try {
      await runSearch(`relax-${r}`, `Too few matches: ${what}`);
      lastSearchError = undefined;
    } catch (e) {
      lastSearchError = e;
    }
  }
  if (!cands.length) {
    if (lastSearchError) {
      emit({ type: "error", kind: "upstream", message: `Crustdata company search failed: ${errMsg(lastSearchError)}` });
      return null;
    }
  }

  /* 3 · verify with enrich */
  const toVerify = cands.slice(0, plan.count + VERIFY_EXTRA);
  type Verified = { cand: Cand; data?: CompanyEnrichData; meta?: Meta; error?: string; note?: string };
  const verified: Verified[] = [];
  const chunks: Cand[][] = [];
  for (let i = 0; i < toVerify.length; i += ENRICH_CHUNK) chunks.push(toVerify.slice(i, i + ENRICH_CHUNK));
  if (toVerify.length) {
    await step("verify", `Verify ${toVerify.length} companies`, "POST /company/enrich", "crustdata", async (track, set) => {
      let fields = ENRICH_GROUPS;
      let note: string | undefined;
      await mapLimit(chunks, 2, async (chunk) => {
        if (aborted()) return;
        const ids = chunk.map((c) => c.id);
        let res;
        try {
          try {
            res = await client.enrichCompanies({ crustdata_company_ids: ids, fields } as never);
          } catch (e) {
            if (!isDenied(e)) throw e;
            fields = ENRICH_FALLBACK_GROUPS;
            note = `a field group was denied (403); retried with ${fields.join(", ")} only`;
            res = await client.enrichCompanies({ crustdata_company_ids: ids, fields } as never);
          }
        } catch (e) {
          for (const c of chunk) verified.push({ cand: c, error: `company enrich failed: ${errMsg(e)}` });
          return;
        }
        track(res.meta);
        const arr = (Array.isArray(res.data) ? res.data : []) as { matched_on?: unknown; matches?: { company_data?: CompanyEnrichData }[] }[];
        for (const c of chunk) {
          const hit = arr.find((r) => String(r.matched_on) === String(c.id))?.matches?.[0]?.company_data ?? arr[chunk.indexOf(c)]?.matches?.[0]?.company_data;
          verified.push(hit ? { cand: c, data: hit, meta: res.meta, note } : { cand: c, error: "company enrich returned no match for this id" });
        }
      });
      set({ count: verified.filter((v) => v.data).length, detail: [`${verified.filter((v) => v.data).length}/${toVerify.length} enriched`, note].filter(Boolean).join(" · ") });
    }).catch(() => undefined);
  }
  verified.sort((a, b) => a.cand.idx - b.cand.idx);

  /* build rows + verification checks */
  const rows: AgentRow[] = [];
  let droppedCount = 0;
  const drop = (d: Dropped) => { droppedCount++; emit({ type: "dropped", item: d }); };
  for (const v of verified) {
    if (rows.length >= plan.count) break;
    const c = v.cand;
    const searchCite = citeOf(c.meta, `companies[crustdata_company_id=${c.id}]`, `crustdata_company_id ${c.id}`);
    if (!v.data || !v.meta) {
      // keep the candidate (it matched the search filters) but say plainly what could not be verified
      rows.push(blankRow(c, window, searchCite, v.error ?? "not enriched"));
      continue;
    }
    const row = buildRow(c, v.data, v.meta, window, plan, searchCite);
    if (v.note) row.errors.push(v.note);
    const failed = row.checks.find((k) => k.ok === false);
    if (failed) {
      drop({ id: c.id, name: row.name, domain: row.domain, reason: `failed verification: ${failed.detail}` });
      continue;
    }
    rows.push(row);
  }
  for (const r of rows) emit({ type: "row", row: r });

  /* 4 · founders */
  let personEnriches = 0;
  if (rows.length && !aborted()) {
    await step("founders", `Find founders of ${rows.length} companies`, "POST /person/search", "crustdata", async (track, set) => {
      let found = 0;
      await mapLimit(rows, conc, async (row) => {
        if (aborted()) return;
        const body = founderPersonSearchBody(row.id, 3, { withExperience: true });
        try {
          const { data, meta } = await client.searchPeople(body);
          track(meta);
          const profiles = (data.profiles ?? []) as PersonSearchProfile[];
          const founders = profiles.map((p, i) => toFounder(normalizePerson(p), row, citeOf(meta, `profiles[${i}]`, `crustdata_person_id ${p.crustdata_person_id ?? "?"}`, clean(p.social_handles?.professional_network_identifier?.profile_url))));
          row.founders = founders.length
            ? ok(founders, "person search: current employer = this company, current title contains “Founder”", `${founders.length} founder profile(s) on Crustdata.`, [citeOf(meta, "profiles[]", `company_id ${row.id}`)])
            : unavailable("not reported: Crustdata has no profile whose current title at this company contains “Founder”.");
          if (founders.length) found++;
        } catch (e) {
          row.founders = unavailable(`founder search failed: ${errMsg(e)}`);
          row.errors.push(`founder search failed: ${errMsg(e)}`);
        }
        emit({ type: "row", row });
      });
      set({ count: found, detail: `${found}/${rows.length} companies with founder profiles` });
    }).catch(() => undefined);

    // founders with no work history in search → one person enrich each (capped)
    const needEnrich: Founder[] = [];
    for (const r of rows) if (r.founders.status === "ok") for (const f of r.founders.value) if (f.priorSource === "none" && f.linkedinUrl && needEnrich.length < MAX_PERSON_ENRICH) needEnrich.push(f);
    if (needEnrich.length && !aborted()) {
      await step("person-enrich", `Look up work history for ${needEnrich.length} founder(s)`, "POST /person/enrich", "crustdata", async (track, set) => {
        let filled = 0;
        await mapLimit(needEnrich, conc, async (f) => {
          try {
            const { data, meta } = await client.enrichPeople(linkedInPersonEnrichBody(f.linkedinUrl!));
            track(meta);
            personEnriches++;
            const pd = (data as unknown as { matches?: { person_data?: PersonSearchProfile }[] }[])[0]?.matches?.[0]?.person_data;
            if (!pd) return;
            const p = normalizePerson(pd);
            const row = rows.find((r) => r.founders.status === "ok" && r.founders.value.includes(f))!;
            const prior = priorOf(p, row);
            if (prior.length) {
              f.prior = prior;
              f.priorSource = "person/enrich";
              f.citations.push(citeOf(meta, "[0].matches[0].person_data.experience.employment_details.past", `profile ${f.linkedinUrl}`, f.linkedinUrl));
              filled++;
            }
            emit({ type: "row", row });
          } catch {
            /* the founder keeps "no prior employers reported"; the step shows the failure count */
          }
        });
        set({ count: filled, detail: `${filled}/${needEnrich.length} filled` });
      }).catch(() => undefined);
    }
  }

  /* 5 · rank */
  const rankingReason = plan.growth
    ? `Ranked by people added in the last ${WINDOW_MONTHS[window]} months (from Crustdata's monthly headcount series), then by growth %. A small base can show a large %, so absolute hiring leads.`
    : plan.keywords.length
      ? `Kept in Crustdata's relevance order for “${plan.keywords.join(" ")}” (ranked search).`
      : "Ranked by current headcount (largest first).";
  const num = (f: ComputedField<number>) => (f.status === "ok" ? f.value : -Infinity);
  const added = (r: AgentRow) => (r.headcountNow.status === "ok" && r.headcountThen.status === "ok" ? r.headcountNow.value - r.headcountThen.value.value : -Infinity);
  if (plan.growth) rows.sort((a, b) => added(b) - added(a) || num(b.growth) - num(a.growth) || num(b.headcountNow) - num(a.headcountNow));
  else if (!plan.keywords.length) rows.sort((a, b) => num(b.headcountNow) - num(a.headcountNow));
  rows.forEach((r, i) => { r.rank = i + 1; emit({ type: "row", row: r }); });
  emit({ type: "step", step: { id: "rank", label: "Rank and write up", tool: "ranker", endpoint: "local", status: "done", startedAt: now().toISOString(), ms: 0, count: rows.length, detail: rankingReason } });

  /* 6 · summary */
  const top = rows[0];
  const growthBit = (r: AgentRow) => (r.growth.status === "ok" ? ` (${r.growth.value > 0 ? "+" : ""}${r.growth.value}% in ${WINDOW_MONTHS[window]} months)` : "");
  const sentence = rows.length === 0
    ? `No company matched “${plan.raw.slice(0, 120)}”${relaxedLabels.length ? `, even after I ${relaxedLabels.join("; ")}` : ""}. Nothing was padded.`
    : `Found ${rows.length} of the ${plan.count} requested${rows.length < plan.count ? " (only these matched; nothing padded)" : ""}${relaxedLabels.length ? ` after I ${relaxedLabels.join("; ")}` : ""}. Top: ${top!.name}${growthBit(top!)}.`;
  const summary: RunSummary = {
    runId,
    request: plan.raw,
    sentence,
    requested: plan.count,
    returned: rows.length,
    dropped: droppedCount,
    relaxed: relaxedLabels,
    rankingReason,
    credits: Math.round(credits * 100) / 100,
    liveCalls,
    cachedCalls,
    failedCalls,
    startedAt,
    finishedAt: now().toISOString(),
    ms: Date.now() - t0,
    rowOrder: rows.map((r) => r.id),
  };
  void personEnriches;
  emit({ type: "done", summary });
  return summary;
}

/* ───────────── row building ───────────── */

function blankRow(c: { id: number; name: string; domain?: string; relaxed: string[] }, window: GrowthWindow, searchCite: Citation, reason: string): AgentRow {
  const na = unavailable(`not verified: ${reason}`);
  return {
    id: c.id, rank: 0, name: c.name, domain: c.domain, relaxed: c.relaxed,
    founded: na, hq: na, headcountNow: na, headcountThen: na, growth: na, growthWindow: window, series: [], funding: na,
    founders: unavailable("skipped: the company could not be enriched"),
    checks: [{ label: "Matched search filters", ok: true, detail: "returned by /company/search with the filters above" }],
    errors: [reason], sourceCitation: searchCite,
  };
}

function buildRow(c: { id: number; name: string; domain?: string; relaxed: string[] }, d: CompanyEnrichData, meta: Meta, window: GrowthWindow, plan: SearchPlan, searchCite: Citation): AgentRow {
  const co = normalizeCompany(d, c.domain ?? "");
  const root = `[crustdata_company_id=${c.id}].matches[0].company_data`;
  const rec = `crustdata_company_id ${c.id}`;
  const url = co.linkedinUrl ?? co.website;
  const cite = (path: string) => citeOf(meta, `${root}.${path}`, rec, url);
  const missing = (what: string) => unavailable(`not reported: Crustdata returned no ${what} for this company`);
  const hc = d.headcount as { total?: number | null; timeseries?: { date?: string | null; employee_count?: number | null }[] | null; growth_percent?: Record<string, number | null> | null } | undefined;
  const g = growthFromSeries(hc?.timeseries ?? [], window);
  const reported = hc?.growth_percent?.[REPORTED_KEY[window]];
  const checks: AgentRow["checks"] = [];

  const founded: ComputedField<number> = co.yearFounded ? ok(co.yearFounded, "Read as reported", `Founded in ${co.yearFounded}.`, [cite("basic_info.year_founded")]) : missing("basic_info.year_founded");
  const hq: ComputedField<string> = co.hq ? ok(co.hq, "Read as reported", `Headquarters: ${co.hq}.`, [cite("locations.headquarters")]) : missing("locations.headquarters");
  const headcountNow: ComputedField<number> = co.headcount.total != null ? ok(co.headcount.total, "Read as reported", `${co.headcount.total} employees on Crustdata's latest index.`, [cite("headcount.total")]) : g?.last ? ok(g.last.v, "Latest point of the monthly headcount series", `${g.last.v} employees on ${g.last.date}.`, [cite(`headcount.timeseries[date=${g.last.date}]`)]) : missing("headcount.total");
  const headcountThen: ComputedField<{ value: number; date: string }> = g?.then ? ok({ value: g.then.v, date: g.then.date }, `Point of the monthly series nearest ${WINDOW_MONTHS[window]} months before the latest`, `${g.then.v} employees on ${g.then.date}.`, [cite(`headcount.timeseries[date=${g.then.date}]`)]) : unavailable(`not reported: the headcount series has no point ${WINDOW_MONTHS[window]} months back`);
  let growth: ComputedField<number>;
  if (g?.pct != null && g.then) {
    growth = ok(g.pct, `(latest − ${WINDOW_MONTHS[window]} months earlier) ÷ ${WINDOW_MONTHS[window]} months earlier, from headcount.timeseries`, `${g.then.v} on ${g.then.date} → ${g.last.v} on ${g.last.date}: ${g.pct > 0 ? "+" : ""}${g.pct}%.${typeof reported === "number" ? ` Crustdata's own figure: ${round1(reported)}%.` : ""}`, [cite(`headcount.timeseries[date=${g.then.date}]`), cite(`headcount.timeseries[date=${g.last.date}]`)], [
      { name: "then", value: g.then.v, date: g.then.date },
      { name: "now", value: g.last.v, date: g.last.date },
    ]);
  } else if (typeof reported === "number") {
    growth = ok(round1(reported), "Read as reported (no usable monthly series to recompute from)", `Crustdata reports ${round1(reported)}% over ${WINDOW_MONTHS[window]} months.`, [cite(`headcount.growth_percent.${REPORTED_KEY[window]}`)]);
  } else growth = unavailable(`not reported: no headcount series or ${WINDOW_MONTHS[window]}-month growth for this company`);

  // verification against the request
  if (plan.foundedMin != null || plan.foundedMax != null) {
    if (!co.yearFounded) checks.push({ label: "Founded", ok: null, detail: "year founded not reported on enrich (matched the search filter)" });
    else {
      const okY = (plan.foundedMin == null || co.yearFounded >= plan.foundedMin) && (plan.foundedMax == null || co.yearFounded <= plan.foundedMax);
      checks.push({ label: "Founded", ok: okY, detail: okY ? `founded ${co.yearFounded}` : `enrich says founded ${co.yearFounded}, outside the requested range` });
    }
  }
  if (plan.countries.length) {
    const cc = clean(d.locations?.country)?.toUpperCase();
    const okC = !cc || plan.countries.some((x) => x.code === cc || x.name.toUpperCase() === cc);
    checks.push({ label: "Country", ok: cc ? okC : null, detail: cc ? (okC ? `HQ country ${cc}` : `enrich says HQ country ${cc}`) : "HQ country not reported on enrich" });
  }
  if (plan.growth) {
    if (growth.status === "ok") {
      const okG = growth.value >= plan.growth.minPct;
      checks.push({ label: "Growth", ok: okG, detail: okG ? `${growth.value}% ≥ ${plan.growth.minPct}%` : `recomputed ${WINDOW_MONTHS[window]}-month growth is ${growth.value}%, below the requested ${plan.growth.minPct}%` });
    } else checks.push({ label: "Growth", ok: null, detail: "growth could not be recomputed (matched the search filter)" });
  }

  const f = co.funding;
  const anyFunding = f.totalUsd != null || f.lastRoundType || f.lastDate || f.lastRoundUsd != null;
  const funding: AgentRow["funding"] = anyFunding
    ? ok(
        { total: f.totalUsd != null ? money(f.totalUsd, "USD") : null, lastRound: f.lastRoundType ?? null, lastDate: f.lastDate ?? null, lastAmount: f.lastRoundUsd != null ? money(f.lastRoundUsd, "USD") : null },
        "Read as reported; amounts in USD per the field names (*_usd)",
        [f.totalUsd != null ? `Total raised USD ${f.totalUsd.toLocaleString("en-US")}` : "Total raised not reported", f.lastRoundType ? `last round ${f.lastRoundType}${f.lastDate ? ` on ${f.lastDate}` : ""}` : null].filter(Boolean).join("; ") + ".",
        [cite("funding.total_investment_usd"), cite("funding.last_round_type")],
      )
    : unavailable("not reported: Crustdata has no funding rounds for this company");

  const series = (hc?.timeseries ?? [])
    .filter((p) => p.date && typeof p.employee_count === "number")
    .map((p) => ({ date: String(p.date).slice(0, 10), v: p.employee_count as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-13);

  return {
    id: c.id, rank: 0, name: co.name, domain: co.domain || c.domain, logoUrl: co.logoUrl, linkedinUrl: co.linkedinUrl, description: co.description, relaxed: c.relaxed,
    founded, hq, headcountNow, headcountThen, growth, growthWindow: window, series, funding,
    founders: { status: "pending" }, checks, errors: [], sourceCitation: searchCite,
  };
}

function priorOf(p: LivePerson, row: { id: number; name: string; domain?: string }): Founder["prior"] {
  const self = (e: LiveEmployment) => e.companyId === row.id || (row.domain && e.companyDomain === row.domain) || e.company.toLowerCase() === row.name.toLowerCase();
  const seen = new Set<string>();
  return p.past
    .filter((e) => !self(e))
    .filter((e) => (seen.has(e.company.toLowerCase()) ? false : (seen.add(e.company.toLowerCase()), true)))
    .slice(0, 4)
    .map((e) => ({ company: e.company, title: e.title, start: e.start, end: e.end }));
}

function toFounder(p: LivePerson, row: AgentRow, citation: Citation): Founder {
  const prior = priorOf(p, row);
  const title = p.current.find((e) => e.companyId === row.id || e.company.toLowerCase() === row.name.toLowerCase())?.title ?? p.title;
  return { name: p.name, title, linkedinUrl: p.linkedinUrl, personId: p.id, prior, priorSource: prior.length ? "person/search" : "none", citations: [citation] };
}
