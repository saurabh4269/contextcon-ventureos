# Architecture

![How Deal Desk works](assets/architecture.png)

Sources: `docs/assets/architecture.mmd` and `docs/architecture/architecture.mmd` (Mermaid). The rendered PNG/SVG
predate the merges: they do not show the LLM research agent (`/ask`), the exception queue (`/review`) or STT. The tables
below are current.

## Layers

| # | Layer | In code |
| --- | --- | --- |
| 01 | Sources: Crustdata, Gmail, Google Calendar, ElevenLabs | `src/lib/crustdata`, `src/lib/google`, `src/lib/voice` |
| 02 | Agents: one LLM research agent; the rest deterministic functions | `src/lib/agent` (LLM), `src/lib/sourcing`, `src/lib/live/research.ts`, `src/lib/numbers`, `src/lib/voice`, `src/lib/exceptions` |
| 03 | Firm memory: append-only event log | `src/lib/memory` (Postgres via `DATABASE_URL`, else 503) |
| 04 | Trust layer: `ComputedField`, citation enforcement, resilience, money, IST, dry-run | `src/lib/fields.ts`, `src/lib/provenance.ts`, `src/lib/agent/cite.ts`, `src/lib/crustdata/http.ts`, `src/lib/format`, `src/lib/outbound.ts`, `src/test/guards.test.ts` |
| 05 | Screens | `src/app/*` → `src/live/*` → `@port/*` UI kit |

Request path for every live screen:

```
page (src/app/x/page.tsx)
  → client wrapper (src/live/x.tsx) → useLiveJson("/api/…")
    → route handler (src/app/api/…/route.ts, liveRoute wrapper: 400 / 503 / 502)
      → orchestration (src/lib/live/research.ts or src/lib/sourcing/*)
        → CrustdataClient (cache → rate limiter → fetch with x-api-version → X-Credits-Used)
      → normalise + ComputedFields (src/lib/live/normalize.ts, src/lib/numbers/*)
      → recordMemory(...)
  → adapter (src/lib/adapters/*) → @port/screens/* (presentational)
```

## Data flow per screen

| Route | Client wrapper | API | Upstream | Unavailable when |
| --- | --- | --- | --- | --- |
| `/ask` | `src/live/ask.tsx`, `src/live/screen/*` | `POST /api/live/screen` (NDJSON) | model-chosen tools: identify, enrich, company/person search, person enrich, job search, web search | no model key → 503 `model_unavailable` + link to `/agent?q=`; no Crustdata key |
| `/agent` | `src/live/agent/AgentScreen.tsx` | `POST /api/sourcing/run` (NDJSON) | `/company/search` → `/company/enrich` → `/person/search` → `/person/enrich` | no Crustdata key; no candidates (shown honestly, with the relaxation tried) |
| `/agents` | `src/app/agents/page.tsx` (static list) | — | lists the real agents with routes, endpoints, tools | — |
| `/review` | `src/live/review.tsx` | `GET/POST /api/exceptions`, `POST /api/exceptions/:id` | — (JSON file store; in-memory if the file is not writable, and says so) | — |
| `/deal?domain=` | `src/live/deal.tsx` | `GET /api/live/research`, `GET /api/deals/:id/valuation` | identify → enrich, then `/person/search`, `/job/search`, `/web/search/live`, `/company/search` in parallel | no key (503); `no_match`; valuation always unavailable (no pricing model) |
| `/person?linkedin=` | `src/live/person.tsx` | `GET /api/live/person` | `/person/enrich` | no key; `no_match` |
| `/memo?id=` | `src/live/memo.tsx` | `GET /api/deals/:id/numbers` | the same research run as the deal page (`src/lib/numbers/resolve.ts` → `researchCompany`; cached) | memo-only fields (fit, ARR, valuation) unavailable with reasons |
| `/today` | `src/live/today.tsx`, `voice/TodayVoice.tsx` | `/api/connectors/gmail/threads`, `/api/connectors/calendar/events`, `/api/voice/brief?screen=today`, `/api/voice/tts` | Gmail, Calendar, memory, ElevenLabs | Google not configured / token expired |
| `/settings` | `src/live/settings.tsx` | `GET /api/integrations/connectors` | free health calls | — |
| `/brain`, `/pipeline` | `UnavailablePage` + `src/live/memory.tsx` (+ `ResearchForm` on pipeline) | `/api/memory/events` | Postgres | no `DATABASE_URL` |
| `/portfolio`, `/mandates`, `/slack`, `/deal/room` | `UnavailablePage` | `/api/integrations/connectors` | — | always in this build (reason in `src/live/sources.ts`) |
| every screen but Today | `src/live/voice/FloatingVoice.tsx` | `/api/voice/brief`, `/api/voice/tts?timestamps=1` | ElevenLabs | no ElevenLabs key |

## The agents

| Agent | Input → output | Upstream calls | Failure behaviour |
| --- | --- | --- | --- |
| Research (LLM, `/ask`) | any request → plan → tool calls → verified, ranked table | model-chosen; 60-credit / 14-turn cap | every cited value resolved server-side (verified / corrected / unavailable); `model_unavailable` → `/agent` |
| Sourcing (`/agent`) | free-text request → ranked, cited company table + founders + memo/CSV | `/company/identify` (name lookups), `/company/search`, `/company/enrich`, `/person/search`, `/person/enrich` | each step streamed with status, latency, credits; too few results → relax one constraint with disclosure; no match → says so, nothing padded; exceptions → `/review` |
| Research | domain → `LiveCompany` + 6 `LiveCall`s + `ComputedField`s | identify, enrich, person search, job search, web search, company search | identify/enrich failure fails the request; other sub-calls fail individually |
| People | company id → founders; LinkedIn URL → profile | `/person/search`, `/person/enrich` | `no_match` vs error kept distinct |
| Numbers | raw responses → explainable fields | — | `unavailable` + reason, never a guess |
| Inbox | — → threads, events | Gmail, Calendar | 401 "expired — reconnect", 503 not connected |
| Voice | screen + facts → sentence → audio; audio → text | ElevenLabs TTS, STT | not_connected / quota / rate-limited reported as such |
| Memory | action → event | Postgres | 503 unavailable; never an in-memory fallback |
| Health | — → connector status | free endpoints | `not_configured` / `error` with detail |

Only the research agent (`/ask`) plans with an LLM, and its values are checked against Crustdata server-side. Spoken
briefs are composed from the same facts the screen shows; the greeting may be rephrased by the configured model without
adding facts. The ElevenLabs conversational session's tools only navigate.

## Sourcing agent pipeline (`src/lib/sourcing/run.ts`)

```
request text ─(STT optional)─▶ parse (deterministic, parse.ts) ─▶ "Understood" chips (read-only, with source phrase)
  ─▶ a bare company name? /company/identify ─▶ deal page
  ─▶ /company/search  filter tree: country, B2B software taxonomy, founded ≥ year, headcount growth
  ─▶ too few? relax one filter at a time, disclose which
  ─▶ /company/enrich  verify: recompute growth over the requested window from headcount.timeseries, cite both points
  ─▶ /person/search   founders at each company
  ─▶ /person/enrich   past employers
  ─▶ rank, cite every cell, stream NDJSON steps ─▶ table · memo.md · .csv · spoken summary
  ─▶ route exceptions (rules.ts fromSourcingRun) ─▶ /review
```
