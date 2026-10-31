# Deal Desk UI — server API (this repo)

All routes are Next.js route handlers (`runtime = nodejs`, `dynamic = force-dynamic`, `cache-control: no-store`).
Secrets are read from server env only and never appear in responses or logs.

> **Contract source.** The `ComputedField` shape and `/api/deals/:id/{numbers,valuation}` follow the builder's
> explainable-numbers contract (builder repo `builder-main` @ a5330b1, documented in **its** `docs/API.md`). Once that
> branch lands, the builder's doc is authoritative; the routes here are an interim implementation designed to be
> swapped by replacing `src/lib/numbers/*` with calls to the builder backend. Assumptions we made are listed at the end.

## Data modes

`DEALDESK_DATA_MODE=demo|live` (unset = `demo`; any other value is a startup error).

| Route family | demo | live |
| --- | --- | --- |
| `/api/live/*` | **409** `{status:"disabled"}` — a public demo can never spend credits | calls Crustdata |
| `/api/deals/:id/*` | id = demo deal (`helio`) from `src/lib/numbers/demo.ts` | id = company **domain** (e.g. `e2b.dev`) |
| `/api/integrations/connectors` | real status (reports config, serves no data) | same |

## Shared shapes

### ComputedField (`src/lib/fields.ts`)

```ts
type ComputedField<T> =
  | { status: "ok"; value: T; inputs: { name: string; value: unknown }[]; method: string;
      citations: { source: string; endpoint?: string; path?: string; url?: string; retrievedAt?: string }[];
      reasoning: string }
  | { status: "unavailable"; reason: string };
```

`citations[].endpoint` is the upstream call (`POST /company/enrich`), `path` the JSON path in that response
(`[0].matches[0].company_data.headcount.total`), `retrievedAt` when the response was fetched (for cached responses:
when originally fetched). UI helpers: `isOk(f)`, `show(f, fmt)` (→ `"—"` when unavailable), `explain(f)` (hover text).

### Failures (every `/api/live/*` route)

| HTTP | body | meaning |
| --- | --- | --- |
| 400 | `{status:"error", message}` | bad query parameter |
| 409 | `{status:"disabled", message}` | `DEALDESK_DATA_MODE` is not `live` |
| 503 | `{status:"not_connected", message}` | `CRUSTDATA_API_KEY` not set |
| 502 | `{status:"error", message, upstreamStatus?}` | Crustdata/API/transport error (never reported as "no match") |

An **unknown domain** is not a failure: identify returns `matches: []` → `{status:"no_match"}` (HTTP 200 on
`/api/live/*`, 404 on `/api/deals/:id/*`).

### LiveCall (per upstream call, used by the signal graph)

`{ id, method, path, body, status: "ok"|"no_match"|"error"|"skipped", ms, cached, retrievedAt, creditsUsed, error?, note?, data? }`
— `body` is the exact request body sent; `ms` the observed latency of the original call; `creditsUsed` the
`X-Credits-Used` header.

## Routes

### `GET /api/live/research?domain=e2b.dev` (alias `?company=`)

The deal page's research run: identify → enrich, then founders, jobs, web search and comparables in parallel. One
failing call is reported in its `LiveCall` and does not hide the others; identify/enrich failures fail the request.

`{ status:"ok", domain, requestedAt, company: LiveCompany, fields: Record<key, ComputedField>, calls: { identify, enrich, founders, jobs, news, comps } }`
| `{ status:"no_match", domain, requestedAt, calls: { identify } }` | failure.

`fields` keys (all from live responses, see `src/lib/numbers/company-fields.ts`):

| key | method | Crustdata source |
| --- | --- | --- |
| `headcountLatest` | as reported | `POST /company/enrich` `…company_data.headcount.total` |
| `headcountGrowth6m`, `growthYoY`, `headcountGrowthQoQ` | as reported (Crustdata's own growth %), rounded 0.1 | `…headcount.growth_percent.{six_months,yoy,qoq}` |
| `fundingTotalUsdM` | `total_investment_usd ÷ 1e6` | `…funding.total_investment_usd` |
| `lastFundingUsdM` | `last_round_amount_usd ÷ 1e6` | `…funding.last_round_amount_usd` |
| `lastRoundType`, `lastFundingDate` | as reported | `…funding.last_round_type`, `…funding.last_fundraise_date` |
| `webMonthlyVisitors`, `webTrafficQoQ` | as reported | `…web_traffic.domain_traffic["<domain>"].{monthly_visitors,qoq_pct}` |
| `followers` | as reported | `…followers.count` |
| `openRoles` | `total_count` | `POST /job/search` (`company.basic_info.company_id = id`) |
| `engineeringRolesSample` | count of `category == "Engineering"` over returned listings (sample, ≤25) | `job_listings[].job_details.category` |
| `foundersFound` | number of profiles | `POST /person/search` founder filter tree |
| `foundedYear` | as reported | `…basic_info.year_founded` |
| `compsFound` | number of companies | ranked `POST /company/search` on description + categories |
| `signalScore` | **unavailable** — needs the firm thesis + builder scoring model | — |

Cost of a fresh run (live, measured 2026-10-31 for e2b.dev): identify 0 · enrich 2 · person search 0.66 (≈0.23/row
with experience) · job search 0.75 (0.03/row, limit 25) · web search 1 · company search 1.15 (≈0.23/row with funding)
= **5.56 credits**. Repeats are served from the response cache (0 credits).

### `GET /api/live/company?domain=` → `{status:"ok", company, identify, enrich}` | `{status:"no_match", domain, identify}` (identify 0 + enrich 2)
### `GET /api/live/people?companyId=` → `LiveCall<{ total, people: LivePerson[] }>` (founders; ≈0.23/row, limit 5)
### `GET /api/live/person?linkedin=https://www.linkedin.com/in/<handle>` → `{status:"ok", person, call}` | `{status:"no_match", linkedinUrl, call}` (1 credit)
### `GET /api/live/jobs?companyId=` → `LiveCall<{ total, listings[], byCategory[] }>` (0.03/row, limit 25)
### `GET /api/live/news?q=&mention=` → `LiveCall<{ query, results[] }>` (1 credit). Results not mentioning `mention` are dropped (live web results for short names are noisy).
### `GET /api/live/comps?companyId=&q=` → `LiveCall<LiveComp[]>` (ranked company search, target excluded)

### `GET /api/deals/:id/numbers`

`{ id, source: "live"|"demo", dataMode, fields }` with one `ComputedField` per key:
`fitScore, criterionSector, criterionStage, criterionGeo, criterionCheckSize, criterionMemory, returnMultipleLow,
returnMultipleHigh, compsMedianMultiple, growthYoY, headcountLatest, lastFundingUsdM, diligenceVerdict, icMemoArrUsedM,
icMemoValuation, icMemoCompsLine`.

* **live** (id = domain): `headcountLatest`, `growthYoY`, `lastFundingUsdM` are computed from Crustdata as above; every
  other key is `unavailable` with the reason (builder pipeline: data-room ingest, firm mandate, pricing/LLM).
  Comparable-company *multiples* are unavailable because Crustdata has no revenue/valuation multiples.
* **demo** (id = `helio`): values from `src/lib/numbers/demo.ts`, derived from the UI fixtures; every citation's source
  is "Demo data (invented fixture, not a real company)". Keys the demo data does not cover are `unavailable`.
* 404 for an id that does not exist in the current mode (`{status:"error"}`) or an unknown domain (`{status:"no_match"}`);
  503/502 as above.

### `GET /api/deals/:id/valuation`

`{ id, source, dataMode, explainable: { low, high, cap, ask, returnMultipleLow, returnMultipleHigh, compsMedianMultiple } }`
(each a `ComputedField`). Live: all unavailable (needs verified revenue + pricing model). Demo: low/high/cap/ask from the
demo valuation, `compsMedianMultiple` = median of the demo comps' multiples.

### `GET /api/integrations/connectors[?fresh=1]`

Real status for the connectors Deal Desk actually integrates; catalogue tiles (Affinity, Attio, Carta, PitchBook, …) are
UI-only and not listed. Health results are cached 5 minutes per process (`fresh=1` bypasses).

```ts
{ dataMode: "demo"|"live", checkedAt: string, connectors: {
    id: "crustdata"|"llm"|"agentmail"|"slack"|"fireflies"|"gmail"|"calendar",
    name: string,
    status: "connected" | "not_configured" | "error" | "demo",
    mode: "live_check" | "env" | "fixture",
    wired: boolean,          // true only when this build calls it (Crustdata)
    detail: string,          // human-readable reason / health result
    env: string[],           // env var NAMES that configure it (never values)
    docsUrl: string,
    lastCheckedAt: string | null }[] }
```

| status | rule |
| --- | --- |
| `not_configured` | required env missing (no network call) |
| `connected` | a free, read-only health call succeeded: Crustdata `GET /account/credits` (0 credits; detail shows the balance), Anthropic/OpenAI `GET /v1/models`, AgentMail `GET /v0/inboxes`, Slack `auth.test`, Fireflies GraphQL `user`. If `wired` is false the detail says "not used by this build yet". |
| `error` | health call failed (status + upstream message), or Google credentials are set but this build has no OAuth flow |
| `demo` | explicitly on fixtures (`DEALDESK_FIXTURES=1` / `CRUSTDATA_FORCE_FIXTURE=1`) with no key |

Status never comes from timers or fixtures.

## Assumptions vs the builder contract

1. `inputs` is an array of `{ name, value }` (extra keys allowed); `citations` entries allow extra keys.
2. Numbers are plain JSON numbers in the unit named by the key (`…UsdM` = millions of USD, growth in percent).
3. Deal ids: the builder uses its DB deal ids; here live ids are domains and demo ids are fixture ids. A swap only
   needs an id→deal mapping on the UI side.
4. `/valuation` returns only `{ id, source, dataMode, explainable }`; the builder's response also carries its full
   valuation object, which this build does not have.
