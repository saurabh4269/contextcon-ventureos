import { describe, expect, it } from "vitest";
import { companyDomainFromInbox, dealNameFromInbox, normalizeDomain } from "./company";

describe("normalizeDomain", () => {
  it("strips scheme, www and a path", () => {
    expect(normalizeDomain("https://www.Efficieno.ai/about")).toBe("efficieno.ai");
  });
  it("rejects consumer mail hosts and file-like tokens", () => {
    expect(normalizeDomain("gmail.com")).toBeNull();
    expect(normalizeDomain("deck.pdf")).toBeNull();
    expect(normalizeDomain("not a domain")).toBeNull();
  });
});

describe("companyDomainFromInbox", () => {
  it("uses the sender host when it is a company website", () => {
    expect(companyDomainFromInbox({ fromAddress: "ana@example.com", subject: "Deck" })).toBe("example.com");
  });
  it("does not treat Gmail as a company; reads the domain from the subject", () => {
    expect(companyDomainFromInbox({
      fromAddress: "founder@gmail.com",
      subject: "Efficieno AI (efficieno.ai) — seed pitch",
    })).toBe("efficieno.ai");
  });
  it("falls back to a domain in the snippet", () => {
    expect(companyDomainFromInbox({
      fromAddress: "founder@gmail.com",
      subject: "Intro",
      snippet: "We are Efficieno AI — https://efficieno.ai — raising a seed.",
    })).toBe("efficieno.ai");
  });
  it("returns null when nothing names a company website", () => {
    expect(companyDomainFromInbox({ fromAddress: "a@gmail.com", subject: "Lunch?", snippet: "Are you free" })).toBeNull();
  });
});

describe("dealNameFromInbox", () => {
  it("keeps the subject words after stripping the domain", () => {
    expect(dealNameFromInbox({ subject: "Efficieno AI (efficieno.ai) — seed pitch", domain: "efficieno.ai" })).toBe("Efficieno AI seed pitch");
  });
  it("uses the domain when the subject is empty", () => {
    expect(dealNameFromInbox({ subject: "(no subject)", domain: "e2b.dev" })).toBe("e2b.dev");
  });
});
