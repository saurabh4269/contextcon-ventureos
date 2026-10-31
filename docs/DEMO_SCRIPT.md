# Demo script

One Loom (≤ 2:00), then the finals outline (5 min live) and Q&A. All URLs are on the dev server
(`npm run dev`, http://localhost:3240). Deck requirements (p31): a one-sentence intro, a request the product has never
seen taken through to finished work, and where each fact came from.

## Before recording (5 min)

| Do | Why |
| --- | --- |
| `npx tsx scripts/preflight.ts` | Keys present (set/missing only), outbound is dry-run, Crustdata credits and model reachable |
| Run the deck request once on `/ask` and once on `/agent` | Crustdata responses are cached (repeats cost 0 credits); `/agent` then fills `/review` |
| Open `/deal?domain=strpe.com` once | Warms the did-you-mean lookup |
| 1440×900, zoom 100 %, one tab, notifications off, mic permission granted for localhost | Clean take |

An `/ask` run takes about 1.5–2.5 minutes live (model + Crustdata). **Trim the wait in Loom's editor** after the
first tool calls appear; do not pretend it is instant.

## Sidebar click path (Efficieno / inbound deal)

Do **not** type a domain. The left sidebar is labelled **Work** / **Agents** / **Firm**.

**Before recording:** from Shiwani's Gmail, send this to the connected inbox. The subject **must** contain `efficieno.ai` or the row will not become a deal.

- To: the Gmail connected in Settings › Connectors
- Subject: `Efficieno AI (efficieno.ai) — seed pitch`
- Body: any short pitch; include `https://efficieno.ai` once

Then (sidebar labels stay the same; you click a row *inside* the page):

1. In the **left sidebar**, under **Work**, click **Today** (sun icon, first item).
2. On Today, the left card is titled **Inbound**. Click the Efficieno pitch row — the right edge says **Open deal**. That opens the deal page.
3. **Or** in the same sidebar click **Pipeline** (stacked-layers icon, directly under Today). On that page, click the Efficieno row in the company list.
4. On the deal page wait for research to finish. Click any number to open its source. The two header buttons are **Data room** and **IC memo**. Click **IC memo** (there is no "Proceed to diligence" button).
5. On the memo, scroll, then click **Find a 30-min slot**. Click a time, then **Approve & book …**. Click **Review email**, then **Approve & send to …**. Dry run builds the email and does not send it.

## Loom (≤ 2:00)

| Time | URL and clicks | Say |
| --- | --- | --- |
| 0:00–0:08 | http://localhost:3240/ask (Dex in the sidebar) | "Deal Desk is an associate for venture funds: ask for deals, it does the sourcing and first-pass diligence on live Crustdata, and cites every fact." |
| 0:08–0:20 | Paste the deck request, click **Run**: *"Find ten Indian B2B software companies founded since 2023 whose team grew by half in the last six months, and tell me who founded each and what they did before."* | "This is the deck's Investing request. The model plans and calls Crustdata tools." |
| 0:20–0:40 | Plan and tool calls stream (endpoint, credits). *Trim the wait.* Result table appears | "Each step is a real Crustdata call. Rows that don't meet the ask are checked server-side, and any relaxation is disclosed." |
| 0:40–0:55 | Click a value in the table: citation popover (endpoint, JSON path, retrieved time in IST, verified / corrected) | "Nothing the model says is trusted: the server resolves every value against the cited response. Verified, corrected to Crustdata's value, or unavailable." |
| 0:55–1:15 | http://localhost:3240/agent → click the **mic**, say *"fintech startups in Bangalore at seed stage, with their founders"* → it runs. "Understood" chips, step trace with credits, ranked table | "No model at all here: the deterministic agent is the fallback if the model is down. You see exactly what it understood and what each step cost." |
| 1:15–1:22 | Click a growth or headcount cell → citation | "Growth is recomputed from the monthly headcount series; here are the points it used." |
| 1:22–1:37 | Click **Review** in the sidebar (count badge) → http://localhost:3240/review. One item with its reason, e.g. missing or conflicting data → click its approve action | "A person only steps in for exceptions. Everything else finished on its own." |
| 1:37–1:50 | http://localhost:3240/deal?domain=strpe.com → "No Crustdata match" with a did-you-mean chip (Stripe) | "Messy input gets an honest answer: a typo'd domain is no match, with a suggestion, never a guessed company." |
| 1:50–2:00 | Back on `/agent`: **Copy memo (markdown)**, **CSV**, **Read aloud** | "Finished work: a cited memo, a sheet and a spoken summary. Built on Crustdata." |

If a live step fails on camera, keep recording: the trace shows the error and the reason. Say "that's the robustness
rule: it says what failed instead of hiding it."

## Backup plan

| Problem | Do |
| --- | --- |
| `/ask` shows "Model unavailable" | Click its link to `/agent?q=…` (same request, no model); say "this is the fallback" |
| `/ask` too slow for the take | Lead with `/agent` (seconds, not minutes) and show `/ask` as the second beat, trimmed |
| `/review` empty | Run any `/agent` request first; only `/agent` runs feed the queue |
| Mic fails (permission, quota) | Type the request; the mic shows what failed |
| Read aloud blocked by autoplay | Click again; it needs a user gesture |
| Crustdata 429 | Wait 20 s, re-run; the trace shows the 429 honestly |

## Finals (5 minutes, live)

| Time | Beat | URL |
| --- | --- | --- |
| 0:00–0:20 | The job (associate sourcing + first-pass diligence), who pays (funds, banks, diligence firms), the trust rule | `/landing` |
| 0:20–2:00 | A request from a judge (any sector, any country) on `/ask`; while it runs, the same request on `/agent` | `/ask`, `/agent` |
| 2:00–2:40 | Citations: verified / corrected / unavailable; growth from the headcount series; open a company's deal page | `/deal?domain=<a result>` |
| 2:40–3:20 | Robustness: typo'd domain (did-you-mean); optionally the outage drill (pre-restarted server with `DEALDESK_SIMULATE_CRUSTDATA_OUTAGE=1`: pages render from stale cache labelled "cached at <IST>") | `/deal?domain=strpe.com`, `/deal?domain=e2b.dev` |
| 3:20–3:50 | Exceptions: approve one item; memo + CSV; spoken summary | `/review`, `/agent` |
| 3:50–4:30 | How it's built: architecture, where Crustdata is called, where the model plans | README diagram |
| 4:30–5:00 | Next: Track on Crustdata watchers, decision engine, warm forward | — |

## Likely Q&A

| Question | Answer |
| --- | --- |
| Who pays? | VC funds first (replaces associate hours on sourcing and first-pass diligence), then banks and diligence firms. Hypothesis: per seat, Crustdata credits passed through at cost. Not yet validated with a paying customer. |
| Where is the model? | `/ask`: an OpenAI model (default `gpt-6.1-sol`, reasoning `high`; Anthropic if configured) plans and calls Crustdata tools within a 60-credit cap. The server checks every value against the cited response. With no model key, `/ask` offers `/agent`, which uses no model. |
| What does a failure look like? | Crustdata 5xx or timeout: retried with backoff under a deadline; breaker opens on repeated failure; the last good response is shown labelled "cached at <IST>", or the step says what failed. Never invented. |
| What failed while building? | Fixture/demo mode (removed); enrich without `fields` (basic_info only); one denied field 403s the whole call; `hiring.*` null on our plan (used `/job/search`); builder search bodies 400'd until rewritten to the documented filter tree; live web search is slow and noisy. |
| Hardest case? | Requests the filters can't satisfy exactly. Relax one constraint at a time and disclose it, instead of padding. And "no match" must never be confused with "error". |
| How did you test? | vitest on captured live responses through an injected fetch (no network); fault-injection suites (4xx/429/5xx, timeouts, malformed bodies, breaker, stale cache); guard tests that fail on demo data, hard-coded numbers, uncited values or email-send code; an opt-in live contract suite. |
| How much Crustdata does it use? | 7 of the 8 data APIs. A fresh single-company diligence costs about 5.6 credits; repeats are free from cache. Not yet: watchers and MCP (see `docs/CRUSTDATA_USAGE.md`). |
| What's next? | Track ("not yet, keep watching") on Crustdata watchers; the decision engine (fit, verdict, valuation, IC memo); `/ask` runs into the exception queue; warm forward with double opt-in. |
| Was it built today? | The UI shell existed before 10:30 and is disclosed in the README; the live data layer, trust rules, both agents, the exception queue, resilience and voice were built today (see `git log`). |
