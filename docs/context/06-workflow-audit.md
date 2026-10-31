# 06 · Workflow audit: requirements vs what exists

Sources: the team's pre-event requirements audit (`AUDIT_RESULTS.md`, `BACKEND_GAPS.md`, `UI_GAPS.md`, 31 Oct 2026,
about 10:10–11:00 IST). That audit ran against the **earlier** UI and backend, before this repo's live data layer
existed. It found 165 requirements: 39 done, 105 partial, 12 missing, 6 contradicted and 3 unverified. This page keeps
only the product facts and shows where each theme stands on this branch.

## Themes the audit raised, and status now

| Requirement theme | What the audit found (earlier code) | Status on this branch |
| --- | --- | --- |
| Verifiable citations on every number | Source chips fell back to `#`; one comps band was cited to Crustdata but was a fixed string | **Addressed.** `ComputedField` + `enforceCited`. Uncited values are withheld. `/ask` values are resolved server-side ([04](04-trust-rules.md)) |
| No invented data / no fixtures in the product | Sample-data files fed most screens, and cross-screen numbers disagreed (the same company had different fit scores on different screens) | **Addressed by removal.** Fixtures and demo mode were deleted, a guard test enforces it, and screens without a live source show an unavailable page with the reason |
| No fake success | Connect/Sync/Save showed success with no 2xx response; missing message ids were made up | **Addressed.** Health checks make real calls (`src/lib/live/integrations.ts`); outbound is dry-run and says "Dry run — not sent" |
| Crustdata calls follow the documented shapes | Search bodies returned 400 `filter_shape`; enrich without `fields`; the watch body was broken | **Addressed.** Rewritten to the documented filter tree and verified live; enrich uses an allow-list |
| Runs end to end with no human | No live end-to-end run existed | **Partly addressed.** Request → shortlist → memo/CSV runs live (`/agent`, `/ask`). A person is needed only for exceptions (`/review`). The full deal journey (inbound → IC → portfolio) is not built |
| Comps-based pricing / valuation as a range | Private comps were invented | **Honest subset.** Valuation comes only from cited Crustdata inputs, otherwise it is unavailable and raised to `/review` |
| Data-room request after the first meeting; data-room ingest and tie-out | The order was wrong in the old journey, and ingest was not inspected | **Not built.** `/deal/room` is an unavailable page |
| Scheduling with the right partner; note-taker transcripts | Not wired live | **Not built**, apart from Calendar read and a dry-run invite |
| IC memo with clickable sources | Memo citations were dead or invented | **Partly built.** `/memo?id=` reads cited figures from the decisions contract; `/agent` exports a cited memo |
| Portfolio monitoring / watcher | Not wired | **Not built.** The `/watch/company` client exists; Track is the top next item |
| Firm brain ("own your intelligence") | Fixture-backed | **Partly built.** Real append-only memory in Postgres; without `DATABASE_URL` it says it is unavailable |
| Real connectors (Gmail, Calendar, Slack, Fireflies, AgentMail) | Mostly mocks | Gmail and Calendar are real (read; calendar write dry-run). Slack, Fireflies and AgentMail show connector status only |
| LLM errors surfaced, not swallowed | Not handled | **Mostly addressed.** `model_unavailable` (503) offers `/agent?q=`; model API errors surface in the stream. The fallback-model / tool-JSON-repair wrapper (`src/lib/resilience/model.ts`) is not yet wired into the route |
| Identity graph (person ↔ company) visible | Shown only as a table | Founders and their past employers appear on the deal page, the person page and agent rows. There is no graph view |
| Banking mode (conflicts → engagement → KYC, mandates) | Partial | **Not built.** `/mandates` is unavailable |
| MCP / CLI access to firm data | Missing | **Not built** (see [03](03-api-and-crustdata.md)) |
