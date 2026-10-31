# 03 · App API and Crustdata usage

Full request and response shapes: [../API.md](../API.md). Crustdata audit: [../CRUSTDATA_USAGE.md](../CRUSTDATA_USAGE.md).

## App API routes (`src/app/api`)

| Method | Route | Does |
| --- | --- | --- |
| POST | `/api/live/screen` | `/ask` research agent. NDJSON events: `start`, `thinking`, `plan`, `tool_call`, `tool_result`, `verify`, `final`. With no model key it returns 503 `model_unavailable`; with no Crustdata key, 503 `error` |
| POST, GET | `/api/sourcing/run` | `/agent` deterministic sourcing. NDJSON of plan / step / row / dropped / done. `GET ?q=` is for quick checks |
| GET | `/api/live/research` | Full company research for the deal page |
| GET | `/api/live/company` | Identify + enrich one company (`no_match` is an explicit state) |
| GET | `/api/live/people` | Founders for a company (accepts a domain or a company id) |
| GET | `/api/live/person` | Person enrich by LinkedIn URL |
| GET | `/api/live/jobs` | Open roles (`/job/search`) |
| GET | `/api/live/news` | Live web search, with results filtered to the company |
| GET | `/api/live/comps` | Comparable companies (`/company/search`) |
| GET | `/api/deals/:id/numbers` | Deal numbers as `ComputedField`s (uncited values are withheld) |
| GET | `/api/deals/:id/valuation` | Explainable valuation fields, or unavailable with reasons |
| GET | `/api/deals/:id/decisions` | Decision contract. See [08](08-decisions-contract.md) |
| GET, POST | `/api/exceptions` | List exception items and runs; raise items |
| GET, POST | `/api/exceptions/:id` | Read one item; approve / reject / edit it |
| GET, POST | `/api/memory/events` | Organizational memory event log (Postgres, otherwise 503) |
| GET | `/api/memory/stream` | SSE stream of memory events |
| GET | `/api/connectors/gmail/threads` | Gmail threads (read only) |
| GET, POST | `/api/connectors/calendar/events` | List upcoming events. POST builds an invite: dry-run by default (`wouldSend`); in live mode it inserts with `sendUpdates=none` |
| DELETE | `/api/connectors/calendar/events/:id` | Remove a calendar event |
| GET | `/api/integrations/connectors` | Connector health (Crustdata credits, ElevenLabs, Google). Shows env var names, never values |
| GET, POST | `/api/voice/brief` | Spoken brief text for a screen, built from the facts on that screen |
| POST | `/api/voice/tts` | ElevenLabs text to speech (server-side key) |
| POST | `/api/voice/stt` | ElevenLabs speech to text (Scribe) |
| GET | `/api/voice/agent-session` | Signed URL for the conversational voice session (needs `ELEVENLABS_AGENT_ID`) |

## Crustdata endpoints used

Every call goes through one client: `src/lib/crustdata/client.ts` → `http.ts`. Header `x-api-version: 2025-11-01`, a
rate limiter per route, bounded retry, a response cache (repeats cost 0 credits), and one log line per billed call.

| Endpoint | Used by | Credits (live-measured / documented) |
| --- | --- | --- |
| `POST /company/identify` | Deal, did-you-mean (`src/lib/live/resolve.ts`), `/agent` name lookup, `/ask` `identify_company` | 0 |
| `POST /company/enrich` | Deal, `/agent` verify step, `/ask` `enrich_companies`, `company_signals` | 2 per company |
| `POST /company/search` | Deal comparables, `/agent` search + relax, `/ask` `search_companies` | 0.03/row base, ≈0.23/row with funding fields |
| `POST /person/search` | Deal founders, `/agent` founders step, `/ask` `search_people`, `find_founders` | ≈0.13/row (experience filter), ≈0.23/row with history |
| `POST /person/enrich` | Person page, `/agent` past employers, `/ask` `enrich_person` | 1 per profile |
| `POST /job/search` | Deal open roles, `/ask` `search_jobs` (not in `/agent`) | 0.03/row |
| `POST /web/search/live` | Deal live web, `/ask` `web_search` | 1 |
| `GET /account/credits` | Settings › Connectors health | 0 |
| `POST/GET/DELETE /watch/company…` | Client only (`watchCompany`, `getWatchRuns`, `deleteWatch`); nothing calls them yet | 0 to create, 5 per notification |

**Coverage:** 7 of the 8 Crustdata data APIs, plus `/account/credits`. Not used: watchers (company, person, job), the
MCP server, `/web/enrich/live`, autocomplete, person identify, `/account/endpoints`.

**Measured costs:**

| Flow | Credits |
| --- | --- |
| Fresh deal research on e2b.dev (identify 0, enrich 2, person search 0.66, job search 0.75, web search 1, company search 1.15) | 5.56 |
| The same research, repeated (cache) | 0 |
| Person page | 1 |
| `/ask` live runs (60-credit cap per run) | India B2B founders ≈54, US fintech ≈51, EU climate ex-Google founders ≈20 |
| `/agent` run | Shown per step and in total in the trace. One run of the deck request: 33.9 credits, 14 calls |

**Request-shape lessons** (README §5): always send `fields` on enrich, because without it you get `basic_info` only and
still pay 2 credits. One denied field (`technographics`) returns 403 for the whole call, so `enrich-fields.ts` holds an
allow-list. `hiring.*` is null on this plan, so open roles come from `/job/search`. Search bodies must use the
documented filter tree `{op, conditions:[{field,type,value}]}`.
