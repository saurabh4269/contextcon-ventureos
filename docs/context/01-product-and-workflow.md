# 01 · Product and deal workflow

## What Deal Desk is

An associate for venture funds. You type or say a sourcing request; Deal Desk runs it on live Crustdata and returns a
ranked shortlist and a memo, with every fact cited (endpoint, JSON path, retrieval time in IST). A person steps in only
for exceptions (ambiguous match, missing or conflicting data, credit threshold, any outbound send).

- **Who pays (unvalidated hypothesis):** early-stage VC funds first, then growth/PE funds, investment banks, and
  diligence firms. Pricing idea: per seat, with Crustdata credits passed through at cost. No paying customer has
  tested it yet (README §1).
- **The trust rule:** every number is live, computed and cited, or it shows "unavailable" with the reason. There is no
  demo data, and outbound is dry-run. See [04-trust-rules.md](04-trust-rules.md).

## Screens in this build

| Route | State | Code |
| --- | --- | --- |
| `/ask` | Live: LLM research agent | `src/live/ask.tsx`, `src/live/screen/*`, `src/lib/agent/*` |
| `/agent` | Live: deterministic sourcing agent (no model) | `src/live/agent/*`, `src/lib/sourcing/*` |
| `/review` | Live: exception queue | `src/live/review.tsx`, `src/lib/exceptions/*` |
| `/deal?domain=` | Live: single-company diligence and decisions | `src/live/deal.tsx`, `src/lib/live/research.ts` |
| `/person?linkedin=` | Live: founder profile | `src/live/person.tsx` |
| `/memo?id=<domain>` | Live: IC memo numbers from `/api/deals/:id/decisions` | `src/live/memo.tsx` |
| `/today` | Live: Gmail + Calendar read, spoken greeting | `src/live/today.tsx` |
| `/settings` | Live: connector health checks | `src/live/settings.tsx` |
| `/agents` | Static list of the real agents | `src/app/agents/page.tsx` |
| `/brain`, `/pipeline` | Memory panel (needs `DATABASE_URL`), otherwise an unavailable page with the reason | `src/live/memory.tsx`, `src/live/sources.ts` |
| `/portfolio`, `/mandates`, `/slack`, `/deal/room` | Unavailable page with the reason | `src/live/sources.ts` |

## The 10-step deal workflow: built vs not yet

| # | Step | Built in this build | Not yet |
| --- | --- | --- | --- |
| 1 | **Founder email** (inbound) | Gmail threads are read on `/today` (`GET /api/connectors/gmail/threads`, `src/lib/google/*`) | No intake parsing of a pitch email into a deal. No reply drafting or sending: there is no email-send code at all, and a guard test checks for it |
| 2 | **Thesis screen** | Sourcing against a free-text thesis: `/ask` (LLM) and `/agent` (deterministic). `fitScore`, `screenerVerdict` and IC memo figures are computed locally from the firm mandate (`/settings/mandate`), live Crustdata research and peer search (`src/lib/numbers/local.ts`, `resolveDealNumbers`); gaps go to `/review` | No inbound pitch parsing from Gmail into a deal record. Without a configured mandate, thesis gates show **unavailable** with the Settings reason |
| 3 | **Data room** | `/deal/room` route exists | Unavailable page. No ingest, claim extraction or tie-out |
| 4 | **Crustdata research** | **Built.** `/deal?domain=` (identify → enrich → founders, jobs, web, comparables), `/person`, both agents. Every value is a cited `ComputedField` | Watchers and MCP are not used (see [03](03-api-and-crustdata.md)) |
| 5 | **Partner meeting** | Calendar events read on `/today`. `POST /api/connectors/calendar/events` builds an invite, but under `OUTBOUND_MODE=dry_run` (the default) it writes nothing and returns `wouldSend` | No partner-matching scheduler. No live booking during the event |
| 6 | **Transcript** | Fireflies shows up as a connector status only (`FIREFLIES_API_KEY`) | No transcript ingest |
| 7 | **Valuation** | `GET /api/deals/:id/valuation` and the `valuationRange` decision, computed from the deal's cited Crustdata numbers where the inputs exist | No private comps or pricing model. Missing inputs show "unavailable" and go to `/review`, where a person can enter a value, which is then cited to the review item |
| 8 | **IC memo** | `/memo?id=<domain>`: memo figures (`icMemoArrUsedM`, `icMemoValuation`, `icMemoCompsLine`) come from the decisions contract. `/agent` also exports a cited markdown memo and a CSV | The full IC memo pipeline lives in the decision-engine backend, which is not deployed for the event. No IC vote |
| 9 | **Pipeline → portfolio** | `/pipeline` shows the memory panel plus a research form when Postgres is configured | No deal store, stages or owners. `/portfolio` is unavailable (no deal store or cap-table source) |
| 10 | **Firm brain** | Append-only organizational memory in Postgres: `GET/POST /api/memory/events`, SSE `/api/memory/stream`, `/brain` | Without `DATABASE_URL` it returns 503 "unavailable" (there is deliberately no in-memory fallback). No memory-to-thesis proposals |

**Summary:** steps 4 (research) and 2 (thesis-driven sourcing) are fully live, and so are steps 7, 8 and 10 when their
inputs or stores exist. Steps 1 and 5 are read-only or dry-run. Steps 3, 6 and 9 are not built. That is honest
about scope: the event build spent its time on live data and on trust.
