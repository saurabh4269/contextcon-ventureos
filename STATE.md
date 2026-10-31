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
Not matched by design: `/ask?q=` and `/agent?q=` (a streamed run grows step by step, so its timeline becomes a wider result).

### Remaining blocker

- **Storage is unchanged: no database, no new provider.** The deploy still has no `DATABASE_URL`, so the review queue, stages, workflows,
  mandate edits and memory are per Vercel instance. Approving `DATABASE_URL` (Neon via the Vercel Marketplace) remains the one blocker.
- Not changed, found by the audit: `DELETE /api/connectors/calendar/events/:id` deletes even in dry-run (contacts nobody, `sendUpdates=none`);
  `/api/live/screen` keeps running after the client leaves; Today's mic button has no handler; the pipeline board toggle does nothing in live mode.
