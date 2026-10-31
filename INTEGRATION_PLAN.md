# Deal Desk — UI ⇄ backend integration plan

Branch: `integrate` · Date: 2026-10-31 · Crustdata API version `2025-11-01`

## 1. Base app decision

**Shell = this repo (polished UI, Next 15 / React 19 / Tailwind 4).** The backend's Crustdata library and its
stateless pieces are ported into `src/lib/**`, and new Next route handlers under `src/app/api/**` expose live data to
the screens.

Why this direction rather than porting the UI into the builder's backend repo:

| Consideration | Polished UI repo (chosen) | Builder backend repo (`/workspace/dd_new`) |
| --- | --- | --- |
| Completeness here | Every screen and route builds and runs today | Partial copy: `graph/`, `pipeline/`, `mcp/`, `firm/`, the webhook import modules that are **not present** (`@/lib/db`, `@/lib/graph/store`, `@/lib/graph/hash`, `@/lib/jobs/*`, `@/lib/journey/*`, `@/lib/dealdesk/paths`, …) |
| Persistence | Stateless, Vercel-friendly | `better-sqlite3` file DB + drizzle, local zip rooms on disk — not deployable on Vercel without a Postgres port |
| Self-contained & verified code | — | `src/lib/crustdata/*` is self-contained (needs only regenerated OpenAPI types) and was live-verified |
| Risk | Additive: new `src/lib`, `src/app/api`, adapters, thin-wrapper edits | Would require re-porting 19 screens + ~40 components |

So: port what is self-contained (Crustdata client, query builders, match/enrich helpers, rate-limit handling, tests),
leave the DB-bound orchestration (pipeline, graph store, journey, jobs, MCP) in the builder repo and record it as a gap.

## 2. Data modes

`DEALDESK_DATA_MODE=demo|live` (server env, read at request time; the root layout is dynamic so no rebuild is needed).
Unset ⇒ `demo` (documented default). Any other value ⇒ hard error (no guessing).

* **demo** — screens render `port/src/fixtures` exactly as before (pixel-identical) plus one fixed "Demo data" badge.
* **live** — wired screens fetch from `/api/live/*` and `/api/connectors`. A missing key yields an explicit
  "not connected" state; upstream errors yield error states; an unknown domain yields "no match". Never fixtures.
  Screens that have **no live backend in this build** keep rendering their fixtures but carry a visible
  "Demo data · no live source for this screen yet" badge, so nothing fixture-based is passed off as live.

## 3. Screen-by-screen mapping

Legend — **Source**: `ported` = code now in this repo; `builder` = exists only in the builder repo per AUDIT.md
(DB-bound, not ported); `missing` = no backend anywhere.

| Route (screen) | Data the screen needs | Backend source | Fixture → live mapping (adapter) | Status after this pass |
| --- | --- | --- | --- | --- |
| `/deal?domain=` (DealScreen + SignalSection) | `DealData`: header (company, metrics, fit), outline, Signals graph (`SignalGraphData`), sections overview/team/market | **ported** Crustdata client → `GET /api/live/research?domain=` (identify → enrich, founders person search, job search, web search, comparable company search) | `toLiveDeal(research)` → `DealData`; `toSignalGraph(research)` → `SignalGraphData` (calls/chips/sparks/timeline from real calls & latencies); `toOverviewSection`, `toTeamSection`, `toMarketSection` | **Live** (Crustdata) |
| `/deal?id=helio` and `/deal` (fixture deals) | Deck claims, bank deposits, cap table, valuation, data-room evidence, deal team, IC date | **builder** (`pipeline/run.ts`: room ingest, claim extraction, tie-outs, pricing; DB) | none in this build | Fixture-only (badged in live) |
| `/deal/room` (DataRoomScreen) | Room folders/files, facts | **builder** (`pipeline/ingest`, rooms on disk) | none | Fixture-only |
| `/person?linkedin=&domain=` (PersonScreen) | `PersonData`: header, details, insights, timeline | **ported** `GET /api/live/person?linkedin=` (person enrich, 1 credit) | `toLivePerson(profile, company)` → header/details/insights from `basic_profile`, `experience.employment_details`, `education`; timeline = employment history as Crustdata-sourced events; email/calendar tabs empty (Gmail/Calendar not connected) | **Live** (Crustdata) |
| `/person?id=ananya-rao…` | Emails, meetings, notes, deal stage, owner | **builder** (journey/inbound, AgentMail, calendar) | none | Fixture-only |
| `/settings?section=connectors` | `ConnectorsData` | **new** `GET /api/connectors` (env inspection + free Crustdata identify health check) | `toLiveConnectors(status)` overlays real status on the connector catalogue; drops invented activity/call counts | **Live** (status) |
| `/settings` other sections (workflow, members, access, export) | Firm config, members, walls, keys | **builder** (`firm/onboarding.ts`, `firm/config-store`, DB) | none | Fixture-only |
| `/today` (TodaySummary/Today/Calm/Onboarding) | Inbound work rows, meetings, waiting items, briefs | **builder** (journey, inbound connectors, calendar) — calendar is a stub there too | none | Fixture-only |
| `/pipeline` (table/board) | Deals, stages, owners, decisions | **builder** (DB deals) | none | Fixture-only |
| `/pipeline?view=watchlist` | `WatchlistData` company cards (headcount series, growth, est. ARR, warm intro) | Crustdata enrich would cover headcount/growth/revenue; warm-intro paths are **missing** (need CRM/LinkedIn graph) | not wired (would cost 2 credits/company; intro path cannot be sourced honestly) | Fixture-only (gap) |
| `/portfolio` | Portfolio KPIs, board packs, docs | **missing** (portfolio watch = Crustdata watch + webhook in builder, DB-bound) | none | Fixture-only |
| `/mandates` (bank mode) | Buyers, VDR views, gates | **missing** | none | Fixture-only |
| `/memo` | IC memo doc, citations, votes | **builder** (`pipeline/outputs` writes memo; LLM optional) | none | Fixture-only |
| `/brain` | Firm memories, thesis proposals | **builder** (firm config/thesis in DB) | none | Fixture-only |
| `/agents`, `/agents?tab=runs`, `/agent` | Agent list, runs, flow canvas | **builder** (jobs queue, journey) | none | Fixture-only |
| `/ask` | Assistant threads/answers | **builder** (LLM via AI SDK; no key configured here) | none | Fixture-only |
| `/slack`, `/preview/slack` | Slack card frames | **builder** (`slack/dealflow.ts`, dry-run without token) | design reference, no data | Fixture-only (by design) |
| `/landing` | Marketing copy | static | none needed | Static (fixture) |

### Data-shape mismatches (port `types.ts` fixtures vs Crustdata `2025-11-01`)

| UI field | Fixture assumption | Real Crustdata shape | Adapter handling |
| --- | --- | --- | --- |
| `SignalGraphData.calls[].chips[].value` | pre-formatted strings ("22 → 31") | numbers / arrays under `company_data.headcount.*`, `funding.*`, `web_traffic.domain_traffic.*` | formatted in adapter; chips omitted when the field is null |
| `headcount.by_function_timeseries` chip | always present | may be absent | chip/spark omitted when absent (no invented values) |
| `fit.score` / `contributions` | thesis model output (fixture) | no thesis model in this build | transparent rule-based **signal score** from real fields only, labelled "Signal score · rules, no thesis configured" |
| `watch` call node | watch created per research run | creating a watch per page view leaks watches (builder bug) | not created on page view; omitted from the live graph |
| `TeamPerson.prev`, `tenure` | strings | `experience.employment_details.past[]` / `current[]` with dates | derived from employment details |
| `PersonData.person.email` | always present | business email not in basic profile (contact enrich is a separate paid call) | "Not available (contact enrich not run)" |
| `CompRow.multiple` | run-rate multiple | no revenue multiple in Crustdata | "—" |
| identify `matches[]` | fixture assumed `results[]` wrapper in places | top-level array `[{matched_on, match_type, matches[]}]` | `match.ts` handles both; empty `matches` ⇒ explicit no-match |
| Person search | legacy fixtures use `results[]`/`basic_info` | `profiles[]` with `basic_profile`, `experience.employment_details` | normalizer reads `profiles[]` |
| Job search | `job_details.category` | `job_listings[].job_details.{title,category,…}` + `total_count` | grouped by category |
| Web search | `results[0].title/source` | `results[]` with `title`, `url`, `snippet`, `source` | first N results as chips/news |

## 4. API routes added (all `GET`, `runtime = nodejs`, `dynamic = force-dynamic`)

| Route | Crustdata calls (cost) | Response |
| --- | --- | --- |
| `/api/live/company?domain=` | identify (0) → enrich (2) | `{ status: "ok" \| "no_match", company }` or `{ status: "not_connected" \| "error" }` |
| `/api/live/people?companyId=` | person search, founders filter tree (≈0.23/row, limit 5) | profiles |
| `/api/live/person?linkedin=` | person enrich (1) | profile |
| `/api/live/jobs?companyId=` | job search on `company.basic_info.company_id` (0.03/row) | listings + total |
| `/api/live/news?q=` | web search live (1) | results |
| `/api/live/comps?companyId=` | company search with filter tree (0.03/row, limit 5) | companies |
| `/api/live/research?domain=` | all of the above for one company, per-call timing & status | aggregate used by the deal page |
| `/api/connectors` | identify on the configured smoke domain (0) when a key is set | per-connector status |

Every live response is cached (pluggable `ResponseCache`: in-memory by default; file cache under `.cache/crustdata`
only when `DEALDESK_CACHE_DIR` is set, intended for local dev — gitignored). Cache key = path + request body hash.

## 5. Connector matrix

| Connector | Builder repo status (AUDIT.md) | In this build | Live status reported by `/api/connectors` |
| --- | --- | --- | --- |
| Crustdata | Verified / fixed; client + webhook | **Ported** client, queries, rate limiting; webhook not ported (needs jobs queue) | `connected` only after a successful free identify call; `attention` with the API error if it fails; `available` ("Not connected") when `CRUSTDATA_API_KEY` is unset |
| LLM (Anthropic / OpenAI) | Optional; errors swallowed | Not ported (no LLM features wired here) | `available` when no key; with a key: `attention` "Key set · not used by this build" (honest: nothing calls it) |
| AgentMail | Fixed send path; dry-run without keys | Not ported | same rule: env-based, never "connected" without a working integration |
| Google Calendar / Meet | Stub, not wired | Not ported | same rule |
| Gmail | Disconnected OAuth stub | Not ported | same rule |
| Slack | Verified / dry-run | Not ported | same rule |
| Fireflies | Partial; webhook verify not HMAC | Not ported | same rule |

## 6. Builder bugs fixed in the port

1. **Comparable-company search** (`graph/build-deal-graph.ts`, `mcp/tools.ts`) sent non-filter-tree bodies
   (`{industries:{contains}}`, `{field:"industries",type:"(.)"}`) that the API rejects, and on empty results inserted
   invented companies ("FlowBot", "LedgerOps"). Port: `comparableCompaniesSearchBody()` uses the documented filter-tree
   shape (same as person/job queries); no stub companies.
2. **Fallback searches rejected by the API** (`pipeline/run.ts` empty `conditions` + `limit: 0`; graph job search with
   `value: -1, limit: 0`). Port: no request is made without a resolved company id; result is an explicit "unresolved".
3. **Errors mislabeled as no-match** (`pipeline/verify.ts` `.catch(() => null)` → "no match"; `firm/onboarding.ts`
   `catch → {}`). Port: `CompanyLookup` is a discriminated union `ok | no_match | not_connected | error`; only an empty
   `matches[]` is `no_match`.
4. **Watch created on every run, never cleaned up** (`materializeDealIdentityGraph`, with an `example.com` webhook
   fallback). Port: page views never create watches; `watchCompany` requires an explicit webhook URL.
5. **Fixture fallback to Acme for unknown domains** (`fixtures.ts`). Port: strict per-domain fixtures (tests only).

## 7. Verification plan

`npm run build`, `npm run typecheck`, `npm test` (vitest); live smoke against `e2b.dev` (expect ~52 employees) and one
unknown domain (expect explicit no-match); Playwright click-through of every route in demo and live mode with
screenshots in `verify_shots/{demo,live}/`; credit ledger in `verify_shots/CREDITS.md` (hard cap 30 credits).
