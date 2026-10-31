import { describe, expect, it } from "vitest";
import { normalizeDomainInput, normalizeLinkedInUrl } from "./normalize";

describe("input normalisation (route params)", () => {
  it("normalises messy domains", () => {
    for (const raw of ["https://www.E2B.dev/", " e2b.dev ", "E2B.DEV", "http://e2b.dev/path?x=1"]) expect(normalizeDomainInput(raw)).toBe("e2b.dev");
  });
  it("rejects names, unicode, overlong and empty input", () => {
    for (const raw of ["E2B", "", "  ", "‮é🦄.com", `${"a".repeat(5000)}.com`, null, undefined]) expect(normalizeDomainInput(raw)).toBeUndefined();
  });
  it("normalises linkedin urls and rejects lookalikes", () => {
    expect(normalizeLinkedInUrl(" HTTPS://WWW.LinkedIn.com/in/Mlejva/?utm=1 ")).toBe("https://www.linkedin.com/in/Mlejva");
    for (const raw of ["mlejva", "https://evil.com/in/x", "https://linkedin.com.evil.com/in/x", `https://www.linkedin.com/in/${"a".repeat(5000)}`]) expect(normalizeLinkedInUrl(raw)).toBeUndefined();
  });
});
