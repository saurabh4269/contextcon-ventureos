# STATE — Deal Desk, branch `main`

This file tells what each screen shows on the live deploy (`DEALDESK_DATA_MODE=live`) and what is not correct.
Data source words:

- **Crustdata**: a live Crustdata call (cached per server instance).
- **Gmail / Calendar**: a live, read-only Google call.
- **fixture**: sample data from `port/src/fixtures` (demo data).
- **hardcoded**: a value written in the code.
- **store**: the durable store (`src/lib/store/docs.ts`): Postgres when `DATABASE_URL` or `POSTGRES_URL` is set, else
  JSON files. On Vercel without a database the files are in per-instance `/tmp`: **not durable**.
- **empty**: the screen shows its own empty state.

## Before and after this pass

"Before" is main at `410c1b2`. "After" is main at the end of this pass. The UI look did not change: the same port
screens, with data wiring, empty and loading states, and honest labels only.

| Screen / route | Before: source and defects | After |
| --- | --- | --- |
| Today `/today` | Rows: review queue (tmp file) + decisions (Crustdata) + pitch-like Gmail threads. Every deal was "New". Next meetings card was blank with no meeting. "Prep at 2pm" showed for a meeting with no prep brief. | Stages from the store (New, Screening, Diligence, IC). Closed deals (Portfolio, Passed) leave the list. Deals in a workflow open `/workflow?id=`. Next meetings says why it is empty (calendar error, or no IC / board / LP / founder meeting). No prep text without a prep brief. |
| Deal `/deal?domain=` | Crustdata research + decisions. Fit tile showed "0 / 100" before the score arrived. | Fit tile shows "…" while decisions load and while the score builds; never a fake 0. IC memo button opens that deal's memo in every mode. |
| Person `/person?linkedin=` | Crustdata. | No change. |
| Ask `/ask` | Research agent (model + Crustdata). | Result rows have "Start deal →" (starts the workflow for that domain). |
| Agent `/agent?q=` | Sourcing agent. "6-month" growth could come from a point 5 months back. | Growth uses only a point exactly N calendar months back, else Crustdata's own figure. Ranking uses the same two points. |
| Agents `/agents` | fixture, badged "Demo data". | No change (no live source). |
| Memo `/memo?id=<domain>` | Decisions + research. Crustdata revenue estimate labelled "Verified ARR". In demo mode a domain id showed the NexaFlow sample memo. | Label "Est. revenue (Crustdata)". A domain id always shows that deal's live memo. |
| Review `/review` | Review queue in a tmp file / process memory; per instance on Vercel. | Queue in the store; the note under the title names the storage. Approving a deal's item moves a Sourced deal to Screening; the owner is `DEALDESK_USER_NAME`. |
| Pipeline `/pipeline` | Every deal "Sourced", owner "Unassigned", "In diligence" "—". | Stages and owners from the store; stage counts and "In diligence" are real; Passed counts in the header. Owner is `DEALDESK_USER_NAME` after a person acted, else "Unassigned". Footnote names the storage when it is not durable. |
| Portfolio `/portfolio` | empty; nothing wrote a portfolio company. | Deals invested through the workflow (`GET /api/portfolio`), with the cited facts the workflow gathered, contradicted claims, who decided and when. ARR, burn, runway: "—" with the reason (no KPI source). Empty state when none. |
| Firm brain `/brain` | Memory was Postgres-only (503 on the deploy) → always empty; **fixture brain** when events existed. | Memory events from the store: memories, categories, growth, IC outcomes ("no outcome tracked yet"), pass reasons from the partner's note. Thesis and priors from the firm mandate. Empty state when none. No fixture. |
| Settings `/settings`, `/settings/mandate` | Mandate PUT wrote a file (read-only on Vercel; per instance). | Mandate in the store. One source: saved mandate (durable store) → `MANDATE_JSON` → unset. Without a durable store `MANDATE_JSON` wins and PUT answers 409 with the reason. The page says where the mandate comes from. Settings › Workflow section: still "Not available in this build" (briefs and guardrails; not the deal workflow). |
| Workflow `/workflow` | Redirected to Settings › Workflow ("Not available in this build"). Only on branch `integrate`. | The ten-step deal workflow: founder email or domain → intake → thesis screen (mandate) → data-room draft (dry run) → Crustdata claim checks → partner meeting draft (dry run) → transcript (claims checked: "team of 60" vs headcount 46 is contradicted) → valuation (same local decisions as the deal page, honors `MANDATE_JSON`) → IC memo (model, cited) → IC decision → Portfolio / Passed → firm memory. Credits rounded; cached steps say so. Deals in the store; runs continue after the response (`after()`), a dead run goes stale and can be retried. Addresses masked; no email body sent to the browser. |
| API routes | No `/api/workflow*`, no `/api/portfolio`. Review queue and mandate per instance. Memory 503 without a database. | New: `/api/workflow`, `/api/workflow/inbox` (pitch-like subjects only, no senders), `/api/workflow/:id`, `/api/portfolio`, `/api/storage`. `/api/pipeline/deals` rows carry stage, owner, workflowId. `/api/memory/events` works without a database and returns `storage`. |
| MCP | Not on main. | `npm run mcp` (stdio). Ten tools, among them `deal_workflow_start / _list / _get / _act`. Approve is a dry run unless `confirm` and `DEALDESK_ALLOW_APPROVE=1`. |
| CLI `dealdesk` | Not on main. | `npm run dealdesk -- <cmd>`, incl. `deal start|list|show|act`. |

### Storage

| State | Before | After |
| --- | --- | --- |
| Review queue | `.cache/exceptions.json`; process memory on Vercel | store, namespaces `review_items`, `review_runs` |
| Firm mandate | `.cache/mandate.json` + `MANDATE_JSON` seed | store, `settings/mandate`; `MANDATE_JSON` honored as above |
| Deal stages and owners | none | store, `deal_stages` |
| Deal workflows | none on main | store, `workflows` |
| Organizational memory | Postgres only (off on the deploy) | Postgres table `dealdesk_memory_events`, else store `memory_events` (newest 2000) |
| Crustdata response cache | per instance, in memory | no change |

With `DATABASE_URL` (or `POSTGRES_URL`) set, Postgres tables `dealdesk_docs` and `dealdesk_memory_events` are created on
first use. **The deploy has no database env var today, so all of this is "not durable on this deploy"**, and the UI says
so (Review note, Pipeline footnote, Portfolio and Firm brain subtitles, Workflow page, `GET /api/storage`). A cold
instance still lists pitch-like inbound deals: they are rebuilt from Gmail on every call.

### Env var to approve for durable storage

- **`DATABASE_URL`**: a Postgres connection string. Recommended provider: **Neon via the Vercel Marketplace**
  (Storage → Neon → connect to the project; it sets `DATABASE_URL` and `POSTGRES_URL`, both are read). Use the pooled
  URL. No migration step: the tables are created on first use.
- Optional, not secret: **`DEALDESK_USER_NAME`** (owner and "by" name; unset = "Unassigned" / "Partner (you)").
- Nothing was added to the deploy. No database was created.

### Crustdata credits used in this pass

One live workflow run for efficieno.ai on a local server (file cache on, so repeats cost 0):
identify 0 + enrich 2 + person/search 0.99 + job/search 0.03 + company/search 0.55 + web/search 1 +
company/search (peers, decisions) 5.83 = **10.40 credits**. All other checks used tests with recorded shapes.

## Still needs

- **A database on the deploy** (`DATABASE_URL`). Until then the review queue, stages, workflows, mandate edits and
  memory are per Vercel instance and are lost on a cold start.
- The Crustdata response cache is per instance; a cold instance pays again for the same company.
- Portfolio KPIs (ARR, burn, runway, cash) have no source (no cap-table or KPI connector).
- Firm brain: no anti-portfolio, thesis proposals, agent-read log or outcome tracking; the empty-proposals text in the
  port screen still says Deal Desk suggests changes "after 3+ outcomes", which is not built.
- A workflow run that takes longer than the route's `maxDuration` (300 s) stops; "Retry" resumes it.
- No sign-in: anyone with the URL can act on a deal. Sends stay dry-run unless `OUTBOUND_MODE=live` and the recipient is
  on `DEMO_RECIPIENT_ALLOWLIST`, and only on the Approve action.
- The Gmail trigger of the workflow was checked with tests (fakes), not with a live founder email in this pass.
- `/agents` and the Settings › Workflow section have no live source.
- The sidebar has no "Workflow" entry (the nav is in the port shell; not changed). Reach it from `/ask` "Start deal",
  Today / Pipeline rows of workflow deals, Portfolio, or the URL.

## Pass t330

First-principles production pass over every screen, API route, workflow step, the MCP server and the CLI, plus a skeleton
(loading state) audit. The look of the screens did not change; only data wiring, labels, error handling and skeleton sizes.

### Live mode shows no fixtures

- `/agents`, `/mandates`, `/slack`, `/preview/slack`: the unavailable page (what the screen needs, real connector status).
  They used to render fixture agents, mandates and Slack cards under a "Demo data" badge.
- `/agent` with no `?q=`: the Sourcing agent's request box (it was the fixture Helio flow). `/deal/room` without a domain: "No data room connected".
- Fixture query variants (`?id=helio`, `?state=`, `?frame=`, `?restricted`, `?view=`, `?company=helio` …) are ignored in live mode on
  Today, Deal, Person, Ask, Memo, Pipeline, Portfolio, Brain. The Settings shell no longer shows the fixture firm card.
- The badge never says "Demo data" in live mode. The "backend / builder branch" wording on the unavailable pages now says what is true:
  no source in this build.
- Today's ask card used fixture chips ("Thesis fits", "IC prep") and its Send button sent the literal text `text`. It now shows the research
  agent's example requests and opens `/ask?q=` with what was typed.

### Correctness and honest errors

- Valuation chart: an unpriced company showed "$NaNM" labels; the row now has no labels. Charts show "—" for a missing value.
- Mandate page: an error response crashed the form (read `.mandate` of an error body); it now says the load failed. It has a loading skeleton.
- Workflow list: a failing `/api/workflow` showed "No deals yet"; it now shows the error. Inbox failures name the HTTP status.
  The page container was shrink-to-fit (its width followed its content); it is `w-full` now.
- Today / Pipeline / Memo: a body that is not the review queue is a failure, not an empty list.
- Review: the storage line reserves its height while loading.
- API routes (all of `src/app/api`): JSON errors instead of bare 500s, `cache-control: no-store` on every response, `q` limits on the
  Sourcing agent, unknown `?status=` is a 400, SSE stream stops polling when the client leaves, workflow action bodies are validated
  (400, not 502), portfolio store failure is a 502 (not "no companies"). `docs/API.md` matches (memory works without a database; limit 1..500).
- MCP / CLI / workflow: CLI errors print a message and exit 1, `--flag=a=b` keeps the value, MCP `screen_companies` keeps the server's
  message, `run_deal_workflow` says it is a four-step read (it does not advance a deal) and rejects a bad `until`; a missing firm memory no
  longer blocks a deal from running again; Crustdata errors in the research step are not reported as "no match"; uncited screen and
  valuation facts show as unavailable; money and times use `fmtMoney` / IST; `resume` retries unavailable steps.

### Skeleton audit

`scripts/skeleton-audit.mjs` (Playwright, mocked APIs, 0 credits), `scripts/skeleton-audit-report.mjs`, mocks in `scripts/skeleton-audit/`.
Output and `REPORT.md` are in `/workspace/skeleton_audit` (before/, after/, compare/, raw JSON). New skeletons: `port/src/components/skeletons.tsx`
(Brain, Portfolio, Memo, Deal, Settings, Review) and inline ones for Today, Pipeline, Person, Mandate, Workflow. Each uses the loaded screen's
wrapper grid and the loaded height of each card. Phone widths: Brain, Portfolio and Memo stack to one column under 900 px (they overflowed the viewport).
`/ask?q=` and `/agent?q=` show a result-shaped placeholder from the first moment of the run (summary, filter cards and table or cards; Understood, Steps, summary and results), so the finished result no longer pushes the page; their timeline and steps still grow as the stream arrives. Phone widths of Deal, Memo, Brain, Portfolio and Settings › Connectors were measured and tuned (largest remaining delta at 390: Deal's SVG graph element, Connectors 121 px).

### Remaining blocker

- **Storage is unchanged: no database, no new provider.** The deploy still has no `DATABASE_URL`, so the review queue, stages, workflows,
  mandate edits and memory are per Vercel instance. Approving `DATABASE_URL` (Neon via the Vercel Marketplace) remains the one blocker.
- Not changed, found by the audit: `DELETE /api/connectors/calendar/events/:id` deletes even in dry-run (contacts nobody, `sendUpdates=none`);
  `/api/live/screen` keeps running after the client leaves; Today's mic button has no handler; the pipeline board toggle does nothing in live mode.

## Logic fixes (t330)

Each fix below has a vitest test that failed on the old code (most are in `*audit.test.ts`, `claims.test.ts`, `logic.test.ts`,
`concurrency.test.ts`, `parse.test.ts`). Bug → fix.

**Workflow state machine (`src/lib/workflow`)**
- Two clicks on Approve could both send a live email → one atomic step per deal (in-process lock + `DocStore.update`, atomic in the memory, file and Postgres stores); a second request sees the first's result. A deal that is running refuses actions (409).
- A send that worked followed by a failed save could be sent again → approve is two-phase (mark `sending`, send, record `approved`). A mark is never retried on its own; `resolve_send` (`confirm_sent` / `discard_send`) clears it. Only a 4xx from Google clears the mark by itself.
- A whole-deal save from a slow run could overwrite an action (lost update) → deals carry a `rev`; a stale copy cannot save.
- A retried earlier step moved a Passed or IC deal back to Diligence → stages only move forward; Passed and Portfolio are final, in the deal and in the stage store. A failed stage mirror is recorded and retried.
- Illegal actions changed state (decide twice, transcript after the decision, skip after a transcript, override when the screen passed, resume while running, approve with no recipient or a slot in the past) → each is refused with a message and changes nothing.
- A re-run that ended unavailable kept the old run's facts and memo → the new outcome replaces them.
- Gmail not connected: the run went on and drafted to nobody → it stops at intake. A screen where no criterion could be checked said "done" → unavailable. No free meeting slot used a clashing weekend slot → unavailable. Unknown headcount growth was shown as a cited fact → an uncited unknown. A retried memory step wrote the decision twice → it reuses the event.

**Scoring and valuation**
- Sector "AI" matched "retail" → whole words only. Mandate "US" did not match "USA", "IN" not "India" → country aliases.
- ARR under $1M rounded to 0 and $0.75M to 0.8 → two decimals below $1M. Peers with a negative round or revenue gave a negative multiple → ignored. A swapped revenue range gave a valuation low above high → ordered.
- Check sizes "1.5M", "$2,000,000", "2,00,000", "250k" were rejected → read as USD; booleans and objects rejected. Mandate lists "AI, ai" counted twice → deduped.
- A Review value of "abc" or "150" for a fit score was stored, and resolved decision items are never raised again → refused when entered (400), the item stays open; fit score is 0–100, ARR a positive USD amount.
- The memo showed "~$2500M" while the deal page showed "$2.5B" → one money format.

**Claim checks**
- "~60", "60+", "over 60", "50-60" were read as exactly 60 → qualifiers (approximate, minimum, maximum, range) with matching tolerance. "12 engineers" counted as headcount → removed. Number words, "1,200", "60-person team" now parse.
- Tolerance was relative to the claim only (54 vs 60 differed from 60 vs 54) → symmetric, inclusive, with an absolute floor. A zero headcount contradicted any claim → unverifiable.
- A "5% MoM revenue growth" claim was "verified" by headcount growth, and a MoM claim by a 6-month figure → only a team claim in the window it names is checked; the rest is unverifiable with the reason.
- A "$12M Series A" was compared with total raised → compared with the last round (type-matched). ₹, lakh, crore, € and £ were read as USD or dropped → kept with their currency and unverifiable (no cited FX rate). ARR claims were dropped → shown as unverifiable.
- Company domain: `acme.co.uk` became `acme.co`; calendar, Zoom and mail-provider senders could become the company; "Hi.Thanks" was a domain → fixed. Gmail: the company was taken from the investor's own reply; HTML-only mail fused words and dropped links; a thread with no time was dated 1970 → dropped.

**Review queue, stages, counts**
- Two people resolving different items of one run left the run "waiting" for ever, and concurrent raises lost items → a run's items and status are recomputed from its items; resolves and raises run one at a time.
- Today said "N deals have no fit score" counting Portfolio and Passed deals → only deals on the page.
- Pipeline "+N this week" counted deals touched this week as new → counts deals first seen this week. "Passed this year" and the Firm brain's months used the UTC calendar → IST.
- "59m 40s ago" read "60m ago" and "36h" read "2d ago" → whole units, rounded down.
- The Today greeting follows the viewer's time zone (IST when unknown or invalid; never the server's UTC hour).

**Sourcing parser**: "fewer than 50" included 50 and "more than 200" included 200 → exclusive bounds. "growth under 10%" became "growth of 10% or more" → upper bounds are left unread (shown as not used).

**Inputs**: a bare public suffix ("co.uk") was a company domain; a LinkedIn sub-page link (`/details/experience`) was rejected → fixed.

**From the open list**: `DELETE /api/connectors/calendar/events/:id` respects dry-run (200 `dry_run`, nothing deleted). `/api/live/screen` stops the agent between model turns and before each Crustdata call when the client leaves. The Pipeline Board option is an inert, labelled control in live mode (it linked back to the same table). The mic button is unchanged.

**Still open**: the file store is atomic within one process only (Postgres uses a transaction); an in-process lock does not span serverless instances without a database. A growth claim with no stated subject ("grew 50% in 6 months") is unverifiable (a product choice). "Doubled" with no window is not extracted. The check-size criterion counts "met" when the last round is at least the firm's maximum check, which looks wrong but is a product rule. A memo regenerated after a transcript writes a new `memo.drafted` event each time.
