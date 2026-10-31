# Workstream history

Notes from the parallel workstreams that were merged into `integrate` on 31 Oct 2026 (IST). Folded in from the former
root `HANDOFF.md`. Current state lives in [HANDOFF.md](HANDOFF.md); this file is history.

| Workstream | Branch | Scope | Status |
| --- | --- | --- | --- |
| c45 Customer value + demo | `feature/rubric-c45` | Landing value story, demo script, preflight, README additions | Merged (`ed7929a`) |
| c3 Robustness | `feature/rubric-c3` | Crustdata and model resilience, did-you-mean, outage drill, fault-injection suite | Merged (`8f3645f`, `4708098`) |
| c2 Reasons and sources | `feature/rubric-c2` (via c3) | Provenance panel, citation enforcement | Merged via c3 |
| c1 Exception queue | `feature/rubric-c1` (via c3) | `/review`, exceptions API, raise helpers | Merged via c3 |
| nl-screener | `feature/nl-screener` | LLM research agent at `/ask` | Merged (`a0f0e13` is in `integrate`) |
| docs/submission | `docs/submission` | README sections, architecture diagram, code-history note | Merged (`2d6bb2f`) |

## c45: customer value and demo

Session `2e843200-fced-41e4-8a15-f54b98a8fc4f`. Goal: close rubric C4 (customer value) and C5 (demo).

- Landing value section: `src/app/landing/story.tsx`, `src/content/landing-story.ts` (who pays, what it replaces, outcome
  not tool, request-to-finished-work strip; `294caee`).
- `scripts/preflight.ts` + `src/lib/preflight.ts` (key presence only, outbound dry-run, credits and model reachability; `e0a9c58`).
- Demo script beats for exceptions, model and failure (`f48df7e`); README additions folded into `README.md`.
- `docs/DEMO_CHECKLIST.md` was planned and not written; the pre-recording checklist is in `DEMO_SCRIPT.md`.

## c3: robustness (and the c2/c1 follow-up)

Full behaviour write-up: [ROBUSTNESS.md](ROBUSTNESS.md).

- `http.ts`: retry 500/502/503/504, timeouts, transport errors, malformed 2xx on read endpoints (writes never replayed
  after they may have reached Crustdata), jittered backoff, total deadline, per-route circuit breaker.
- `cache.ts` `getStale` + `stale.ts` + `client.ts`: outage → last good response, `meta.stale`, note "cached at <IST>".
- `deadline.ts`: request-scoped deadline (40 s default, research 55 s) applied by `liveRoute` to every Crustdata call.
- `failure.ts`: honest messages, `retryable` flag; signal graph "cached" chip and "did you mean" chip (`adapters/deal.ts`).
- `resolve.ts` + routes: people/jobs/comps/news accept `companyId | domain | company`; company/research add suggestions.
- `src/lib/resilience/*`: `withResilience`, `classifyError`, `resilientModel` (fallback model, tool-JSON repair).
- `simulate.ts`: `DEALDESK_SIMULATE_CRUSTDATA_OUTAGE=1` outage drill (off by default).
- Independent review: 5 bugs fixed in `c5ffb0b` (write replay after reset, stuck breaker trial slot, rate-limit wait
  past deadline, unlabelled stale no-match, model fallback budget) and non-array identify ≠ no_match.
- Also: voice LLM call bounded (`brief.ts`), Google calls timeout + non-JSON handling, memo stamps in IST + guard test.
- Tests: `crustdata/resilience.test.ts`, `live/robustness.test.ts`, `live/routes-robustness.test.ts`,
  `live/resolve.test.ts`, `resilience/*.test.ts`, `adapters/deal-robustness.test.ts`. At hand-off: 336 pass / 5 skipped, tsc clean.

c2 (reasons and sources): `src/lib/provenance.test.ts` fails if any ok value or displayed number lacks a source
(endpoint + path or URL, IST retrieval time, cached flag); `/api/deals` numbers and valuation pass through
`enforceCited` (uncited → withheld); KPI check means a usable citation; team card says "with a cited profile";
source chips never link to `#`.

c1 (exception queue): `/review`, `GET/POST /api/exceptions`, `POST /api/exceptions/:id`, `src/lib/exceptions/raise.ts`
(`ambiguousMatch`, `missingData`, `conflictingData`, `creditThreshold`, `outboundSend`, `parseRaise`);
`/api/sourcing/run` records each finished sourcing run and its items; the nav badge reads `?count=1`.

### Open seams

- LLM research agent → exception queue (not wired): after a screen run,
  `const d = fromScreenResult(r, id); exceptionStore().recordRun(d.run, d.raise)`; for ad-hoc cases
  `raiseException(ambiguousMatch(resolution, { runId }))`.
- `deal.tsx` could render research `message` / `suggestions` as clickable links; today they show as a chip.
