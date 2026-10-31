# 07 · The `/ask` research agent (LLM)

`/ask` takes any natural-language sourcing request. A model plans and calls Crustdata tools, the server verifies every
value it returns, and you get a ranked, cited table. You can reach it from `/ask`, from `/ask?q=<text>` (runs the text
once), from the assistant dock, and from the sidebar Search row.

## Code map

| Piece | File |
| --- | --- |
| Route: `POST /api/live/screen {"query"}` → NDJSON | `src/app/api/live/screen/route.ts` |
| Agent loop (`runScreenAgent`) | `src/lib/agent/agent.ts` |
| Event and result contract (`ScreenEvent`, `ScreenResult`, `submit_answer`) | `src/lib/agent/contract.ts` |
| Model clients (provider-neutral) | `src/lib/agent/model.ts` |
| Tool registry | `src/lib/agent/tools.ts`, `src/lib/agent/tools/*.ts` |
| Citation checks | `src/lib/agent/cite.ts` |
| UI | `src/live/ask.tsx`, `src/live/screen/*` |

## The loop

1. The route validates the query (non-empty, at most 2000 characters, otherwise 400) and builds the model client from
   the environment. If no model is configured it returns a single `model_unavailable` event (HTTP 503) and searches
   nothing; the UI then offers a one-tap link to `/agent?q=<same text>`, which uses no model. If there is no Crustdata
   key it returns a single `error` event (503).
2. The model plans (a `plan` event) and calls tools (`tool_call`, then `tool_result` with status, rows, credits and ms).
   It checks the rows against the request and re-queries or relaxes filters when needed, and says so in the plan text.
3. Caps: `DEFAULT_MAX_STEPS = 14` model turns and `DEFAULT_CREDIT_CAP = 60` Crustdata credits per run (`agent.ts`).
4. The model finishes by calling `submit_answer`. In that answer, every cell names the tool call (`ref`) and a JSON path
   into that call's raw response.
5. **Server-side verification** (`verify` event, `cite.ts` `checkCell`): the server resolves each path against the
   stored response.
   - **verified**: the value matches.
   - **corrected**: the claim differs, so the Crustdata value is shown in its place (with the claim kept for audit).
   - **unavailable**: there is no resolvable citation, so nothing is shown.

   Each requirement in the request is reported as applied server-side, applied client-side, or unavailable.
6. `final` carries the `ScreenResult` with its citation stats. If the run throws, the stream emits an `error` event
   with the message and does not invent a result.

## Tools (Crustdata only)

`identify_company`, `enrich_companies`, `company_signals`, `search_companies`, `search_people`, `find_founders`,
`enrich_person`, `search_jobs`, `web_search`, plus `submit_answer`. The Crustdata endpoints and costs are in
[03](03-api-and-crustdata.md).

## Model configuration (env var names only)

| Variable | Effect |
| --- | --- |
| `ANTHROPIC_API_KEY` | When set, it takes precedence: the Anthropic Messages API is used. Model from `DEALDESK_LLM_MODEL` (default in `model.ts`) |
| `OPENAI_API_KEY` | Otherwise the OpenAI Responses API with function tools is used |
| `OPENAI_MODEL` | Default `gpt-6.1-sol` |
| `OPENAI_REASONING_EFFORT` | Default `high` |
| `OPENAI_FAST_MODEL` | Intended fallback model for the resilience wrapper (default `gpt-6-luna`); see below |

Keys only ever go into request headers on the server (`modelFromEnv` in `src/lib/agent/model.ts`). With neither key
set the agent is unavailable. No deterministic answer is ever passed off as a model answer.

**Resilience seam (not yet wired):** `src/lib/resilience/model.ts` (`resilientModel`) adds a per-call timeout, retries,
a circuit breaker per model, a fallback model, and repair of malformed tool JSON. It is tested, but the route still
uses `modelFromEnv()` directly. Wiring it in is a next step ([10](10-handoff-next-steps.md)).

## Measured live runs

India B2B founders (the deck request): ≈54 credits, 143 s. US fintech: ≈51 credits, 92 s. EU climate ex-Google
founders: ≈20 credits, 119 s. A typo'd climate request ("germny"): 12.87 credits, 91 s, with 52 of 52 values verified.

## Known gap

`/ask` runs do not feed the exception queue yet. Only `/agent` runs (`fromSourcingRun`) and deal decisions do. The
seam `fromScreenResult` exists in `src/lib/exceptions/rules.ts`, but nothing calls it.
