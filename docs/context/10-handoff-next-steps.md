# 10 · State of play and next steps

Sources: [../HANDOFF.md](../HANDOFF.md) (written at 13:55 IST, 31 Oct 2026), README §3, and the code on this branch.
The handoff predates the decisions merge (`fcdccf7`, `38e2ef3`), so this page is the more current one where they differ.

## State in one paragraph

Live and merged: the LLM research agent (`/ask`), the deterministic sourcing agent (`/agent`), live deal and person
research, the exception queue (`/review`), citation enforcement and the reasons-and-sources panel, Crustdata
resilience, voice (STT, TTS, a conversational session), the decisions contract (`/api/deals/:id/decisions`, with
decisions routed to `/review`), and the responsive shell. Demo and fixture modes were removed and guard tests keep them
out. Nothing outbound is sent.

## Known gaps

| Gap | Impact | Where |
| --- | --- | --- |
| Decision-engine backend not deployed | Fit score, screener verdict, diligence verdict and IC memo figures show "unavailable" (and go to `/review`) unless `DEALDESK_BUILDER_URL` points at a backend | [08](08-decisions-contract.md) |
| `/ask` runs do not feed `/review` | Only `/agent` runs and deal decisions raise exceptions | `fromScreenResult` in `src/lib/exceptions/rules.ts` is not called |
| Model resilience wrapper not wired | `/ask` has no fallback model or tool-JSON repair at runtime | `src/lib/resilience/model.ts` vs `src/app/api/live/screen/route.ts` |
| `DATABASE_URL` unset in dev | Memory panels (`/brain`, `/pipeline`) say "unavailable" | Correct by design; set it on the deployment |
| `/ask` latency and cost | 90–145 s and 20–54 credits per live run | `/agent` is the fast path |
| Rendered architecture diagram is stale | Does not show `/ask`, `/review` or STT | `docs/architecture/*`; the tables in [02](02-architecture.md) are current |
| Pricing is unvalidated | No customer quote | README §1 |
| The earlier UI predates the event | Disclosed in the README "Code history" section | `451e4d9` |

## Next steps (ranked)

1. **Gate** after every merge: `npm run typecheck && npm test`.
2. **Wire `/ask` into the exception queue**: call `fromScreenResult` + `recordRun` from the screen route, as the
   sourcing route does.
3. **Wire `resilientModel`** into `POST /api/live/screen`, with `OPENAI_FAST_MODEL` as the fallback.
4. **Track ("not yet, keep watching")** on Crustdata `/watch/company`. A pass becomes 2–4 measurable milestones (for
   example team ≥ 50, next round raised); the webhook re-opens the deal with the cited change. This needs a public HTTPS
   webhook route with HMAC-SHA256 verification of `x-crustdata-signature`, a deal store, and `DEALDESK_PUBLIC_URL`. The
   client (`watchCompany`, `deleteWatch`, `getWatchRuns`) is already live-verified. Watches must be created explicitly,
   never on page view.
5. **Deploy the decision-engine backend** (thesis gates, screener, data room, pricing, IC memo) and set
   `DEALDESK_BUILDER_URL`. Its fields are accepted only with citations ([08](08-decisions-contract.md)).
6. **Set `DATABASE_URL`** on the deployment so memory is live.
7. **More Crustdata:** `/watch/person` on founders (repeat founders leaving a job), job search as a sourcing signal in
   `/agent`, `/web/enrich/live` to cite a company's own pages, `/account/endpoints` to build the enrich allow-list
   from the account, and the Crustdata MCP server.
8. **Connectors** (Slack, AgentMail, Fireflies) for posting decisions and ingesting transcripts. Outbound stays dry-run
   by default and anything sent goes through `/review`.
9. **Model-written memo prose**, under an "add no facts" rule (today the memo is composed deterministically from cited
   rows).
10. **Regenerate the architecture diagram** from `docs/architecture/architecture.mmd`.

## Where to look

Contributor rules and commands: [AGENTS.md](../../AGENTS.md). Decisions and their reasons:
[../DECISIONS.md](../DECISIONS.md). Robustness: [../ROBUSTNESS.md](../ROBUSTNESS.md). API shapes: [../API.md](../API.md).
