// Two people (or one double click) resolving different items of one run at the same time: each request loads the
// queue, resolves its item and flushes. Neither request sees the other's change, so neither finishes the run.
import { describe, expect, it, vi } from "vitest";
import { createMemoryDocStore } from "@/lib/store/docs";
import { missingData } from "./raise";
import { loadExceptionStore } from "./store";

vi.mock("server-only", () => ({}));

async function seeded() {
  const docs = createMemoryDocStore();
  const s = await loadExceptionStore(docs);
  const { items } = s.recordRun({ id: "run1", source: "sourcing-agent", request: "fintechs", autoCompleted: 1 }, [
    missingData({ name: "Acme", domain: "acme.example" }, "HQ", "no HQ", { runId: "run1" }),
    missingData({ name: "Beta", domain: "beta.example" }, "HQ", "no HQ", { runId: "run1" }),
  ]);
  await s.flush();
  return { docs, ids: items.map((i) => i.id) };
}

describe("review queue under concurrent resolves", () => {
  it("the run finishes once its last open item is resolved, whichever request flushed last", async () => {
    const { docs, ids } = await seeded();
    const a = await loadExceptionStore(docs), b = await loadExceptionStore(docs); // both load before either flushes
    a.resolveException(ids[0]!, "approve");
    b.resolveException(ids[1]!, "approve");
    await a.flush();
    await b.flush();
    const after = await loadExceptionStore(docs);
    expect(after.openCount()).toBe(0);
    const run = after.list({ status: "all" }).runs.find((r) => r.id === "run1")!;
    expect(run.status).toBe("finished");
    expect(run.finishedAt).toBeTruthy();
  });

  it("a run lists every item that points at it, even when two requests raised items for it concurrently", async () => {
    const { docs, ids } = await seeded();
    const a = await loadExceptionStore(docs), b = await loadExceptionStore(docs);
    const x = a.raiseException(missingData({ name: "Gamma", domain: "gamma.example" }, "HQ", "no HQ", { runId: "run1" }));
    const y = b.raiseException(missingData({ name: "Delta", domain: "delta.example" }, "HQ", "no HQ", { runId: "run1" }));
    await a.flush();
    await b.flush();
    const run = (await loadExceptionStore(docs)).list({ status: "all" }).runs.find((r) => r.id === "run1")!;
    expect([...run.exceptionIds].sort()).toEqual([...ids, x.id, y.id].sort());
    expect(run.status).toBe("waiting_on_person");
  });

  it("two clicks on the same item through the lock resolve it once", async () => {
    const { docs, ids } = await seeded();
    const { resolveOnce } = await import("./resolve");
    const results = await Promise.allSettled([resolveOnce(ids[0]!, "approve", {}, docs), resolveOnce(ids[0]!, "reject", {}, docs)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await loadExceptionStore(docs)).get(ids[0]!)?.status).toBe("approved");
  });
});
