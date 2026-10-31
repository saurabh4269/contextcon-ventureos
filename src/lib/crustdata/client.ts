import {
  FIXTURE_LABEL,
  loadFixture,
  loadFixtureForDomain,
  loadFixtureForCompanyId,
  loadWatchCreateFixture,
  domainForFixtureCompanyId,
  hasFixtureForCompanyId,
} from "./fixtures";
import { FIXTURE_CREDITS } from "./credits";
import { withCompanyEnrichFields } from "./enrich-fields";
import { companyIdFromJobSearchBody } from "./job-queries";
import { companyIdFromPersonSearchBody } from "./person-queries";
import { buildWatchCompanyBody } from "./watch-body";
import { resolveCrustdataMode } from "./mode";
import { crustdataFetch, RateLimiter, CRUSTDATA_BASE_URL, CRUSTDATA_API_VERSION } from "./http";
import { cacheKey, type ResponseCache } from "./cache";
import type {
  CompanyEnrichRequest,
  CompanyEnrichResponse,
  CompanyIdentifyRequest,
  CompanyIdentifyResponse,
  CompanySearchRequest,
  CompanySearchResponse,
  CrustdataCallMeta,
  JobSearchResponse,
  PersonEnrichResponse,
  PersonSearchResponse,
  WebSearchLiveRequest,
  WebSearchLiveResponse,
} from "./types";

export type CrustdataClientOptions = {
  apiKey?: string;
  /** When true, never call the network (even if apiKey is set). Tests only. */
  forceFixture?: boolean;
  /** Cache for successful live responses (read-only calls only; never watch create/delete). */
  cache?: ResponseCache;
  /** Called once per live network call (not for cache hits). Never receives the API key. */
  onLiveCall?: (e: { method: string; path: string; status: "ok" | "error"; creditsUsed: string | null; latencyMs: number; error?: string }) => void;
};

type Result<T> = { data: T; meta: CrustdataCallMeta };

const today = () => new Date().toISOString().slice(0, 10);

export class CrustdataClient {
  readonly mode: "live" | "fixture";
  private readonly apiKey?: string;
  private readonly limiter = new RateLimiter();
  private readonly cache?: ResponseCache;
  private readonly onLiveCall?: CrustdataClientOptions["onLiveCall"];

  constructor(opts: CrustdataClientOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.CRUSTDATA_API_KEY;
    this.mode = resolveCrustdataMode({ apiKey: this.apiKey, forceFixture: opts.forceFixture });
    this.cache = opts.cache;
    this.onLiveCall = opts.onLiveCall;
  }

  get baseUrl() {
    return CRUSTDATA_BASE_URL;
  }

  get apiVersion() {
    return CRUSTDATA_API_VERSION;
  }

  private fixture<T>(path: string, data: T, credits: string): Result<T> {
    return {
      data,
      meta: { mode: "fixture", path, creditsUsed: credits, requestId: null, asOf: today(), retrievedAt: new Date().toISOString(), latencyMs: 0, cached: false, fixtureLabel: FIXTURE_LABEL },
    };
  }

  /** One live call: cache lookup (when `cacheable`), rate-limited fetch, cache store on success. */
  private async live<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body: unknown,
    { cacheable = true, timeoutMs, retries }: { cacheable?: boolean; timeoutMs?: number; retries?: number } = {},
  ): Promise<Result<T>> {
    const key = cacheable && this.cache ? cacheKey(method, path, body) : undefined;
    if (key && this.cache) {
      const hit = await this.cache.get(key);
      if (hit) {
        return {
          data: hit.data as T,
          meta: { mode: "live", path, creditsUsed: hit.creditsUsed, requestId: hit.requestId, asOf: new Date(hit.storedAt).toISOString().slice(0, 10), retrievedAt: new Date(hit.storedAt).toISOString(), latencyMs: hit.latencyMs, cached: true },
        };
      }
    }
    const t0 = Date.now();
    try {
      const { data, creditsUsed, requestId } = await crustdataFetch<T>(
        this.apiKey!,
        path,
        { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
        this.limiter,
        { timeoutMs, retries },
      );
      const latencyMs = Date.now() - t0;
      this.onLiveCall?.({ method, path, status: "ok", creditsUsed, latencyMs });
      if (key && this.cache) await this.cache.set(key, { data, creditsUsed, requestId, latencyMs, storedAt: Date.now() });
      return { data, meta: { mode: "live", path, creditsUsed, requestId, asOf: today(), retrievedAt: new Date().toISOString(), latencyMs, cached: false } };
    } catch (e) {
      this.onLiveCall?.({ method, path, status: "error", creditsUsed: null, latencyMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  }

  async identifyCompany(body: CompanyIdentifyRequest): Promise<Result<CompanyIdentifyResponse>> {
    const path = "/company/identify";
    if (this.mode === "fixture") {
      return this.fixture(path, loadFixtureForDomain<CompanyIdentifyResponse>("company-identify", body.domains?.[0] ?? undefined), FIXTURE_CREDITS.identify);
    }
    return this.live<CompanyIdentifyResponse>("POST", path, body);
  }

  async enrichCompanies(body: Omit<CompanyEnrichRequest, "fields"> & { fields?: string[] }): Promise<Result<CompanyEnrichResponse>> {
    const path = "/company/enrich";
    if (this.mode === "fixture") {
      const ids = body.crustdata_company_ids ?? [];
      const domain = body.domains?.[0]?.trim() || domainForFixtureCompanyId(Number(ids[0])) || undefined;
      if (!domain) {
        throw new Error(`No enrich fixture for request (ids=${JSON.stringify(ids)}). Pass domains[] or a mapped crustdata_company_id.`);
      }
      return this.fixture(path, loadFixtureForDomain<CompanyEnrichResponse>("company-enrich", domain), FIXTURE_CREDITS.enrichCompany);
    }
    return this.live<CompanyEnrichResponse>("POST", path, withCompanyEnrichFields(body as Record<string, unknown>));
  }

  async searchCompanies(body: CompanySearchRequest): Promise<Result<CompanySearchResponse>> {
    const path = "/company/search";
    if (this.mode === "fixture") {
      return this.fixture<CompanySearchResponse>(path, { companies: [], next_cursor: null, total_count: 0 }, FIXTURE_CREDITS.companySearchPerRow);
    }
    return this.live<CompanySearchResponse>("POST", path, body);
  }

  async searchPeople(body: Record<string, unknown>): Promise<Result<PersonSearchResponse>> {
    const path = "/person/search";
    if (this.mode === "fixture") {
      const companyId = companyIdFromPersonSearchBody(body);
      // Unknown company in fixture mode = an empty roster (there is no fixture for it), not an error swallowed.
      const data =
        companyId != null && hasFixtureForCompanyId("person-search", companyId)
          ? loadFixtureForCompanyId<PersonSearchResponse>("person-search", companyId)
          : loadFixture<PersonSearchResponse>("person-search-empty.json");
      return this.fixture(path, data, FIXTURE_CREDITS.personSearchFounderPerRow);
    }
    return this.live<PersonSearchResponse>("POST", path, body);
  }

  async enrichPeople(body: Record<string, unknown>): Promise<Result<PersonEnrichResponse>> {
    const path = "/person/enrich";
    if (this.mode === "fixture") {
      return this.fixture(path, loadFixture<PersonEnrichResponse>("person-enrich-e2b-founder.json"), FIXTURE_CREDITS.personEnrich);
    }
    return this.live<PersonEnrichResponse>("POST", path, body);
  }

  async searchJobs(body: Record<string, unknown>): Promise<Result<JobSearchResponse>> {
    const path = "/job/search";
    if (this.mode === "fixture") {
      const companyId = companyIdFromJobSearchBody(body);
      const data =
        companyId != null && hasFixtureForCompanyId("job-search", companyId)
          ? loadFixtureForCompanyId<JobSearchResponse>("job-search", companyId)
          : loadFixture<JobSearchResponse>("job-search-empty.json");
      return this.fixture(path, data, FIXTURE_CREDITS.jobSearchPerRow);
    }
    return this.live<JobSearchResponse>("POST", path, body);
  }

  async webSearchLive(body: WebSearchLiveRequest): Promise<Result<WebSearchLiveResponse>> {
    const path = "/web/search/live";
    if (this.mode === "fixture") {
      return this.fixture(path, loadFixture<WebSearchLiveResponse>("web-search-live.json"), FIXTURE_CREDITS.webSearchLive);
    }
    return this.live<WebSearchLiveResponse>("POST", path, body, { timeoutMs: 20_000, retries: 2 });
  }

  /** Free account introspection (`GET /account/credits`). Never cached. */
  async getAccountCredits(): Promise<Result<unknown>> {
    const path = "/account/credits";
    if (this.mode === "fixture") throw new Error("getAccountCredits is live-only");
    return this.live<unknown>("GET", path, undefined, { cacheable: false });
  }

  /**
   * Create an entity watch. Requires an explicit webhook URL (or DEALDESK_PUBLIC_URL) — there is no placeholder fallback,
   * and nothing in the UI calls this on page view (the builder created one watch per pipeline run and never deleted it).
   */
  async watchCompany(input: { crustdataCompanyId: number; webhookUrl?: string }): Promise<Result<{ id: string | number }>> {
    const path = "/watch/company";
    const webhook =
      input.webhookUrl ??
      (process.env.DEALDESK_PUBLIC_URL ? `${process.env.DEALDESK_PUBLIC_URL.replace(/\/$/, "")}/api/webhooks/crustdata` : undefined);
    if (!webhook?.trim()) {
      throw new Error("Crustdata watch requires a webhook URL (pass webhookUrl or set DEALDESK_PUBLIC_URL).");
    }
    const body = buildWatchCompanyBody({ crustdataCompanyId: input.crustdataCompanyId, webhookUrl: webhook });
    if (this.mode === "fixture") {
      return this.fixture(path, { id: loadWatchCreateFixture().id }, FIXTURE_CREDITS.watchCreate);
    }
    const res = await this.live<{ id: string | number }>("POST", path, body, { cacheable: false });
    return { data: { id: res.data.id }, meta: res.meta };
  }

  async deleteWatch(watchId: string): Promise<{ meta: CrustdataCallMeta }> {
    const path = `/watch/company/${encodeURIComponent(watchId)}`;
    if (this.mode === "fixture") return { meta: this.fixture(path, null, FIXTURE_CREDITS.watchCreate).meta };
    const { meta } = await this.live<null>("DELETE", path, undefined, { cacheable: false });
    return { meta };
  }

  async getWatchRuns(watchId: string): Promise<Result<unknown>> {
    const path = `/watch/company/${encodeURIComponent(watchId)}/runs`;
    if (this.mode === "fixture") return this.fixture(path, { runs: [] }, FIXTURE_CREDITS.watchCreate);
    return this.live<unknown>("GET", path, undefined, { cacheable: false });
  }
}

export function createCrustdataClient(opts?: CrustdataClientOptions) {
  return new CrustdataClient(opts);
}

