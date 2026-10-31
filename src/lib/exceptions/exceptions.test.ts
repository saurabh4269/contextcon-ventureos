// Exception queue: raise → person approves / rejects / edits → run finishes. Outbound never leaves the server.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Resolution as CompanyResolution } from "@/lib/live/resolve";
import { ambiguousMatch, conflictingData, creditThreshold, missingData, outboundSend, parseRaise } from "./raise";
import { createExceptionStore, ExceptionError } from "./store";
import { resetDocStore } from "@/lib/store/docs";
import type { Artefact } from "./types";

vi.mock("server-only", () => ({}));

const at = new Date("2026-10-31T08:00:00Z");
const store = () => createExceptionStore({ file: null, now: () => at });
const identifyCall = { id: "identify" as const, method: "POST" as const, path: "/company/identify", body: { names: ["Mercury"] }, status: "ok" as const, ms: 120, cached: false, retrievedAt: "2026-10-31T07:51:39.241Z", creditsUsed: "0" };
const ambiguous: Exclude<CompanyResolution, { status: "ok" }> = {
  status: "ambiguous",
  input: "Mercury",
  message: '"Mercury" matches 2 companies; pass domain= or companyId= to pick one.',
  suggestions: [{ companyId: 301, name: "Mercury", domain: "mercury.com", confidence: 1 }, { companyId: 302, name: "Mercury", domain: "mercury.co.uk", confidence: 0.9 }],
  calls: { identify: identifyCall },
};
const artefact: Artefact = {
  kind: "shortlist",
  columns: [{ key: "hq", label: "HQ" }],
  rows: [{ rank: 1, name: "Acme", cells: [{ key: "hq", label: "HQ", value: null, status: "unavailable", reason: "not indexed" }], founders: [], notes: [] }],
};

describe("exception store", () => {
  it("a run with open items waits on a person and finishes when the last one is resolved", () => {
    const s = store();
    const { run, items } = s.recordRun({ id: "run1", source: "sourcing-agent", request: "fintechs in Bengaluru", autoCompleted: 4, artefact }, [
      missingData({ name: "Acme", domain: "acme.example" }, "HQ", "Crustdata has no locations.headquarters for Acme.", { runId: "run1", target: { row: 0, cell: "hq" } }),
      creditThreshold("run1", 42, 40),
    ]);
    expect(run.status).toBe("waiting_on_person");
    expect(s.openCount()).toBe(2);
    const edited = s.resolveException(items[0]!.id, "edit", { value: "Bengaluru, India" });
    expect(edited.item).toMatchObject({ status: "edited", resolution: { effect: 'Value entered by person: “Bengaluru, India” (not from Crustdata).' } });
    expect(edited.run?.artefact?.rows[0]?.cells[0]).toMatchObject({ value: "Bengaluru, India", status: "manual", citation: { source: "Person" } });
    expect(edited.run?.status).toBe("waiting_on_person");
    const last = s.resolveException(items[1]!.id, "approve");
    expect(last.run).toMatchObject({ status: "finished", finishedAt: at.toISOString() });
    expect(s.openCount()).toBe(0);
  });

  it("raising is idempotent per open key; a resolved key can be raised again", () => {
    const s = store();
    const a = s.raiseException(ambiguousMatch(ambiguous));
    expect(s.raiseException(ambiguousMatch(ambiguous)).id).toBe(a.id);
    s.resolveException(a.id, "reject");
    expect(s.raiseException(ambiguousMatch(ambiguous)).id).not.toBe(a.id);
  });

  it("re-running the same request does not duplicate open items (run id and row index differ)", () => {
    const s = store();
    const base = { kind: "missing_data" as const, title: "Founders not reported", subject: { name: "Acme", domain: "acme.in" } };
    const a = s.raiseException({ ...base, key: "run1:r0:missing" } as never);
    const b = s.raiseException({ ...base, key: "run2:r3:missing" } as never);
    expect(b.id).toBe(a.id);
    const c = s.raiseException({ ...base, subject: { name: "Other", domain: "other.in" }, key: "run2:r4:missing" } as never);
    expect(c.id).not.toBe(a.id);
  });

  it("rejects bad resolutions with the right status", () => {
    const s = store();
    const a = s.raiseException(creditThreshold("r", 50, 40));
    expect(() => s.resolveException("nope", "approve")).toThrow(ExceptionError);
    expect(() => s.resolveException(a.id, "edit", { value: "x" })).toThrow(/cannot be edited/);
    s.resolveException(a.id, "approve");
    try {
      s.resolveException(a.id, "approve");
    } catch (e) {
      expect((e as ExceptionError).status).toBe(409);
    }
  });

  it("approving an outbound send runs the dry-run transport only, even with OUTBOUND_MODE=live", () => {
    const prev = process.env.OUTBOUND_MODE;
    process.env.OUTBOUND_MODE = "live";
    try {
      const s = store();
      const item = s.raiseException(outboundSend({ channel: "email", to: "founder@acme.example", subject: "Intro", body: "Hello" }));
      const { item: done } = s.resolveException(item.id, "edit", { value: "Hello, edited" });
      expect(done.resolution?.outbound).toMatchObject({ transport: "dry_run", channel: "email", wouldSend: { to: "founder@acme.example", body: "Hello, edited" } });
      expect(done.resolution?.effect).toMatch(/dry run only, nothing left the server/);
    } finally {
      if (prev === undefined) delete process.env.OUTBOUND_MODE;
      else process.env.OUTBOUND_MODE = prev;
    }
  });

  it("says honestly where items are kept (no DATABASE_URL)", () => {
    expect(store().storage()).toMatchObject({ kind: "memory", note: expect.stringMatching(/DATABASE_URL is unset/) });
  });
});

describe("raise helpers", () => {
  it("ambiguous match lists every candidate with its identify citation and never auto-picks", () => {
    const r = ambiguousMatch(ambiguous, { runId: "run9" });
    expect(r).toMatchObject({ kind: "ambiguous_match", runId: "run9", title: '"Mercury" matches 2 companies', proposed: { label: "Mercury (mercury.com)" } });
    expect(r.evidence).toHaveLength(2);
    expect(r.evidence[1]).toMatchObject({ value: "mercury.co.uk", citation: { endpoint: "POST /company/identify", retrievedAt: identifyCall.retrievedAt } });
    expect(r.reason).toMatch(/never guesses/);
  });

  it("conflicting data shows both values with their sources", () => {
    const cite = { source: "Crustdata", endpoint: "POST /company/enrich", path: "headcount.total", retrievedAt: "2026-10-31T07:51:39.241Z" };
    const r = conflictingData({ name: "Acme" }, "headcount", { label: "model", value: 80 }, { label: "Crustdata", value: 52, citation: cite });
    expect(r.reason).toBe("model says 80, Crustdata says 52. A person decides which stands.");
    expect(r.evidence[1]?.citation).toEqual(cite);
  });

  it("parseRaise validates untrusted input", () => {
    expect(parseRaise(null)).toMatchObject({ ok: false });
    expect(parseRaise({ kind: "made_up", key: "k", title: "t", reason: "r" })).toMatchObject({ ok: false, message: expect.stringMatching(/^kind must be one of/) });
    expect(parseRaise({ kind: "missing_data", key: "", title: "t", reason: "r" })).toMatchObject({ ok: false });
    expect(parseRaise({ kind: "missing_data", key: "k", title: "t", reason: "r" })).toMatchObject({ ok: true, input: { evidence: [] } });
  });
});

describe("/api/exceptions routes", () => {
  afterEach(() => resetDocStore());

  it("raise over HTTP, count for the nav badge, list, then resolve", async () => {
    resetDocStore();
    const list = await import("@/app/api/exceptions/route");
    const one = await import("@/app/api/exceptions/[id]/route");
    const json = (body: unknown) => new Request("http://localhost/api/exceptions", { method: "POST", body: JSON.stringify(body) });

    expect((await list.POST(json({ item: { kind: "nope" } }))).status).toBe(400);
    const raised = await (await list.POST(json({ item: outboundSend({ channel: "slack", to: "#deals", body: "Acme looks good" }) }))).json();
    expect(raised).toMatchObject({ status: "ok", open: 1, item: { kind: "outbound_send", status: "open" } });
    expect(await (await list.GET(new Request("http://localhost/api/exceptions?count=1"))).json()).toEqual({ open: 1 });
    const all = await (await list.GET(new Request("http://localhost/api/exceptions?status=all"))).json();
    expect(all).toMatchObject({ open: 1, storage: { kind: "memory" }, items: [{ id: raised.item.id }] });

    const params = Promise.resolve({ id: raised.item.id });
    const bad = await one.POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ action: "send" }) }), { params });
    expect(bad.status).toBe(400);
    const res = await (await one.POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ action: "approve" }) }), { params })).json();
    expect(res).toMatchObject({ status: "ok", open: 0, item: { status: "approved", resolution: { outbound: { transport: "dry_run" } } } });
    const again = await one.POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ action: "approve" }) }), { params });
    expect(again.status).toBe(409);
    expect((await one.GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: "missing" }) })).status).toBe(404);
  });
});
