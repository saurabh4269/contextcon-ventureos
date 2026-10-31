# Architecture

![How Deal Desk works](assets/architecture.png)

Source: `docs/assets/architecture.mmd` (Mermaid, checked against the code). The PNG/SVG were rendered from the earlier
diagram and do not yet show the Sourcing agent or STT. <!-- VERIFY: re-render once the agent lands -->

## Layers

| # | Layer | In code |
| --- | --- | --- |
| 01 | Sources: Crustdata, Gmail, Google Calendar, ElevenLabs | `src/lib/crustdata`, `src/lib/google`, `src/lib/voice` |
| 02 | Agents: deterministic orchestration functions, no LLM | `src/lib/agent` <!-- VERIFY -->, `src/lib/live/research.ts`, `src/lib/numbers`, `src/lib/voice` |
| 03 | Firm memory: append-only event log | `src/lib/memory` (Postgres via `DATABASE_URL`, else 503) |
| 04 | Trust layer: `ComputedField`, money, IST, dry-run | `src/lib/fields.ts`, `src/lib/format`, `src/lib/outbound.ts`, `src/test/guards.test.ts` |
| 05 | Screens | `src/app/*` → `src/live/*` → `@port/*` UI kit |

Request path for every live screen:

```
page (src/app/x/page.tsx)
  → client wrapper (src/live/x.tsx) → useLiveJson("/api/…")
    → route handler (src/app/api/…/route.ts, liveRoute wrapper: 400 / 503 / 502)
      → orchestration (src/lib/live/research.ts or src/lib/agent/*)
        → CrustdataClient (cache → rate limiter → fetch with x-api-version → X-Credits-Used)
      → normalise + ComputedFields (src/lib/live/normalize.ts, src/lib/numbers/*)
      → recordMemory(...)
  → adapter (src/lib/adapters/*) → @port/screens/* (presentational)
```

## Data flow per screen

| Route | Client wrapper | API | Upstream | Unavailable when |
| --- | --- | --- | --- | --- |
| `/agent` | `src/live/agent` <!-- VERIFY --> | `POST /api/agent/run` (NDJSON) <!-- VERIFY --> | `/company/search` → `/company/enrich` → `/person/search` → `/person/enrich` | no Crustdata key; no candidates (shown honestly, with the relaxation tried) |
| `/agents` | <!-- VERIFY --> | — | lists the real agents | — |
| `/deal?domain=` | `src/live/deal.tsx` | `GET /api/live/research`, `GET /api/deals/:id/valuation` | identify → enrich, then `/person/search`, `/job/search`, `/web/search/live`, `/company/search` in parallel | no key (503); `no_match`; valuation always unavailable (no pricing model) |
| `/person?linkedin=` | `src/live/person.tsx` | `GET /api/live/person` | `/person/enrich` | no key; `no_match` |
| `/memo?id=` | `src/live/memo.tsx` | `GET /api/deals/:id/numbers` | the same research run as the deal page (`src/lib/numbers/resolve.ts` → `researchCompany`; cached) | memo-only fields (fit, ARR, valuation) unavailable with reasons |
| `/today` | `src/live/today.tsx`, `voice/TodayVoice.tsx` | `/api/connectors/gmail/threads`, `/api/connectors/calendar/events`, `/api/voice/brief?screen=today`, `/api/voice/tts` | Gmail, Calendar, memory, ElevenLabs | Google not configured / token expired |
| `/settings` | `src/live/settings.tsx` | `GET /api/integrations/connectors` | free health calls | — |
| `/brain`, `/pipeline` | `UnavailablePage` + `src/live/memory.tsx` (+ `ResearchForm` on pipeline) | `/api/memory/events` | Postgres | no `DATABASE_URL` |
| `/portfolio`, `/mandates`, `/ask`, `/slack`, `/deal/room` | `UnavailablePage` | `/api/integrations/connectors` | — | always in this build (reason in `src/live/sources.ts`) |
| every screen but Today | `src/live/voice/FloatingVoice.tsx` | `/api/voice/brief`, `/api/voice/tts?timestamps=1` | ElevenLabs | no ElevenLabs key |

## The agents

| Agent | Input → output | Upstream calls | Failure behaviour |
| --- | --- | --- | --- |
| Sourcing | free-text request → ranked, cited company table + founders + memo/CSV | `/company/search`, `/company/enrich`, `/person/search`, `/person/enrich` | each step streamed with status, latency, credits; too few results → relax with disclosure; no match → says so <!-- VERIFY --> |
| Research | domain → `LiveCompany` + 6 `LiveCall`s + `ComputedField`s | identify, enrich, person search, job search, web search, company search | identify/enrich failure fails the request; other sub-calls fail individually |
| People | company id → founders; LinkedIn URL → profile | `/person/search`, `/person/enrich` | `no_match` vs error kept distinct |
| Numbers | raw responses → explainable fields | — | `unavailable` + reason, never a guess |
| Inbox | — → threads, events | Gmail, Calendar | 401 "expired — reconnect", 503 not connected |
| Voice | screen + facts → sentence → audio; audio → text | ElevenLabs TTS, STT | not_connected / quota / rate-limited reported as such |
| Memory | action → event | Postgres | 503 unavailable; never an in-memory fallback |
| Health | — → connector status | free endpoints | `not_configured` / `error` with detail |

None of the agents uses an LLM. The text the voice agent speaks is composed deterministically from the same facts the
screen shows (`composer: "deterministic"` in `/api/voice/brief`).

## Sourcing agent pipeline <!-- VERIFY: every step name and file against src/lib/agent -->

```
request text ─(STT optional)─▶ parse (deterministic) ─▶ interpretation chips (editable)
  ─▶ /company/search  filter tree: country, B2B software taxonomy, founded ≥ year, headcount growth
  ─▶ too few? relax one filter at a time, disclose which
  ─▶ /company/enrich  verify: recompute 6-month growth from headcount.timeseries, cite both points
  ─▶ /person/search   founders at each company
  ─▶ /person/enrich   past employers
  ─▶ rank, cite every cell, stream NDJSON steps ─▶ table · memo.md · .csv · spoken summary
```
