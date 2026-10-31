# 04 · Trust rules and where they are enforced

The product rule: **every number on screen is live, computed and cited (value, method, inputs, source), or it says
"unavailable" and why.** Nothing is invented, and nothing leaves the firm without a person.

| Rule | Enforced in |
| --- | --- |
| No demo data or fixtures in production paths. No data-mode switch | `src/test/guards.test.ts` ("fixtures are test-only", "no demo data mode"). Fixtures live under test folders only |
| Every number is a `ComputedField` (value, method, inputs, citations, reasoning) or `unavailable` + reason | `src/lib/fields.ts`; rendered by `src/live/field.tsx` |
| An `ok` value with no usable source is withheld, never shown | `src/lib/provenance.ts` (`uncitedOk`, `enforceCited`) and its tests; applied in the numbers, valuation and decisions routes |
| Agent values are checked against the cited Crustdata response, never taken on the model's word | `src/lib/agent/cite.ts` (verified / corrected / unavailable) |
| Decision-engine values must carry citations and must not cite fixture, sample, demo or seed sources | `src/lib/numbers/decisions.ts` (`fromBuilderField`, `NOT_REAL`) |
| No hard-coded amounts, %, dates or counts in screens, components or adapters | `src/test/guards.test.ts` (literal scan) |
| Money is `{amount, currency}`, never converted without a cited FX rate | `src/lib/format` |
| Times are stored in UTC and shown in IST | `src/lib/format` (`fmtDateTime` → "… IST"); `src/test/ist-guard.test.ts` |
| Outbound is dry-run unless `OUTBOUND_MODE=live`. There is no email-send code | `src/lib/outbound.ts`; guard test "no email sending" |
| Secrets are server-side only. Status screens show env var names, never values | route handlers; `src/lib/live/integrations.ts`; `src/lib/preflight.ts` reports set/missing only |
| An error is never shown as "no match", and "no match" is never shown as a company | `src/lib/live/research.ts`, `src/lib/live/resolve.ts` (did-you-mean, never an auto-picked company) |
| A failing sub-call never hides the others | `src/lib/live/research.ts` (identify/enrich failure fails the request; the other calls fail individually) |
| A stale value is labelled as stale | `src/lib/crustdata/http.ts` stale-cache fallback, labelled "cached at <IST>" |
| A person handles only exceptions, and every exception carries its reason | `src/lib/exceptions/rules.ts` (`fromSourcingRun`), `src/lib/exceptions/decisions.ts`; `/review` |
| Memory never fakes persistence | `src/lib/memory/*`: Postgres or an explicit 503, with no in-memory fallback |
| Voice adds no facts | Spoken briefs are composed from the screen's facts (`src/lib/voice/*`). The conversational session's client tools only navigate (`run_sourcing`, `open_company`, `open_screen`) |

Gate before any merge: `npm run typecheck && npm test` (vitest, no network). The guard tests fail the build if any rule
above regresses.
