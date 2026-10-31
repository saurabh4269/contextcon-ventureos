# What we use Crustdata for, and are we using it to the full extent?

Audit of branch `integrate`, 31 Oct 2026. Sources: `docs/crustdata/openapi/*.yaml` (company, person, job, web), the
watch docs, the event deck's API page (8 APIs + MCP), `src/lib/crustdata/*`, and live measurements in
`verify_shots/CREDITS.md` and the earlier live audit.

## Thesis

Crustdata already did the hard part: a canonical, continuously refreshed graph of companies and people (identity
resolution, headcount history, funding, hiring, web traffic, career histories). Rebuilding any of that is wasted effort
and a source of wrong numbers. **Deal Desk orchestrates and cites**: it turns an investor's request into the right
sequence of Crustdata calls, verifies what matters (recomputing growth from the raw timeseries), and shows every value
with the endpoint and JSON path it came from. Our own code adds judgement (filters, ranking, the trust rules,
memory), not data.

## Short answer

| | |
| --- | --- |
| Endpoints used in product code | 7 of the deck's 8 APIs + `/account/credits` |
| Endpoint in the client but not called by any screen | Watch (`/watch/company` create, delete, runs) |
| Not used | MCP server, person identify, autocomplete, web fetch (`/web/enrich/live`), person/job watchers, `/account/endpoints` |
| Biggest unused value | **Watchers** (turn a one-off diligence into continuous monitoring: Track) and **job search as a sourcing filter** |

## Capability table

Legend: **Used** = called by a screen or route today · **Client only** = implemented, not called · **No** = not implemented.
"This session" marks what the sourcing agent added. <!-- VERIFY: confirm each "this session" row against src/lib/sourcing -->

| Capability | Status | Where | Value if used more |
| --- | --- | --- | --- |
| `POST /company/identify` (domain/name → id) | Used | `src/lib/live/research.ts` `lookupCompany` (deal, memo) | — (0 credits; already the entry point) |
| `POST /company/enrich` | Used; this session also in agent verification <!-- VERIFY --> | `research.ts`; `src/lib/sourcing` <!-- VERIFY --> | — |
| · `basic_info`, `taxonomy`, `locations` | Used | `src/lib/live/normalize.ts` | — |
| · `headcount.total`, `growth_percent.{mom,qoq,six_months,yoy}` | Used | `normalize.ts`, `src/lib/numbers/company-fields.ts` | — |
| · `headcount.timeseries` | Used (deal sparkline); this session: growth recomputed from it in the agent <!-- VERIFY --> | `src/lib/adapters/deal.ts` | Verifiable growth claims: cite both endpoints of the window |
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
| `POST /company/search` | Used (comparables); this session also sourcing <!-- VERIFY --> | `research.ts` `searchComps`, `company-queries.ts`; `src/lib/sourcing` <!-- VERIFY --> | Market maps; saved searches as thesis feeds |
| `POST /company/search/autocomplete` | No | — | Type-ahead for company names in the request box |
| `POST /person/search` | Used (founders); this session also agent founders <!-- VERIFY --> | `research.ts` `searchFounders`, `person-queries.ts` | Founder-first sourcing ("ex-Stripe engineers who founded in 2024") |
| `POST /person/enrich` | Used (person page); this session also past employers <!-- VERIFY --> | `research.ts` `enrichPerson` | — |
| `POST /person/identify`, autocomplete | No | — | Resolve a founder name from an email signature |
| `POST /job/search` | Used (open roles, engineering share on the deal page) | `research.ts` `searchJobs`, `job-queries.ts` | **Hiring as a sourcing signal**: rank candidates by open roles / recent postings |
| `POST /web/search/live` | Used (live web on the deal page) | `research.ts` `searchNews` | — (slow, noisy; filtered) |
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
| Sourcing run (10 companies) | search + enrich × N + person search + person enrich × founders | <!-- VERIFY: from a real run's step trace --> |
| Settings health | `/account/credits` | 0 |

Total spent across the integration and verification sessions: ≈ 7.6 credits by 12:46 IST (`verify_shots/CREDITS.md`),
plus <!-- VERIFY --> for the agent runs.

## Recommendations (ranked)

1. **Watchers for Track.** One shared "track-signals" watch per fund (headcount, funding, news) with entities PATCHed in
   and out; per-company threshold watches only for hard milestones. Needs `/api/webhooks/crustdata` with HMAC-SHA256
   verification of `x-crustdata-signature` and a monthly `/runs` poll as fallback. Plan: `/workspace/dealdesk_audit/TRACK_NOT_YET_ANALYSIS.md`.
2. **Job search as a sourcing signal.** After search, one `limit:1` job search per candidate (0.03 each) gives
   `total_count` open roles: cheap, and a strong "growing now" signal that `hiring.*` does not give on this plan.
3. **Headcount timeseries everywhere a growth number appears.** Recompute, cite the two points, flag if it disagrees with
   `growth_percent`.
4. **Funding filters and investors** in sourcing, and investor overlap as the basis for Warm forward.
5. **`/account/endpoints` at startup** to build the enrich allow-list from the account instead of hard-coding it.
6. **MCP server** once the sourcing tools are stable.
