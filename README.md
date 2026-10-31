# Deal Desk by VentureOS

An agentic OS for VCs and banks, built on Crustdata. Next.js 15, React 19, Tailwind 4.

**Live data only.** Every number and list on screen comes from a live source — Crustdata, Gmail, Google Calendar,
the organizational memory (Postgres) — or the screen says plainly that the source is not connected and why. There is
no demo mode and no sample data in the app. Numbers travel as explainable `ComputedField`s (value, method, inputs,
citations), money as `{amount, currency}`, times as UTC rendered in IST.

## Run locally

```bash
npm ci
cp .env.example .env.local   # fill in what you have; everything else shows "not connected"
npm run dev                  # http://localhost:3240
npm run build && npm start
npm test                     # vitest (no network; Crustdata tests use captured responses through an injected fetch)
npm run typecheck
```

## What is live

| Screen | Source |
| --- | --- |
| Today | Gmail inbox threads (metadata), Google Calendar upcoming events, today's memory, spoken greeting (ElevenLabs) |
| Deal `/deal?domain=` | Crustdata identify → enrich, founders, jobs, web search, comparables; valuation/memo fields with honest reasons |
| Person `/person?linkedin=` | Crustdata person enrich |
| IC memo `/memo?id=` | `GET /api/deals/:id/numbers` |
| Settings › Connectors | `GET /api/integrations/connectors` (real health checks) |
| Firm brain, Pipeline | organizational memory (live), research form |
| Portfolio, Mandates, Agents, Assistant, Slack, Data room | not connected in this build — shown as such, with the real status of what they need |

A floating voice orb (every screen except Today) speaks a short line about the current screen, built from the same data.

## Crustdata endpoints used

`POST /company/identify` (0 credits) · `POST /company/enrich` (2) · `POST /person/search` (founders) · `POST /person/enrich` (1)
· `POST /job/search` · `POST /web/search/live` (1) · `POST /company/search` (comparables) · `GET /account/credits` (health, 0).
API version `2025-11-01`. Responses are cached (memory by default; files under `DEALDESK_CACHE_DIR` in dev).

## Outbound

`OUTBOUND_MODE=dry_run` (default) — anything that would contact a person (calendar invite/insert) is built, validated and
returned as `{transport:"dry_run", wouldSend}` with a visible "Dry run — not sent" label. Gmail send, Slack posts and
AgentMail sends are not implemented.

## Layout

- `src/app` routes and API route handlers (`docs/API.md`)
- `src/lib` Crustdata client, Google, memory store, voice, numbers, formatting
- `src/live` live screen wrappers, memory panel, voice agent
- `port/src/screens`, `port/src/components` the UI; `port/test/fixtures` are test-only
