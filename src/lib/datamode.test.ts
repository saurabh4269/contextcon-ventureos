import { describe, expect, it } from "vitest";
import { DataModeConfigError, namedLiveAgent, namedLiveDeal, namedLivePerson, namedLiveQuery, resolveDataMode } from "./datamode";

describe("resolveDataMode", () => {
  it("defaults to demo so the live site keeps the fixture UI", () => {
    expect(resolveDataMode({})).toBe("demo");
    expect(resolveDataMode({ DEALDESK_DATA_MODE: "  " })).toBe("demo");
  });
  it("accepts demo or live", () => {
    expect(resolveDataMode({ DEALDESK_DATA_MODE: "demo" })).toBe("demo");
    expect(resolveDataMode({ DEALDESK_DATA_MODE: "LIVE" })).toBe("live");
  });
  it("rejects anything else", () => {
    expect(() => resolveDataMode({ DEALDESK_DATA_MODE: "fixtures" })).toThrow(DataModeConfigError);
  });
});

describe("named live overlays (same screen, real source)", () => {
  it("deal: domain/company overlay; fixture id and restricted stay dummy", () => {
    expect(namedLiveDeal({ domain: "e2b.dev" })).toBe("e2b.dev");
    expect(namedLiveDeal({ company: " efficieno.ai " })).toBe("efficieno.ai");
    expect(namedLiveDeal({ domain: "e2b.dev", id: "helio" })).toBeUndefined();
    expect(namedLiveDeal({ domain: "e2b.dev", restricted: "1" })).toBeUndefined();
    expect(namedLiveDeal({})).toBeUndefined();
  });
  it("person: linkedin overlay; fixture id stays dummy", () => {
    expect(namedLivePerson({ linkedin: "https://www.linkedin.com/in/mlejva" })).toBe("https://www.linkedin.com/in/mlejva");
    expect(namedLivePerson({ linkedin: "https://www.linkedin.com/in/mlejva", id: "ananya-rao" })).toBeUndefined();
    expect(namedLivePerson({})).toBeUndefined();
  });
  it("ask: ?q= overlay; pinned frames stay dummy", () => {
    expect(namedLiveQuery({ q: "Indian B2B software" })).toBe("Indian B2B software");
    expect(namedLiveQuery({ q: "Indian B2B software", frame: "2" })).toBeUndefined();
    expect(namedLiveQuery({})).toBeUndefined();
  });
  it("agent: ?q= overlay; flow/frame fixtures stay dummy", () => {
    expect(namedLiveAgent({ q: "fintech in Bangalore" })).toBe("fintech in Bangalore");
    expect(namedLiveAgent({ q: "fintech in Bangalore", frame: "3" })).toBeUndefined();
    expect(namedLiveAgent({ q: "fintech in Bangalore", view: "flow" })).toBeUndefined();
    expect(namedLiveAgent({ q: "fintech in Bangalore", agent: "inbound" })).toBeUndefined();
  });
});
