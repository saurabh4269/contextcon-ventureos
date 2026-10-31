# Deal Desk UI — server API (this repo)

All routes are Next.js route handlers (`runtime = nodejs`, `dynamic = force-dynamic`, `cache-control: no-store`).
Secrets are read from server env only and never appear in responses or logs.

> **Contract source.** The `ComputedField` shape and `/api/deals/:id/{numbers,valuation}` follow the builder's
> explainable-numbers contract (builder repo `builder-main` @ a5330b1, documented in **its** `docs/API.md`). Once that
> branch lands, the builder's doc is authoritative; the routes here are an interim implementation designed to be
> swapped by replacing `src/lib/numbers/*` with calls to the builder backend. Assumptions we made are listed at the end.

## Data rules

There is no demo mode: every route serves live data or an explicit failure (`not_connected` 503, `unavailable` 503,
`error` 502, `no_match`). Money values are `{ amount, currency }` (ISO 4217); times are UTC ISO strings (the UI renders
IST). Outbound actions honour `OUTBOUND_MODE` (default `dry_run`).

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
| `fundingTotal` | Money `{amount, currency:"USD"}` | `…funding.total_investment_usd` |
| `lastFunding` | Money `{amount, currency:"USD"}` | `…funding.last_round_amount_usd` |
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

### `GET /api/live/company?domain=` → `{status:"ok", company, identify, enrich}` | `{status:"no_match", domain, identify, message, suggestions, suggest}` (identify 0 + enrich 2; "did you mean" suggestions on no_match, never auto-picked — also on `/api/live/research`)
### `GET /api/live/people?companyId=` (or `domain=` / `company=`) → `LiveCall<{ total, people: LivePerson[] }>` (founders; ≈0.23/row, limit 5)
### `GET /api/live/person?linkedin=https://www.linkedin.com/in/<handle>` → `{status:"ok", person, call}` | `{status:"no_match", linkedinUrl, call}` (1 credit)
### `GET /api/live/jobs?companyId=` (or `domain=` / `company=`) → `LiveCall<{ total, listings[], byCategory[] }>` (0.03/row, limit 25)
### `GET /api/live/news?q=&mention=` (or `domain=` / `company=`) → `LiveCall<{ query, results[] }>` (1 credit). Results not mentioning `mention` are dropped (live web results for short names are noisy). A domain is resolved to the company name (identify, 0) and searched as `"<name>"` with `mention=<name>`; a plain name is searched directly.
### `GET /api/live/comps?companyId=&q=` (or `domain=` / `company=`, `q` optional) → `LiveCall<LiveComp[]>` (ranked company search, target excluded). Without `q` the description comes from identify + enrich (+2 credits, `enrich` call included).

`domain=` / `company=` (a domain, URL or company name in any script, ≤ 200 chars) on people/jobs/comps/news: messy input is
normalised (case, whitespace, scheme/`www.`/path, invisible characters, IDN → punycode) and resolved with
`/company/identify` (0 credits); the response is the route's usual body plus `resolved: { companyId, name, domain, via:
"domain"|"name", identify }`. Never guessed: a name is accepted only when exactly one candidate has that exact name;
otherwise HTTP 200 `{ status: "no_match"|"ambiguous", input, message, suggestions: [{ companyId, name, domain,
confidence }], calls }` (an unknown domain gets "did you mean" suggestions from a name identify on its first label).
A broken domain (`strpe..com`, `stripe,com`) is a 400 `{ status:"error", message, suggestion: "strpe.com" }`.

Failures, retries, the circuit breaker, stale-cache fallback ("cached at … IST"), per-route deadlines and the outage
drill are described in [ROBUSTNESS.md](ROBUSTNESS.md). Failure bodies: `{ status: "error", message, upstreamStatus?, retryable? }`.

### `GET /api/deals/:id/numbers`

`{ id, source: "crustdata", fields }` with one `ComputedField` per key:
`fitScore, criterionSector, criterionStage, criterionGeo, criterionCheckSize, criterionMemory, returnMultipleLow,
returnMultipleHigh, compsMedianMultiple, growthYoY, headcountLatest, lastFundingUsdM, diligenceVerdict, icMemoArrUsedM,
icMemoValuation, icMemoCompsLine`.

* id = company domain: `headcountLatest`, `growthYoY`, `lastFundingUsdM` are computed from Crustdata as above; every
  other key is `unavailable` with the reason (builder pipeline: data-room ingest, firm mandate, pricing/LLM).
  Comparable-company *multiples* are unavailable because Crustdata has no revenue/valuation multiples.
* 404 for an id that does not exist in the current mode (`{status:"error"}`) or an unknown domain (`{status:"no_match"}`);
  503/502 as above.

### `GET /api/deals/:id/valuation`

`{ id, source, explainable: { low, high, cap, ask, returnMultipleLow, returnMultipleHigh, compsMedianMultiple } }`
(each a `ComputedField`). Live: all unavailable (needs verified revenue + pricing model).

### `GET /api/integrations/connectors[?fresh=1]`

Real status for the connectors Deal Desk actually integrates; catalogue tiles (Affinity, Attio, Carta, PitchBook, …) are
UI-only and not listed. Health results are cached 5 minutes per process (`fresh=1` bypasses).

```ts
{ checkedAt: string, connectors: {
    id: "crustdata"|"llm"|"agentmail"|"slack"|"fireflies"|"elevenlabs"|"gmail"|"calendar",
    name: string,
    status: "connected" | "not_configured" | "error",
    mode: "live_check" | "env",
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

Status never comes from timers or fixtures.

## Assumptions vs the builder contract

1. `inputs` is an array of `{ name, value }` (extra keys allowed); `citations` entries allow extra keys.
2. Numbers are plain JSON numbers (growth in percent); **money is `{amount, currency}`** in full units — the builder key
   names `lastFundingUsdM` / `icMemoArrUsedM` are kept for compatibility, but their values are Money objects (trust rule 4).
3. Deal ids: the builder uses its DB deal ids; here deal ids are company domains. A swap only
   needs an id→deal mapping on the UI side.
4. `/valuation` returns only `{ id, source, dataMode, explainable }`; the builder's response also carries its full
   valuation object, which this build does not have.

## Memory (organizational memory)

Postgres table `dealdesk_memory_events` (created on first use) when `DATABASE_URL` is set; otherwise every memory route
answers **503** `{status:"unavailable", reason:"memory store not configured (DATABASE_URL)"}` — no in-memory fallback.

* `POST /api/memory/events` `{kind, actor:{type:"user"|"agent"|"system", id?, name?}, subject?:{type,id,label?}, summary, data?, source}`
  → 201 `{status:"ok", event}`; 400 on invalid input (`kind` is a dotted verb, `data` ≤ 8 KB).
* `GET /api/memory/events?since=<id>&limit=<1..200>` → `{status:"ok", events: MemoryEvent[], cursor}` (oldest first;
  without `since`, the latest `limit`). `MemoryEvent = input + {id, at (UTC ISO)}`.
* `GET /api/memory/stream?since=<id>` → SSE, `event: memory` per new event (server polls every 2 s).

Recorded kinds: `research.run`, `person.enriched`, `connector.check` (only checks that ran), `deal.opened`,
`person.opened`, `signal.action`, `note.added`, `access.requested`, `greeting.generated`, `greeting.played`,
`assistant.brief`, `assistant.asked`, `meeting.dry_run`, `meeting.booked`, `meeting.deleted`.
The builder implements the same contract on its main; this repo only stores/lists.

## Google (read-only in the event build)

Server-side OAuth refresh (`GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`); access tokens cached in memory. Errors:
503 `not_connected` · 401 `{code:"expired"}` ("Google connection expired — reconnect") · 403 `forbidden` · 502.

* `GET /api/connectors/gmail/threads?since=<ISO>&max=<1..25>` → `{status:"ok", since, threads:[{id, from, fromAddress, subject, lastMessageAt, messages, unread}], estimate}` (INBOX, `format=metadata`).
* `GET /api/connectors/calendar/events?max=<1..25>` → `{status:"ok", events:[{id, summary, start, end, allDay, attendees, link}]}` (primary, from now).
* `POST /api/connectors/calendar/events {summary, start, end, description?, attendees?}` → with `OUTBOUND_MODE=dry_run`
  (default): 200 `{status:"ok", transport:"dry_run", label, wouldSend}`; live: 201 `{transport:"live", event}` (`sendUpdates=none`).
* `DELETE /api/connectors/calendar/events/:id` → 204, or 410 if already gone.

## Voice

* `POST /api/voice/tts {text ≤ 1200}` → `audio/mpeg` stream (ElevenLabs `/v1/text-to-speech/{voice}/stream`, model
  `eleven_flash_v2_5`, voice `ELEVENLABS_VOICE_ID` default `nPczCjzI2devNBz1zQrb`). `?timestamps=1` → `application/x-ndjson`
  chunks `{audio_base64, alignment{characters, character_start_times_seconds, …}}` (cumulative times; used for exact
  captions). 400 bad input · 503 `not_connected` · 502 `{upstreamStatus, message}`.
* `GET /api/voice/brief?screen=<id>&subject=<domain|linkedin>` / `POST {screen, subject?, question}` →
  `{status:"ok", text, composer:"deterministic"|"llm", llmError?, sources:[{label, ref}], facts, generatedAt}`.
  `screen=today` is the greeting (memory since the last `greeting.played`, Gmail threads since then, next meeting,
  connector issues, latest deal); other screens get a line about their subject. Without an AI key, the text is composed
  deterministically from those facts and questions get an honest "no AI model connected" reply.

## Speech-to-text

* `POST /api/voice/stt` (multipart: `file` = audio blob, `durationMs?` = client-measured length, `language?` = ISO 639)
  → 200 `{text, language, durationMs, raw, languageProbability, source}`. Upstream: ElevenLabs `POST /v1/speech-to-text`,
  model `scribe_v2` (override `ELEVENLABS_STT_MODEL_ID`), domain `keyterms` (Crustdata, B2B, Series A, …; disable with
  `ELEVENLABS_STT_KEYTERMS=0`). `text` is `raw` after a small post-correction for domain words (`correctTranscript` in
  `src/lib/voice/stt.ts`); `raw` is kept so the correction is visible.
* Limits: webm / ogg / mp4 / mpeg / wav only, ≥ 200 bytes, ≤ 4 MB, ≤ 32 s.
* Errors (JSON `{status:"error"|"not_connected", code, message, source}`): 400 `bad_input` · 413 `too_large` / `too_long` ·
  415 `unsupported_type` · 503 `not_connected` · 402 `quota_exceeded` · 429 `rate_limited` · 422 `bad_audio` ·
  502 `key_invalid` / `permission_denied` / `upstream_error`.

## Sourcing agent <!-- VERIFY: every line of this section against src/app/api/agent/run and src/lib/agent -->

* `POST /api/agent/run {request: string}` → `application/x-ndjson`, one JSON object per line as each step happens:
  - `{type:"interpretation", chips:[{key, label, value, source:"parsed"|"default"}], unparsed:[…]}`
  - `{type:"step", id, label, status:"running"|"ok"|"no_match"|"error"|"skipped", call?: LiveCall, note?}` for
    `search` (`POST /company/search`), `relax` (which filter was loosened, and why), `verify` (`POST /company/enrich`,
    growth recomputed from `headcount.timeseries`), `founders` (`POST /person/search`), `history` (`POST /person/enrich`)
  - `{type:"result", rows:[{company, fields: Record<key, ComputedField>, founders:[…]}], creditsUsed}`
  - `{type:"error", message}` on a failure that stops the run (no key → `not_connected`).
* No LLM: parsing is deterministic; the chips are the full statement of what was understood.
* Exports (memo markdown, CSV) are built from the `result` rows; every row keeps its citations.
* Each run is appended to organizational memory when `DATABASE_URL` is set.
