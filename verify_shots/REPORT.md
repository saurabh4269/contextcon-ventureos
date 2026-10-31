# Deal Desk — live integration report

Date: 2026-10-31 (IST) · branch `integrate` · server: `next start -p 3277` (production build) with Crustdata, ElevenLabs,
Google (Gmail/Calendar read) and a local Postgres for organizational memory. Final commit: see the end of this file.

## Rules applied

| Rule | How it is enforced |
| --- | --- |
| No demo data / fixture variants in production | `DEALDESK_DATA_MODE`, the demo numbers module and every `?mode=`/`?id=helio`/`?hold=`/… variant are gone; `port/test/fixtures` is test-only; `src/test/guards.test.ts` fails if production code imports fixtures or test helpers |
| Honest unavailable states | screens without a source render `src/live/sources.ts` reasons plus the **real** status of each connector they need |
| No hard-coded data literals | guard test scans screens, components, adapters, live wrappers and routes for amounts, percentages, dates, times, durations and counted claims |
| Money `{amount, currency}` | Crustdata `*_usd` fields become `{amount, currency:"USD"}`; `fmtMoney` never converts or relabels (INR shows ₹) |
| Times UTC → IST | `src/lib/format` (`fmtDateTime` → "31 Oct 2026, 12:40 IST"); unit-tested, including the midnight roll-over |
| Live organizational memory | Postgres (`DATABASE_URL`) or explicit 503 "memory store not configured (DATABASE_URL)"; panel polls every 3 s |
| Outbound | `OUTBOUND_MODE=dry_run` (default): book-call returns `{transport:"dry_run", wouldSend}` + "Dry run — not sent (event rules)" label. Gmail send / Slack post / AgentMail send are not implemented (guard test: no `messages/send` in code) |

## Works live (evidence)

* **Crustdata research** `GET /api/live/research?domain=e2b.dev` → `status: ok`, E2B: headcount **52**, YoY growth **136.4 %**,
  total raised **{35 000 000 USD}**, last round **Series A {21 000 000 USD}**, **32** open roles, **2** founders
  (Vasek Mlejnsky, Tomas Valenta). Unknown domain `zz9-no-such-startup-qx7.com` → `status: no_match` (not an error).
* **Numbers** `GET /api/deals/e2b.dev/numbers` → 3 fields `ok` (headcountLatest, growthYoY, lastFundingUsdM as Money), 13
  `unavailable` with reasons; `/valuation` → all `unavailable` (needs builder pricing model).
* **Connectors** `GET /api/integrations/connectors` → Crustdata **connected** (GET /account/credits), ElevenLabs **connected**
  (GET /v1/voices), Gmail **connected** (token refresh + users.getProfile), Google Calendar **connected** (token refresh +
  calendarList.get primary); AI model, AgentMail, Slack, Fireflies **not_configured**.
* **Google (read)**: `GET /api/connectors/gmail/threads?max=10` → HTTP 200, 10 threads (7 unread); `GET /api/connectors/calendar/events?max=5`
  → HTTP 200, 0 upcoming events. (Counts only; no contents are reported.)
* **Calendar write — one test before the event rule**: before the hackathon dry-run rule arrived, one event titled
  "[Deal Desk test] — safe to delete" (15 min, **0 attendees**, `sendUpdates=none`) was created and deleted immediately:
  `POST /api/connectors/calendar/events` → 201, `DELETE …/:id` → **204**, repeat DELETE → **410**. No further calendar
  writes; the path is now dry-run by default.
* **Memory**: every research run, person lookup, connector check that ran, deal/person opened, signal action, note, greeting
  and assistant brief appended to `dealdesk_memory_events`; adapter integration-tested against a real Postgres 18.
* **Voice**: `POST /api/voice/tts` live once with short text → HTTP 200, `audio/mpeg`, 23 867 bytes (voice
  `nPczCjzI2devNBz1zQrb` Brian, model `eleven_flash_v2_5`); with-timestamps stream checked once → NDJSON, 5 chunks,
  cumulative character times (captions use these exact times, not a proportional estimate). The greeting text is composed
  from memory + Gmail + Calendar + connector status (no AI key on this box → `composer: "deterministic"`, sources listed in
  the panel).

## Unavailable and why

| Screen / data | Reason |
| --- | --- |
| Pipeline, Portfolio, Mandates (deal store), Agents/Runs/Agent (job queue), Data room, Settings › workflow/members/access/export | builder backend (`builder-main`) not in this repo |
| Fit score, criteria, return multiples, comps multiples, diligence verdict, IC memo figures, valuation | builder pipeline (data-room ingest, mandate, pricing/LLM); Crustdata has no revenue multiples |
| Assistant free-form answers | no AI model key configured; questions get an honest "no AI model connected" reply plus known facts |
| Slack screens | Slack not configured; nothing is posted |

## Screen → number → source

| Screen | Number | Source |
| --- | --- | --- |
| Deal header / Overview / Signals | Headcount 52 | `/api/live/research` · `fields.headcountLatest` · Crustdata `POST /company/enrich` `[0].matches[0].company_data.headcount.total` |
| Deal header / Signals | 6-month growth | `fields.headcountGrowth6m` · `…headcount.growth_percent.six_months` |
| Memo | YoY growth +136 % | `/api/deals/:id/numbers` · `growthYoY` · `…headcount.growth_percent.yoy` |
| Deal header / Overview | Total raised $35M | `fields.fundingTotal` (Money) · `…funding.total_investment_usd` |
| Overview / Memo | Last round Series A, $21M | `fields.lastRoundType`, `fields.lastFunding` / `lastFundingUsdM` · `…funding.last_round_type`, `…funding.last_round_amount_usd` |
| Deal header / Overview / Signals | Open roles 32 | `fields.openRoles` · `POST /job/search` `total_count` |
| Signals | Engineering roles (sample) | `fields.engineeringRolesSample` · `job_listings[].job_details.category` |
| Deal header / Overview | Monthly visitors, web traffic QoQ | `fields.webMonthlyVisitors`, `fields.webTrafficQoQ` · `…web_traffic.domain_traffic["e2b.dev"]` |
| Team | Founders found 2 | `fields.foundersFound` · `POST /person/search` `profiles[]` |
| Market | Comparables count, raised per comp | `fields.compsFound`, comps `totalUsd` (Money) · `POST /company/search` |
| Signals fit tile | Signal score | unavailable: needs firm thesis + builder scoring model |
| Valuation section | Low/High/Ask/Return multiples/Comps median | `/api/deals/:id/valuation` `explainable.*` — unavailable: pricing model (builder) |
| Memo | Fit, criteria, ARR used, valuation, comps line, verdict | `/api/deals/:id/numbers` — unavailable with the pipeline reason |
| Settings › Connectors | Crustdata credit balance | `GET /account/credits` (health check) |
| Today | Inbound threads, unread, next meeting | `/api/connectors/gmail/threads`, `/api/connectors/calendar/events` |
| Today greeting / orb | every spoken fact | `/api/voice/brief` `sources[]` (memory event ids, connector statuses, Crustdata endpoint + path) |

## Credits

Crustdata: ≈ 7.6 of 30 for the whole job; 0 in this session (all reads served from the cache). See `CREDITS.md`.

## Verification

`npm run build` ✓ · `npm run typecheck` ✓ · `npm test` ✓ (189 tests: 184 passed, 5 skipped — live-credit and live-DB
suites that need opt-in env; the Postgres memory suite was also run against a real local Postgres and passed).

`node scripts/verify-live.mjs http://localhost:3277` (headless Chromium, production build):

* **26 routes** clicked through, screenshots in `verify_shots/live/<route>.png`, **0 console errors / page errors**
  (`console.json`). An earlier run found React hydration error #418 on `/` and `/today` (speech-recognition support
  was decided during render) — fixed in `e32cc4c`.
* **DOM ↔ API numbers check passed**: deal header `hc`=52, `raised`=$35M, `round`=Series A, `roles`=32 equal
  `/api/live/research` fields; every memo field's `data-status` equals `/api/deals/e2b.dev/numbers`, unavailable ones
  render "—", ok ones match (52, +136%, $21M). The valuation tab renders its unavailable state.
* **Voice**: `/today` greeting reached *speaking* then *idle* (`today-voice-speaking.png`, `today-voice-idle.png`);
  the TTS error state is shown when `/api/voice/tts` is intercepted with a 502 (`today-voice-error.png`, the only mocked
  response). Autoplay blocking: headless Chromium allowed autoplay even with `--autoplay-policy=user-gesture-required`,
  so `scripts/verify-autoplay-blocked.mjs` simulates the browser refusing the first `play()` (`NotAllowedError`) →
  panel shows **Tap to hear** (`today-voice-blocked.png`), and tapping it plays (*speaking*).
* **Floating orb** opened on deal, memo, pipeline, brain and settings (`*-orb-open.png`): each spoke a line about that
  screen built from real data; **Esc** closed the popover and focus returned to the orb on every screen. The orb sits
  bottom-right without covering page controls (it moves left of the assistant dock when that is open).
* Personal Gmail/Calendar content (senders, subjects, event titles) and the greeting captions that speak it are
  **masked** in every screenshot; the `/today` greeting video (`verify_shots/voice/today-greeting.webm`, 3.5 MB) is kept
  locally and gitignored.

## Gaps

* Builder backend (deal store, pipeline, firm config, agents, IC memo, pricing) not connected — swap points are
  `src/lib/numbers/*`, `src/lib/memory/store.ts`, `src/lib/voice/brief.ts`; contract in `docs/API.md`.
* No sign-in: the greeting name comes from `DEALDESK_GREETING_NAME`; memory actors are "user" without an id.
* No AI model key here: greeting/orb text is deterministic; questions get an honest "no AI model connected" reply.
* Push-to-talk uses the browser's SpeechRecognition (Chrome); headless Chromium has none, so the text-input fallback
  was exercised instead.
* Slack, Fireflies, AgentMail: status only. All outbound is dry-run (`OUTBOUND_MODE`).
* Memory feed is noisy (every page view of a deal records a research run, honestly marked as cached).

## Commits (this session)

- `25c3316` Verification: live click-through screenshots (personal data masked), autoplay-blocked check, REPORT and credit ledger
- `e32cc4c` Fix hydration mismatch (speech support decided after mount), honour ?tab=valuation, cap Today activity list
- `be4f7b8` Ignore local Claude settings (.claude/)
- `95d019c` Docs for the live-only product: README, .env.example, INTEGRATION_PLAN, API (memory, Google, voice, outbound)
- `bb45486` Outbound dry-run by default (OUTBOUND_MODE): book-call builds the Calendar insert but sends nothing
- `bf68800` Gmail + Google Calendar connectors (OAuth refresh token, server-side) feeding a live Today and the greeting
- `53d6384` Voice assistant: spoken Today greeting and a floating context-aware orb (ElevenLabs via server route)
- `790faaa` UI without fixtures: honest unavailable states, live memory panel, explainable valuation/memo
- `ccf42bf` Remove demo data mode and fixture mode from production paths
- `82875ff` Organizational memory store (Postgres via DATABASE_URL, explicit unavailable otherwise) and central IST/money formatter

Voice feature: `53d6384` (greeting + orb), Google read connectors: `bf68800`, outbound dry-run: `bb45486`, hydration/tab fixes: `e32cc4c`. The final commit is the one that adds this list (see `git log -1` on `integrate`).
