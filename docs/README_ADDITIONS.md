# README additions (for the docs/submission worker to merge into README.md)

## Section 1 — replace the pricing sentence
Pricing (hypothesis, not yet validated with customers): **per seat per month for the fund team, plus Crustdata credits passed
through at cost** (a fresh single-company diligence costs about 5.6 credits; repeats are free from cache). The value test a
fund applies: does one seat replace enough associate hours on sourcing and first-pass diligence to pay for itself?
We have not run that test with a paying customer yet, and we say so.

## Section 1 — what is new
- Outcome, not a tool: the output is a finished, cited shortlist or memo, not a search box.
- Every fact carries its source (Crustdata endpoint + JSON path + retrieved time in IST) or says "unavailable" and why.
- A person is pulled in only for exceptions (ambiguous match, missing or conflicting data, credit threshold, any outbound
  send); everything else completes on its own.

## Section 2 — where a person is still needed
Add the row: "Exceptions queue (`/review`): items the agent could not settle on its own, each with its reason. Person
approves, edits or rejects; the run then finishes." <!-- VERIFY once the exceptions branch is merged -->

## Section 4 — robustness
Crustdata calls: timeout per call, retry on 429 (Retry-After, capped) and on 5xx/timeouts/malformed JSON for read
endpoints (jittered backoff under a deadline), per-route circuit breaker, and a stale-cache fallback labelled
"cached at <IST time>". Failures show as an honest error or "unavailable", never as invented data.

## Demo path
See docs/DEMO_SCRIPT.md: unseen request → plan → live Crustdata calls → cited shortlist → one exception approved by a person
→ one graceful failure → who pays.
