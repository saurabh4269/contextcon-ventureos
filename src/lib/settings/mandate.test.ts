import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createMandateStore, EMPTY_MANDATE, parseMandate, unsetMandateFields } from "./mandate";
import { createFileDocStore, createMemoryDocStore, resetDocStore } from "@/lib/store/docs";

describe("parseMandate", () => {
  it("normalises lists (comma strings, trims, dedupes) and keeps unset fields unset", () => {
    const p = parseMandate({ sectors: "Fintech, AI ,Fintech", stages: ["seed", ""], geos: [] }, new Date("2026-10-31T08:00:00Z"));
    expect(p).toEqual({ ok: true, mandate: { sectors: ["Fintech", "AI"], stages: ["seed"], geos: [], checkSizeUsd: {}, priors: {}, updatedAt: "2026-10-31T08:00:00.000Z" } });
    if (!p.ok) throw new Error();
    expect(unsetMandateFields(p.mandate)).toEqual(["geographies", "check size"]);
  });

  it("accepts numeric strings and ranges", () => {
    const p = parseMandate({ checkSizeUsd: { min: "250000", max: 2_000_000 }, priors: { dilutionPct: { low: 15, high: 25 }, returnMultiple: { low: 3, high: 10 } } });
    expect(p).toMatchObject({ ok: true, mandate: { checkSizeUsd: { min: 250_000, max: 2_000_000 }, priors: { dilutionPct: { low: 15, high: 25 }, returnMultiple: { low: 3, high: 10 } } } });
  });

  it.each([
    [null, /JSON object/],
    [{ sectors: 5 }, /sectors must be a list/],
    [{ checkSizeUsd: { min: -1 } }, /positive/],
    [{ checkSizeUsd: { min: 5, max: 1 } }, /min must be ≤ max/],
    [{ priors: { dilutionPct: { low: 15 } } }, /needs both low and high/],
    [{ priors: { dilutionPct: { low: 30, high: 20 } } }, /low must be ≤ high/],
    [{ priors: { dilutionPct: { low: 15, high: 120 } } }, /≤ 100/],
  ])("rejects %j", (body, msg) => {
    const p = parseMandate(body);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.message).toMatch(msg);
  });
});

describe("createMandateStore", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });

  it("in memory: starts empty (no built-in mandate) and returns what was set", async () => {
    const s = createMandateStore({ docs: createMemoryDocStore() });
    expect(await s.get()).toEqual(EMPTY_MANDATE);
    const p = parseMandate({ sectors: ["AI"] });
    if (!p.ok) throw new Error();
    await s.set(p.mandate);
    expect((await s.get()).sectors).toEqual(["AI"]);
  });

  it("file-backed: persists across store instances and keeps updatedAt", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mandate-"));
    dirs.push(dir);
    const p = parseMandate({ geos: ["India"], priors: { returnMultiple: { low: 3, high: 10 } }, partners: [{ name: "A. Partner", focus: ["AI"] }] }, new Date("2026-10-31T08:00:00Z"));
    if (!p.ok) throw new Error();
    await createMandateStore({ docs: createFileDocStore(dir) }).set(p.mandate);
    expect(await createMandateStore({ docs: createFileDocStore(dir) }).get()).toMatchObject({ geos: ["India"], priors: { returnMultiple: { low: 3, high: 10 } }, partners: [{ name: "A. Partner", focus: ["ai"] }], updatedAt: "2026-10-31T08:00:00.000Z" });
  });
});

describe("GET/PUT /api/settings/mandate", () => {
  it("PUT validates and stores; GET returns it with the unset fields", async () => {
    process.env.DEALDESK_STORE = "memory";
    resetDocStore();
    const { GET, PUT } = await import("@/app/api/settings/mandate/route");
    const put = (body: string) => PUT(new Request("http://localhost/api/settings/mandate", { method: "PUT", headers: { "content-type": "application/json" }, body }));
    expect((await put("nope")).status).toBe(400);
    const bad = await put(JSON.stringify({ checkSizeUsd: { min: 0 } }));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ status: "error", message: expect.stringMatching(/positive/) });
    expect(await (await GET()).json()).toMatchObject({ mandate: { sectors: [] }, unset: ["sectors", "stages", "geographies", "check size"] });
    const ok = await put(JSON.stringify({ sectors: ["Fintech"], stages: ["seed"] }));
    expect(ok.status).toBe(200);
    expect(await (await GET()).json()).toMatchObject({ mandate: { sectors: ["Fintech"], stages: ["seed"] }, unset: ["geographies", "check size"] });
    delete process.env.DEALDESK_STORE;
    resetDocStore();
  });
});

describe("MANDATE_JSON: one mandate source", () => {
  const seed = JSON.stringify({ sectors: ["B2B SaaS"], stages: ["Seed"], priors: { returnMultiple: { low: 3, high: 8 } } });
  it("durable store: the seed is used until a mandate is saved; the saved one wins", async () => {
    const s = createMandateStore({ docs: createFileDocStore(fs.mkdtempSync(path.join(os.tmpdir(), "mandate-"))), seed });
    expect(await s.source()).toMatchObject({ mandate: { sectors: ["B2B SaaS"], priors: { returnMultiple: { low: 3, high: 8 } } }, source: { kind: "env" } });
    const r = await s.set({ ...(await s.get()), sectors: ["Fintech"] });
    expect(r.ok).toBe(true);
    expect(await s.source()).toMatchObject({ mandate: { sectors: ["Fintech"] }, source: { kind: "stored" } });
  });
  it("no durable store (Vercel /tmp): MANDATE_JSON is the one source and saving is refused with the reason", async () => {
    const s = createMandateStore({ docs: createFileDocStore(fs.mkdtempSync(path.join(os.tmpdir(), "mandate-")), { serverless: true }), seed });
    const r = await s.set({ ...(await s.get()), sectors: ["Fintech"] });
    expect(r).toMatchObject({ ok: false, status: 409, message: expect.stringMatching(/MANDATE_JSON.*DATABASE_URL/) });
    expect(await s.source()).toMatchObject({ mandate: { sectors: ["B2B SaaS"] }, source: { kind: "env", writable: false } });
  });
  it("MANDATE_JSON values are cited (origin env, read time), so priors are not withheld as uncited", async () => {
    const { returnMultiple } = await import("@/lib/numbers/local");
    const { enforceCited } = await import("@/lib/provenance");
    const m = await createMandateStore({ docs: createMemoryDocStore(), seed }).get();
    expect(m).toMatchObject({ origin: "env", updatedAt: null, readAt: expect.stringMatching(/Z$/) });
    const f = enforceCited({ r: returnMultiple(m, "low") }).r!;
    expect(f).toMatchObject({ status: "ok", value: 3, citations: [{ source: "Firm mandate (MANDATE_JSON, server env)" }] });
  });
  it("ignores an invalid seed", async () => {
    expect((await createMandateStore({ docs: createMemoryDocStore(), seed: "{nope" }).get()).sectors).toEqual([]);
  });
});
