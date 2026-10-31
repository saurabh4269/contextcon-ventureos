import { describe, expect, it } from "vitest";
import { normalizeDomainInput, normalizeLinkedInUrl } from "./normalize";

describe("normalizeDomainInput", () => {
  it("a public suffix alone is not a company domain", () => {
    for (const v of ["co.uk", "com.au", "co.in", "org.uk", "https://www.co.uk/"]) expect(normalizeDomainInput(v), v).toBeUndefined();
    expect(normalizeDomainInput("acme.co.uk")).toBe("acme.co.uk");
    expect(normalizeDomainInput("e2b.dev")).toBe("e2b.dev");
  });
});

describe("normalizeLinkedInUrl", () => {
  it("a profile link copied from a sub-page is still that profile", () => {
    expect(normalizeLinkedInUrl("https://www.linkedin.com/in/mlejva/details/experience/")).toBe("https://www.linkedin.com/in/mlejva");
    expect(normalizeLinkedInUrl("https://www.linkedin.com/in/mlejva/recent-activity/all/?x=1")).toBe("https://www.linkedin.com/in/mlejva");
  });
  it("still rejects companies, empty handles and other hosts", () => {
    expect(normalizeLinkedInUrl("https://linkedin.com/company/e2b")).toBeUndefined();
    expect(normalizeLinkedInUrl("https://www.linkedin.com/in/")).toBeUndefined();
    expect(normalizeLinkedInUrl("http://evil.com/linkedin.com/in/x")).toBeUndefined();
  });
});
