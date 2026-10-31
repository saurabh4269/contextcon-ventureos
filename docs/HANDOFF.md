# Handoff: Deal Desk (branch `integrate`)

The single canonical handoff. As of **31 Oct 2026, 13:55 IST**. Code freeze **15:30 IST** (last call 15:00).
Workstream history (c45, c3/c2/c1 notes): [WORKSTREAMS.md](WORKSTREAMS.md). Why things are this way: [DECISIONS.md](DECISIONS.md).

## State in one line

All feature branches are merged into `integrate`: the LLM research agent (`/ask`), the deterministic Sourcing agent
(`/agent`), live deal and person research, the exception queue (`/review`), citation enforcement, Crustdata resilience,
voice (STT, TTS, conversational session) and the new shell; the decision engine is **not** merged.

## Done (merged into `integrate`)

| Area | Where | Evidence |
| --- | --- | --- |
| Crustdata client on documented request shapes; cache, credits, rate limits | `src/lib/crustdata/*` | `a04e8be`, `34a755e` |
| Live deal research `/deal?domain=` (identify → enrich → founders, jobs, web, comps in parallel) | `src/lib/live/research.ts`, `src/live/deal.tsx` | `4b0a852`; e2b.dev 5.56 credits fresh |
| Live person page `/person?linkedin=` | `src/live/person.tsx` | `e6c3a55` |
| `ComputedField` contract; `/api/deals/:id/{numbers,valuation}` withhold uncited values | `src/lib/fields.ts`, `src/lib/provenance.ts` | `d63a56c`, `4bd084d` |
| Research agent (LLM): `/ask`, `POST /api/live/screen` NDJSON; server-side citation checks; `model_unavailable` → link to `/agent?q=` | `src/lib/agent/*`, `src/live/ask.tsx`, `src/live/screen/*` | `c3cd6b9`, `98995f6`, `9d7d17f` |
| Sourcing agent (deterministic): `/agent`, `POST /api/sourcing/run` NDJSON; parse → search (+relax) → enrich verify → founders → past employers → rank → memo/CSV | `src/lib/sourcing/*`, `src/live/agent/*` | `5659f04`, `74bcde6` |
| Exception queue: `/review`, `GET/POST /api/exceptions`, `POST /api/exceptions/:id` (approve/reject/edit); sourcing runs record their exceptions | `src/lib/exceptions/*`, `src/live/review.tsx` | `ad914d0`, `39b1fd9` |
| Reasons and sources: every ok value / displayed number must have a source (test-enforced) | `src/lib/provenance.ts`, `.test.ts` | `4bd084d`, `0ec6569` |
| Crustdata resilience: retry, jittered backoff, per-route breaker, deadlines, stale-cache fallback, did-you-mean, outage drill | `src/lib/crustdata/http.ts`, `src/lib/live/resolve.ts`, `docs/ROBUSTNESS.md` | `1108137`, `c5ffb0b`, `adde284`, `7d6d9db` |
| Model resilience seam (fallback model, tool-JSON repair) | `src/lib/resilience/*` | `b13b459` |
| Voice: STT mic on `/agent`, Read aloud, Today greeting, orb, conversational session (signed URL) | `src/lib/voice/*`, `src/live/voice/*`, `src/app/api/voice/*` | `bc8115b`, `53d6384` |
| Shell: collapsible sidebar, mobile drawer, Dex mascot logo/favicon, account menu; responsive pass | `port/src/components/shell.tsx`, `port/src/components/brand/*` | `180035a`, `1310616` |
| Organizational memory (Postgres or explicit 503) | `src/lib/memory/*` | `82875ff` |
| Gmail + Calendar read; outbound dry-run by default | `src/lib/google/*`, `src/lib/outbound.ts` | `bf68800`, `bb45486` |
| Preflight (key presence only, never values) | `scripts/preflight.ts`, `src/lib/preflight.ts` | `e0a9c58` |
| Demo and fixture modes removed; guard tests | `src/test/guards.test.ts` | `ccf42bf` |

## In progress (at time of writing)

| Item | Who | Note |
| --- | --- | --- |
| UI audit fixes (click-through of every button) | Two UI auditor sessions, committing to this tree | `src/lib/sourcing/run.ts` had uncommitted edits at 13:50 |
| Loom recording | Saurabh | Script: [DEMO_SCRIPT.md](DEMO_SCRIPT.md) |
| Push to GitHub | Grok | Nothing is pushed from this box |

## Next (ranked)

1. Re-run the gate after the auditors' last commit: `npm run typecheck && npm test`.
2. Record the ≤ 2:00 Loom from [DEMO_SCRIPT.md](DEMO_SCRIPT.md) on the final build (warm the cache first).
3. Grok pushes `integrate` and makes it what judges land on (GitHub default branch is `dev`) before 15:00.
4. Fill the submission form (every member's IITB email, roll number, GitHub) by 15:00.
5. Wire `/ask` runs into the exception queue (`fromScreenResult` + `recordRun`; seam in [WORKSTREAMS.md](WORKSTREAMS.md)).
6. Decision engine merge if the builder patch arrives (see below).
7. After the event: Track on Crustdata `/watch/company` webhooks (HMAC-verified route, milestone evaluation, re-score).
8. Set `DATABASE_URL` on the deployment so memory is live there.

## Decision-engine builder merge

**Not arrived.** If delivered, it lands at `/workspace/claude_review/builder_patch/` (fit score, verdict, valuation,
IC memo, live memory events, trust rules). Until merged, fit / verdict / valuation / IC-memo numbers show "unavailable"
with the reason. Merge only behind `npm run typecheck && npm test` and the guard tests.

## Open risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Pre-10:30 code (`451e4d9`, 259 files of earlier UI) | Rule p28 | Disclosed in README "Code history" |
| Commit author identities differ from the team roster (14 early commits as `Yogesh`) | Judges may be confused | Disclosed in README |
| `/ask` live runs take 90–145 s and 20–54 credits | Loom over time | Trim the wait in Loom; `/agent` as the fast path |
| `/ask` runs do not feed `/review` (only `/agent` runs do) | Demo of exceptions must use an `/agent` run | Next item 5 |
| Crustdata 429 / outage | Step fails | Bounded retry, breaker, stale cache labelled "cached at <IST>", honest error |
| `DATABASE_URL` unset here | Memory panels say "unavailable" | Correct by design |
| Auditors editing the tree near freeze | Broken build | Gate after each merge; never `next build` while `next dev` runs |
| GitHub default branch is `dev` | Judges see the old README | Grok pushes before 15:00 |

## How to verify

```bash
npm run typecheck
npm test                                   # vitest, no network
npx tsx scripts/preflight.ts --offline     # key presence (set/missing), outbound mode; drop --offline for free pings
npm run crustdata:test:live                # opt-in, spends a few credits
```

Click path (dev server `npm run dev`, http://localhost:3240):

| Click | Expect |
| --- | --- |
| `/settings` → Connectors | Real checks: Crustdata (`GET /account/credits`), ElevenLabs, Gmail, Calendar |
| `/ask?q=Find ten Indian B2B software companies founded since 2023 whose team grew by half in the last six months, and tell me who founded each and what they did before.` | Plan → tool calls → verify → table; click a value for its citation (verified / corrected / unavailable) |
| `/agent` → deck example chip | "Understood" chips → step trace (endpoint, ms, credits) → ranked cited table → Copy memo / CSV / Read aloud |
| `/review` | Items from the last `/agent` run, each with its reason; Approve / Reject / Edit |
| `/deal?domain=e2b.dev` | Headcount, growth, funding, open roles, founders; click a number → method + citation |
| `/deal?domain=strpe.com` | No match with a "did you mean" suggestion |
| `/deal?domain=zz9-no-such-startup-qx7.com` | "No Crustdata match", not an error |
| `/person?linkedin=https://www.linkedin.com/in/mlejva` | Founder profile, past employers |
| `/today` | Inbox, meetings, greeting (tap if autoplay is blocked) |
| `/brain` | Memory panel, or "memory store not configured (DATABASE_URL)" |

## Environment variables (names only)

| Name | Needed for |
| --- | --- |
| `CRUSTDATA_API_KEY` | every Crustdata screen and both agents |
| `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-6.1-sol`), `OPENAI_REASONING_EFFORT` (default `high`) | research agent `/ask` |
| `ANTHROPIC_API_KEY`, `DEALDESK_LLM_MODEL` (default `claude-sonnet-5-5`) | takes precedence over OpenAI when set; also Today greeting phrasing |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` (default `eleven_flash_v2_5`), `ELEVENLABS_STT_MODEL_ID` (default `scribe_v2`), `ELEVENLABS_STT_KEYTERMS` | TTS and STT |
| `ELEVENLABS_AGENT_ID`, `ELEVENLABS_AGENT_LLM` | conversational voice session (`node scripts/voice-agent-setup.mjs` creates the agent) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Gmail, Calendar |
| `DATABASE_URL` | memory (not set on this box) |
| `OUTBOUND_MODE` | `dry_run` (default) or `live` |
| `EXCEPTIONS_FILE` | exception store path (default `.cache/exceptions.json`) |
| `RUN_CREDIT_ALERT` | credit alert per sourcing run (default 40) |
| `DEALDESK_SIMULATE_CRUSTDATA_OUTAGE` | outage drill, off by default |
| `DEALDESK_CACHE_DIR`, `DEALDESK_CACHE_TTL_SECONDS` | file response cache for dev |
| `DEALDESK_PUBLIC_URL` | webhook URL for watches (future) |
| `DEALDESK_GREETING_NAME`, `APP_URL` | greeting name; preflight app ping |
| `AGENTMAIL_API_KEY`, `SLACK_BOT_TOKEN`, `FIREFLIES_API_KEY` | connector status only |
| `CRUSTDATA_LIVE`, `MEMORY_TEST_DATABASE_URL` | opt-in live / integration tests |

## Ownership map

| Area | Owner / location |
| --- | --- |
| This repo (`/workspace/contextcon-ventureos`, branch `integrate`) | Saurabh Gupta (product owner); main Claude session `9ffd800d-db8c-47aa-b198-72a714a53a05` (code, docs, merges) |
| Push to GitHub (`github.com/saurabh4269/contextcon-ventureos`) | Grok (Saurabh's assistant). Nothing is pushed from this box |
| Landing page | Another worker, `/workspace/dealdesk-landing` (branch `landing/v5`). Do not edit from here |
| Film / teaser | Another worker, `/workspace/demo_video`. Do not edit from here |
| Decision engine | Builder agent, separate repo copy; patch would arrive at `/workspace/claude_review/builder_patch/` |
| Analysis and audits (read-only) | `/workspace/dealdesk_audit/` |
| Hackathon contacts | Crustdata on the floor (API, credits, MCP); event WhatsApp group |
