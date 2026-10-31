import { describe, expect, it } from "vitest";
import { mergePipelineDeals } from "./pipeline";

describe("mergePipelineDeals", () => {
  it("lists inbound companies and researched ones, inbox winning on the same domain", () => {
    const rows = mergePipelineDeals(
      [
        { companyDomain: "efficieno.ai", subject: "Efficieno AI (efficieno.ai) — seed pitch", lastMessageAt: "2026-10-31T10:00:00.000Z" },
        { companyDomain: null, subject: "Lunch", lastMessageAt: "2026-10-31T11:00:00.000Z" },
      ],
      [
        { kind: "research.run", at: "2026-10-30T08:00:00.000Z", subject: { type: "company", id: "e2b.dev", label: "E2B" } },
        { kind: "deal.opened", at: "2026-10-31T09:00:00.000Z", subject: { type: "company", id: "efficieno.ai", label: "Efficieno" } },
        { kind: "note.added", at: "2026-10-31T12:00:00.000Z", subject: { type: "company", id: "other.com", label: "Other" } },
      ],
    );
    expect(rows.map((r) => r.domain)).toEqual(["efficieno.ai", "e2b.dev"]);
    expect(rows[0]).toMatchObject({ source: "inbound", name: "Efficieno AI seed pitch", href: "/deal?domain=efficieno.ai" });
    expect(rows[1]).toMatchObject({ source: "researched", name: "E2B", href: "/deal?domain=e2b.dev" });
  });

  it("skips memory subjects that are not a website domain", () => {
    expect(mergePipelineDeals([], [{ kind: "deal.opened", at: "2026-10-31T09:00:00.000Z", subject: { type: "company", id: "not a domain", label: "X" } }])).toEqual([]);
  });
});
