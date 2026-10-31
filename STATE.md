# STATE — Deal Desk, branch `main`

This file tells what each screen shows on the live deploy (`DEALDESK_DATA_MODE=live`) and what is not correct.
Data source words:

- **Crustdata**: a live Crustdata call (cached per server instance).
- **Gmail / Calendar**: a live, read-only Google call.
- **fixture**: sample data from `port/src/fixtures` (demo data).
- **hardcoded**: a value written in the code.
- **tmp file**: a JSON file in `/tmp` (on Vercel each instance has its own `/tmp`, and the file is lost on a cold start).
- **empty**: the screen shows its own empty state.

## Before this pass (main at `410c1b2`)

| Screen / route | Data source (live mode) | Broken | Mock |
| --- | --- | --- | --- |
| Today `/today` | Rows: review queue (tmp file) + decisions (Crustdata) + pitch-like Gmail threads. Inbound card: Gmail counts. Meetings: Calendar. | Every deal shows stage "New". The Next meetings card shows a blank list when no meeting title names a kind. A meeting with no prep brief shows the text "Prep at 2pm". | No fixture rows. Ask chips from fixture `todaySummary.ask`. |
| Deal `/deal?domain=` | Crustdata research + decisions. | The fit tile counts up from a base of 0 when the decisions arrive, so it shows "0 / 100" first. In demo mode the "IC memo" button opens `/memo?id=<domain>`, which shows the NexaFlow sample memo. | None in live mode. |
| Person `/person?linkedin=` | Crustdata. | — | Fixture people for `?id=`. |
| Ask `/ask`, `/ask?q=` | Research agent (model + Crustdata). | — | — |
| Agent `/agent?q=` | Sourcing agent (Crustdata). | 6-month growth can use a point 5 months back and still says "6-month" (the series match allows 45 days). | Plain `/agent` shows the fixture agent. |
| Agents `/agents` | fixture | No live source. | Fixture list, badged "Demo data". |
| Memo `/memo?id=<domain>` | Decisions (Crustdata) + research. | The box labels a Crustdata revenue estimate "Verified ARR". | — |
| Review `/review` | Review queue (tmp file). | On Vercel each instance has its own queue; items vanish on a cold start. | — |
| Pipeline `/pipeline` | Same rows as Today. | Every deal is "Sourced". Owner is always "Unassigned". No stage moves on approve. "In diligence" is "—". | — |
| Portfolio `/portfolio` | empty | Nothing writes a portfolio company. | — |
| Firm brain `/brain` | Memory store (Postgres only). | No `DATABASE_URL` on the deploy, so the API returns 503 and the screen is always empty. When events exist, the screen shows the **fixture** brain. | Fixture brain when memory has events. |
| Settings `/settings` | Connector status (live). Mandate in `/settings/mandate`. | Mandate PUT writes to a file; on Vercel the project dir is read-only, so the write fails. On another instance the saved mandate is not there. | Workflow, members, access, export: "Not available in this build". |
| Workflow `/workflow` | — | Redirects to Settings › Workflow, which says "Not available in this build". The 10-step workflow exists only on branch `integrate`. | — |
| API routes | `/api/live/*`, `/api/deals/:id/*` (Crustdata), `/api/connectors/*` (Google), `/api/exceptions*` (tmp file), `/api/memory/*` (Postgres or 503), `/api/pipeline/deals` (Gmail + memory), `/api/settings/mandate` (file + `MANDATE_JSON`). | No `/api/workflow*`. The mandate file and the review queue file are per instance. | — |
| MCP | — | Not on main (only on `integrate`). | — |
| CLI `dealdesk` | — | Not on main (only on `integrate`). | — |

### Storage before

- Review queue: `.cache/exceptions.json`. On Vercel the project dir is read-only, so the store falls back to process memory.
- Mandate: `.cache/mandate.json`, seeded from `MANDATE_JSON`.
- Organizational memory: Postgres only (`DATABASE_URL`); not set on the deploy, so it is off.
- Deal stages and workflows: no store.
- The deploy has no database, KV or Blob env vars.
