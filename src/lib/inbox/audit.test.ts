// Audit tests: deal name and company domain from an inbox thread, Gmail parsing helpers. No network.
import { describe, expect, it } from "vitest";
import { htmlToText, messageText, parseFrom, toInboxThread } from "@/lib/google/gmail";
import { companyDomainFromInbox, dealNameFromInbox } from "./company";
import { mergePipelineDeals } from "./pipeline";

describe("dealNameFromInbox", () => {
  it("strips Re: / Fwd: / Intro: prefixes, in any order and repeated", () => {
    expect(dealNameFromInbox({ subject: "Re: Fwd: Re: Acme AI seed pitch", domain: "acme.ai" })).toBe("Acme AI seed pitch");
    expect(dealNameFromInbox({ subject: "FW: Intro: Acme AI seed deck", domain: "acme.ai" })).toBe("Acme AI seed deck");
    expect(dealNameFromInbox({ subject: "AW: Acme pitch", domain: "acme.ai" })).toBe("Acme pitch");
  });
  it("a hyphen inside a name stays", () => {
    expect(dealNameFromInbox({ subject: "Stack-AI pitch deck", domain: "stackai.com" })).toBe("Stack-AI pitch deck");
    expect(dealNameFromInbox({ subject: "Acme - seed pitch", domain: "acme.ai" })).toBe("Acme seed pitch");
  });
  it("the domain is removed literally (dots are not wildcards)", () => {
    expect(dealNameFromInbox({ subject: "e2bxdev seed pitch and e2b.dev", domain: "e2b.dev" })).toBe("e2bxdev seed pitch and");
  });
  it("invisible and bidi control characters are removed; newlines collapse", () => {
    expect(dealNameFromInbox({ subject: "Acme‮ gnorw​ seed\r\nBcc: x@y.com", domain: "acme.ai" })).toBe("Acme gnorw seed Bcc: x@y.com");
  });
  it("Re: alone falls back to the domain", () => {
    expect(dealNameFromInbox({ subject: "Re:", domain: "acme.ai" })).toBe("acme.ai");
  });
  it("overlong subjects fall back to the domain", () => {
    expect(dealNameFromInbox({ subject: "x".repeat(200), domain: "acme.ai" })).toBe("acme.ai");
  });
});

describe("companyDomainFromInbox", () => {
  it("reduces mail subdomains; keeps country TLDs", () => {
    expect(companyDomainFromInbox({ fromAddress: "a@mail.acme.com" })).toBe("acme.com");
    expect(companyDomainFromInbox({ fromAddress: "a@em.acme.co.in" })).toBe("acme.co.in");
  });
  it("calendar / video / provider senders are not companies", () => {
    expect(companyDomainFromInbox({ fromAddress: "calendar-notification@google.com", subject: "Invitation: Acme intro" })).toBeNull();
    expect(companyDomainFromInbox({ fromAddress: "no-reply@zoom.us", subject: "Meeting", snippet: "Join https://us02web.zoom.us/j/1" })).toBeNull();
    expect(companyDomainFromInbox({ fromAddress: "a@yahoo.co.uk", subject: "hi" })).toBeNull();
    expect(companyDomainFromInbox({ fromAddress: "a@gmail.com", subject: "x", snippet: "https://calendly.com/foo/30min" })).toBeNull();
  });
  it("sentence fragments and file names are not domains", () => {
    expect(companyDomainFromInbox({ fromAddress: "a@gmail.com", subject: "Hello.Thanks", snippet: "see deck.pdf, i.e. attached; node.js" })).toBeNull();
  });
});

describe("parseFrom", () => {
  it("handles quoted, bare, angle-only, legacy and comma names", () => {
    expect(parseFrom('"Ruiz, Ana" <ana@x.com>')).toEqual({ name: "Ruiz, Ana", address: "ana@x.com" });
    expect(parseFrom("ana@x.com")).toEqual({ name: "ana@x.com", address: "ana@x.com" });
    expect(parseFrom("<ana@x.com>")).toEqual({ name: "ana@x.com", address: "ana@x.com" });
    expect(parseFrom("ana@x.com (Ana Ruiz)")).toEqual({ name: "Ana Ruiz", address: "ana@x.com" });
    expect(parseFrom("Ana Ruiz")).toEqual({ name: "Ana Ruiz", address: null });
  });
});

describe("toInboxThread", () => {
  const h = (from: string, subject = "Acme pitch") => [{ name: "From", value: from }, { name: "Subject", value: subject }];
  it("takes the company from the founder's message, not from the investor's own reply", () => {
    const t = toInboxThread({
      id: "t",
      messages: [
        { internalDate: "1", labelIds: ["INBOX"], payload: { headers: h("Ana <ana@acme.ai>") } },
        { internalDate: "2", labelIds: ["SENT"], payload: { headers: h("Me <partner@myfund.vc>", "Re: Acme pitch") } },
      ],
    });
    expect(t!.fromAddress).toBe("ana@acme.ai");
    expect(t!.companyDomain).toBe("acme.ai");
    expect(t!.subject).toBe("Re: Acme pitch");
  });
  it("without a SENT label the last message is used", () => {
    const t = toInboxThread({ id: "t", messages: [{ internalDate: "1", payload: { headers: h("a@one.com") } }, { internalDate: "2", payload: { headers: h("b@two.com") } }] });
    expect(t!.companyDomain).toBe("two.com");
  });
});

describe("messageText / htmlToText", () => {
  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
  it("block tags do not fuse numbers and words; entities decode", () => {
    expect(htmlToText("<div>team of 60</div><div>engineers &amp; ops &lt;3 &#8377;4 crore &quot;x&quot;</div>")).toBe('team of 60\nengineers & ops <3 ₹4 crore "x"');
  });
  it("link targets survive the strip (the company site is often only a link)", () => {
    const t = messageText({ mimeType: "text/html", body: { data: b64('<p>See <a href="https://acme.ai/deck">our site</a></p>') } });
    expect(t).toContain("https://acme.ai/deck");
  });
  it("mailto links add no URL", () => {
    expect(htmlToText('<a href="mailto:a@b.com">mail me</a>')).toBe("mail me");
  });
  it("text/plain wins over html", () => {
    expect(messageText({ parts: [{ mimeType: "text/html", body: { data: b64("<b>html</b>") } }, { mimeType: "text/plain", body: { data: b64("plain") } }] })).toBe("plain");
  });
});

describe("pipeline names", () => {
  it("a reply thread does not make the row name start with Re:", () => {
    const rows = mergePipelineDeals([{ companyDomain: "acme.ai", subject: "Re: Acme AI seed pitch", lastMessageAt: "2026-10-31T10:00:00.000Z" }], []);
    expect(rows[0]!.name).toBe("Acme AI seed pitch");
  });
});

describe("toInboxThread without internalDate", () => {
  const hd = (...kv: [string, string][]) => kv.map(([name, value]) => ({ name, value }));
  it("falls back to the Date header, and a thread with no usable time is dropped instead of dated 1970", () => {
    const withHeader = toInboxThread({ id: "t1", messages: [{ payload: { headers: hd(["From", "a@one.com"], ["Subject", "s"], ["Date", "Fri, 30 Oct 2026 09:30:00 +0530"]) } }] });
    expect(withHeader?.lastMessageAt).toBe("2026-10-30T04:00:00.000Z");
    expect(toInboxThread({ id: "t2", messages: [{ payload: { headers: hd(["From", "a@one.com"], ["Subject", "s"]) } }] })).toBeNull();
    expect(toInboxThread({ id: "t3", messages: [] })).toBeNull();
  });
});
