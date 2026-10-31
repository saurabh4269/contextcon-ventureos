import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFileDocStore, createMemoryDocStore, dataDir, databaseUrl, docStore, resetDocStore } from "./docs";

describe("database URL selection", () => {
  it("prefers DATABASE_URL, then POSTGRES_URL, and ignores blanks", () => {
    expect(databaseUrl({})).toBeNull();
    expect(databaseUrl({ DATABASE_URL: "  " })).toBeNull();
    expect(databaseUrl({ POSTGRES_URL: "postgres://b" })).toEqual({ name: "POSTGRES_URL", url: "postgres://b" });
    expect(databaseUrl({ DATABASE_URL: "postgres://a", POSTGRES_URL: "postgres://b" })?.name).toBe("DATABASE_URL");
  });
  it("info never carries the URL", () => {
    resetDocStore();
    const info = docStore({ DEALDESK_STORE: "memory", DATABASE_URL: "postgres://user:secret@host/db" }).info();
    expect(JSON.stringify(info)).not.toMatch(/secret|postgres:\/\//);
    resetDocStore();
  });
});

describe("data dir", () => {
  it("override, else .cache locally, else /tmp on Vercel", () => {
    expect(dataDir({ DEALDESK_DATA_DIR: "/x" }, "/p")).toBe("/x");
    expect(dataDir({}, "/p")).toBe(path.join("/p", ".cache"));
    expect(dataDir({ VERCEL: "1" }, "/p")).toBe(path.join(os.tmpdir(), "dealdesk"));
  });
});

for (const [name, make] of [
  ["memory", () => createMemoryDocStore()],
  ["file", () => createFileDocStore(fs.mkdtempSync(path.join(os.tmpdir(), "dd-docs-")))],
] as const) {
  describe(`${name} doc store`, () => {
    it("put / get / list in creation order / update in place / remove", async () => {
      const s = make();
      await s.put("things", "b", { n: 1 });
      await s.putMany("things", [{ id: "12", doc: { n: 2 } }, { id: "a", doc: { n: 3 } }]);
      await s.put("things", "b", { n: 4 });
      expect((await s.list<{ n: number }>("things")).map((r) => [r.id, r.doc.n])).toEqual([["b", 4], ["12", 2], ["a", 3]]);
      expect(await s.get("things", "a")).toEqual({ n: 3 });
      expect(await s.get("things", "zz")).toBeNull();
      await s.remove("things", "12");
      expect((await s.list("things")).map((r) => r.id)).toEqual(["b", "a"]);
      expect(await s.list("other")).toEqual([]);
    });
    it("returns copies (callers cannot mutate stored docs)", async () => {
      const s = make();
      const d = { xs: [1] };
      await s.put("things", "x", d);
      d.xs.push(2);
      const got = await s.get<{ xs: number[] }>("things", "x");
      got!.xs.push(3);
      expect(await s.get("things", "x")).toEqual({ xs: [1] });
    });
    it("rejects bad namespaces", async () => {
      await expect(make().put("../etc", "x", {})).rejects.toThrow(/namespace/);
    });
  });
}

describe("file store honesty", () => {
  it("local files are durable for one server; Vercel /tmp files are labelled not durable", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dd-docs-"));
    expect(createFileDocStore(dir).info()).toMatchObject({ kind: "file", durable: true });
    expect(createFileDocStore(dir, { serverless: true }).info()).toMatchObject({ kind: "file", durable: false, note: expect.stringMatching(/Not durable on this deploy.*DATABASE_URL/) });
  });
  it("a read-only directory keeps working in process memory and says so", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dd-docs-"));
    const file = path.join(dir, "blocked");
    fs.writeFileSync(file, "a file, not a directory");
    const s = createFileDocStore(file);
    await s.put("things", "x", { ok: true });
    expect(await s.get("things", "x")).toEqual({ ok: true });
    expect(s.info()).toMatchObject({ kind: "memory", durable: false, note: expect.stringMatching(/could not be written/) });
  });
  it("another store instance on the same dir sees the writes", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dd-docs-"));
    await createFileDocStore(dir).put("things", "x", { v: 1 });
    expect(await createFileDocStore(dir).get("things", "x")).toEqual({ v: 1 });
  });
});
