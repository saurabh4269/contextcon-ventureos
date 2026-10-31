# Robustness and edge cases

How Deal Desk behaves when inputs are messy and upstreams fail. The rule throughout: **degrade to an honest
`unavailable` / error with a reason, or to the last good response clearly labelled — never crash, never invent, never
report an error as "no match".**

## Crustdata transport (`src/lib/crustdata/http.ts`, `client.ts`, `stale.ts`)

| Failure | What happens |
|---|---|
| 500 / 502 / 503 / 504 | Retried up to 2× with full-jitter exponential backoff (≈250 ms + 0–400 ms, then + 0–800 ms), **read endpoints only** |
| Timeout (30 s per attempt) / connection error | Same retries for reads. A write (`POST /watch/company`, `DELETE /watch/company/:id`) is never replayed once it may have reached Crustdata (any response, a reset, a body that dies mid-read); it is resent once only when the connection provably never opened (`ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`) |
| 2xx that is not JSON (HTML error page, truncated body, empty body) | Treated as an outage (retried), then `CrustdataMalformedResponseError`. Never parsed into data, never "no match" |
| 429 | Waits `Retry-After` / `X-RateLimit-Reset` (≤ 15 s total, ≤ 3 retries), then a 429 failure with `retry in N s` |
| 400 / 401 / 403 / 404 / 422 | Not retried: these are answers. 401/403 say "Crustdata rejected the request" so an operator fixes the key |
| Repeated outages on one route | **Circuit breaker** (per route, 4 consecutive outages — 5xx, timeouts, transport errors, malformed 2xx — → open 30 s). Calls fail fast instead of waiting on a dead upstream; one half-open trial call after the cooldown. 4xx and 429 never trip it |
| Crustdata down and a previous response exists | **Stale-cache fallback**: the last good response (up to 7 days old) is served with `meta.stale = true` and the note `Crustdata unavailable (HTTP 503); showing the response cached at 31 Oct 2026, 13:00 IST`. Its `retrievedAt` is the original fetch time, so every citation stays truthful. Answers (4xx) are never served stale |
| Slow everything | **Per-route deadline** (AsyncLocalStorage): every call made by a `/api/live/*` route (incl. retries and backoff) stops at 40 s (research: 55 s, under `maxDuration` 60). Parallel calls that run out of time become `unavailable` gaps; the rest of the run is still returned. The local rate limiter never waits past the deadline either |

Read endpoints (replayable): `/company/{identify,enrich,search,search/autocomplete}`, `/person/{identify,enrich,search,search/autocomplete}`,
`/job/search`, `/web/{search,enrich}/live`, and any `GET`. A replay after a timeout may bill a read twice; retries are bounded.

Where it shows: the deal page's signal graph adds a `cached · stale` chip (with the note) to any call served from the
stale cache, and each number's source line ends with the same "cached at … IST" note (`src/live/field.tsx`). Failure
bodies from `/api/live/*` are `{ status: "error", message, upstreamStatus?, retryable? }` (HTTP 502), e.g.
`Crustdata /company/enrich is unavailable after repeated failures; calls are paused until 13:45 IST. No data was invented.`

### Outage drill (for demos and operators)

`DEALDESK_SIMULATE_CRUSTDATA_OUTAGE=1` (off by default) makes every Crustdata call answer 503 inside the server — no
request leaves the box and no data is produced. With `DEALDESK_CACHE_DIR=.cache/crustdata` set (so the cache survives
the restart): open a deal (e.g. `/deal?domain=e2b.dev`), restart the dev server with the drill on, reload — the page renders
from the last good responses with `cached` chips and IST times; a company never looked up before shows an honest error.

## Input (`src/lib/live/normalize.ts`, `src/lib/live/resolve.ts`)

- **A company anywhere**: `/api/live/people`, `/jobs`, `/comps`, `/news` accept `companyId` (unchanged), `domain`, or
  `company` (domain, URL or name). Domains and names are resolved server-side with `/company/identify` (0 credits).
- **Messy input** is normalised: case, surrounding spaces, `https://www.x.com/about?…`, zero-width/control characters,
  internationalised domains (`bücher.de` → `xn--bcher-kva.de`).
- **Typos are never guessed silently**: `strpe..com` is a 400 with `suggestion: "strpe.com"`; an unknown domain
  (`strpe.com`) is a `no_match` with "did you mean" suggestions from an identify-by-name (`Stripe (stripe.com)`), also
  on `/api/live/company` and `/api/live/research` and as a chip on the deal page. A name with several exact matches is
  `ambiguous` — the caller picks.
- **Hostile input**: emoji-only, punctuation-only, empty, or > 200 characters → 400 with a message saying what to send.
  Non-English names (`रेज़रपे`, `株式会社メルカリ`) are valid names.

## Model calls (`src/lib/resilience/index.ts`, `model.ts`)

`withResilience(fn, opts)` — per-attempt timeout, total deadline, jittered retries, breaker, honest error classes
(`timeout`, `rate_limited`, `upstream_unavailable`, `circuit_open`, `auth`, `bad_request`, `not_found`,
`insufficient_credits`, `malformed_response`, `network`, `aborted`) with a short user message each.
`resilientModel(primary, { fallback })` wraps the agent's OpenAI/Anthropic `ModelClient`: retries outages, falls back
once to a second model on timeout/5xx/429/404, never on 401/403/400 (misconfiguration must surface), repairs
malformed tool-call JSON (code fences, trailing commas) and turns unrepairable or unknown tool calls into error
results for the loop instead of crashing it.

Merge seam (agent loop on `feature/nl-screener`, `src/app/api/live/screen/route.ts`): replace
`const model = modelFromEnv()` with `const primary = modelFromEnv(); const model = primary && resilientModel(primary, { fallback: null })`
(or a fast-model client once one exists), show `modelUnavailableMessage(e)` when `model.complete` throws, and answer
tool calls whose input has `__invalid_arguments` with an `isError` tool result.

## Money and time

Amounts are shown in the currency Crustdata returns (`fundingTotal` is USD per the field name
`total_investment_usd`; INR renders as `₹`, unknown codes as the code) — no FX conversion anywhere. Instants render in
IST (`31 Oct 2026, 13:21 IST`, with date rollover); calendar dates (`2024-03-15`) are not shifted.

## Tests

`npx vitest run src/lib/crustdata/resilience.test.ts src/lib/live/robustness.test.ts src/lib/live/routes-robustness.test.ts src/lib/live/resolve.test.ts src/lib/resilience src/lib/adapters/deal-robustness.test.ts`
— fault injection through `fetchImpl`: 400/401/403/404/422/429/500/502/503/504, timeouts, network errors, malformed and
empty bodies, write replay safety, deadline, breaker open/half-open, stale fallback (memory and file cache, corrupt
cache file), research runs with per-endpoint faults, unknown company, typo domains, emoji / non-English / 10 000-char
input, INR vs USD formatting and IST rendering.
