# 11 · ContextCon evaluation (judge-style audit)

**Date:** 31 Oct 2026 (UTC), code freeze ~15:30 IST  
**Evaluator:** dedicated audit run (no API keys; live paths verified via mocked HTTP tests and code read)  
**Gate run on this branch:** `npm ci` · `npm run typecheck` · `npm test` · `npm run build` — all green

## Summary scores

| # | Criterion | Max | Score | Notes |
| --- | --- | --- | --- | --- |
| 1 | End-to-end execution | 25 | **17** | Strong sourcing → shortlist → memo/CSV and deal diligence; not the full 10-step inbound→portfolio journey |
| 2 | Facts and verification | 20 | **18** | `ComputedField` + `enforceCited` + broad tests; decisions honest when mandate/peers missing |
| 3 | Robustness and edge cases | 20 | **17** | Fault injection, circuit breaker, stale cache, messy input; a few seams untested at route level |
| 4 | Customer value and idea | 20 | **15** | Clear who-pays and service framing in README; pricing still an unvalidated hypothesis |
| 5 | Demo and understanding | 15 | **12** | Two runbooks + context docs; dual dev/demo ports need one sentence (fixed in README); test count was stale (fixed) |
| | **Total** | **100** | **79** | Team self-score in [05](05-rubric-scorecard.md) was **82** after live keys; this audit is stricter on workflow breadth |

## How this audit was done

1. Read [README](../../README.md), [docs/context/*](README.md), [docs/DEMO_RUNBOOK.md](../DEMO_RUNBOOK.md), [SETUP_LOCAL.md](../../SETUP_LOCAL.md), [AGENTS.md](../../AGENTS.md), [docs/HANDOFF.md](../HANDOFF.md).
2. `npm ci`, `npm run typecheck`, `npm test` (48 files, **711 passed**, 5 skipped), `npm run build` (no dev server on 3240).
3. Live Crustdata/Gmail/OpenAI paths judged through injected-fetch tests (`src/test/crustdata.ts`, `src/lib/sourcing/sourcing.test.ts`, `src/lib/live/routes-robustness.test.ts`, `src/lib/crustdata/resilience.test.ts`, `src/lib/agent/*.test.ts`) and route/handler reads.

---

## 1 · End-to-end execution (17 / 25)

**What the rubric asks:** a never-seen request → finished work (shortlist + founders, deal + decisions, IC memo), people only for exceptions; the 10-step deal workflow.

### Evidence (built)

| Flow | Evidence |
| --- | --- |
| Sourcing → cited shortlist → memo/CSV | `src/lib/sourcing/run.ts` (`runAgent` steps: parse → search → relax → verify → founders → rank); tests `runAgent > searches, verifies…` and **`finishes cited shortlist work for a request it has never seen`** in `src/lib/sourcing/sourcing.test.ts` |
| Exceptions only when needed | `src/lib/exceptions/rules.ts` `fromSourcingRun`; tests `src/lib/exceptions/rules.test.ts`, `decisions.test.ts` (review queue dedupe, edit → cited decision) |
| Research agent (NL, unseen asks) | `src/lib/agent/agent.test.ts`, `tools.test.ts`, `tools/extra-tools.test.ts`; stream contract `src/lib/agent/contract.ts` |
| Single-company diligence | `src/lib/live/research.ts`; `src/lib/provenance.test.ts` (deal page every KPI has `why` + citation) |
| Decisions + IC memo numbers | `src/lib/numbers/resolve.ts` → `computeLocalDeal`; consumers `/deal`, `/memo`; tests `src/lib/numbers/local.test.ts`, `exceptions/decisions.test.ts` |
| Gmail / Calendar read | `src/lib/google/*`, `/today`; outbound calendar insert dry-run `src/lib/outbound.ts` |

### Gaps (points at stake)

| Gap | Steps | Points | Evidence |
| --- | --- | --- | --- |
| No pitch-email → deal intake | 1 | **+4** | [01](01-product-and-workflow.md) step 1; Gmail read only on `/today` |
| Data room, transcript, portfolio pipeline | 3, 6, 9 | **+3** | `/deal/room`, `/portfolio` unavailable in `src/live/sources.ts` |
| Partner scheduling / live booking | 5 | **+1** | Calendar read + dry-run invite; [DEMO_RUNBOOK](../DEMO_RUNBOOK.md) live book only with keys |
| `/ask` does not raise exceptions to `/review` | — | **+0.5** | Seam noted in README §3; `fromScreenResult` not wired |
| Deterministic `/agent` ignores some NL (e.g. CTO role) | — | **+0.5** | Test **`reads an unseen messy request…`** — `plan.ignored` contains `ctos`; `/ask` handles via tools |

---

## 2 · Facts and verification (18 / 20)

### Evidence

| Rule | Enforcement |
| --- | --- |
| Every number cited or unavailable | `src/lib/fields.ts`, `src/lib/provenance.ts` `enforceCited` / `uncitedOk` |
| Regression test | `src/lib/provenance.test.ts` — `uncitedOk` empty on research, deal numbers, valuation, deal UI `whys()` |
| No fixtures in product | `src/test/guards.test.ts` — imports, demo mode, hard-coded literals in scanned dirs |
| Agent cells checked server-side | `src/lib/agent/cite.ts`; agent tests verify ledger + tool errors |
| Builder override cannot smuggle demo data | `fromBuilderField` drops fixture/demo citations — `decisions.test.ts` |
| Money / IST | `src/lib/format/format.test.ts`, `src/test/ist-guard.test.ts` |

### Gaps

| Gap | Points | Evidence |
| --- | --- | --- |
| IC memo / diligence fields need mandate + peers + priors | **+1** | `local.test.ts` — empty mandate → unavailable with Settings reason |
| Logo placeholder SVGs in `@port` (not numeric claims) | **+0.5** | `port/src/assets/logos/companies/*` — decorative only; guard scans production paths |
| Historical doc claimed screener always unavailable | **+0.5** | Fixed in [08](08-decisions-contract.md) to match `resolve.ts` |

---

## 3 · Robustness and edge cases (17 / 20)

### Evidence

| Area | Tests / code |
| --- | --- |
| Crustdata 429/503/403/500, malformed JSON | `src/lib/crustdata/resilience.test.ts`, `client.fixture.test.ts` |
| Circuit breaker + stale cache | `src/lib/crustdata/http.ts`; `routes-robustness.test.ts` outage drill |
| Messy company/domain input | `src/lib/live/resolve.test.ts`, `input.test.ts`, `robustness.test.ts`, `routes-robustness.test.ts` |
| Partial failure on deal research | `research.test.ts` — one failed sub-call does not hide others |
| Sourcing relax, 403 field denial, founder 500 | `sourcing.test.ts` |
| LLM tool 400 → tool error | `agent.test.ts` |
| Outbound allowlist + dry-run | `src/lib/outbound.test.ts`, `demo-safety.test.ts`, guards email test |
| Google timeout | Documented in [ROBUSTNESS.md](../ROBUSTNESS.md); implementation in google lib |

### Gaps

| Gap | Points | Evidence |
| --- | --- | --- |
| `resilientModel` wrapper not wired to `/api/live/screen` route | **+1** | [06-workflow-audit.md](06-workflow-audit.md); `src/lib/resilience/model.ts` exists |
| Memory unavailable without `DATABASE_URL` (no fallback) | **+1** | By design; hurts demo of “firm brain” without env |
| No automated test for full memo outbound allowlist UI path | **+1** | API tested; UI is manual in [DEMO_RUNBOOK](../DEMO_RUNBOOK.md) |

---

## 4 · Customer value and idea (15 / 20)

### Evidence

- README §1 — who pays, what job is replaced, outcome vs tool, pricing hypothesis labelled unvalidated (`README.md` lines 36–54).
- Landing narrative `src/content/landing-story.ts` — “Any request, including one it has never seen.”
- Exception-only human loop documented in README §2 table and [01](01-product-and-workflow.md).

### Gaps

| Gap | Points |
| --- | --- |
| No customer quote or paid pilot | **+4** |
| Banking / mandate screens unavailable (`/mandates`) | **+1** |

---

## 5 · Demo and understanding (12 / 15)

### Evidence

- Primary click paths: [docs/DEMO_RUNBOOK.md](../DEMO_RUNBOOK.md) (live demo, port 3000 + OAuth), [09-demo-runbook-and-setup.md](09-demo-runbook-and-setup.md) (3240 dev + recorded ≤2:00 script), [docs/DEMO_SCRIPT.md](../DEMO_SCRIPT.md).
- Preflight: `scripts/preflight.ts` (keys set/missing, no values printed).
- Architecture diagrams linked from README.

### Doc vs code mismatches (found and status)

| Doc | Issue | Status |
| --- | --- | --- |
| README Quick start | Said 664 tests; vitest reports **711** (+2 in this PR) | **Fixed** in README |
| README Quick start | Did not say demo uses port **3000** vs dev **3240** | **Fixed** one-line note |
| [08-decisions-contract.md](08-decisions-contract.md) | Said local `screenerVerdict` always unavailable | **Fixed** to match `resolveDealNumbers` |
| [01-product-and-workflow.md](01-product-and-workflow.md) | Said no firm mandate in build | **Fixed** — `/settings/mandate` + `computeLocalDeal` |
| [05-rubric-scorecard.md](05-rubric-scorecard.md) | Live-run credit/latency claims | Cannot re-verify without keys; treat as team notes |
| SETUP_LOCAL vs README | Both correct for different commands (`dev:demo` vs `dev`) | Clarified in README; SETUP_LOCAL already documents 3000 |

### Gaps

| Gap | Points |
| --- | --- |
| No checked-in recording at `verify_shots/` for judges without keys | **+2** |
| `/` remains a link list, not a guided demo entry | **+1** |

---

## Ranked remaining gaps (by rubric points)

1. **Full deal workflow** (email intake, data room, transcript, portfolio store) — **~8 pts** on criterion 1  
2. **Customer validation** — **~4 pts** on criterion 4  
3. **Recorded demo artifact** — **~2–3 pts** on criterion 5  
4. **Wire LLM resilience wrapper on screen route** — **~1 pt** on criterion 3  
5. **`/ask` → `/review` seam** — **~0.5 pt** on criterion 1  
6. **Expand deterministic parser for role asks (CTO, etc.) or steer to `/ask`** — **~0.5 pt** on criterion 1  

---

## Fixes applied in this audit PR

| Change | Why |
| --- | --- |
| `docs/context/11-evaluation.md` | This scorecard |
| `src/lib/sourcing/sourcing.test.ts` | Unseen-request parse + end-to-end runner test (mocked HTTP) |
| README test count + port note | Doc accuracy |
| [01](01-product-and-workflow.md), [08](08-decisions-contract.md), [context README](README.md) | Align workflow/decisions docs with `computeLocalDeal` / `resolveDealNumbers` |

---

## Test counts (this run)

```
Test Files  48 passed (48)
     Tests  711 passed | 5 skipped (714)
```

Skipped: live Crustdata / Postgres opt-in suites (see test file names `*.live.test.ts` or env guards).

---

## Related docs

- Team self-assessment: [05-rubric-scorecard.md](05-rubric-scorecard.md)  
- Workflow truth table: [01-product-and-workflow.md](01-product-and-workflow.md)  
- Trust rules map: [04-trust-rules.md](04-trust-rules.md)  
- Demo: [../DEMO_RUNBOOK.md](../DEMO_RUNBOOK.md), [09-demo-runbook-and-setup.md](09-demo-runbook-and-setup.md)
