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
| ~13:00 | **Deterministic request parser, no LLM** | No LLM key at the event; a deterministic parser with visible chips is also more auditable | Wait for a key; regex-only with hidden assumptions |
| ~13:00 | Sourcing agent on the deck's Investing request as the hero flow | The deck's rubric rewards "a request it has never seen through to finished work" (25 %) | Single-company deal page as the hero |
| ~13:00 | Relax filters with disclosure instead of returning padding | Too few matches is common for tight filters; disclosure keeps it honest | Silently loosen; or return fewer than asked with no explanation |
| ~13:00 | Recompute growth from `headcount.timeseries` during verification | Search-index growth can lag; recomputing gives a citable pair of points <!-- VERIFY --> | Trust the search filter value |
| ~13:00 | **ElevenLabs STT + TTS rather than a Conversational AI agent** <!-- VERIFY: final choice --> | Every spoken fact must come from cited data; STT feeds the same parser, TTS speaks a deterministic summary. A conversational agent would need an LLM and client tools in under two hours | Conversational agent with client tools |
| ~13:00 | Original mascot "Dex" (a rust fox) as logo and favicon <!-- VERIFY --> | A memorable, original mark in the brand's rust colour; no third-party assets | Stock or AI-generated logo |
| ~13:00 | Collapsible sidebar, mobile drawer, responsive pass <!-- VERIFY --> | Judges may open the app on a phone; the shell must not hide content | Desktop-only |
| 13:05 | Docs: README in the deck's five sections; honest code-history note | Required by the deck (p30); pre-10:30 code must be disclosed (p28) | Short README |
| <!-- VERIFY --> | Decision engine: merged / not merged at freeze | <!-- VERIFY --> | |
| Deferred | Track ("not yet, keep watching") on Crustdata `/watch/company` | Needs a public webhook URL with HMAC verification and a deal store; not demo-safe before freeze | Fake alerts (violates the trust rule) |
| Deferred | Warm forward | Event outbound rule and founder-consent flow | — |
| Deferred | Crustdata MCP server | Not needed inside one app | — |
