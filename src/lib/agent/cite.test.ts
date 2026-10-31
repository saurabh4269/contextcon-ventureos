import { describe, expect, it } from "vitest";
import { checkCell, resolvePath } from "./cite";

const doc = {
  companies: [
    { basic_info: { name: "Acme AI", year_founded: 2023 }, headcount: { total: 1200, growth_percent: { "6m": 55, "12m": 0.5 } }, tags: [], funding: null, public: false },
    { basic_info: { name: "Beta Labs", "odd.key": "x" }, people: [{ title: "Co-Founder & CEO" }] },
  ],
  total_count: 2,
};

describe("resolvePath", () => {
  it.each([
    ["companies[0].basic_info.name", "Acme AI"],
    ["companies[1].people[0].title", "Co-Founder & CEO"],
    ["companies[0].headcount.growth_percent.6m", 55],
    ['companies[0].headcount.growth_percent["12m"]', 0.5],
    ['companies[1].basic_info["odd.key"]', "x"],
    ["$.companies[0].headcount.total", 1200],
    ["$companies[0].headcount.total", 1200],
    ["  total_count ", 2],
    ["companies.1.basic_info.name", "Beta Labs"],
    ["companies[0].funding", null],
    ["companies[0].public", false],
  ])("%s", (p, want) => {
    expect(resolvePath(doc, p)).toEqual(want);
  });

  it.each([
    "companies[5].basic_info.name",
    "companies[0].basic_info.missing",
    "companies[0].funding.total", // through null
    "companies.name", // non-numeric key on an array
    "total_count.x", // through a number
  ])("misses %s → undefined", (p) => {
    expect(resolvePath(doc, p)).toBeUndefined();
  });

  it("returns the root for an empty path", () => {
    expect(resolvePath(doc, "$")).toBe(doc);
  });
});

describe("checkCell", () => {
  it("verifies equal numbers and numbers within tolerance (max of 0.051 or 1%)", () => {
    expect(checkCell(55, doc, "companies[0].headcount.growth_percent.6m")).toMatchObject({ status: "verified", value: 55, source: 55 });
    expect(checkCell(55.4, doc, "companies[0].headcount.growth_percent.6m").status).toBe("verified");
    expect(checkCell(0.55, doc, "companies[0].headcount.growth_percent.12m").status).toBe("verified");
    expect(checkCell(1210, doc, "companies[0].headcount.total").status).toBe("verified");
  });

  it("parses numeric strings: '55%', '1,200', ' 55 '", () => {
    expect(checkCell("55%", doc, "companies[0].headcount.growth_percent.6m")).toMatchObject({ status: "verified", value: "55%", source: 55 });
    expect(checkCell("1,200", doc, "companies[0].headcount.total").status).toBe("verified");
    expect(checkCell(" 55 ", doc, "companies[0].headcount.growth_percent.6m").status).toBe("verified");
  });

  it("corrects numbers outside tolerance or non-numeric claims, returning the Crustdata value", () => {
    expect(checkCell(70, doc, "companies[0].headcount.growth_percent.6m")).toEqual({ status: "corrected", value: 55, source: 55, claimed: 70 });
    expect(checkCell(56, doc, "companies[0].headcount.growth_percent.6m").status).toBe("corrected");
    expect(checkCell("about half", doc, "companies[0].headcount.growth_percent.6m")).toMatchObject({ status: "corrected", value: 55 });
  });

  it("compares strings case/space-insensitively, accepting containment either way", () => {
    expect(checkCell("acme  ai", doc, "companies[0].basic_info.name").status).toBe("verified");
    expect(checkCell("Co-Founder", doc, "companies[1].people[0].title").status).toBe("verified");
    expect(checkCell("Acme AI Pvt Ltd", doc, "companies[0].basic_info.name").status).toBe("verified");
    expect(checkCell("CTO", doc, "companies[1].people[0].title")).toEqual({ status: "corrected", value: "Co-Founder & CEO", source: "Co-Founder & CEO", claimed: "CTO" });
  });

  it("compares booleans by their text", () => {
    expect(checkCell(false, doc, "companies[0].public").status).toBe("verified");
    expect(checkCell(true, doc, "companies[0].public")).toMatchObject({ status: "corrected", value: false });
  });

  it("matches claims inside object sources via their JSON text", () => {
    expect(checkCell("Acme AI", doc, "companies[0].basic_info").status).toBe("verified");
    const r = checkCell("Gamma", doc, "companies[0].basic_info");
    expect(r.status).toBe("corrected");
    expect(r.value).toBe(JSON.stringify(doc.companies[0]!.basic_info));
  });

  it("is unavailable without a path or when the path misses", () => {
    expect(checkCell(55, doc, undefined)).toMatchObject({ status: "unavailable", value: null, reason: expect.stringMatching(/No citation path/) });
    expect(checkCell(55, doc, "")).toMatchObject({ status: "unavailable" });
    expect(checkCell(55, doc, "companies[9].headcount.total")).toMatchObject({ status: "unavailable", reason: expect.stringMatching(/does not exist/) });
  });

  it("is unavailable when Crustdata holds null, an empty array or an empty string", () => {
    expect(checkCell(10, doc, "companies[0].funding")).toMatchObject({ status: "unavailable", value: null, reason: expect.stringMatching(/no value/) });
    expect(checkCell("x", doc, "companies[0].tags").status).toBe("unavailable");
    expect(checkCell("x", { a: "" }, "a").status).toBe("unavailable");
    expect(checkCell(null, null, "a").status).toBe("unavailable");
  });

  it("fills in the Crustdata value when the model claimed null but the source has one", () => {
    expect(checkCell(null, doc, "companies[0].headcount.total")).toEqual({ status: "corrected", value: 1200, source: 1200, claimed: null });
  });
});
