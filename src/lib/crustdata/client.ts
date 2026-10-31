import { withCompanyEnrichFields } from "./enrich-fields";
import { buildWatchCompanyBody } from "./watch-body";
import { CrustdataConfigError } from "./mode";
import { CrustdataApiError, crustdataFetch, RateLimiter, CRUSTDATA_BASE_URL, CRUSTDATA_API_VERSION } from "./http";
import { cacheKey, type ResponseCache } from "./cache";
import { staleFallback } from "./stale";
import { CircuitBreaker } from "@/lib/resilience/breaker";
import { remainingMs } from "@/lib/resilience/deadline";
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
  /** Second key (default CRUSTDATA_API_KEY_BACKUP): used automatically once the primary is out of credits. */
  backupApiKey?: string;
  /** Transport override (tests inject a fetch that serves checked-in captures). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Cache for successful live responses (read-only calls only; never watch create/delete). */
  cache?: ResponseCache;
  /** Per-route circuit breaker (tests inject one with a small threshold). */
  breaker?: CircuitBreaker;
  /** Backoff sleep override (tests pass a no-op so retries run instantly). */
  sleep?: (ms: number) => Promise<void>;
  /** Called once per live network call (not for cache hits). Never receives the API key. */
  onLiveCall?: (e: { method: string; path: string; status: "ok" | "error"; creditsUsed: string | null; latencyMs: number; error?: string; key?: CrustdataKeyLabel }) => void;
};

export type CrustdataKeyLabel = "primary" | "backup";
export const BACKUP_KEY_NOTE = "Primary Crustdata key out of credits; served with the backup key (CRUSTDATA_API_KEY_BACKUP)";

/** Out of credits / quota (not a transient rate limit): 402 always; 429 or 403 only when the body says credits/quota. */
export function isQuotaError(e: unknown): boolean {
  if (!(e instanceof CrustdataApiError)) return false;
  if (e.status === 402) return true;
  if (e.status !== 429 && e.status !== 403) return false;
  const text = `${e.message} ${JSON.stringify(e.body ?? "")}`;
  return /credit|quota|insufficient|exhaust|balance|payment|plan limit/i.test(text);
}

type Result<T> = { data: T; meta: CrustdataCallMeta };

const today = () => new Date().toISOString().slice(0, 10); // UTC date of retrieval

export class CrustdataClient {
  private readonly apiKey: string;
  private readonly backupApiKey: string | null;
  /** Sticky: once the primary key runs out of credits every later call uses the backup. */
  private keyInUse: CrustdataKeyLabel = "primary";
  private readonly fetchImpl?: typeof fetch;
  private readonly limiter = new RateLimiter();
  private readonly cache?: ResponseCache;
  private readonly onLiveCall?: CrustdataClientOptions["onLiveCall"];
  private readonly breaker: CircuitBreaker;
  private readonly sleep?: (ms: number) => Promise<void>;

  constructor(opts: CrustdataClientOptions = {}) {
    const key = (opts.apiKey ?? process.env.CRUSTDATA_API_KEY)?.trim();
    if (!key) throw new CrustdataConfigError("Crustdata is not configured: set CRUSTDATA_API_KEY.");
    this.apiKey = key;
    const backup = (opts.backupApiKey ?? process.env.CRUSTDATA_API_KEY_BACKUP)?.trim();
    this.backupApiKey = backup && backup !== key ? backup : null;
    this.fetchImpl = opts.fetchImpl;
    this.cache = opts.cache;
    this.onLiveCall = opts.onLiveCall;
    this.breaker = opts.breaker ?? new CircuitBreaker();
    this.sleep = opts.sleep;
  }

  get baseUrl() {
    return CRUSTDATA_BASE_URL;
  }

  get apiVersion() {
    return CRUSTDATA_API_VERSION;
  }

  /**
   * One live call: cache lookup (when `cacheable`), rate-limited fetch with retries/breaker, cache store on success.
   * When Crustdata is down, a cacheable read falls back to its last good response (meta.stale + "cached at …" note).
   */
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
          meta: { path, creditsUsed: hit.creditsUsed, requestId: hit.requestId, asOf: new Date(hit.storedAt).toISOString().slice(0, 10), retrievedAt: new Date(hit.storedAt).toISOString(), latencyMs: hit.latencyMs, cached: true },
        };
      }
    }
    const t0 = Date.now();
    const call = (label: CrustdataKeyLabel) =>
      crustdataFetch<T>(
        label === "backup" && this.backupApiKey ? this.backupApiKey : this.apiKey,
        path,
        { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
        this.limiter,
        { timeoutMs, retries, fetchImpl: this.fetchImpl, breaker: this.breaker, sleep: this.sleep, deadlineMs: remainingMs() },
      );
    try {
      let label = this.keyInUse;
      let res: Awaited<ReturnType<typeof call>>;
      try {
        res = await call(label);
      } catch (e) {
        if (label !== "primary" || !this.backupApiKey || !isQuotaError(e)) throw e;
        this.onLiveCall?.({ method, path, status: "error", creditsUsed: null, latencyMs: Date.now() - t0, error: `primary key out of credits (${(e as CrustdataApiError).status}); switching to CRUSTDATA_API_KEY_BACKUP`, key: "primary" });
        this.keyInUse = label = "backup";
        res = await call(label);
      }
      const { data, creditsUsed, requestId } = res;
      const latencyMs = Date.now() - t0;
      this.onLiveCall?.({ method, path, status: "ok", creditsUsed, latencyMs, key: label });
      if (key && this.cache) await this.cache.set(key, { data, creditsUsed, requestId, latencyMs, storedAt: Date.now() });
      const keyMeta = label === "backup" ? { keyUsed: label, keyNote: BACKUP_KEY_NOTE } : {};
      return { data, meta: { path, creditsUsed, requestId, asOf: today(), retrievedAt: new Date().toISOString(), latencyMs, cached: false, ...keyMeta } };
    } catch (e) {
      this.onLiveCall?.({ method, path, status: "error", creditsUsed: null, latencyMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e), key: this.keyInUse });
      const stale = await staleFallback(this.cache, key, path, e);
      if (stale) return { data: stale.data as T, meta: stale.meta };
      throw e;
    }
  }

  async identifyCompany(body: CompanyIdentifyRequest): Promise<Result<CompanyIdentifyResponse>> {
    const path = "/company/identify";
    return this.live<CompanyIdentifyResponse>("POST", path, body);
  }

  async enrichCompanies(body: Omit<CompanyEnrichRequest, "fields"> & { fields?: string[] }): Promise<Result<CompanyEnrichResponse>> {
    const path = "/company/enrich";
    // An explicit `fields` list is respected (the sourcing agent retries without a denied group after a 403); without one,
    // every permitted group is requested (no `fields` would return basic_info only).
    const b = body as Record<string, unknown> & { fields?: string[] };
    return this.live<CompanyEnrichResponse>("POST", path, b.fields?.length ? b : withCompanyEnrichFields(b));
  }

  async searchCompanies(body: CompanySearchRequest): Promise<Result<CompanySearchResponse>> {
    const path = "/company/search";
    return this.live<CompanySearchResponse>("POST", path, body);
  }

  async searchPeople(body: Record<string, unknown>): Promise<Result<PersonSearchResponse>> {
    const path = "/person/search";
    return this.live<PersonSearchResponse>("POST", path, body);
  }

  async enrichPeople(body: Record<string, unknown>): Promise<Result<PersonEnrichResponse>> {
    const path = "/person/enrich";
    return this.live<PersonEnrichResponse>("POST", path, body);
  }

  async searchJobs(body: Record<string, unknown>): Promise<Result<JobSearchResponse>> {
    const path = "/job/search";
    return this.live<JobSearchResponse>("POST", path, body);
  }

  async webSearchLive(body: WebSearchLiveRequest): Promise<Result<WebSearchLiveResponse>> {
    const path = "/web/search/live";
    return this.live<WebSearchLiveResponse>("POST", path, body, { timeoutMs: 20_000, retries: 2 });
  }

  /** Free account introspection (`GET /account/credits`). Never cached. */
  async getAccountCredits(): Promise<Result<unknown>> {
    const path = "/account/credits";
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
    const res = await this.live<{ id: string | number }>("POST", path, body, { cacheable: false });
    return { data: { id: res.data.id }, meta: res.meta };
  }

  async deleteWatch(watchId: string): Promise<{ meta: CrustdataCallMeta }> {
    const path = `/watch/company/${encodeURIComponent(watchId)}`;
    const { meta } = await this.live<null>("DELETE", path, undefined, { cacheable: false });
    return { meta };
  }

  async getWatchRuns(watchId: string): Promise<Result<unknown>> {
    const path = `/watch/company/${encodeURIComponent(watchId)}/runs`;
    return this.live<unknown>("GET", path, undefined, { cacheable: false });
  }
}

export function createCrustdataClient(opts?: CrustdataClientOptions) {
  return new CrustdataClient(opts);
}

