import { describe, expect, it } from "vitest";
import { createMemoryDocStore } from "@/lib/store/docs";
import { applyMove, listStages, moveStage } from "./stages";

const at = "2026-10-31T06:00:00.000Z";

describe("deal stages", () => {
  it("a person's move sets the owner from DEALDESK_USER_NAME; an agent's move does not", () => {
    const a = applyMove(null, { domain: "Acme.test", stage: "screening", by: "Screener", actor: "agent", at }, { DEALDESK_USER_NAME: "Ada Lovelace" });
    expect(a).toMatchObject({ domain: "acme.test", stage: "screening", owner: null, history: [{ stage: "screening", by: "Screener", actor: "agent" }] });
    const b = applyMove(a, { domain: "acme.test", stage: "ic", by: "Ada Lovelace", actor: "user", at }, { DEALDESK_USER_NAME: "Ada Lovelace" });
    expect(b).toMatchObject({ stage: "ic", owner: "Ada Lovelace" });
  });
  it("without DEALDESK_USER_NAME a person's move leaves the owner Unassigned (null)", () => {
    expect(applyMove(null, { domain: "acme.test", stage: "screening", by: "you", actor: "user", at }, {}).owner).toBeNull();
  });
  it("forwardOnly never moves back or out of a closed stage", () => {
    const ic = applyMove(null, { domain: "acme.test", stage: "ic", by: "x", actor: "agent", at }, {});
    expect(applyMove(ic, { domain: "acme.test", stage: "screening", by: "x", actor: "user", forwardOnly: true, at }, {}).stage).toBe("ic");
    const done = applyMove(ic, { domain: "acme.test", stage: "passed", by: "x", actor: "user", at }, {});
    expect(applyMove(done, { domain: "acme.test", stage: "portfolio", by: "x", actor: "user", forwardOnly: true, at }, {}).stage).toBe("passed");
  });
  it("is stored per domain and listed", async () => {
    const docs = createMemoryDocStore();
    await moveStage({ domain: "acme.test", stage: "screening", by: "Screener", actor: "agent", workflowId: "w1" }, docs, {});
    await moveStage({ domain: "acme.test", stage: "diligence", by: "Research agent", actor: "agent" }, docs, {});
    const [r] = await listStages(docs);
    expect(r).toMatchObject({ domain: "acme.test", stage: "diligence", workflowId: "w1" });
    expect(r!.history.map((h) => h.stage)).toEqual(["screening", "diligence"]);
  });
});
