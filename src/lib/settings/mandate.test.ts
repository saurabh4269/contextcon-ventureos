import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createMandateStore, EMPTY_MANDATE, parseMandate, unsetMandateFields } from "./mandate";

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

  it("in memory: starts empty (no built-in mandate) and returns what was set", () => {
    const s = createMandateStore({ file: null });
    expect(s.get()).toEqual(EMPTY_MANDATE);
    const p = parseMandate({ sectors: ["AI"] });
    if (!p.ok) throw new Error();
    s.set(p.mandate);
    expect(s.get().sectors).toEqual(["AI"]);
  });

  it("file-backed: persists across store instances, keeps updatedAt; an unreadable file reads as unset", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mandate-"));
    dirs.push(dir);
    const file = path.join(dir, "nested", "mandate.json");
    const p = parseMandate({ geos: ["India"], priors: { returnMultiple: { low: 3, high: 10 } } }, new Date("2026-10-31T08:00:00Z"));
    if (!p.ok) throw new Error();
    createMandateStore({ file }).set(p.mandate);
    expect(createMandateStore({ file }).get()).toMatchObject({ geos: ["India"], priors: { returnMultiple: { low: 3, high: 10 } }, updatedAt: "2026-10-31T08:00:00.000Z" });
    fs.writeFileSync(file, "{not json");
    expect(createMandateStore({ file }).get()).toEqual(EMPTY_MANDATE);
  });
});

describe("GET/PUT /api/settings/mandate", () => {
  it("PUT validates and stores; GET returns it with the unset fields", async () => {
    process.env.MANDATE_FILE = "memory";
    delete (globalThis as { __dealdeskMandate?: unknown }).__dealdeskMandate;
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
    delete (globalThis as { __dealdeskMandate?: unknown }).__dealdeskMandate;
    delete process.env.MANDATE_FILE;
  });
});
