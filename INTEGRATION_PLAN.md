# Deal Desk — integration plan (live-only)

Branch `integrate` · 2026-10-31 · Crustdata API `2025-11-01`

## Decisions

1. **Shell = this repo** (polished UI). The builder's self-contained Crustdata library is ported into `src/lib/crustdata`;
   DB-bound orchestration (pipeline, firm config, agents/jobs, journey) stays in the builder backend (`builder-main`)
   and is consumed through `docs/API.md` contracts once it lands. Module boundaries (`src/lib/numbers`,
   `src/lib/memory/store.ts`, `src/lib/voice/brief.ts`) are the swap points.
2. **No demo mode.** Production code never imports sample data (`port/test/fixtures` is test-only, enforced by
   `src/test/guards.test.ts`). Missing sources render "not connected"/"unavailable" with the reason.
3. **Trust rules**: explainable `ComputedField`s; money `{amount, currency}` never relabelled or converted without a
   cited FX rate; UTC storage, IST rendering through `src/lib/format`; no hard-coded data literals in UI/API layers
   (guard test); organizational memory appended live for every action; outbound dry-run by default.

## Screen → source

| Route | Source | State |
| --- | --- | --- |
| `/today` | Gmail threads, Calendar events, memory, voice greeting | live |
| `/deal?domain=` | `/api/live/research`, `/api/deals/:id/valuation` | live (valuation fields unavailable: needs builder pricing) |
| `/person?linkedin=` | `/api/live/person` | live |
| `/memo?id=` | `/api/deals/:id/numbers` | live Crustdata fields; memo fields unavailable with reasons |
| `/settings` | `/api/integrations/connectors` | connectors live; workflow/members/access/export unavailable (builder) |
| `/brain`, `/pipeline` | `/api/memory/events` | live memory; deal store unavailable (builder) |
| `/portfolio`, `/mandates`, `/agents`, `/agent`, `/ask`, `/slack`, `/preview/slack`, `/deal/room` | — | unavailable, with real connector status (`src/live/sources.ts`) |
| `/landing` | marketing copy (`src/content/landing.ts`) | static |

## Connectors

| Connector | In this build | Status source |
| --- | --- | --- |
| Crustdata | client, research, person | `GET /account/credits` (0 credits) |
| Gmail | inbox threads (read-only) | token refresh + `users.getProfile` |
| Google Calendar / Meet | upcoming events; book-call insert (dry-run by default) | token refresh + `calendarList.get primary` |
| ElevenLabs | voice greeting / orb (TTS) | `GET /v1/voices` |
| AI model (Anthropic / OpenAI) | optional phrasing of greeting/answers | `GET /v1/models` |
| Slack, Fireflies, AgentMail | not wired | cheap auth call when a key is set |
| Affinity, Attio, Carta, PitchBook, … | catalogue tiles only | none |

## Builder bugs fixed in the port

Comparable-company search body (filter tree), fallback searches the API rejects, errors mislabelled as no-match,
watches created on every run, Acme fallback for unknown domains — see git history (`a04e8be`, `34a755e`).

## Verification

`npm run build`, `npm run typecheck`, `npm test`; `node scripts/verify-live.mjs` against a running server (click-through
of every route, DOM ↔ API number check, voice states); results in `verify_shots/REPORT.md`.
