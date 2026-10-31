# 08 · Decisions contract

**Route:** `GET /api/deals/:id/decisions`, where `:id` is the company domain (`src/app/api/deals/[id]/decisions/route.ts`).
**Logic:** `src/lib/numbers/decisions.ts`, plus `src/lib/exceptions/decisions.ts` for the review queue.
**Consumers:** `/deal?domain=` (`src/live/deal.tsx`) and `/memo?id=` (`src/live/memo.tsx`).

## Response shape (`DecisionsResponse`)

```
{ dealId, companyDomain,
  source: "crustdata" | "crustdata+builder",
  decisions: { <DecisionKey>: ComputedField },
  endpoints: { <key>: "/api/deals/<id>/decisions#<key>" | "/api/deals/<id>/valuation[#key]" },
  fields: deal numbers + decisions + valuationLow/High/Cap + founderAsk,
  builder?: { status: "used" | "not_configured" | "unavailable", reason? },
  review?: { runId, href, open: [...], resolved: [...] } }
```

The decision keys (`DECISION_KEYS`) are `fitScore`, `screenerVerdict`, `valuationRange`, `returnMultipleLow`,
`returnMultipleHigh`, `compsMedianMultiple`, `diligenceVerdict`, `icMemoArrUsedM`, `icMemoValuation` and
`icMemoCompsLine`. Each one is a `ComputedField` (value, method, inputs, citations, reasoning) or `unavailable` + reason.

## How a response is built

1. `resolveDealNumbers(id)` (`src/lib/numbers/resolve.ts`) runs the same cached Crustdata research as the deal page.
2. `localDecisions()` builds this build's own values:
   - `valuationRange` exists only when both the low and high valuation are ok, and it carries their citations.
   - The return multiples and the comps median come from the valuation route when ok, otherwise from the numbers route.
   - `screenerVerdict` is always unavailable here, with the reason "needs the firm thesis gates and an inbound pitch".
   - Everything passes through `enforceCited`, so an ok value with no source is withheld.
3. `withBuilder()` brings in the optional decision-engine backend (next section).
4. `withReview()` connects the response to the review queue. Pass `?review=0` to read without raising items.

## `DEALDESK_BUILDER_URL` behaviour

| Situation | Result |
| --- | --- |
| Unset (the default) | `builder: { status: "not_configured" }`. Local values only |
| Set | `GET <url>/api/deals/<domain>/decisions`, with an 8 s timeout and `no-store` |
| Non-2xx response | `builder.status: "unavailable"` with "HTTP <code>". Local values are kept |
| Network error or timeout | `unavailable` with "Builder backend unreachable (<error name>)". Local values are kept |
| A field Deal Desk already computed as ok | **Never overwritten** by the builder |
| A builder field that is not `ok`, has a null value, has no citations, or cites `fixture`/`sample`/`demo`/`seed`/`mock` | Dropped (`fromBuilderField` returns null) |
| An accepted builder field | Citations are re-anchored to the call Deal Desk made: endpoint `GET /api/deals/<domain>/decisions`, path `fields.<key>.citations[i]`, our `retrievedAt`. `source: "crustdata+builder"` |
| No usable fields | `unavailable` with "Builder backend returned no cited decisions for this deal" |

Any builder failure falls back to this build's honest values and never to a guess.

## Review queue link

`src/lib/exceptions/decisions.ts` handles the decisions a person can settle (`REVIEWED_DECISIONS`: fit score, screener
verdict, valuation range, diligence verdict and the three IC memo figures):

- An **unavailable** decision raises a `missing_data` item in `/review`.
- An **ok decision that rests on partial inputs** (an input that is itself unavailable) raises a `low_confidence` item.
- A value a person **enters** in `/review` (edit) comes back as ok, cited to that review item and labelled as theirs.
- A **rejected** low-confidence decision is withheld, with the reason.

Run id: `deal:<domain>:decisions`. Tests: `src/lib/numbers/decisions.test.ts`, `src/lib/exceptions/decisions.test.ts`.
