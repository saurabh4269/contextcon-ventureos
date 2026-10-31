# HANDOFF — rubric C3 (Robustness and edge cases)

Branch `feature/rubric-c3` (worktree /workspace/rubric-c3), from integrate @7886cd7. Session: rubric-c3 Claude Code
instance (31 Oct 2026). Full behaviour write-up: docs/ROBUSTNESS.md.

## Goal
Close scorecard gaps 4–5 for criterion 3: Crustdata tool resilience, LLM-call resilience helper, domain-anywhere with
"did you mean", and a fault-injection robustness suite.

## Done (all committed; tests green, tsc clean)
- http.ts: retry 500/502/503/504, timeouts, transport errors, malformed 2xx on read endpoints (writes never replayed
  after they may have reached Crustdata), jittered backoff, total deadline, per-route circuit breaker.
- cache.ts getStale + stale.ts + client.ts: outage → last good response, `meta.stale`, note "cached at <IST>".
- deadline.ts: request-scoped deadline (40 s default, research 55 s) applied by liveRoute to every Crustdata call.
- failure.ts: honest messages, `retryable` flag; signal graph "cached" chip + "did you mean" chip (adapters/deal.ts).
- resolve.ts + routes: people/jobs/comps/news accept companyId | domain | company; company/research add suggestions.
- resilience/index.ts + model.ts: withResilience, classifyError, resilientModel (fallback model, tool-JSON repair).
- simulate.ts: DEALDESK_SIMULATE_CRUSTDATA_OUTAGE=1 outage drill (off by default).
- Tests: crustdata/resilience.test.ts, live/robustness.test.ts, live/routes-robustness.test.ts, live/resolve.test.ts,
  resilience/*.test.ts, adapters/deal-robustness.test.ts.

- Independent review done; 5 confirmed bugs fixed in c5ffb0b (write replay after reset, stuck breaker trial slot,
  rate-limit wait past deadline, unlabelled stale no-match, model fallback budget) + non-array identify ≠ no_match.
- Also: voice LLM call bounded (brief.ts), Google calls timeout + non-JSON handling, memo stamps in IST + guard test.

## In progress
- Nothing. DONE — status in /workspace/rubric_cc/c3.status. 336 tests pass / 5 skipped, tsc clean.

## Next / for the merger
- nl-screener merge seam: see docs/ROBUSTNESS.md "Model calls".
- deal.tsx (hot file) could render research `message`/`suggestions` as clickable links; today they show as a chip.
