# 09 · Local setup and demo runbook

Full local setup (one command on Windows, Mac or Linux; keys checked before start): [SETUP_LOCAL.md](../../SETUP_LOCAL.md). The [README Quick start](../../README.md#quick-start) is the short version, expanded below.
Full demo script: [../DEMO_SCRIPT.md](../DEMO_SCRIPT.md).

## Local setup

```bash
npm ci
cp .env.example .env.local     # fill in values locally; never commit or paste them anywhere
npm run dev                    # next dev on http://localhost:3240 (check it isn't already running)
```

- **Minimum:** `CRUSTDATA_API_KEY`. Anything missing shows "not connected" or "unavailable" and never a fake value.
- **`/ask` needs** `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`). Without it, `/ask` offers `/agent`.
- **Optional:** the ElevenLabs keys (voice), the Google OAuth trio (Gmail/Calendar), `DATABASE_URL` (memory),
  `DEALDESK_BUILDER_URL` (decision engine), `OUTBOUND_MODE` (keep the default `dry_run`). The full list of names is in
  [../HANDOFF.md](../HANDOFF.md#environment-variables-names-only) and `.env.example`.
- **Gate:** `npm run typecheck && npm test` (vitest, no network). The live contract suite is opt-in and spends credits:
  `npm run crustdata:test:live`.
- **Preflight:** `npx tsx scripts/preflight.ts --offline` reports keys as set/missing only, plus the outbound mode.
  Drop `--offline` to add free pings (Crustdata credits, model reachability).
- Never run `npm run build` while `next dev` is running in the same directory.

## Before a demo (5 min)

1. Run `npx tsx scripts/preflight.ts`.
2. Run the deck request once on `/ask` and once on `/agent`. This warms the cache (repeats cost 0 credits) and fills
   `/review`.
3. Open `/deal?domain=strpe.com` once to warm the did-you-mean lookup.
4. Use a 1440×900 window at 100 % zoom with one tab, notifications off, and mic permission granted for localhost.

An `/ask` run takes about 1.5–2.5 minutes live. Trim the wait in the recording; don't present it as instant.

## Recorded demo (≤ 2:00)

| Time | Where | What it shows |
| --- | --- | --- |
| 0:00–0:20 | `/ask`: paste the deck request ("Find ten Indian B2B software companies founded since 2023 whose team grew by half in the last six months, and tell me who founded each and what they did before.") → **Run** | The model plans and calls Crustdata tools |
| 0:20–0:40 | The plan and tool calls stream (endpoint, credits), then the table | Real calls; rows checked server-side; any relaxation disclosed |
| 0:40–0:55 | Click a value | Citation popover: endpoint, JSON path, IST time, verified / corrected |
| 0:55–1:15 | `/agent` → mic → "fintech startups in Bangalore at seed stage, with their founders" | No model: "Understood" chips, step trace with credits, ranked table |
| 1:15–1:22 | Click a growth or headcount cell | Growth recomputed from the headcount series, with both points cited |
| 1:22–1:37 | `/review` → approve one item | A person handles exceptions only |
| 1:37–1:50 | `/deal?domain=strpe.com` | "No Crustdata match" plus a did-you-mean chip, never a guessed company |
| 1:50–2:00 | `/agent`: **Copy memo**, **CSV**, **Read aloud** | Finished work: memo, sheet, spoken summary |

## Other click checks

| URL | Expect |
| --- | --- |
| `/settings` → Connectors | Real checks: Crustdata `GET /account/credits`, ElevenLabs, Gmail, Calendar |
| `/deal?domain=e2b.dev` | Headcount, growth, funding, open roles, founders, decisions; click a number for its method and citation |
| `/deal?domain=zz9-no-such-startup-qx7.com` | "No Crustdata match", not an error |
| `/person?linkedin=https://www.linkedin.com/in/mlejva` | Founder profile with past employers |
| `/memo?id=e2b.dev` | IC memo figures from the decisions contract, or unavailable with reasons |
| `/today` | Inbox, meetings, greeting (tap if autoplay is blocked) |
| `/brain` | Memory panel, or "memory store not configured (DATABASE_URL)" |

## Backup plan

| Problem | Do |
| --- | --- |
| `/ask` shows "Model unavailable" | Click its link to `/agent?q=…` (the same request, no model) |
| `/ask` is too slow | Lead with `/agent` (it takes seconds) and show `/ask` second, trimmed |
| `/review` is empty | Run any `/agent` request first, or open a deal (unavailable decisions raise items) |
| Mic fails | Type the request instead; the mic shows what failed |
| Read aloud is blocked | Click again: it needs a user gesture |
| Crustdata 429 | Wait 20 s and re-run; the trace shows the 429 honestly |
| Outage drill | Restart with `DEALDESK_SIMULATE_CRUSTDATA_OUTAGE=1`: pages render from the stale cache, labelled "cached at <IST>" |
