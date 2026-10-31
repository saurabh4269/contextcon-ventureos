# 02 · Architecture

Diagrams: [../architecture/architecture.svg](../architecture/architecture.svg) ·
[PNG](../architecture/architecture.png) · [Mermaid source](../architecture/architecture.mmd) ·
[overview PNG](../assets/architecture.png). Detailed tables: [../ARCHITECTURE.md](../ARCHITECTURE.md). The rendered
diagrams predate the `/ask` agent, `/review` and STT; the tables below are current.

## Stack

Next.js 15 (App Router, Node route handlers), React 19, Tailwind 4, TypeScript, vitest. Postgres (`postgres` driver)
holds organizational memory and nothing else. There is no other backend. Dev server: `npm run dev` on port 3240.

External services: Crustdata API (`x-api-version: 2025-11-01`), Gmail and Google Calendar (read; calendar writes are
dry-run by default), ElevenLabs (TTS `eleven_flash_v2_5`, STT `scribe_v2`, an optional conversational session), and one
LLM provider for `/ask` (OpenAI Responses API by default, Anthropic when its key is set; see [07](07-nl-agent.md)).

## Layers (bottom to top)

| # | Layer | Code |
| --- | --- | --- |
| 01 | Sources: Crustdata, Gmail, Calendar, ElevenLabs | `src/lib/crustdata`, `src/lib/google`, `src/lib/voice` |
| 02 | Agents: one LLM research agent; the rest are deterministic functions | `src/lib/agent`, `src/lib/sourcing`, `src/lib/live/research.ts`, `src/lib/numbers`, `src/lib/exceptions` |
| 03 | Firm memory: append-only event log | `src/lib/memory` (Postgres via `DATABASE_URL`, otherwise 503) |
| 04 | Trust layer: `ComputedField`, citation enforcement, resilience, money/IST, dry-run | `src/lib/fields.ts`, `src/lib/provenance.ts`, `src/lib/agent/cite.ts`, `src/lib/crustdata/http.ts`, `src/lib/format`, `src/lib/outbound.ts` |
| 05 | Screens | `src/app/*` → `src/live/*` → `port/` UI kit (`@port/*`) |

## Agents

| Agent | Input → output | Code |
| --- | --- | --- |
| Research (LLM, `/ask`) | any request → plan → Crustdata tool calls → server-verified, ranked table | `src/lib/agent`, `POST /api/live/screen` |
| Sourcing (`/agent`, deterministic, the no-model fallback) | request → parsed chips → search (+ relax, disclosed) → enrich verify → founders → past employers → ranked, cited table, memo, CSV | `src/lib/sourcing/run.ts`, `POST /api/sourcing/run` |
| Company research | domain → identify → enrich, then founders, jobs, web, comparables in parallel | `src/lib/live/research.ts` |
| People | company id → founders; LinkedIn URL → profile | `src/lib/crustdata/person-queries.ts` |
| Numbers / decisions | raw responses → `ComputedField`s; deal decisions | `src/lib/numbers/*` |
| Exceptions | run or decisions → review items (missing data, low confidence, conflicts, credit threshold) | `src/lib/exceptions/*` |
| Inbox | Gmail threads, Calendar events | `src/lib/google/*` |
| Voice | facts → spoken sentence; audio → request text; a conversational session whose tools only navigate | `src/lib/voice/*`, `src/live/voice/*` |
| Memory | action → event, streamed over SSE | `src/lib/memory/*` |
| Health | real connector checks (free calls) | `src/lib/live/integrations.ts` |

## Request path (every live screen)

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

## Resilience

`src/lib/crustdata/http.ts` provides: a timeout on each call, a request-scoped deadline, bounded 429 retry, jittered
retry on 5xx, timeouts and malformed JSON for reads, a circuit breaker per route, and a stale-cache fallback labelled
"cached at <IST>". Did-you-mean for unknown domains lives in `src/lib/live/resolve.ts`. A model resilience wrapper
(fallback model, tool-JSON repair: `resilientModel` in `src/lib/resilience/model.ts`) exists and is tested, but on this
branch `POST /api/live/screen` still calls `modelFromEnv()` directly. Outage drill: `DEALDESK_SIMULATE_CRUSTDATA_OUTAGE=1`. Details:
[../ROBUSTNESS.md](../ROBUSTNESS.md).

## Modes of interaction (ContextCon brief)

Deal Desk is architected primarily as a **system of agents**: deterministic and LLM-driven functions over live APIs,
orchestrated from Next.js route handlers and streamed to the UI. Each agent is code with typed steps, not a single
monolithic prompt.

| Mode | Status in this repo | Where |
| --- | --- | --- |
| **System of agents** (default) | **Shipped.** Research (`/ask`), Sourcing (`/agent`), company research, people, numbers, exceptions, inbox, voice, memory | `src/lib/agent`, `src/lib/sourcing`, `src/lib/live/research.ts`, agents table above |
| **Single conversational agent** | **Partial.** ElevenLabs conversational session with navigation-only client tools (`run_sourcing`, `open_company`, `open_screen`) | `src/lib/voice/agent.ts`, `GET /api/voice/agent-session` |
| **MCP server** | **Not on this branch** (in progress elsewhere). Would expose the same Crustdata tool registry as MCP tools | Reserved: [11-evaluation.md § Architecture modes](11-evaluation.md#architecture-modes-contextcon-brief) |
| **CLI** | **Not on this branch** (in progress elsewhere). Would call the same JSON routes from a terminal | Reserved: [11-evaluation.md § Architecture modes](11-evaluation.md#architecture-modes-contextcon-brief) |

The UI and README describe the agentic OS outcome (shortlist, memo, exceptions). MCP and CLI are alternate front-ends
to the same trust layer, not separate data paths.
