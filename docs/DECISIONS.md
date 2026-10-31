# Decisions log

Times are IST, 31 Oct 2026 unless noted. Newest last.

| When | Decision | Why | Alternatives rejected |
| --- | --- | --- | --- |
| 10:53 | Start from the previously deployed Deal Desk UI as the shell (`451e4d9`), disclosed in README | Polished screens let event time go to live data and trust, not layout | Rebuild UI from zero (no time to reach the same quality) |
| 11:03 | Port the builder's Crustdata library, not its DB-bound orchestration (`3ed5f36`, `a04e8be`) | The client was self-contained; the orchestration needed the builder's DB and had wrong request bodies | Merge the whole builder backend (too large, broken against live) |
| 11:10 | Rewrite every Crustdata request to the documented shapes, verified live | Live replay showed 400 `filter_shape` on all builder person/job/company search bodies and a broken watch body | Patch call sites one by one |
| 11:10 | Always send `fields` on `/company/enrich` from an allow-list | Without `fields` enrich returns `basic_info` only (2 credits wasted); one denied field 403s the whole call | Request everything |
| 11:10 | Open roles from `/job/search`, not `hiring.*` | `hiring.*` was null for test companies on this plan | Show the null as zero (dishonest) |
| 11:23 | One failing sub-call never hides the others; errors never shown as "no match" | Robustness is 20 % of judging and the old code hid failures | Fail the whole page on any error |
| 11:30 | Every number is a `ComputedField` (value, method, inputs, citations, reasoning) or `unavailable` + reason | "Verified facts with sources" is 20 % of judging; the founder's rule: every number computed and cited | Tooltips with free text |
| 12:12 | Memory in Postgres or explicit 503, no in-memory fallback | An in-memory store would vanish on restart and look persisted | SQLite file, in-memory map |
| 12:12 | One formatter for money and time; money `{amount, currency}`, UTC stored, IST shown | Mixed currencies and time zones were a source of wrong numbers | Format in each component |
| 12:22 | **Remove demo data and fixture mode entirely** (`ccf42bf`), guard tests to keep it out | A judge or partner cannot tell fixture numbers from live ones; trust is the product | Keep a "demo" toggle |
| 12:30 | Voice via ElevenLabs server route; key never reaches the browser | Secrets rule; also lets us cache in dev | Client-side SDK with a public key |
| 12:36 | Gmail/Calendar read-only, OAuth refresh token server-side | Enough for Today; no send scope needed | Gmail send |
| 12:39 | **Outbound dry-run by default** (`OUTBOUND_MODE`); no email send code at all | Event rule: agents contact only the team, Crustdata, Techfest | Send to team addresses only |
| ~13:00 | **Deterministic request parser, no LLM** (later kept as the fallback; see 13:15 and 13:33) | No LLM key at the event yet; a deterministic parser with visible chips is also more auditable | Wait for a key; regex-only with hidden assumptions |
| ~13:00 | Sourcing agent on the deck's Investing request as the hero flow | The deck's rubric rewards "a request it has never seen through to finished work" (25 %) | Single-company deal page as the hero |
| ~13:00 | Relax filters with disclosure instead of returning padding | Too few matches is common for tight filters; disclosure keeps it honest | Silently loosen; or return fewer than asked with no explanation |
| ~13:00 | Recompute growth from `headcount.timeseries` during verification (`run.ts` `growthFromSeries`; Crustdata's own figure shown alongside) | Search-index growth can lag; recomputing gives a citable pair of points | Trust the search filter value |
| 13:21 | **ElevenLabs STT + TTS for facts, plus a Conversational AI session that only navigates** (`bc8115b`) | Every spoken fact must come from cited data: STT feeds the same request box, TTS speaks a deterministic summary. The conversational agent's client tools only open screens or start a run (`run_sourcing`, `open_company`, `open_screen`), so it adds no facts | STT + TTS only (less natural); a conversational agent that answers from its own LLM (uncited) |
| 13:21 | **Original mascot "Dex"** (a round rust fox with reading glasses and a ledger) as logo, favicon and empty/loading states (`port/src/components/brand/mascot.tsx`, `180035a`) | Founder asked for a mascot as the logo; an original drawn-in-code mark in the brand's rust colour, no third-party assets; motion stops under reduced-motion | Stock or AI-generated logo |
| 13:21 | Collapsible sidebar, mobile drawer, responsive pass (`180035a`, `1310616`) | Judges may open the app on a phone; the shell must not hide content | Desktop-only |
| 13:05 | Docs: README in the deck's five sections; honest code-history note | Required by the deck (p30); pre-10:30 code must be disclosed (p28) | Short README |
| 13:15 | **Add an LLM research agent (`/ask`)** with server-side citation checks (`b6ce324`, `c3cd6b9`) | A model key became available; a model handles any phrasing, and the server resolving every cited value keeps the trust rule | Keep the parser only (misses unusual phrasings) |
| 13:23 | **Move the sourcing agent to `src/lib/sourcing` and `/api/sourcing/run`** (`5659f04`) | Frees `src/lib/agent` and the "agent" name for the LLM screener; two agents, two directories, no import tangles | Share one directory with a mode flag |
| 13:28 | Model calls through `resilientModel` (fallback model, tool-JSON repair, shared call budget) | Robustness applies to the model as well as Crustdata | Fail the run on the first model error |
| 13:33 | **Deterministic fallback on `model_unavailable`** (`9d7d17f`) | With no model key `/api/live/screen` returns 503 `model_unavailable` and searches nothing; `/ask` offers `/agent?q=` with the same text. The product still finishes work with no model, and never fakes a model answer | Silently run the parser under the `/ask` label; show only an error |
| 13:44 | Exception queue (`/review`): a person handles only ambiguous / missing / conflicting data, credit threshold and outbound send; the run finishes on the last resolution | The rubric rewards end-to-end without a human; the honest version is "human only for exceptions" | Ask for confirmation at every step |
| 13:49 | **README merge strategy**: one README in the deck's five sections, owned by `docs/submission`; other workstreams wrote `docs/README_ADDITIONS.md`, folded in at the end and deleted; `docs/HANDOFF.md` is the single handoff, workstream notes moved to `docs/WORKSTREAMS.md` | Parallel workers editing README.md would conflict near freeze | Each worker edits README directly |
| 13:55 | Decision engine **not merged** at the time of writing; fields stay "unavailable" with the reason | The builder patch had not arrived (`/workspace/claude_review/builder_patch/`) | Ship placeholder scores (violates the trust rule) |
| Deferred | Track ("not yet, keep watching") on Crustdata `/watch/company` | Needs a public webhook URL with HMAC verification and a deal store; not demo-safe before freeze | Fake alerts (violates the trust rule) |
| Deferred | Warm forward | Event outbound rule and founder-consent flow | — |
| Deferred | Crustdata MCP server | Not needed inside one app | — |
