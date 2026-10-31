# Demo runbook (live, on your own PC)

This runbook assumes `SETUP_LOCAL.md` is done and `npm run dev:demo` is running on **http://localhost:3000**.
All times are IST.

## 10 minutes before

1. Run `npx tsx scripts/preflight.ts`. Every line should be ✓, apart from the expected ! lines (DATABASE_URL, and the live outbound warning if you turned live on).
2. Open Settings › Connectors (`/settings?section=connectors`). Gmail and Calendar should read *Connected as you@example.com*.
3. Decide on dry run or live.
   - For a real email to yourself, set `OUTBOUND_MODE=live` in `.env.local` and restart `npm run dev:demo`.
   - The memo's **Send & schedule** badge then reads *Live · only you@example.com, saurabhgupta0342@gmail.com*.
4. Warm the cache by running the demo request once on `/ask`. Repeats cost no Crustdata credits.
5. Open Gmail for you@example.com and Google Calendar in a second tab, so the audience can see the email and the event arrive.

## Click path

| # | Where | Do | Shows |
| --- | --- | --- | --- |
| 1 | `/ask` | Paste the request and click **Run** | Plan, plus Crustdata tool calls with credits |
| 2 | Results table | Click a value | Citation: endpoint, JSON path, IST time, verified or corrected |
| 3 | Click a company | `/deal?domain=<domain>` | Live headcount, growth and funding, each cited |
| 4 | Deal › decisions | Open fit and verdict, with their criteria | Decisions and what fed them. Partial inputs go to `/review` |
| 5 | **IC memo** | `/memo?id=<domain>` | Memo figures with reasoning and citations |
| 6 | Memo › **Send & schedule** | To is prefilled with you@example.com. Click **Review email**, then **Approve & send to …** | Live: the email arrives in the Gmail tab. Dry run: *"DRY RUN: email … built, not sent"* |
| 7 | Memo › **Find a 30-min slot** | Pick a slot, then click **Approve & book …** | Free slots from your real calendar (10:00–19:00 IST, Mon–Fri). The event appears in Calendar, with no invite emails sent |
| 8 | Optional | Type a non-team address in To and click **Review email** | *"Blocked: … is not on the demo allowlist"*, which shows the safety rule |

## Fallbacks

| Problem | Do |
| --- | --- |
| Primary Crustdata key out of credits (402, or 429 quota) | Nothing. The app switches to `CRUSTDATA_API_KEY_BACKUP` and the trace shows **Backup Crustdata key (primary out of credits)**. Point at it as a robustness beat |
| Both Crustdata keys fail | Re-run a request you already ran (served from cache, labelled with its cached time), or use `/deal?domain=e2b.dev`, which you warmed earlier |
| Crustdata 429 rate limit (not quota) | Wait 20 s and re-run. The trace shows the 429 honestly |
| Model unavailable or slow on `/ask` | Click the link to `/agent?q=…`, the same request with the deterministic agent and no model |
| Gmail or Calendar shows *invalid_grant* or *not connected* | Settings › Connectors › Gmail › **Connect** (on port 3000), then retry. Otherwise demo in dry run: approving still shows the exact email |
| Email didn't arrive | Check Sent in Gmail (you sent it to yourself). The memo panel shows the API result. Check Spam |
| `redirect_uri_mismatch` on Connect | The app is not on port 3000. Stop it and run `npm run dev:demo` |
| Anything in live mode feels risky | Set `OUTBOUND_MODE=dry_run` and restart. Every step still runs, and nothing is sent |
