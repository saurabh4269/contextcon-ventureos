# Crustdata documentation ambiguities (2025-11-01)

Captured while building Deal Desk’s typed client. These are gaps or inconsistencies in the public docs—not bugs in our client.

1. **Raw OpenAPI YAML URLs** (`https://docs.crustdata.com/openapi-specs/2025-11-01/*.yaml`) redirect to **login**, not the YAML file. We extract OpenAPI from embedded blocks in Markdown API reference pages instead (`pnpm crustdata:extract-openapi`).

2. **YAML fence formats** — Most reference pages use ` ```yaml /openapi-specs/…/company.yaml post /company/identify `; **Search Companies** uses a bare ` ```yaml ` line with no path header. The extractor must infer the target spec file from `info.title`.

3. **Error envelope** — API Introduction says most APIs use `description`; Person API uses `reason`. Watch rate-limit examples use nested `error: { type, message, metadata }`. Clients should branch on HTTP status and accept all three shapes.

4. **Company enrich rate limit vs batch size** — Product copy and hackathon brief mention “up to 25 companies per request” for enrich; the embedded OpenAPI and rate-limit table only state **15 RPM** for `/company/enrich`, not a explicit max batch size in the extracted schema. Confirm in dashboard or enrich reference before sending large batches.

5. **Fixture response strictness** — Identify returns a **top-level array** per identifier; enrich returns a **top-level array** of enriched matches. Person search response field names in fixtures must match generated `PersonSearchResponse` (our fixture uses a simplified `results` wrapper—live responses should be validated against generated types after first live call).

6. **Web search path** — Docs and introduction table use `POST /web/search/live`; embedded web.yaml operation id is `datasetWebSearch`. Request/response types are `WebSearchRequest` / `WebSearchResponse` (not `WebSearchLive*`).

7. **Pricing table vs permissions API** — Pricing page lists some endpoints as “Not in the dashboard”; authoritative per-account costs are on `GET /account/endpoints` (free). Static markdown tables can lag.

8. **Person identify credit** — Pricing says **1 credit per match** and unmatched identifiers free; company identify is **free**. Smoke test uses company identify as documented.

9. **Changelog / version drift** — Only a subset of endpoints is in our merged OpenAPI (company/person/job/web/watch). Account, batch, and social_post specs require login to download; enable those endpoints when keys are available and re-run extract/codegen.

10. **Headcount “as_of”** — Enrich schema uses dated snapshots in examples; exact field path for “as of” on headcount timeseries should be taken from `company_data.headcount` in live enrich responses (fixture uses a simplified `as_of` string for Deal Desk UI).

When `CRUSTDATA_API_KEY` is set, run `pnpm crustdata:smoke` and compare live JSON to `docs/crustdata/fixtures/`; adjust fixtures if the API returns additional nullable fields.
