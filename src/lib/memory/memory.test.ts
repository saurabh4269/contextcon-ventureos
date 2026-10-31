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
  it("is explicitly unavailable without DATABASE_URL (no in-memory fallback)", async () => {
    const { memoryStore, MEMORY_NOT_CONFIGURED } = await import("./store");
    expect(memoryStore({})).toEqual({ status: "unavailable", reason: MEMORY_NOT_CONFIGURED });
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
