# AGENTS.md — guide for any coding agent working on Deal Desk

Read this first, then `docs/HANDOFF.md` (current state) and `docs/API.md` (route contracts).

## What this is

Deal Desk: an agentic OS for venture investors, built on Crustdata. Next.js 15 App Router, React 19, Tailwind 4,
TypeScript, vitest. Server code lives in route handlers (`runtime = "nodejs"`). There is no separate backend; the
"builder backend" referred to in `src/live/sources.ts` is a different repo and is **not** part of this build.

## Repo map

| Path | What |
| --- | --- |
| `src/app/**/page.tsx` | Routes. Thin: read search params, pick a `src/live/*` wrapper or `UnavailablePage` |
| `src/app/api/live/*` | Crustdata-backed JSON routes (`research`, `company`, `people`, `person`, `jobs`, `news`, `comps`) |
| `src/app/api/sourcing/run` | Sourcing agent, NDJSON step stream (`src/lib/agent` + `/api/live/screen` are the separate LLM screener) |
| `src/app/api/deals/[id]/{numbers,valuation}` | Explainable numbers (`ComputedField`s) |
| `src/app/api/memory/{events,stream}` | Organizational memory (Postgres) + SSE |
| `src/app/api/connectors/{gmail,calendar}` | Google read; calendar insert (dry-run) |
| `src/app/api/voice/{tts,stt,brief}` | ElevenLabs TTS / STT; deterministic spoken briefs |
| `src/app/api/integrations/connectors` | Real connector health |
| `src/lib/crustdata/` | The Crustdata client: `client.ts`, `http.ts` (transport, 429), `cache.ts`, `rate-limits.ts`, `credits.ts`, `enrich-fields.ts`, `*-queries.ts` (request bodies), `generated/` (OpenAPI types) |
| `src/lib/sourcing/` | Sourcing agent: `parse.ts` (request → plan + chips), `run.ts` (steps, relax, verify, founders, rank), `export.ts` (memo/CSV), `examples.ts` |
| `src/lib/live/` | Orchestration (`research.ts`), normalisation, failure mapping, `liveRoute` wrapper, connector health |
| `src/lib/numbers/` | Raw response → `ComputedField` (`company-fields.ts`, `deal-numbers.ts`) |
| `src/lib/fields.ts` | The `ComputedField` type and helpers (`isOk`, `show`, `explain`) |
| `src/lib/format/` | The only place that formats money and time (IST) |
| `src/lib/memory/` | Memory store (Postgres or explicit unavailable), `recordMemory` |
| `src/lib/google/` | OAuth refresh, Gmail, Calendar |
| `src/lib/voice/` | ElevenLabs TTS/STT, greeting and screen briefs |
| `src/lib/outbound.ts` | `OUTBOUND_MODE` switch and dry-run envelope |
| `src/live/` | Client wrappers that fetch live data and feed the UI kit (`deal.tsx`, `person.tsx`, `today.tsx`, `memo.tsx`, `settings.tsx`, `memory.tsx`, `unavailable.tsx`, `sources.ts`, `useLiveJson.ts`, `voice/*`) |
| `src/live/agent/` | Sourcing agent screen (`AgentScreen`, `Cite`, `useAgentRun` with the screener seam) |
| `port/src/` (imported as `@port/*`) | The UI kit: `screens/`, `components/` (shell, ui, charts, signal graph), `types.ts`. Presentational; takes data via props |
| `port/test/fixtures` | **Test-only** sample data. Never import from production code |
| `docs/` | `API.md`, `crustdata/openapi/*.yaml` (extracted OpenAPI), `crustdata/fixtures/*.json` (captured live responses for tests), `crustdata/AMBIGUITIES.md` |
| `scripts/` | OpenAPI extract/codegen, `crustdata-smoke.ts`, screenshot and verify scripts |
| `verify_shots/` | Last click-through report (`REPORT.md`) and credit ledger (`CREDITS.md`) |

Aliases (`tsconfig.json`): `@/*` → `src/*`, `@port/*` → `port/src/*`.

## Commands

| Command | Notes |
| --- | --- |
| `npm run dev` | Dev server on **port 3240**. Often already running on the shared box: check `ss -ltnp \| grep 3240` before starting another |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | vitest, no network. Live Crustdata tests are opt-in: `npm run crustdata:test:live` (spends a few credits) |
| `npm run crustdata:smoke` | One identify call (0 credits) |
| `npm run build` | **Do not run while `next dev` is running on the same directory** (both write `.next/` and corrupt each other). Not needed for most changes; typecheck + tests are the gate |

The box is shared (16 GB, no swap): keep to one dev server and one browser, and kill what you start.

## Product rules (hard constraints; breaking one is a bug)

1. **No demo data.** No fixtures, sample values, seeded memory, placeholder companies or "data mode" switches in production
   code. Missing data renders as `unavailable` with the real reason. `src/test/guards.test.ts` enforces this.
2. **Every number is a `ComputedField`** (`src/lib/fields.ts`): `{status:"ok", value, method, inputs[], citations[], reasoning}`
   or `{status:"unavailable", reason}`. A citation names `source`, `endpoint` (e.g. `POST /company/enrich`), `path` (JSON
   path in the response) and `retrievedAt`. Do not show a number that cannot be cited.
3. **No hard-coded data literals** in `port/src/screens`, `port/src/components`, `src/live`, `src/app`, `src/lib/adapters`,
   `src/content`: no amounts, percentages, dates, clock times, durations or counted claims in strings or JSX. If a literal
   is legitimately needed, add a `data-literal-ok: <why>` comment on that line.
4. **Money** is `{amount, currency}` (ISO 4217) end to end; format only with `src/lib/format`. Never relabel or convert
   without a cited FX rate. Lakh/crore must be parsed explicitly (no parser exists yet; add one in `src/lib/format`).
5. **Time**: store and transmit UTC ISO strings; display in Asia/Kolkata via `fmtDateTime` / `fmtTime` / `fmtDate`.
6. **Outbound is dry-run** (`OUTBOUND_MODE` unset or `dry_run`): anything that would contact a person is built and
   returned as `{transport:"dry_run", wouldSend}` with the visible label. Event rule: agents contact only the team,
   Crustdata and Techfest. Do not add Gmail send (`messages/send` is blocked by the guard test).
7. **Secrets stay server-side.** Read keys from `process.env` in route handlers/lib only; never send them to the client,
   never log them, never include values in responses (connector status lists env var *names*).
8. **Errors are not "no match"**, and "no match" (`matches: []`) is not a company. One failing sub-call must not hide the others.
9. **Memory is live**: append an event for every user/agent action (`recordMemory` server-side, `recordEvent` client-side).
   No in-memory fallback.
10. Build to the official API docs (Crustdata `2025-11-01`, ElevenLabs, Google). Cite the doc URL in a comment.

## Adding a Crustdata call

1. **Body**: write a builder in `src/lib/crustdata/*-queries.ts`. Search endpoints take a filter tree:
   `{field, type, value}` or `{op:"and"|"or", conditions:[…]}`. Check the field names in `docs/crustdata/openapi/*.yaml`
   and the types in `src/lib/crustdata/generated/`.
2. **Call**: use a method on `CrustdataClient` (`client.ts`); add one if missing, via `this.live(method, path, body, opts)`.
   Get the process-wide client with `liveCrustdataClient()` (`src/lib/live/server.ts`) so the rate limiter and cache are shared.
3. **Route**: wrap with `liveRoute(parse, run)` (`src/lib/live/route.ts`): 400 bad params, 503 not connected, 502 upstream.
4. **Cache**: successful read responses are cached by `(method, path, body)` hash (`cache.ts`); repeats cost 0 credits.
   `DEALDESK_CACHE_DIR` turns on a file cache for dev. Never cache watch create/delete.
5. **Credits**: add the documented price to `credits.ts`; the real charge is in the `X-Credits-Used` header (surfaced as
   `creditsUsed` on every `LiveCall`). Use `limit` and request only the `fields` you need (premium groups cost per row).
6. **Rate limits**: add the RPM to `rate-limits.ts` (route templates like `/watch/company/:id`). 429 has no `Retry-After`;
   `http.ts` waits on `x-ratelimit-reset` and gives up after 15 s total.
7. **The 403 gotcha**: requesting any field your plan does not permit fails the **whole** call with `permission_error`.
   `/company/enrich` always gets the permitted group list from `enrich-fields.ts`. Denied on this plan: `technographics`,
   `crunchbase`, `maps`, `social_posts`, `hiring.recent_openings`, `experience.years_of_experience_raw`.
8. **Other gotchas**: enrich without `fields` returns only `basic_info` (still 2 credits); unknown domains return 200 with
   `matches: []`; `hiring.*` is null for most companies (use `/job/search`); web traffic keys contain dots
   (`domain_traffic["e2b.dev"]`); timeseries are unsorted; names can contain zero-width characters (`sanitizeCrustdataName`).
9. **Test**: capture a real response (strip PII) into `docs/crustdata/fixtures/` and test through an injected `fetchImpl`
   (see `src/test/crustdata.ts`, `src/lib/live/research.test.ts`).

## How screens get data

- Client wrappers in `src/live/*` call same-origin JSON routes with `useLiveJson(url)` (`src/live/useLiveJson.ts`), which
  returns `loading | ok | failed{status, body}`. Render `failed` with `failureMessage(res, "What")`: it distinguishes
  `not_connected`, `unavailable` (with reason) and `error`.
- Screens with no live source use `UnavailablePage` / `UnavailableBlock` (`src/live/unavailable.tsx`). The reason text
  and needed connectors are in `src/live/sources.ts` (one place, so UI and verify report agree); it shows the **real**
  connector status from `/api/integrations/connectors`.
- Numbers render with `FieldRow` / `FieldDetail` (`src/live/field.tsx`): value, or "—" plus the reason; click for method,
  inputs and citations.
- The UI kit (`@port/*`) is presentational. Map API data to its props in `src/lib/adapters/*` (e.g. `adapters/deal.ts`).

## Test guards (`src/test/guards.test.ts`)

| Guard | Fails when |
| --- | --- |
| fixtures are test-only | production code imports `fixtures`, `/test/` or `@/test`; or `port/src/fixtures` exists |
| no demo data mode | `DEALDESK_DATA_MODE`, `*_FORCE_FIXTURE`, `DEALDESK_FIXTURES`, `forceFixture` appear in production code |
| no email sending | `messages/send`, `drafts/send`, `messages.send` appear |
| no hard-coded data values | a string/JSX literal in the scanned dirs looks like money, %, ISO date, clock time, month-day, duration or a counted claim |

## Known gaps

- Fit score, verdict, valuation and IC memo numbers are `unavailable` (decision engine not merged). <!-- VERIFY -->
- Organizational memory needs `DATABASE_URL`; it is **not set** in this box's `.env.local`, so memory panels show "unavailable".
- Portfolio, Mandates, Assistant (`/ask`), Slack, Data room: unavailable pages (no source in this build).
- No webhook route for Crustdata watches yet; `watchCompany` exists in the client but nothing calls it.
- No auth / multi-user. Single-tenant event build.
- `/` is a plain link list, not a home screen. <!-- VERIFY: may change with the shell work -->
- Parser is deterministic: unusual phrasings fall back to visible chips the user must fix. <!-- VERIFY -->

## First 30 minutes

1. `git log --oneline | head -30` and read `docs/HANDOFF.md`, `docs/DECISIONS.md`.
2. Check what is running: `ss -ltnp | grep -E '3240|3277'`. Reuse the dev server on 3240 if it is up.
3. `ls .env.local` and compare names with `.env.example` (never print values). Without `CRUSTDATA_API_KEY` every live
   screen shows "not connected"; that is correct behaviour.
4. `npm run typecheck && npm test`. Both must pass before and after your change.
5. Open `/settings` (connectors), `/deal?domain=e2b.dev` (cached; 0 credits on repeat), `/agent`. <!-- VERIFY -->
6. Read `src/lib/live/research.ts` end to end: it is the reference pattern (spec → attempt → LiveCall with credits/latency).
7. Before adding UI text with numbers, re-read rule 3 above.
8. Do not commit secrets, `.cache/`, `verify_shots/voice/`. Do not push or deploy unless asked; final pushes are done by
   the owner's release process.
