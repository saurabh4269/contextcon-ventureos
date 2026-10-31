# HANDOFF — c45 (Customer value + Demo), branch feature/rubric-c45

Session: 2e843200-fced-41e4-8a15-f54b98a8fc4f (acct2 session 8fbe4305-bf7a-4662-b968-e03d100f9af8). Prompt: /workspace/rubric_cc/c45.md.

## Goal
Close rubric C4 (customer value/idea) and C5 (demo/understanding): in-product value story on /landing, docs/DEMO_SCRIPT.md
(≤2-min Loom path + judge Q&A), docs/DEMO_CHECKLIST.md, scripts/preflight.ts (key presence only), docs/README_ADDITIONS.md.
README.md is owned by docs/submission — do not edit it here.

## Done
- (nothing committed yet)

## In progress
- Landing value section (new files under src/components/landing + src/content/landing-story.ts)
- scripts/preflight.ts + tests (subagent)

## Next
- DEMO_SCRIPT.md, DEMO_CHECKLIST.md, README_ADDITIONS.md; status file /workspace/rubric_cc/c45.status

---

# Robustness workstream (feature/rubric-c3)

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

## Follow-up (13:40–) — C2 reasons/sources + C1 exception queue, merged here
- Merged feature/rubric-c2 (ad0731c) and feature/rubric-c1 (56a4e3c; this also brings c1's docs, sourcing agent,
  responsive/voice/shell commits). One conflict (port/src/components/dealsections.tsx) resolved keeping both the
  responsive layout and the Why chips.
- C2 finished: src/lib/provenance.test.ts fails if any ok value or displayed number lacks a source (endpoint+path or
  URL, IST retrieval time, cached flag); /api/deals numbers + valuation pass through enforceCited (uncited → withheld);
  KPI check = usable citation; team card "with a cited profile" (P02); SrcPop never links to "#", plain chips open
  their href (P04). P04's invented comps / fixed 7.5–8.5x string do not exist on this branch (comps come from
  /company/search rows, multiples unavailable).
- C1 finished: /review page, GET/POST /api/exceptions, POST /api/exceptions/:id, src/lib/exceptions/raise.ts
  (ambiguousMatch, missingData, conflictingData, creditThreshold, outboundSend, parseRaise), /api/sourcing/run records
  each finished sourcing run + its items; nav badge reads ?count=1. Tests: src/lib/exceptions/*.test.ts.
- Seam for the LLM loop (nl-screener): after a screen run, `exceptionStore().recordRun(...Object.values(fromScreenResult(result, runId)))`
  i.e. `const d = fromScreenResult(r, id); exceptionStore().recordRun(d.run, d.raise)`; for ad-hoc cases `raiseException(ambiguousMatch(resolution, { runId }))`.
