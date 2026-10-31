// Robustness suite: the research run over real E2B captures with faults injected per endpoint, outage → stale cache,
// failure messages, hostile inputs, and currency / IST rendering. Everything must degrade to an honest error or
// "unavailable" with a reason — never a crash, never an invented number.
import { describe, expect, it } from "vitest";
import { createCrustdataClient, CRUSTDATA_BASE_URL, CrustdataApiError, MemoryResponseCache } from "@/lib/crustdata";
import { CrustdataMalformedResponseError, CrustdataTransportError } from "@/lib/crustdata/http";
import { fmtDate, fmtDateTime, fmtMoney, money } from "@/lib/format";
import { CircuitOpenError } from "@/lib/resilience/breaker";
import { fixtureFetch } from "@/test/crustdata";
import { failureFrom } from "./failure";
import { clean, normalizeCompany, normalizeDomainInput, normalizeLinkedInUrl } from "./normalize";
import { researchCompany } from "./research";

type Fault = number | "network" | "malformed" | "empty-200" | "object-200";
const noSleep = async () => {};

/** Fixture fetch with faults injected for chosen endpoints ("POST /person/search" → 503, …). */
function faultyFetch(faults: () => Record<string, Fault>): typeof fetch {
  const real = fixtureFetch();
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const p = String(input).slice(CRUSTDATA_BASE_URL.length);
    const fault = faults()[`${(init?.method ?? "GET").toUpperCase()} ${p}`];
    if (fault === undefined) return real(input, init);
    if (fault === "network") throw new TypeError("fetch failed");
    if (fault === "malformed") return new Response("<html>502 Bad Gateway</html>", { status: 200 });
    if (fault === "empty-200") return new Response(null, { status: 200 });
    if (fault === "object-200") return new Response(JSON.stringify({ error: "unexpected" }), { status: 200 });
    return new Response(JSON.stringify({ error: { type: "internal_error", message: `injected ${fault}` } }), { status: fault });
  }) as typeof fetch;
}

const client = (faults: Record<string, Fault> | (() => Record<string, Fault>), cache?: MemoryResponseCache) =>
  createCrustdataClient({ apiKey: "test-key-not-real", fetchImpl: faultyFetch(typeof faults === "function" ? faults : () => faults), cache, sleep: noSleep });

describe("research run with injected faults", () => {
  it("keeps the company when founders 503, web search drops and jobs return garbage; each gap says why", async () => {
    const r = await researchCompany(client({ "POST /person/search": 503, "POST /web/search/live": "network", "POST /job/search": "malformed" }), "e2b.dev");
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.calls.founders).toMatchObject({ status: "error" });
    expect(r.calls.founders.error).toContain("503");
    expect(r.calls.news.error).toMatch(/transport error: fetch failed/);
    expect(r.calls.jobs.error).toMatch(/not valid JSON/);
    expect(r.calls.founders.data).toBeUndefined();
    for (const key of ["foundersFound", "openRoles"]) {
      const f = r.fields[key]!;
      expect(f.status).toBe("unavailable");
      if (f.status === "unavailable") expect(f.reason).toMatch(/failed/);
    }
    // the parts that did answer are still real and cited
    const funding = r.fields.fundingTotal!;
    expect(funding.status).toBe("ok");
    if (funding.status === "ok") expect(funding.citations[0]).toMatchObject({ endpoint: "POST /company/enrich", path: expect.stringContaining("total_investment_usd") });
  });

  it.each([500, 503, "network", "malformed", "empty-200", "object-200"] as const)("identify %s → a thrown, retryable failure — never no_match", async (fault) => {
    const err = await researchCompany(client({ "POST /company/identify": fault }), "e2b.dev").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    const f = failureFrom(err);
    expect(f).toMatchObject({ status: "error", retryable: true });
    expect(f.message).not.toMatch(/no match/i);
  });

  it.each([400, 401, 403, 404])("identify %i → a non-retryable failure with the upstream status", async (status) => {
    const err = await researchCompany(client({ "POST /company/identify": status }), "e2b.dev").catch((e: unknown) => e);
    expect(failureFrom(err)).toMatchObject({ status: "error", upstreamStatus: status });
    expect(failureFrom(err).status === "error" && failureFrom(err)).not.toHaveProperty("retryable");
  });

  it("empty results are empty, not invented", async () => {
    const r = await researchCompany(client({}), "zz9-no-such-startup-qx7.com");
    expect(r.status).toBe("no_match");
  });

  it("when Crustdata goes down mid-session the run is served from the last good responses, labelled cached at IST", async () => {
    let down = false;
    const cache = new MemoryResponseCache(0); // expire immediately so the second run must go live first
    const c = client((): Record<string, Fault> => (down ? { "POST /company/identify": 503, "POST /company/enrich": 503, "POST /person/search": 503, "POST /job/search": 503, "POST /web/search/live": 503, "POST /company/search": 503 } : {}), cache);
    const first = await researchCompany(c, "e2b.dev");
    expect(first.status).toBe("ok");
    await new Promise((r) => setTimeout(r, 5));
    down = true;
    const second = await researchCompany(c, "e2b.dev");
    expect(second.status).toBe("ok");
    if (second.status !== "ok" || first.status !== "ok") return;
    expect(second.company).toEqual(first.company);
    expect(second.calls.enrich).toMatchObject({ stale: true, cached: true, retrievedAt: first.calls.enrich.retrievedAt });
    expect(second.calls.enrich.note).toMatch(/^Crustdata unavailable \(HTTP 503\); showing the response cached at \d{1,2} \w{3} \d{4}, \d{2}:\d{2} IST$/);
    const funding = second.fields.fundingTotal!;
    if (funding.status === "ok") expect(funding.citations[0]).toMatchObject({ stale: true, note: second.calls.enrich.note });
  });
});

describe("failure messages are honest and actionable", () => {
  it("circuit open names the route and the IST resume time", () => {
    const f = failureFrom(new CircuitOpenError("Crustdata /company/enrich", Date.parse("2026-10-31T08:15:00Z"), "HTTP 503"));
    expect(f.message).toBe("Crustdata /company/enrich is unavailable after repeated failures; calls are paused until 13:45 IST. No data was invented.");
  });
  it("timeouts, malformed bodies, rate limits and auth errors", () => {
    expect(failureFrom(new CrustdataTransportError("timeout", "Crustdata POST /company/enrich timed out after 30000 ms")).message).toMatch(/timed out after 30000 ms \(retried where safe\)/);
    expect(failureFrom(new CrustdataMalformedResponseError(200, "POST", "/job/search", "<html>"))).toMatchObject({ retryable: true, upstreamStatus: 200 });
    expect(failureFrom(new CrustdataApiError(429, { error: "slow down" }, 30)).message).toMatch(/retry in 30 s/);
    expect(failureFrom(new CrustdataApiError(401, { error: { type: "unauthorized", message: "Invalid API key in request." } })).message).toMatch(/rejected the request \(401\)/);
  });
});

describe("hostile and messy input never crashes the normalizers", () => {
  it.each([
    ["🚀🚀🚀", undefined],
    ["रेज़रपे", undefined],
    ["x".repeat(10_000), undefined],
    ["", undefined],
    ["   ", undefined],
    ["strpe..com", undefined],
    ["RAZORPAY.COM ", "razorpay.com"],
    ["https://www.razorpay.com/about?x=1", "razorpay.com"],
  ])("normalizeDomainInput(%j)", (raw, expected) => {
    expect(normalizeDomainInput(raw)).toBe(expected);
  });

  it("LinkedIn URLs and zero-width noise", () => {
    expect(normalizeLinkedInUrl("🚀")).toBeUndefined();
    expect(normalizeLinkedInUrl("linkedin.com/in/mlejva/?trk=x")).toBe("https://www.linkedin.com/in/mlejva");
    expect(clean("Tomas‎  ‎Valenta")).toBe("Tomas Valenta");
    expect(clean("​​")).toBeUndefined();
  });

  it("a company record with almost nothing in it normalizes to empty fields, not zeros", () => {
    const c = normalizeCompany({ crustdata_company_id: 7 } as never, "acme.example");
    expect(c).toMatchObject({ id: 7, name: "acme.example", domain: "acme.example", industries: [], categories: [] });
    expect(c.headcount.total).toBeUndefined();
    expect(c.funding.totalUsd).toBeUndefined();
    expect(c.web.monthlyVisitors).toBeUndefined();
  });
});

describe("currency and IST rendering", () => {
  it("formats each amount in its own currency — never converted", () => {
    expect(fmtMoney(money(35_000_000, "usd"))).toBe("$35M");
    const inr = fmtMoney(money(2_500_000_000, "INR"));
    expect(inr).toContain("₹");
    expect(inr).not.toContain("$");
    expect(fmtMoney(money(800_000, "EUR"))).toBe("€800K");
    expect(fmtMoney(money(1_000, "QQQ"))).toMatch(/QQQ/); // unknown code: shown, not guessed
    expect(fmtMoney(null)).toBe("—");
  });

  it("renders instants in IST (with date rollover) and calendar dates unshifted", () => {
    expect(fmtDateTime("2026-10-31T07:51:39.241Z")).toBe("31 Oct 2026, 13:21 IST");
    expect(fmtDateTime("2026-10-31T20:00:00Z")).toBe("1 Nov 2026, 01:30 IST");
    expect(fmtDate("2024-03-15")).toBe("15 Mar 2024");
    expect(fmtDateTime("not a date")).toBe("—");
    expect(fmtDateTime(null)).toBe("—");
  });
});
