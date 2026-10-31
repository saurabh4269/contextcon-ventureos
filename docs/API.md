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

### Review queue (exceptions for a person) — `/review`

Agents auto-complete everything they can verify and raise an item only when a person is needed: ambiguous company
match, missing or conflicting data, a credit threshold, low confidence, an incomplete run, and every outbound send
(approve = dry run only; `OUTBOUND_MODE=live` is ignored here). Storage: a JSON file on the server
(`.cache/exceptions.json`, or `EXCEPTIONS_FILE`; `EXCEPTIONS_FILE=memory` for memory only) because `DATABASE_URL` is
unset; the response's `storage.note` says so.

- `GET /api/exceptions[?status=open|all][&run=<runId>]` → `{ storage, open, items, runs }` (any other `status` is 400); `?count=1` → `{ open }` (nav badge)
- `POST /api/exceptions { item: { kind, key, title, reason, evidence[], subject?, proposed?, runId?, target? } }` → raise one
  item (idempotent per open `key`; 400 on an unknown kind)
- `POST /api/exceptions/:id { action: "approve"|"reject"|"edit", note?, value? }` → `{ status:"ok", item, run, open }`;
  404 unknown id, 409 already resolved, 400 bad action / empty edit / a value the decision cannot use (a fit score that is not
  0..100, ARR that is not a positive USD amount): the item stays open. The last open item of a run finishes the run; a run's
  item list and status are recomputed from its items on every load.
- In-process seams: `raiseException()` / `exceptionStore().recordRun()` (src/lib/exceptions/store.ts), item builders
  `ambiguousMatch`, `missingData`, `conflictingData`, `creditThreshold`, `outboundSend` (src/lib/exceptions/raise.ts), and
  run rules `fromSourcingRun` (wired into `/api/sourcing/run`) and `fromScreenResult` (for the LLM screening loop).

### `GET /api/deals/:id/numbers`

`{ id, source: "crustdata", fields }` with one `ComputedField` per key:
`fitScore, criterionSector, criterionStage, criterionGeo, criterionCheckSize, criterionMemory, returnMultipleLow,
returnMultipleHigh, compsMedianMultiple, growthYoY, headcountLatest, lastFundingUsdM, diligenceVerdict, icMemoArrUsedM,
icMemoValuation, icMemoCompsLine`.

* id = company domain: `headcountLatest`, `growthYoY`, `lastFundingUsdM` are computed from Crustdata as above; every
  other key is computed locally from the firm mandate, live Crustdata research and peers (see **Local decision
  computation** below), or is `unavailable` with the specific missing input.
* 404 for an id that does not exist in the current mode (`{status:"error"}`) or an unknown domain (`{status:"no_match"}`);
  503/502 as above.

### `GET /api/deals/:id/valuation`

`{ id, source, explainable: { low, high, cap, ask, returnMultipleLow, returnMultipleHigh, compsMedianMultiple } }`
(each a `ComputedField`). `low`/`high`/`returnMultiple*`/`compsMedianMultiple` are computed locally (below); `cap` and
`ask` are unavailable (they come from a term sheet / pitch, which this build does not ingest).

### `GET /api/deals/:id/decisions`

Builder (Origin `main` e28ea49) decision contract, ported: `{ dealId, companyDomain, source: "crustdata" |
"crustdata+builder", decisions, endpoints, fields, builder? }`. `decisions` has one `ComputedField` per key —
`fitScore, screenerVerdict, valuationRange, returnMultipleLow, returnMultipleHigh, compsMedianMultiple,
diligenceVerdict, icMemoArrUsedM, icMemoValuation, icMemoCompsLine`; `endpoints[key]` names the route that computed it;
`fields` = every `/numbers` key + the decisions + `valuationLow/High/Cap, founderAsk`. Used by the deal page (fit tile,
Decision · valuation section) and `/memo`.

* id = company domain. Every decision is computed locally (see **Local decision computation**); one whose input is
  missing is `unavailable` with that reason. `screenerVerdict` comes from the same computation.
* `DEALDESK_BUILDER_URL` (optional override): base URL of the builder deployment. Its decisions replace the local ones,
  only when `ok` with citations; any field whose citations/inputs/method mention fixture/sample/demo/seed/mock
  data is dropped and the local value stays. Citations are re-anchored to `GET /api/deals/:id/decisions` + `fields.<key>.citations[i]` + our
  retrieval time, then `enforceCited` runs. `builder.status`: `used` | `not_configured` | `unavailable` (+ reason).
  8 s timeout; on any error the local result is returned.
* Review queue: `fitScore, screenerVerdict, valuationRange, diligenceVerdict, icMemoArrUsedM, icMemoValuation,
  icMemoCompsLine` that are `unavailable` are raised as `missing_data`, and `ok` ones computed with an unavailable/empty
  input as `low_confidence`, on run `deal:<domain>:decisions` (source `deal`, idempotent per key; resolved keys are not
  re-raised). A person's **edit** fills the decision as `ok`, cited `{ source: "Deal Desk review queue (entered by you)",
  endpoint: "POST /api/exceptions/<id>", path: "resolution.value", retrievedAt }`; rejecting a low-confidence decision
  withholds it. `review: { runId, href, open[], resolved[] }` is on the response; `?review=0` reads without recording.
  The deal page's fit and screener stats open the sources panel with each mandate criterion (`whyFromDecision`).

### Local decision computation (`src/lib/numbers/local.ts`, wired in `src/lib/numbers/resolve.ts`)

Per deal: `researchCompany` (identify + enrich + founders/jobs/news/comps), `searchPeers` (below), the firm mandate
(`GET /api/settings/mandate`) and firm memory (review-queue items on the domain). No fixtures, no built-in numbers.

| Key | Computation | Unavailable when |
| --- | --- | --- |
| `criterionSector` | a mandate sector appears in the company's Crustdata industries/categories/description | no mandate sectors; no taxonomy |
| `criterionStage` | `funding.last_round_type` ∈ mandate stages | no stages; no round type |
| `criterionGeo` | country or HQ matches a mandate geo (ISO3 like `IND` or a name) | no geos; no HQ/country |
| `criterionCheckSize` | met when last round ≥ the firm's max (else min) check | no check size; no round amount |
| `criterionMemory` | past resolved review items on the domain; not met if most were rejected; neutral (not scored) with no history | — |
| `fitScore` | 100 × met ÷ scored criteria (unset/unavailable criteria are named, not scored) | nothing scorable (e.g. no mandate) |
| `screenerVerdict` | Decline if sector/stage/geo not met; Review if any other criterion not met; else Advance | no fit score |
| `compsMedianMultiple` | median over peers of (last round ÷ dilution-prior midpoint) ÷ revenue-estimate midpoint (two decimals below 1×) | no dilution prior; < 2 peers with round + revenue; peer search error |
| `valuationLow/High`, `valuationRange` | company revenue estimate (low/high) × peer median; fallback last round ÷ dilution prior (high/low) | no prior; no revenue and no round |
| `returnMultipleLow/High` | the firm's target-return prior — an **assumption**, labelled as such | prior unset |
| `diligenceVerdict` | Do not proceed if screener Decline; else Proceed with flags (no founders found, headcount down YoY, last round > 2 years) or Proceed to diligence | no screener verdict |
| `icMemoArrUsedM` | midpoint of Crustdata `revenue.estimated`, USD M (an estimate, not reported ARR) | no revenue estimate |
| `icMemoValuation` | the valuation range | range unavailable |
| `icMemoCompsLine` | peer list + median multiple | no peers; peer search error |

Firm priors are cited `{ source: "Firm mandate (entered in Settings)", endpoint: "GET /api/settings/mandate", path:
"priors.…", note: "Assumption: …" }`; Crustdata inputs cite the call and JSON path.

`searchPeers` (`src/lib/live/research.ts`): live `POST /company/search` with `taxonomy.professional_network_industry =
<first industry>`, `funding.last_round_type = <stage>`, `locations.country = <country>`, `funding.last_round_amount_usd
=> 1`, sorted by last fundraise date, limit 11. If fewer than 3 peers come back it relaxes geography, then stage
(`matched` says which constraints held). Up to 4 searches per deal.

### `GET /api/settings/mandate` · `PUT /api/settings/mandate`

The firm mandate and priors (UI: `/settings/mandate`). Stored as JSON in `.cache/mandate.json` (`MANDATE_FILE` overrides
the path; `MANDATE_FILE=memory` keeps it in process, for tests). Nothing has a default: unset fields stay unset and
every decision that needs them says so.

```json
{ "sectors": ["Fintech"], "stages": ["seed", "series_a"], "geos": ["India", "IND"],
  "checkSizeUsd": { "min": 250000, "max": 2000000 },
  "priors": { "dilutionPct": { "low": 15, "high": 25 }, "returnMultiple": { "low": 3, "high": 10 } } }
```

* `GET` → `{ mandate: {…, updatedAt}, unset: ["sectors" | "stages" | "geographies" | "check size"] }`.
* `PUT` (full replace) → same shape. Lists accept arrays or comma strings (trimmed, deduped, max 30); numbers must be
  positive; ranges need both ends with low ≤ high; dilution ≤ 100. Invalid body → 400 `{ status: "error", message }`.

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

## Deal workflow (/workflow)

One deal through ten steps (intake, screen, data room, research, schedule, transcript, valuation, memo, pipeline, memory),
kept in the durable store (`workflows` namespace; Postgres with `DATABASE_URL`, else JSON files, "not durable" on Vercel).
Code: `src/lib/workflow/` (run.ts orchestrator, actions.ts person actions, public.ts browser view).

- `GET /api/workflow` → `{ deals: Deal[], storage }`
- `POST /api/workflow` `{from:"gmail", messageId}` | `{from:"ask", domain, name?}` → `201 {id}`; the run continues after the
  response (`next/server` `after()`, `maxDuration` 300 s).
- `GET /api/workflow/inbox` → `{ query, candidates:[{id, subject, date, domain}], hidden }`: read-only Gmail search
  `in:inbox newer_than:90d (pitch OR deck OR raising OR "data room" OR intro OR investment)` (`INBOX_QUERY`). Only
  pitch-like subjects that name a company domain are listed; no sender is shown (the deploy has no sign-in).
- `GET /api/workflow/:id` → Deal, public view: addresses masked to their domain, no email body (poll while `running`).
- `POST /api/workflow/:id` actions: `approve {step:"dataroom"|"schedule"}`, `transcript {text, source?, name?}`, `skip_transcript`,
  `override_screen`, `decide {verdict:"invest"|"pass", note?}`, `regenerate_memo`, `resume`. Every action resumes the run.
  `approve` sends (Gmail send / Calendar insert on the primary calendar, no attendees, sendUpdates=none) only when
  `outboundMode()==="live"` AND every recipient is on `DEMO_RECIPIENT_ALLOWLIST`; otherwise it records the dry run.
  A live approve is two-phase and at-most-once: it persists `draft.sending`, sends, then records `approved`. A request that sees
  `sending` answers 409 and sends nothing. After a send that failed with a 4xx the mark clears; after any other error (timeout,
  5xx) the outcome is unknown and the mark stays until `resolve_send {step, resolution:"confirm_sent"|"discard_send"}`.
  Actions are serialised per deal: a deal that is running answers 409; an action that is not legal in the deal's state (decide
  twice, transcript after the decision, anything but `resolve_send`/`resume` on a Passed or Portfolio deal) answers 400.
- Stage moves are mirrored to the deal-stage store (`GET /api/pipeline/deals` rows carry `stage`, `owner`, `workflowId`).
- Claims ("team of 60", "grew 50% in 6 months", founded, raised) are verified against Crustdata within a tolerance
  (`CLAIM_TOLERANCE`: headcount and raised 10%, growth 25%); outside it they are contradicted, with the Crustdata citation.
- Screen credits are the credits the uncached calls billed, rounded to 2 decimals; a cached step says so.

## Assumptions vs the builder contract

1. `inputs` is an array of `{ name, value }` (extra keys allowed); `citations` entries allow extra keys.
2. Numbers are plain JSON numbers (growth in percent); **money is `{amount, currency}`** in full units — the builder key
   names `lastFundingUsdM` / `icMemoArrUsedM` are kept for compatibility, but their values are Money objects (trust rule 4).
3. Deal ids: the builder uses its DB deal ids; here deal ids are company domains. A swap only
   needs an id→deal mapping on the UI side.
4. `/valuation` returns only `{ id, source, dataMode, explainable }`; the builder's response also carries its full
   valuation object, which this build does not have.

## Memory (organizational memory)

Postgres table `dealdesk_memory_events` (created on first use) when `DATABASE_URL` is set; otherwise the durable store's
documents (files, labelled `storage.durable:false`; see `GET /api/storage`). A store read/write failure is **502**
`{status:"error", message}`.

* `POST /api/memory/events` `{kind, actor:{type:"user"|"agent"|"system", id?, name?}, subject?:{type,id,label?}, summary, data?, source}`
  → 201 `{status:"ok", event}`; 400 on invalid input (`kind` is a dotted verb, `data` ≤ 8 KB).
* `GET /api/memory/events?since=<id>&limit=<1..500>` → `{status:"ok", events: MemoryEvent[], cursor}` (oldest first;
  without `since`, the latest `limit`). `MemoryEvent = input + {id, at (UTC ISO)}`.
* `GET /api/memory/stream?since=<id>` → SSE, `event: memory` per new event (server polls every 2 s).

Recorded kinds: `research.run`, `person.enriched`, `connector.check` (only checks that ran), `deal.opened`,
`person.opened`, `signal.action`, `note.added`, `access.requested`, `greeting.generated`, `greeting.played`,
`assistant.brief`, `assistant.asked`, `meeting.dry_run`, `meeting.booked`, `meeting.deleted`.
The builder implements the same contract on its main; this repo only stores/lists.

## Google (read-only in the event build)

Server-side OAuth refresh (`GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`); access tokens cached in memory. Errors:
503 `not_connected` · 401 `{code:"expired"}` ("Google connection expired — reconnect") · 403 `forbidden` · 502.

* `GET /api/connectors/gmail/threads?since=<ISO>&max=<1..25>` → `{status:"ok", since, threads:[{id, from, fromAddress, subject, snippet, companyDomain, lastMessageAt, messages, unread}], estimate}` (INBOX, `format=metadata`). `companyDomain` is the sender host or a website named in the subject/snippet; null for personal mail with no domain.
* `GET /api/pipeline/deals` → `{status:"ok", deals:[{domain, name, href, source:"inbound"|"opened"|"researched", at}], sources:{inbox, memory}}`. Live inbox + memory only; empty when neither has a company.
* `GET /api/connectors/calendar/events?max=<1..25>` → `{status:"ok", events:[{id, summary, start, end, allDay, attendees, link}]}` (primary, from now).
* `POST /api/connectors/calendar/events {summary, start, end, description?, attendees?}` → with `OUTBOUND_MODE=dry_run`
  (default): 200 `{status:"ok", transport:"dry_run", label, wouldSend}`; live: 201 `{transport:"live", event}` (`sendUpdates=none`).
* `DELETE /api/connectors/calendar/events/:id` → 204, or 410 if already gone, when `OUTBOUND_MODE=live`. In dry run (default) nothing is deleted: 200 `{transport:"dry_run", wouldSend:{eventId}}`.

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

## Research agent (LLM screener)

* `POST /api/live/screen {query: string}` (≤ 2000 chars) → `application/x-ndjson`, one `ScreenEvent` per line
  (`src/lib/agent/contract.ts`): `start {query, model}` · `thinking {step}` · `plan {step, text}` (plan, verification and
  relax/re-query narration) · `tool_call {ref, tool, endpoint, input, estCredits}` · `tool_result {ref, status, rows,
  totalCount, creditsUsed, ms, error?}` · `verify {text, stats}` · `final {result: ScreenResult}`.
* `ScreenResult`: `rows[]` (`name`, `cells[]`, `people[]` with `prior[]` roles), each value a `ScreenCell {value, status:
  verified|corrected|unavailable, citation {ref, method, endpoint, path, retrievedAt}, reason?, claimed?}`; `filters[]`
  `{requirement, applied: server|client|unavailable, field, detail, relaxed?}`; `caveats`, `calls` (ledger with body,
  credits, retrieval time), `credits {used, cap}`, `timings`, `citationStats`.
* Failures: no model key → HTTP 503, single `{type:"model_unavailable", message}` line; no `CRUSTDATA_API_KEY` → 503,
  single `error` line; bad body → 400 `error` line; model API failure mid-run → `error` event. Env: `OPENAI_API_KEY`,
  `OPENAI_MODEL` (default `gpt-6.1-sol`), `OPENAI_REASONING_EFFORT` (default `high`); `ANTHROPIC_API_KEY` +
  `DEALDESK_LLM_MODEL` take precedence when set.

## Sourcing agent

Code: `src/app/api/sourcing/run/route.ts`, `src/lib/sourcing/{parse,run,export,examples}.ts`, UI `src/live/agent/*` at `/agent?q=`.
(`src/lib/agent` and `POST /api/live/screen` are the LLM research agent above; when it reports `model_unavailable`,
`/ask` offers a one-tap fallback to this agent at `/agent?q=`.)

* `POST /api/sourcing/run {q: string}` (also `GET ?q=`) → `application/x-ndjson`, one `AgentEvent` per line
  (`src/lib/sourcing/run.ts`). 400 (JSON `{status:"error", message}`, no stream) when the body is not JSON or `q` is missing, blank or over 2000 characters.
  - `{type:"plan", runId, startedAt, parse}`: `parse.kind` is `search` (plan with `interpretation[]` chips
    `{key,label,phrase,kind:"filter"|"query"|"output"|"default"|"assumption"|"correction"}` and `ignored[]` phrases),
    `company` or `refuse`.
  - `{type:"step", step:{id,label,tool,endpoint,status:"running"|"done"|"failed"|"skipped",startedAt,ms,credits,cachedCalls,calls,count,detail}}`
    for `parse`, `search`, `relax-<constraint>` (one constraint loosened per search, at most three), `verify`
    (`POST /company/enrich`), `founders` (`POST /person/search`), `person-enrich` (`POST /person/enrich`), `rank`, `memory`.
  - `{type:"row", row}` (upserted by `row.id` as founders arrive): `founded`, `hq`, `headcountNow`, `headcountThen`,
    `growth` (recomputed from `headcount.timeseries`), `funding`, `founders` are `ComputedField`s with citations
    (`endpoint`, `path`, `record`, `url`, `retrievedAt`, `cached`); plus `series`, `checks`, `relaxed`, `errors`.
  - `{type:"dropped", item:{id,name,domain,reason}}`: matched the search but failed verification.
  - Terminal: `{type:"done", summary:{sentence, requested, returned, dropped, relaxed[], rankingReason, credits, liveCalls, cachedCalls, failedCalls, ms, rowOrder}}`
    | `{type:"refuse", message, ignored}` | `{type:"redirect", href, label, reason}` (a single company → `/deal?domain=`)
    | `{type:"error", kind:"not_connected"|"upstream"|"bad_request", message}`.
* No LLM: parsing is deterministic; the chips are the full statement of what was understood. Too few matches → relax
  (disclosed in the chips' trace, the row and the summary); never padded.
* 403 field denial: search/enrich retry with the permitted fields and say so in the step detail. 429: `http.ts` backoff.
  One company's failure stays on its row (`errors[]`).
* Exports (memo markdown, CSV) are built client-side from the rows (`src/lib/sourcing/export.ts`); every value keeps its citation.
* Each run is appended to organizational memory (`agent.run`) when `DATABASE_URL` is set; otherwise the `memory` step is `skipped` with the reason.
