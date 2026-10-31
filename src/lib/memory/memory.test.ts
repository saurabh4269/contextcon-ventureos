import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { parseMemoryEventInput } from "./types";
import { createPostgresMemoryStore, MEMORY_TABLE } from "./postgres";

vi.mock("server-only", () => ({}));

const valid = { kind: "deal.opened", actor: { type: "user" }, subject: { type: "company", id: "e2b.dev", label: "E2B" }, summary: "Opened E2B", source: "ui:/deal" };

describe("memory event validation", () => {
  it("accepts a well-formed event and normalizes optional fields", () => {
    const r = parseMemoryEventInput(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.input).toMatchObject({ kind: "deal.opened", actor: { type: "user", id: null, name: null }, subject: { id: "e2b.dev" }, data: null });
  });
  it.each([
    [{ ...valid, kind: "Opened" }, /kind/],
    [{ ...valid, actor: { type: "robot" } }, /actor.type/],
    [{ ...valid, summary: " " }, /summary/],
    [{ ...valid, source: undefined }, /source/],
    [{ ...valid, subject: { type: "company" } }, /subject/],
    [{ ...valid, data: [1] }, /data/],
    [{ ...valid, data: { big: "x".repeat(9000) } }, /data/],
  ])("rejects %j", (body, msg) => {
    const r = parseMemoryEventInput(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(msg);
  });
});

describe("memory store selection", () => {
  it("without a database: the durable store's documents, labelled (not durable on Vercel)", async () => {
    const { memoryStore } = await import("./store");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dd-mem-"));
    const local = memoryStore({ DEALDESK_DATA_DIR: dir });
    expect(local).toMatchObject({ status: "ok", storage: { kind: "file", durable: true } });
    const vercel = memoryStore({ DEALDESK_DATA_DIR: dir, VERCEL: "1" });
    expect(vercel).toMatchObject({ status: "ok", storage: { kind: "file", durable: false, note: expect.stringMatching(/Not durable on this deploy/) } });
  });
  it("document memory: ids increase, since cursor, latest-N, concurrent appends get distinct ids", async () => {
    const { createDocMemoryStore } = await import("./store");
    const { createMemoryDocStore } = await import("@/lib/store/docs");
    const m = createDocMemoryStore(createMemoryDocStore());
    const ev = { kind: "workflow.decision", actor: { type: "user" as const }, summary: "Invested", source: "test" };
    const [a, b, c] = await Promise.all([m.append(ev), m.append({ ...ev, summary: "two" }), m.append({ ...ev, summary: "three" })]);
    expect([a.id, b.id, c.id]).toEqual(["1", "2", "3"]);
    expect((await m.list({ sinceId: "1", limit: 10 })).map((e) => e.id)).toEqual(["2", "3"]);
    expect((await m.list({ limit: 2 })).map((e) => e.summary)).toEqual(["two", "three"]);
    expect(a).toMatchObject({ subject: null, data: null, at: expect.stringMatching(/Z$/) });
  });
});

// Integration: runs only against a real Postgres (MEMORY_TEST_DATABASE_URL), e.g. a local throwaway instance.
const url = process.env.MEMORY_TEST_DATABASE_URL;
describe.skipIf(!url)("postgres memory store (live database)", () => {
  const store = url ? createPostgresMemoryStore(url, { max: 1 }) : null;
  afterAll(async () => { await store?.end(); });

  it("appends and lists events in order with a since cursor", async () => {
    const before = await store!.list({ limit: 1 });
    const a = await store!.append({ ...valid, actor: { type: "user" }, subject: null, data: { n: 1 } } as never);
    const b = await store!.append({ ...valid, kind: "note.added", actor: { type: "agent", name: "test" }, summary: "second" } as never);
    expect(Number(b.id)).toBeGreaterThan(Number(a.id));
    expect(a.at).toMatch(/Z$/);
    const since = await store!.list({ sinceId: before.at(-1)?.id ?? "0", limit: 50 });
    expect(since.map((e) => e.id).slice(-2)).toEqual([a.id, b.id]);
    expect(since.at(-1)).toMatchObject({ kind: "note.added", actor: { type: "agent", name: "test" }, subject: { type: "company", id: "e2b.dev" } });
    expect(MEMORY_TABLE).toBe("dealdesk_memory_events");
  });
});

describe("event id cursor", () => {
  it("accepts bigint-sized ids only", async () => {
    const { isEventId } = await import("./types");
    expect(isEventId("12")).toBe(true);
    expect(isEventId("9".repeat(19))).toBe(false);
    expect(isEventId("abc")).toBe(false);
    expect(isEventId("")).toBe(false);
  });
});
