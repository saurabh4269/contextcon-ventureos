# Crustdata credit ledger (hard cap: 30 credits for the whole job)

| Session | Calls | Credits |
| --- | --- | --- |
| Earlier integration sessions (port, live e2b.dev research, unknown-domain check, founder person enrich) | identify 0 · enrich 2 · person search 0.66 · job search 0.75 · web search 1 · company search 1.15 · person enrich 1 · re-runs while fixing request shapes | ≈ 7.6 (as recorded at hand-off) |
| This session (live-only rework, voice, Google, verification) | every research/person request served from the response cache (`cached: true`, `.cache/crustdata`); health checks via `GET /account/credits` (0 credits) | 0 |
| **Total** | | **≈ 7.6 of 30** |

Evidence for this session: every `/api/live/research` call returned `calls.*.cached = true` and the server log has no
`[crustdata]` lines (one is printed per billed network call). `GET /account/credits` reports the balance in Settings › Connectors.
