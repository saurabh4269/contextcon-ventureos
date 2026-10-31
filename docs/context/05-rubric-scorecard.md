# 05 · ContextCon rubric scorecard (self-assessed)

Source: the team's rubric audit on 31 Oct 2026. These are honest self-scores against the event's five criteria, taken
from live runs against the dev server and real Crustdata calls. They are not judges' scores.

## Scores

| # | Criterion | Max | Initial (≈13:15 IST) | Re-score (≈14:00 IST) |
| --- | --- | --- | --- | --- |
| 1 | End-to-end execution | 25 | 9 | **20** |
| 2 | Facts and verification | 20 | 13 | **17** |
| 3 | Robustness and edge cases | 20 | 12 | **18** |
| 4 | Customer value and idea | 20 | 13 | **15** |
| 5 | Demo and understanding | 15 | 8 | **12** |
| | **Total** | 100 | **55** | **82** |

## Evidence behind the re-score

- **End-to-end:** `POST /api/sourcing/run` on the deck request (Indian B2B companies founded since 2023, team grew by
  half, founders and backgrounds) returned 10/10 cited rows in 3.2 s from 14 live calls costing 33.9 credits, with 0
  failed calls. One company was dropped with a reason, 2 items went to `/review` and 8 completed on their own. A new,
  messy request with a typo ("seed climate tech in germny… who are their CTOs") sent to `/api/live/screen` returned
  10 rows and 4 named CTOs, using 8 tool calls and 12.87 of 60 credits in 91 s.
- **Facts:** the screen run's verifier checked 52 values: 52 verified, 0 corrected, 0 unavailable. Every cell has an
  endpoint, JSON path and `retrievedAt`. A test fails if an ok value has no source (`src/lib/provenance.ts`).
- **Robustness:** jittered retry, a circuit breaker, a stale-cache fallback and per-route deadlines in `http.ts`;
  fault-injection tests; a domain is accepted anywhere; a typo'd domain gets did-you-mean; there is an outage drill;
  Google calls time out after 15 s.
- **Customer value:** a who-pays strip on `/landing`, and a pricing hypothesis labelled unvalidated.
- **Demo:** [../DEMO_SCRIPT.md](../DEMO_SCRIPT.md) with Q&A, and `scripts/preflight.ts` (checks that keys are present
  without printing them).

## Remaining gaps at the re-score (and status on this branch)

| Gap | Points at stake | Status now |
| --- | --- | --- |
| Decision fields (fit score, verdict, valuation, IC memo) unavailable | +4 C1, +2 C2 | Contract and client merged (`/api/deals/:id/decisions`, [08](08-decisions-contract.md)). Valuation is computed from cited Crustdata numbers where the inputs exist. The rest needs the decision-engine backend, and gaps go to `/review` |
| `DATABASE_URL` unset, so memory is off | +1 C3, +1 C1 | Unchanged: set it on the deployment |
| Pricing and customer validation | +5 C4 | Open: still a hypothesis, with no customer quote |
| Recorded demo | +3 C5 | See [09](09-demo-runbook-and-setup.md) |
