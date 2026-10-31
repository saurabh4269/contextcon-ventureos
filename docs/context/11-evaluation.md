# 11 · ContextCon evaluation (strict, code + tests)

**Evaluator run:** 31 Oct 2026, no API keys in the environment (by design). Live behaviour was inferred from route/lib
code, `docs/context/*`, and vitest with injected HTTP (no network). Gate on this branch after fixes below:
`npm run typecheck && npm test && npm run build` — **713 passed, 5 skipped** (714 total).

This scorecard is **stricter than** the team's self-assessment in [05-rubric-scorecard.md](05-rubric-scorecard.md)
(82/100): it weights the **full 10-step deal workflow** in criterion 1 and treats doc/code drift as a demo penalty.

## Summary scores

| # | Criterion | Max | Score | Notes |
| --- | --- | --- | --- | --- |
| 1 | End-to-end execution | 25 | **13** | Sourcing + diligence + exceptions are live; inbound→IC→portfolio chain is partial |
| 2 | Facts and verification | 20 | **17** | `ComputedField`, `enforceCited`, provenance + guard tests |
| 3 | Robustness and edge cases | 20 | **17** | Crustdata/http resilience, fault tests; LLM wrapper not wired to `/ask` route |
| 4 | Customer value and idea | 20 | **14** | Clear README positioning; pricing still an unvalidated hypothesis |
| 5 | Demo and understanding | 15 | **12** | Strong runbooks; minor README/test-count drift fixed in this PR |
| | **Total** | **100** | **73** | |

---

## 1 · End-to-end execution (13 / 25)

**What the brief asks:** a never-seen request → finished work (shortlist with founders, deal with decisions, IC memo),
people only for exceptions, plus the **10-step** workflow (founder email → … → firm memory).

**Evidence (built):**

| Flow | Evidence |
| --- | --- |
| Unseen NL → cited shortlist + founders | `runAgent` in `src/lib/sourcing/run.ts`; stream `POST /api/sourcing/run`; UI `src/live/agent/*`. Tests: `src/lib/sourcing/sourcing.test.ts` (`runAgent` suite), new parse case for messy "germny" request |
| LLM path (when keys present) | `src/lib/agent/agent.ts`, `POST /api/live/screen`; 503 + `/agent` fallback: `src/app/api/live/screen/route.test.ts` |
| Exceptions, person only when needed | `fromSourcingRun` → `/review`: `src/lib/exceptions/rules.ts`, `src/app/api/sourcing/run/route.ts` L64–68; tests `src/lib/exceptions/rules.test.ts`, **`src/app/api/sourcing/run/route.test.ts`** (review + memory steps) |
| Single-company diligence | `researchCompany` `src/lib/live/research.ts`; `/deal?domain=` |
| IC memo figures | `/memo?id=` + `GET /api/deals/:id/decisions`; local decision engine `src/lib/numbers/local.ts` when mandate set — tests `src/lib/numbers/local.test.ts` |
| Firm memory | `recordMemory` on sourcing finish (`route.ts` L56–63); Postgres when `DATABASE_URL` set |

**10-step workflow** (from [01-product-and-workflow.md](01-product-and-workflow.md)):

| Step | Built? | Gap (points at stake) |
| --- | --- | --- |
| 1 Founder email intake | Read-only Gmail on `/today` | No pitch→deal parsing; no automatic replies (+3 C1) |
| 2 Thesis screen | Sourcing agents live | Fit/screener need mandate or builder (+2 C1) |
| 3 Data room | `/deal/room` unavailable | Not built (+2 C1) |
| 4 Crustdata research | **Yes** | — |
| 5 Partner meeting | Calendar read; dry-run invite | No scheduler (+1 C1) |
| 6 Transcript | — | Not built (+1 C1) |
| 7 Valuation | Cited local valuation when inputs exist | No full comps engine (+1 C1) |
| 8 IC memo | Partial via decisions + `/agent` export | Full builder pipeline not deployed (+1 C1) |
| 9 Pipeline → portfolio | `/portfolio` unavailable | No deal store (+2 C1) |
| 10 Firm brain | Live with `DATABASE_URL` | Off in eval env (+0.5 C1) |

**Ranked gaps (criterion 1):**

1. **No orchestrated deal journey** (email → IC → portfolio) — **~8 pts**
2. **`/ask` runs do not raise exceptions** (`fromScreenResult` not wired; README §3) — **~2 pts**
3. **Role-specific asks** (e.g. "who are their CTOs") not parsed in deterministic agent — `parse.ts` leaves `ctos` in `ignored` (test documents behaviour) — **~1 pt**

---

## 2 · Facts and verification (17 / 20)

**Evidence:**

| Rule | Enforcement |
| --- | --- |
| Every number cited or unavailable | `src/lib/fields.ts`, `enforceCited` in `src/lib/provenance.ts` |
| Uncited ok values fail tests | `src/lib/provenance.test.ts` — `uncitedOk`, deal page whys |
| No fixtures in product | `src/test/guards.test.ts` — imports, demo mode |
| No hard-coded data literals in UI paths | `src/test/guards.test.ts` — `literals()` scan |
| `/ask` server-side verification | `src/lib/agent/cite.ts`, screen reducer tests in `src/live/screen/screen.test.tsx` |
| Decisions re-cited | `src/lib/numbers/decisions.ts` L8–10; `withBuilder` drops fixture citations — `src/lib/numbers/local.test.ts` |

**Gaps (+3 pts at stake):**

1. Mandate-dependent decisions show unavailable until `/settings/mandate` — honest, but IC demo needs mandate entry (**+1 C2**)
2. Builder backend optional; several IC memo fields stay unavailable without it (**+1 C2**)
3. Stale-cache values must stay labelled — covered in `provenance.test.ts` (**+0**); peer revenue multiples use mandate priors labelled "Assumption" — good (**+0**)

---

## 3 · Robustness and edge cases (17 / 20)

**Evidence:**

| Area | Tests / code |
| --- | --- |
| Crustdata 5xx, 429, timeout, malformed JSON, circuit breaker, stale cache | `src/lib/crustdata/http.ts`, `src/lib/live/routes-robustness.test.ts` |
| Outage drill | `DEALDESK_SIMULATE_CRUSTDATA_OUTAGE=1` — same test file |
| Unknown domain, did-you-mean | `src/lib/live/resolve.ts`, `src/lib/live/input.test.ts` |
| Sourcing: 403 field denial, partial founder failure, relax disclosure | `src/lib/sourcing/sourcing.test.ts` |
| Google timeout | `src/lib/google/robustness.test.ts` |
| Screen route bad input | `src/app/api/live/screen/route.test.ts` — empty query, bad JSON, length |
| Sourcing route bad input + orchestration | **`src/app/api/sourcing/run/route.test.ts`** |
| LLM resilience (fallback, JSON repair) | `src/lib/resilience/model.test.ts` — **not** used by `POST /api/live/screen` (`src/app/api/live/screen/route.ts` uses `modelFromEnv()` directly; [02-architecture.md](02-architecture.md)) |

**Gaps:**

1. Wire `resilientModel` into screen route (**+2 C3**)
2. Broader LLM fault-injection at route level (stream mid-run failure) (**+1 C3**)

---

## 4 · Customer value and idea (14 / 20)

**Evidence:** README §1 (`README.md` L36–61) — who pays, what job, service vs tool, outbound dry-run, exceptions-only
humans. Landing story tests: `src/content/landing-story.test.ts`. Pricing explicitly **unvalidated** (honest, but caps
score).

**Gaps:** No customer quote or usage proof (**+5 C4** per team scorecard); banking/mandates storyline in `port/` docs
not productised (**+1 C4**).

---

## 5 · Demo and understanding (12 / 15)

**Evidence:**

| Doc | Matches code? |
| --- | --- |
| [SETUP_LOCAL.md](../../SETUP_LOCAL.md) | Port 3240 default; `dev:demo` on 3000 — consistent with `package.json` |
| [docs/DEMO_RUNBOOK.md](../DEMO_RUNBOOK.md) | Uses `dev:demo` / 3000 for OAuth — intentional |
| [09-demo-runbook-and-setup.md](09-demo-runbook-and-setup.md) | Aligns with `/ask` → `/agent` → `/review` → `/deal` path |
| [02-architecture.md](02-architecture.md) | Agents + **modes of interaction** table (this PR) |

**Doc vs code mismatches (fixed or noted):**

| Issue | Status |
| --- | --- |
| README claimed **664** tests; vitest reported **709+** before this PR | **Fixed** → 712+ in README (re-run after new tests) |
| Team scorecard **82/100** vs strict **73/100** | Documented here; both kept |
| Architecture PNG predates `/ask` | Noted in [02-architecture.md](02-architecture.md) L5–6 |

**Gaps:** No checked-in recording (**+2 C5**); `/ask` latency not instant — runbook warns (**+0**).

---

## Architecture modes (ContextCon brief)

Documented in [02-architecture.md § Modes of interaction](02-architecture.md#modes-of-interaction-contextcon-brief).

| Mode | Deal Desk today |
| --- | --- |
| System of agents | **Primary.** Table of agents in `02-architecture.md`; implementation under `src/lib/agent`, `src/lib/sourcing`, `src/lib/live/research.ts` |
| Single agent | **ElevenLabs voice** session only; tools navigate, do not mutate data (`src/lib/voice/agent.ts`) |
| MCP server | **Reserved.** Separate branch; should re-use `src/lib/agent/tools/*` registry — no duplicate Crustdata client |
| CLI | **Reserved.** Should POST to existing routes (`/api/sourcing/run`, `/api/live/screen`) with NDJSON consumed client-side |

---

## Gaps ranked by points at stake (all criteria)

| Rank | Gap | Est. pts | Owner / note |
| --- | --- | --- | --- |
| 1 | Full deal workflow (intake → data room → transcript → portfolio) | **~12** | Product scope; partial local decisions |
| 2 | Customer validation / pricing proof | **~5** | Business, not code |
| 3 | Decision engine / builder deploy (`DEALDESK_BUILDER_URL`) | **~4** | C1 + C2 |
| 4 | Recorded demo artifact | **~3** | C5 |
| 5 | Wire `resilientModel` on `/ask` | **~2** | C3; low-risk follow-up |
| 6 | `/ask` → exception queue | **~2** | Seam exists in `rules.ts` |
| 7 | `DATABASE_URL` on demo machine | **~1** | C1 + C3 |
| 8 | Parse role queries (CTO vs founder) | **~1** | Deterministic parser |
| 9 | MCP + CLI | **~0** (architecture) | Other branch; docs reserved |

---

## Fixes applied in this evaluation PR

1. **`docs/context/11-evaluation.md`** — this scorecard.
2. **`docs/context/02-architecture.md`** — modes of interaction table + MCP/CLI reserved pointers.
3. **`src/app/api/sourcing/run/route.test.ts`** — 400 handling + post-run **review** and **memory** steps (workflow orchestration).
4. **`src/lib/sourcing/sourcing.test.ts`** — unseen messy request (typo `germny`, climate/seed, ignored `ctos`).
5. **`README.md`** — vitest count aligned with CI.

---

## Test inventory (representative)

| File | What it proves |
| --- | --- |
| `src/test/guards.test.ts` | No fixtures/demo mode/email send/hard-coded literals |
| `src/lib/provenance.test.ts` | Citations on research + deal UI |
| `src/lib/sourcing/sourcing.test.ts` | Parser + full agent runner (injected fetch) |
| `src/app/api/sourcing/run/route.test.ts` | API orchestration after a run |
| `src/lib/live/routes-robustness.test.ts` | Crustdata fault injection |
| `src/app/api/live/screen/route.test.ts` | Model/Crustdata missing, bad body |
| `src/lib/numbers/local.test.ts` | Local decisions + mandate gates |
| `src/lib/resilience/model.test.ts` | LLM fallback (library only) |

**Counts:** 48 test files, **713 passed**, 5 skipped (live Crustdata contract + Postgres opt-in).
