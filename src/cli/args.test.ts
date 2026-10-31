import { describe, expect, it } from "vitest";
import { parseArgs } from "./args";
import { render } from "./index";

describe("dealdesk parseArgs", () => {
  it("parses every command", () => {
    expect(parseArgs(["ask", "seed", "fintech", "in", "India"])).toEqual({ ok: true, json: false, command: { cmd: "ask", request: "seed fintech in India" } });
    expect(parseArgs(["research", "e2b.dev", "--json"])).toEqual({ ok: true, json: true, command: { cmd: "research", domain: "e2b.dev" } });
    expect(parseArgs(["decisions", "e2b.dev", "--no-review"])).toMatchObject({ command: { cmd: "decisions", review: false } });
    expect(parseArgs(["workflow", "e2b.dev", "--until", "decisions"])).toMatchObject({ command: { cmd: "workflow", domain: "e2b.dev", until: "decisions" } });
    expect(parseArgs(["workflow", "e2b.dev", "--until=outreach"])).toMatchObject({ command: { until: "outreach" } });
    expect(parseArgs(["review", "list", "--all", "--run", "deal:x.io:decisions"])).toMatchObject({ command: { cmd: "review-list", status: "all", run: "deal:x.io:decisions" } });
    expect(parseArgs(["review", "approve", "abc", "--confirm", "--note", "ok"])).toMatchObject({ command: { cmd: "review-approve", id: "abc", confirm: true, note: "ok" } });
    expect(parseArgs(["review", "approve", "abc"])).toMatchObject({ command: { confirm: false } });
    expect(parseArgs(["doctor"])).toMatchObject({ command: { cmd: "doctor" } });
    expect(parseArgs([])).toMatchObject({ command: { cmd: "help" } });
    expect(parseArgs(["research", "--help"])).toMatchObject({ command: { cmd: "help" } });
  });
  it("parses the deal workflow commands", () => {
    expect(parseArgs(["deal", "start", "acme.test", "--name", "Acme"])).toMatchObject({ ok: true, command: { cmd: "deal-start", domain: "acme.test", name: "Acme" } });
    expect(parseArgs(["deal", "list"])).toMatchObject({ ok: true, command: { cmd: "deal-list" } });
    expect(parseArgs(["deal", "act", "d1", "transcript", "--text", "team of 60"])).toMatchObject({ ok: true, command: { cmd: "deal-act", id: "d1", action: "transcript", text: "team of 60", confirm: false } });
    expect(parseArgs(["deal", "act", "d1"])).toMatchObject({ ok: false });
  });
  it("rejects missing arguments and unknown commands", () => {
    expect(parseArgs(["research"])).toMatchObject({ ok: false, message: expect.stringMatching(/missing <domain>/) });
    expect(parseArgs(["ask"])).toMatchObject({ ok: false });
    expect(parseArgs(["review"])).toMatchObject({ ok: false });
    expect(parseArgs(["review", "approve"])).toMatchObject({ ok: false });
    expect(parseArgs(["frobnicate"])).toMatchObject({ ok: false, message: expect.stringMatching(/unknown command/) });
    expect(parseArgs(["workflow", "x.io", "--until"])).toMatchObject({ ok: false, message: "--until needs a value" });
  });
});

describe("dealdesk render", () => {
  it("prints decisions with sources and unavailable reasons", () => {
    const out = render({ ok: true, tool: "get_decisions", status: 200, data: { companyDomain: "e2b.dev", summary: { fitScore: { status: "ok", value: 72, sources: [{ endpoint: "POST /company/enrich" }] }, screenerVerdict: { status: "unavailable", reason: "needs thesis" } } }, sources: [{ endpoint: "POST /company/enrich", path: "headcount.total" }] });
    expect(out).toMatch(/✓ fitScore\s+72/);
    expect(out).toMatch(/screenerVerdict\s+unavailable: needs thesis/);
    expect(out).toMatch(/\[1\] POST \/company\/enrich · headcount.total/);
  });
  it("prints failures", () => {
    expect(render({ ok: false, tool: "research_company", status: 0, data: { status: "unreachable", message: "ECONNREFUSED" }, sources: [] })).toMatch(/✗ research_company failed \(HTTP 0\): ECONNREFUSED/);
  });
});

describe("dealdesk parseArgs values", () => {
  it("keeps '=' inside a --flag=value value", () => {
    expect(parseArgs(["deal", "act", "abcd1234", "transcript", "--text=a=b c"])).toMatchObject({ command: { text: "a=b c" } });
  });
});
