# Demo script

Button labels and chip text marked `<!-- VERIFY -->` must be checked against the final `/agent` screen before recording.

## Loom (≤ 2:00)

Deck requirements (p31): a one-sentence intro · a request the product has never seen, through to finished work · show
where each fact came from. Record at 1440×900, browser zoom 100 %, one tab, notifications off. Speak the lines in quotes.

| Time | Screen and exact clicks | Say |
| --- | --- | --- |
| 0:00–0:08 | `/agent`, empty request box, Dex logo visible | "Deal Desk is an associate for venture funds: you ask for deals, it does the sourcing and diligence on live Crustdata, and cites every fact." |
| 0:08–0:22 | Click the **mic** <!-- VERIFY -->, say the request; or paste it. Request: *"Find ten Indian B2B software companies founded since 2023 whose team grew by half in the last six months, and tell me who founded each and what they did before."* Transcript lands in the box | "This is the deck's Investing request. I haven't run it before on camera." |
| 0:22–0:32 | Interpretation chips appear: `India` · `B2B software` · `founded ≥ 2023` · `headcount +50 % / 6 mo` · `10 results` · `founders + past employers` <!-- VERIFY chip text --> | "No LLM here: a deterministic parser turns the request into filters I can see and edit before anything runs." |
| 0:32–0:58 | Click **Run** <!-- VERIFY -->. Step trace streams: company search → (relaxed, with a note, if too few) → enrich verify → founder search → founder enrich. Each step shows latency and credits | "Each step is a real Crustdata call, streamed as it happens, with the credits it cost. If too few companies match, it relaxes one filter and tells you which." |
| 0:58–1:15 | Results table. Hover a growth cell, click it: citation opens with `POST /company/enrich` · `headcount.timeseries[…]` · retrieved time (IST) <!-- VERIFY --> | "Growth isn't taken on trust: it's recomputed from the headcount history, and here are the two data points it used." |
| 1:15–1:30 | Click a company name → `/deal?domain=…`. Click **Open roles** or **Total raised**: method + citation | "Every company opens into a full diligence page. Every number has a method and a source, or it says unavailable and why." |
| 1:30–1:42 | Back. Type a messy request: *"b2b saas in bangalor foundd 2024 grew 300% hirng"* <!-- VERIFY --> → chips show what was understood and what was dropped; or a deal for `zz9-no-such-startup-qx7.com` → "No Crustdata match" | "Messy input gets an honest reading, not a confident guess. Unknown companies are 'no match', never invented." |
| 1:42–1:52 | Click **Export memo** and **CSV** <!-- VERIFY -->; show the markdown memo with source links | "The finished work: a memo and a sheet, every row cited." |
| 1:52–2:00 | Click **Read summary** <!-- VERIFY -->; ElevenLabs speaks a two-sentence summary | "And a spoken summary for the partner on the move. Built on Crustdata." |

Recording rules:
- Run the same request once before recording so responses are cached (repeats cost 0 credits and load fast). Use a
  *different* messy request on camera for the robustness beat, so "never seen" stays true for that one.
- If any step fails live, keep recording: the trace shows the error honestly; say "that's the robustness rule: it says
  what failed instead of hiding it."
- Open the Loom link in a private window before submitting (deck p31).

## Backup plan (live calls slow or failing)

| Problem | Do |
| --- | --- |
| Search or enrich slow (> 10 s) | Talk over the trace ("you're watching real calls"); the cache will make the take-2 fast. Re-record from 0:22 |
| Crustdata 429 | Wait 20 s (limits reset per minute), re-run; the trace shows the 429 honestly |
| `/agent` broken at freeze | Fall back to the deal flow: `/pipeline` research form → `e2b.dev` → click citations → unknown domain → `/today` greeting. Same intro line, same "where facts come from" beat |
| Mic fails (permission, quota) | Paste the request; say "voice is optional". The error message shows what failed |
| Voice summary blocked by autoplay | Click again; it needs a user gesture |
| ElevenLabs quota | Skip the last beat; end on the memo export |

## Finals (5 minutes, live) — outline

| Time | Beat |
| --- | --- |
| 0:00–0:20 | Intro: the job (associate sourcing + first-pass diligence), who pays (funds, banks, diligence firms), the trust rule |
| 0:20–2:30 | Live: a request from the audience or a judge (any sector, any country) → chips → trace → table → citation → deal page |
| 2:30–3:15 | Robustness: messy input, an impossible filter (relaxation disclosed), an unknown domain |
| 3:15–3:50 | Finished work: memo + CSV export, spoken summary |
| 3:50–4:30 | How it's built: architecture slide (`docs/assets/architecture.png`), where Crustdata is called, no LLM |
| 4:30–5:00 | What's next: Track on Crustdata watchers, decision engine, warm forward |

## Likely Q&A

| Question | Answer |
| --- | --- |
| Who pays? | VC funds first (replaces associate hours on sourcing and first-pass diligence), then banks and diligence firms. Per seat, Crustdata credits passed through. |
| Why no LLM? | No key at the event, and it turned out to be a feature: the parser's reading is shown as chips you can edit, and every sentence of the memo comes from cited data, so nothing is hallucinated. An LLM can later phrase text under "add no facts" rules. |
| What failed? | Fixture/demo mode (removed: nobody could tell real from fake); enrich without `fields` (basic_info only); one denied field 403s the whole call; `hiring.*` null on our plan (used `/job/search`); every builder search body 400'd until rewritten to the documented filter tree; live web search is slow and noisy. |
| Hardest case? | Requests the filters can't satisfy exactly. We relax one filter at a time and disclose it, instead of padding the list. Also: "no match" vs "error" must never be confused. |
| How did you test? | vitest on captured live responses through an injected fetch (no network), guard tests that fail on demo data, hard-coded numbers or email-send code; an opt-in live contract suite; a click-through of every route with DOM-vs-API number checks. |
| How much Crustdata does it use? | 7 of the 8 APIs; a fresh single-company diligence costs about 5.6 credits, repeats are free from cache. Next: watchers. |
| What's next? | Track ("not yet, keep watching") on Crustdata watchers with measurable milestones; the decision engine (fit, verdict, valuation, IC memo); warm forward with double opt-in. |
| Was it built today? | The UI shell existed before 10:30 and is disclosed in the README; the live data layer, trust rules, agent and voice were built today (see git log). |
