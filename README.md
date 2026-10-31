# Deal Desk

**An agentic OS for venture investors, built on Crustdata: type or say a sourcing request, get a ranked, cited shortlist and a memo.**

> **The trust rule:** every number on screen is live, computed and cited (value, method, inputs, source), or it says
> "unavailable" and why. No demo data, no fixtures, no invented fallbacks, and nothing leaves the firm (outbound is dry-run).

ContextCon @ IIT Bombay (Techfest), 31 Oct 2026 · Theme: **Investing** · Team: Saurabh Gupta, Shiwani Mishra

![How Deal Desk works](docs/assets/architecture.png)

## Quick start

```bash
npm ci
cp .env.example .env.local     # add CRUSTDATA_API_KEY at minimum; anything missing shows "not connected"
npm run dev                    # http://localhost:3240
```

| Try this | What happens |
| --- | --- |
| `/agent` → "Find ten Indian B2B software companies founded since 2023 whose team grew by half in the last six months, and tell me who founded each and what they did before" | Sourcing agent: interpretation chips → live step trace → ranked, cited table → memo/CSV export <!-- VERIFY: route and flow once src/lib/sourcing lands --> |
| `/deal?domain=e2b.dev` | Live research: identify → enrich → founders, open roles, web, comparables. Click any number for its method and citation. |
| `/deal?domain=zz9-no-such-startup-qx7.com` | Honest "No Crustdata match" (not an error, not a fake company) |
| `/settings` → Connectors | Real health checks (Crustdata `GET /account/credits`, ElevenLabs, Gmail, Calendar) |
| `/today` | Gmail + Calendar read, spoken greeting (ElevenLabs) |

`npm test` (vitest, no network) · `npm run typecheck` · Details for contributors: [AGENTS.md](AGENTS.md) · state of play: [docs/HANDOFF.md](docs/HANDOFF.md).

---

## 1. The service, and who pays

**The job:** a venture fund's associate spends days a week on sourcing and first-pass diligence: find companies that fit
the thesis, check the growth claims, find the founders and their background, and write it up with sources for the partners.
Deal Desk does that job end to end and hands back a decision-ready, cited shortlist and memo.

| Who pays | Why |
| --- | --- |
| Early-stage VC funds (partners, associates, scouts) | Replaces associate hours on sourcing and first-pass diligence; every claim is checkable before IC |
| Growth / PE / investment banks (analysts) | Same screen-and-verify work on targets and comparables |
| Diligence and research firms | Sell the output (a sourced, cited list or memo) as a service |

It is a **service, not a tool** (the deck's distinction): the output is the finished shortlist with reasons and
sources, not a search box. Pricing is not set; a per-seat subscription plus Crustdata credits passed through at cost is the
working assumption. <!-- VERIFY: pricing line with Saurabh -->

## 2. What it does now, and where a person is still needed

| Step | Done by Deal Desk (live) | Person needed |
| --- | --- | --- |
| Understand a free-text sourcing request | Deterministic parser → filters shown as editable interpretation chips <!-- VERIFY --> | Confirms or edits the chips when the parse is ambiguous |
| Find candidates | Crustdata `/company/search` filter tree; relaxes filters with a visible disclosure when too few match <!-- VERIFY --> | Accepts or rejects the relaxation |
| Verify growth | `/company/enrich` headcount; growth recomputed from the headcount timeseries, cited <!-- VERIFY --> | — |
| Founders and their past | `/person/search` founders → `/person/enrich` past employers <!-- VERIFY --> | — |
| Rank, cite, export | Ranked table, each cell cited to endpoint + JSON path; markdown memo and CSV <!-- VERIFY --> | Decides who to meet |
| Single-company diligence | `/deal?domain=`: headcount, growth (6m/QoQ/YoY), funding, web traffic, open roles, founders, live web, comparables | Judgement on fit |
| Inbox and calendar | Gmail threads + Calendar events (read only), spoken daily greeting | Replies, meetings |
| Voice | ElevenLabs speech-to-text on the request box, spoken run summary, greeting, context orb <!-- VERIFY: mic + run summary --> | — |
| Contacting anyone | **Never automatic.** Calendar invites are built and shown as "Dry run — not sent" | Sends it themselves |
| Fit score, verdict, valuation, IC memo numbers | Shown as **unavailable with the reason** (needs the firm mandate and a pricing model) <!-- VERIFY: unless the decision engine is merged --> | Partner decides |

## 3. What comes next, and why not now

| Next | What | Why not now |
| --- | --- | --- |
| **Track: "not yet, keep watching"** | A verdict that is a clear no for this round, with 2–4 measurable milestones (e.g. team ≥ 50, next round raised). Crustdata `/watch/company` webhooks fire when a milestone is hit; Deal Desk re-scores and asks "re-review?" | Needs a public HTTPS webhook URL, HMAC verification and a deal store to attach the watch to. Watch creation is already in the client (`watchCompany`, documented body, live-verified create/delete) but nothing calls it, by design: the old code created one watch per page view and never deleted it. |
| **Decision engine** | Fit score against the firm mandate, verdict advance / track / pass, valuation range, IC memo | Built in a separate builder repo; not merged into this build at freeze. Fields show "unavailable" with the reason instead of a guess. <!-- VERIFY: update if merged --> |
| **Warm forward** | On a thesis-mismatch pass, suggest 2–3 co-investors (inferred from Crustdata funding data, cited), double opt-in, drafts only | Event rule: agents may contact only the team, Crustdata and Techfest. Also needs founder consent flows. |
| Hiring signal at scale | `/job/search` counts as a sourcing filter, not just on the deal page | Credit cost per candidate; added after the core flow was proven |
| Crustdata MCP server | Let any agent (Claude, Cursor) drive Deal Desk's sourcing with the same tools | Not needed for a single app; no time to harden |
| Slack / AgentMail / Fireflies | Post decisions, send founder notes, ingest call transcripts | Outbound is locked during the event |
| LLM phrasing | Better request parsing and memo prose under "add no facts" rules | No LLM key available at the event; the deterministic path had to work on its own first |

## 4. How to run it, and how it is built

**Stack:** Next.js 15 (App Router, route handlers on Node), React 19, Tailwind 4, TypeScript, vitest. Postgres (`postgres`
driver) for organizational memory. No other backend.

**Models: no LLM is used.** There was no LLM key at the event, so request parsing, ranking and every sentence of the
memo and spoken summaries are deterministic code over live data. ElevenLabs provides voice only: `eleven_flash_v2_5` for
text-to-speech and Scribe (`scribe_v2`) for speech-to-text. (An optional `ANTHROPIC_API_KEY` hook can rephrase the Today
greeting from the same facts; it is not set in this build.)

**Agents** (code, not prompts; each step is a function with a typed input and a cited output):

| Agent | Does | Code |
| --- | --- | --- |
| Sourcing | Request → filters → search → verify → founders → ranked, cited table; streams its trace as NDJSON | `src/lib/sourcing`, `POST /api/sourcing/run`, `src/live/agent` <!-- VERIFY --> |
| Research | identify → enrich, then founders, jobs, web, comparables in parallel; one failing call never hides the others | `src/lib/live/research.ts` |
| People | Founders by company id; full profile by LinkedIn URL | `src/lib/crustdata/person-queries.ts` |
| Numbers | Turns raw responses into `ComputedField`s (method, inputs, citations) | `src/lib/numbers/*` |
| Inbox | Gmail threads, Calendar events (read) | `src/lib/google/*` |
| Voice | Greeting, context orb, mic (STT), run summary (TTS) | `src/lib/voice/*`, `src/live/voice/*` |
| Memory | Appends every action to an event log, streamed live | `src/lib/memory/*` |
| Health | Real connector checks (free calls), never timers | `src/lib/live/integrations.ts` |

**Data:** Crustdata (company, person, job, web), Gmail and Google Calendar (read), ElevenLabs. Nothing is seeded.

### Where it calls Crustdata

All calls go through one client (`src/lib/crustdata/client.ts` → `http.ts`): header `x-api-version: 2025-11-01`, per-route
rate limiter, bounded 429 retry (≤ 15 s total), response cache (no credits on repeat), one log line per billed call.

| Endpoint | File | Screen | Credits (live-measured / documented) |
| --- | --- | --- | --- |
| `POST /company/identify` | `src/lib/live/research.ts` `lookupCompany` | Deal | 0 |
| `POST /company/enrich` | `research.ts` `lookupCompany`; agent verify step <!-- VERIFY: src/lib/sourcing file --> | Deal, Agent | 2 per company |
| `POST /company/search` | `research.ts` `searchComps` + `src/lib/crustdata/company-queries.ts`; agent search step <!-- VERIFY --> | Deal (comparables), Agent | 0.03/row base, ≈0.23/row with funding fields |
| `POST /person/search` | `research.ts` `searchFounders` + `person-queries.ts`; agent founders step <!-- VERIFY --> | Deal, Agent | ≈0.13/row (experience filter), ≈0.23/row with history |
| `POST /person/enrich` | `research.ts` `enrichPerson`; agent past-employers step <!-- VERIFY --> | Person, Agent | 1 per profile |
| `POST /job/search` | `research.ts` `searchJobs` + `job-queries.ts` | Deal (open roles) | 0.03/row |
| `POST /web/search/live` | `research.ts` `searchNews` | Deal (live web) | 1 |
| `GET /account/credits` | `src/lib/live/integrations.ts` | Settings › Connectors | 0 |
| `POST/GET/DELETE /watch/company…` | `client.ts` `watchCompany` / `deleteWatch` / `getWatchRuns` | none yet (Track is next) | 0 to create, 5 per notification |

A fresh deal research run on e2b.dev cost **5.56 credits** (measured). A sourcing run costs roughly
<!-- VERIFY: credits per /agent run from the step trace --> credits. Full audit: [docs/CRUSTDATA_USAGE.md](docs/CRUSTDATA_USAGE.md).

## 5. Approaches tried: what worked, what failed

| Tried | Result | What we did |
| --- | --- | --- |
| A demo/fixture data mode next to live mode | Worked for UI work, but a judge (or partner) can't tell which numbers are real | **Removed it** (`ccf42bf`); a guard test now fails `npm test` if production code imports fixtures or adds a data-mode switch |
| `/company/enrich` without `fields` | Returns only `basic_info` and still costs 2 credits | Always send the permitted field groups (`enrich-fields.ts`) |
| Asking for one field the plan doesn't allow (`technographics`, `years_of_experience_raw`) | **403 for the whole call**, not a partial response | Allow-list of permitted groups; never request denied fields |
| `hiring.*` from enrich as the hiring signal | All null for our test companies; `open_jobs_timeseries` absent | Open roles come from `/job/search` `total_count`; engineering share from `job_details.category` |
| Builder's person/job/company search bodies | 400 `filter_shape` on every one | Rewrote to the documented filter tree (`{op, conditions:[{field,type,value}]}`), live-verified |
| `/web/search/live` for company news | 4–7 s and noisy (other companies with the same name, redirect URLs) | Kept, but results that don't mention the company are dropped and it's marked as the slow step |
| Unknown domains | Crustdata returns 200 with `matches: []`; old code showed "verified" | Treated as an explicit `no_match` state, never as a company |
| 429 rate limits | No `Retry-After` header; old client could stall ~50 s | Sliding-window limiter per route; 429 retry capped at 15 s, then fail loudly |
| Watch created on every research run | Leaked watches, cost per notification | Watch creation removed from page loads; needs an explicit webhook URL |
| An LLM for parsing the request | No key at the event | Deterministic parser with visible interpretation chips; the user corrects it instead of trusting it <!-- VERIFY --> |
| Voice: ElevenLabs Conversational AI agent vs STT + TTS | <!-- VERIFY: which shipped --> | STT (Scribe) on the request box + TTS for summaries keeps every spoken fact tied to cited data |
| Browser autoplay for the spoken greeting | Can be blocked without a user gesture | The greeting tries to play, and if blocked says so and waits for a tap (checked in the verify run) |

**Testing:** vitest suites for the Crustdata client (captured live responses through an injected fetch), request bodies,
rate-limit headers, numbers, formatting (IST, money), memory (against a real Postgres when `MEMORY_TEST_DATABASE_URL` is set), Google, outbound, voice and the
trust guards (`src/test/guards.test.ts`). An opt-in live contract suite: `npm run crustdata:test:live`.

---

## Trust rules (enforced in code)

| Rule | Where |
| --- | --- |
| No demo data or fixtures in production paths | `src/test/guards.test.ts` |
| Every number is a `ComputedField` (value, method, inputs, citations) or `unavailable` + reason | `src/lib/fields.ts`, `src/live/field.tsx` |
| No hard-coded amounts, %, dates or counts in screens | `src/test/guards.test.ts` (literal scan) |
| Money is `{amount, currency}`; never converted without a cited FX rate | `src/lib/format` |
| Times stored UTC, shown in IST | `src/lib/format` (`fmtDateTime` → "… IST") |
| Outbound is dry-run unless `OUTBOUND_MODE=live`; no email send code exists | `src/lib/outbound.ts`, guard test |
| Secrets are server-side only; status shows env var names, never values | route handlers, `src/lib/live/integrations.ts` |
| Errors are never shown as "no match", and "no match" is never shown as a company | `src/lib/live/research.ts` |

## Team

| Name | Role | GitHub |
| --- | --- | --- |
| Saurabh Gupta | Product, engineering | [saurabh4269](https://github.com/saurabh4269) |
| Shiwani Mishra | <!-- VERIFY: role --> | <!-- VERIFY --> |

## Code history (honest note)

- Building at the event started at 10:30 IST. The first commit, `451e4d9` (10:53 IST, 259 files), is the **Deal Desk web
  UI as previously deployed** to contextcon.ventureos.xyz, written before the event. It contained screens with sample data.
- Built during the event (every later commit, see `git log`): the Crustdata client port and rewrite to documented request
  shapes, all `/api/live/*` routes, the `ComputedField` contract and explainable numbers, removal of all demo/fixture
  modes, live deal and person pages, organizational memory, Gmail/Calendar connectors, outbound dry-run, ElevenLabs voice
  (TTS, STT), the sourcing agent, and these docs. <!-- VERIFY: add shell/mascot/mobile commits -->
- Some commits carry a different author identity from the team's; they were made from the team's coding-agent
  environment. <!-- VERIFY: Saurabh to confirm wording -->
- Design references, plans and research notes from before the event are allowed by the rules and are not in this repo.
