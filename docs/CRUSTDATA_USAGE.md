# What are we using Crustdata for, and are we using it to the full extent?

Audit of branch `integrate` after all merges, 31 Oct 2026 13:55 IST. Sources: `docs/crustdata/openapi/*.yaml`, the
watch docs, the event deck's API page (8 APIs + MCP), `src/lib/crustdata/*`, `src/lib/live/*`, `src/lib/sourcing/*`,
`src/lib/agent/tools*`, and live measurements in `verify_shots/CREDITS.md`.

## The answer

**What for:** Crustdata is the only source of company and people facts in Deal Desk. It powers both agents (LLM research
`/ask`, deterministic sourcing `/agent`), the single-company diligence page, the person page, typo handling
(did-you-mean via identify) and the connector health check. Every value on screen cites the endpoint and JSON path it
came from.

**Full extent? No.** We use 7 of the deck's 8 data APIs (identify, enrich, company search, person search,
person enrich, job search, live web search) plus `/account/credits`. We do **not** use the two things that would turn
Deal Desk from "answers when asked" into "watches for you": **watchers** (company, person, job) and the **MCP server**;
nor web fetch, autocomplete, person identify, or `/account/endpoints`.

**First-principles recommendation.** Crustdata already did the hard part: a canonical, continuously refreshed graph of
companies and people. A fund's real job is not one search, it is *noticing change* in thousands of companies over
months. So the next unit of value is not another screen; it is a subscription to change:

| Rank | Adopt | Why it matters to a fund | Effort |
| --- | --- | --- | --- |
| 1 | **`/watch/company` webhooks for Track** ("not yet, keep watching") | A pass becomes a set of measurable milestones (team ≥ 50, round raised); Crustdata tells us when one is hit; the deal re-opens with the cited change | Webhook route with HMAC-SHA256 on `x-crustdata-signature`, a deal store, `DEALDESK_PUBLIC_URL`. Client already has `watchCompany`/`deleteWatch`/`getWatchRuns` (live-verified) |
| 2 | **`/watch/person`** on founders and operators | Repeat founders leaving a job is the earliest sourcing signal there is | Same webhook route |
| 3 | **Job search as a sourcing signal** (already an `/ask` tool, `search_jobs`; not in `/agent`) | Open roles = "growing now"; `hiring.*` is null on our plan | One `limit:1` call per candidate (0.03 credits) |
| 4 | **`/watch/job/search`** for portfolio and pipeline | Senior hires and hiring freezes as portfolio signals | Same webhook route |
| 5 | **`/web/enrich/live`** (fetch a URL) | Cite a company's own pricing or careers page in the memo | One tool in the agent registry |
| 6 | **Crustdata MCP server** | Let the partner's own agent (Claude, Cursor) use the same tools; lets Deal Desk expose its sourcing as MCP | Configuration, not code |
| 7 | **`/account/endpoints` at startup** | Build the enrich allow-list from the account instead of hard-coding it (avoids the whole-call 403) | Small |

What we deliberately do not rebuild: identity resolution, headcount history, funding history, career histories. Our
code adds judgement (filters, ranking, verification, the trust rules, the exception queue), not data.

## Capability table

Legend: **Used** = called by a screen or route today · **Client only** = implemented, not called · **No** = not implemented.
"Ask" = LLM research agent tools (`src/lib/agent/tools.ts`, `tools/*.ts`); "Agent" = deterministic sourcing (`src/lib/sourcing/run.ts`).

| Capability | Status | Where | Value if used more |
| --- | --- | --- | --- |
| `POST /company/identify` (domain/name → id) | Used: Deal, Agent (name lookup), Ask (`identify_company`), did-you-mean | `src/lib/live/research.ts` `lookupCompany`, `src/lib/live/resolve.ts`, `run.ts`, `tools/identify-company.ts` | — (0 credits; already the entry point) |
| `POST /company/enrich` | Used: Deal, Agent (verify step), Ask (`enrich_companies`, `company_signals`) | `research.ts`; `run.ts`; `tools.ts`, `tools/company-signals.ts` | — |
| · `basic_info`, `taxonomy`, `locations` | Used | `src/lib/live/normalize.ts` | — |
| · `headcount.total`, `growth_percent.{mom,qoq,six_months,yoy}` | Used | `normalize.ts`, `src/lib/numbers/company-fields.ts` | — |
| · `headcount.timeseries` | Used: deal sparkline; Agent recomputes growth from it and cites both points | `src/lib/adapters/deal.ts`, `run.ts` `growthFromSeries` | Verifiable growth claims: cite both endpoints of the window |
| · `headcount.by_function_timeseries` | Used (top function sparkline) | `adapters/deal.ts` | Engineering vs sales mix as a stage signal |
| · `funding.*` (total, last round, date, investors) | Used | `normalize.ts`, `company-fields.ts` | Funding filters in sourcing ("raised < $5M"); co-investor inference for Warm forward |
| · `funding.milestones` | No | — | Round history for the "line, not dot" view in Track |
| · `web_traffic` (visitors, QoQ, timeseries) | Used (deal page) | `normalize.ts` | Traction signal in sourcing rank |
| · `followers` | Used | `normalize.ts` | Minor |
| · `news[]` | Used (high-confidence only) | `normalize.ts` | — |
| · `revenue.estimated` | Requested, not shown | — | Coarse revenue band; must be labelled "estimated", never ARR |
| · `people` | Requested, not read | — | Leadership list without extra person calls (legacy keys; prefer person APIs) |
| · `hiring.*` | Not used (null on this plan) | — | — |
| · `technographics`, `crunchbase`, `maps`, `social_posts` | Not permitted (403s the call) | `enrich-fields.ts` allow-list | — |
| `POST /company/search` | Used: Deal (comparables), Agent (search + relax), Ask (`search_companies`) | `research.ts` `searchComps`, `company-queries.ts`; `run.ts`; `tools.ts` | Market maps; saved searches as thesis feeds |
| `POST /company/search/autocomplete` | No | — | Type-ahead for company names in the request box |
| `POST /person/search` | Used: Deal (founders), Agent (founders step), Ask (`search_people`, `find_founders`) | `research.ts` `searchFounders`, `person-queries.ts`; `run.ts`; `tools.ts`, `tools/find-founders.ts` | Founder-first sourcing ("ex-Stripe engineers who founded in 2024") |
| `POST /person/enrich` | Used: Person page, Agent (past employers), Ask (`enrich_person`) | `research.ts` `enrichPerson`; `run.ts`; `tools.ts` | — |
| `POST /person/identify`, autocomplete | No | — | Resolve a founder name from an email signature |
| `POST /job/search` | Used: Deal (open roles, engineering share), Ask (`search_jobs`); not in Agent | `research.ts` `searchJobs`, `job-queries.ts`; `tools/search-jobs.ts` | **Hiring as a sourcing signal**: rank candidates by open roles / recent postings |
| `POST /web/search/live` | Used: Deal (live web), Ask (`web_search`) | `research.ts` `searchNews`; `tools/web-search.ts` | — (slow, noisy; filtered) |
| `POST /web/enrich/live` (fetch a URL) | No | — | Cite a company's own pricing/careers page in the memo |
| `POST /watch/company`, `GET …/:id/runs`, `DELETE …/:id` | **Client only** | `client.ts` `watchCompany`, `getWatchRuns`, `deleteWatch`; body in `watch-body.ts` (live-verified create → delete) | **Track "not yet, keep watching"**: milestone watches (`headcount.total => 50`, `funding.last_round_type changed`) re-open a deal when hit. Free to create, 5 credits per notification |
| `POST /watch/person` | No | — | Alert when a tracked founder changes jobs (sourcing for repeat founders) |
| `POST /watch/job/search` | No | — | Alert when a portfolio or pipeline company posts senior roles |
| `GET /account/credits` | Used | `src/lib/live/integrations.ts` (Settings health, 0 credits) | Credit budget per agent run |
| `GET /account/endpoints` | No | — | Detect permitted fields at startup instead of a static allow-list |
| Crustdata **MCP server** | No | — | Expose the same tools to any agent (Claude, Cursor); lets Deal Desk itself become an MCP server for investors' own agents |

## Cost per flow (measured)

| Flow | Calls | Credits |
| --- | --- | --- |
| Deal research, fresh (e2b.dev) | identify 0 · enrich 2 · person search 0.66 · job search 0.75 · web search 1 · company search 1.15 | **5.56** |
| Same, repeated | cache hits | 0 |
| Person page | person enrich | 1 |
| Sourcing run `/agent` | search (+ relax) + enrich + person search + person enrich × founders | Shown per step and in total in the trace; not measured for this doc |
| Research agent `/ask` (live runs) | model-chosen tools, 60-credit cap per run | India B2B founders ≈54 · US fintech ≈51 · EU climate ex-Google founders ≈20 |
| Settings health | `/account/credits` | 0 |

Total spent across the integration and verification sessions: ≈ 7.6 credits by 12:46 IST (`verify_shots/CREDITS.md`);
agent runs after that are not totalled here (check `GET /account/credits` on Settings).

Ranked recommendations: see "The answer" at the top. Track design notes: `/workspace/dealdesk_audit/TRACK_NOT_YET_ANALYSIS.md`
(one shared track-signals watch per fund with entities PATCHed in and out; per-company threshold watches only for hard
milestones; a monthly `/runs` poll as fallback).
