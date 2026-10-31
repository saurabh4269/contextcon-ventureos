# HANDOFF — rubric C3 (Robustness and edge cases)

Branch `feature/rubric-c3` (worktree /workspace/rubric-c3), from integrate @7886cd7. Session: rubric-c3 Claude Code instance.

## Goal
Close scorecard gaps 4–5 for criterion 3: Crustdata tool resilience (5xx/timeout retries with jittered backoff under a
deadline, circuit breaker, stale-cache fallback "cached at <IST>"), generic `withResilience` for the LLM calls,
domain-anywhere for /api/live/{people,jobs,comps,news} with "did you mean", and a fault-injection robustness suite.

## Done
- `src/lib/resilience/breaker.ts` — per-key circuit breaker.
- `src/lib/crustdata/http.ts` — retries 500/502/503/504, timeouts, transport errors and malformed 2xx JSON for read
  endpoints only (writes: one reconnect when never connected); jittered backoff; total deadline; breaker hooks.
- `src/lib/crustdata/cache.ts` — `getStale` (7-day stale window), memory cache bounded, corrupt cache file = miss.
- `src/lib/crustdata/stale.ts` + client.ts — outage → last good cached response with `meta.stale` + IST note;
  LiveCall.stale/note; citation chip shows the "cached at …" note (src/live/field.tsx).

## In progress
- withResilience + resilientModel (src/lib/resilience/{index,model}.ts) — subagent.
- domain-anywhere resolve (src/lib/live/resolve.ts + routes) — subagent.
- http fault-injection tests.

## Next
- Robustness suite, docs/API.md notes, /workspace/rubric_cc/c3.status.
