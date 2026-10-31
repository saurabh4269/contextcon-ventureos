import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/memory/store", () => ({
  memoryStore: () => ({ status: "ok", store: { list: async () => [] } }),
  recordMemory: async () => ({ status: "unavailable", reason: "test" }),
}));
vi.mock("@/lib/live/integrations", () => ({ listIntegrations: async () => [] }));
vi.mock("@/lib/google/oauth", () => ({ googleConfig: () => null, GoogleApiError: class extends Error {} }));
// a stand-in model that greets regardless of screen (what a chatty LLM does); null = no model configured
const llm = vi.hoisted(() => ({ on: false, systems: [] as string[] }));
vi.mock("@/lib/agent/model", async (orig) => ({
  ...(await orig<typeof import("@/lib/agent/model")>()),
  modelFromEnv: () => (llm.on ? { provider: "test", complete: async ({ system }: { system: string }) => { llm.systems.push(system); return { text: "Good morning, Saurabh. Here is what's on this screen." }; } } : null),
}));

import { GET, POST } from "@/app/api/voice/brief/route";
import { composeGreeting, hourIn, parseHour, resolveTimeZone, salutation, stripSalutation } from "./greeting";
import { composeScreenLine } from "./screen";

const empty = { memory: { status: "ok" as const, events: [] }, connectors: [] };
const opening = (text: string) => text.split(".")[0];
const SALUTE = /\b(good (morning|afternoon|evening|night)|working late)\b/i;

describe("salutation by local hour", () => {
  it.each([
    [8, "Good morning"], [14, "Good afternoon"], [19, "Good evening"], [23, "Working late"],
    [5, "Good morning"], [11, "Good morning"], [12, "Good afternoon"], [16, "Good afternoon"], [17, "Good evening"], [21, "Good evening"], [22, "Working late"], [0, "Working late"], [4, "Working late"],
  ])("hour %i → %s", (h, s) => expect(salutation(h)).toBe(s));
});

describe("composeGreeting uses the user's time zone, not a fixed IST hour", () => {
  it.each([
    // [instant (UTC), IANA zone, local hour, salutation]
    ["2026-10-31T12:00:00Z", "America/New_York", 8, "Good morning"],
    ["2026-10-31T12:00:00Z", "Europe/Athens", 14, "Good afternoon"],
    ["2026-10-31T12:00:00Z", "Asia/Bangkok", 19, "Good evening"],
    ["2026-10-31T14:00:00Z", "Asia/Tokyo", 23, "Working late"],
    ["2026-10-31T02:30:00Z", "Asia/Kolkata", 8, "Good morning"],
    ["2026-10-31T08:30:00Z", "Asia/Kolkata", 14, "Good afternoon"],
    ["2026-10-31T13:30:00Z", "Asia/Kolkata", 19, "Good evening"],
    ["2026-10-31T17:30:00Z", "Asia/Kolkata", 23, "Working late"],
    ["2026-10-31T15:00:00Z", "America/Los_Angeles", 8, "Good morning"],
    ["2026-10-31T21:00:00Z", "America/Los_Angeles", 14, "Good afternoon"],
    ["2026-11-01T02:00:00Z", "America/Los_Angeles", 19, "Good evening"],
    ["2026-11-01T06:00:00Z", "America/Los_Angeles", 23, "Working late"],
    ["2026-10-31T08:00:00Z", "Europe/London", 8, "Good morning"],
    ["2026-10-31T19:00:00Z", "Pacific/Auckland", 8, "Good morning"],
  ])("%s in %s (%i:00) → %s", (at, tz, hour, s) => {
    const now = new Date(at);
    expect(hourIn(now, tz)).toBe(hour);
    const g = composeGreeting({ ...empty, name: "Saurabh", now, tz });
    expect(opening(g.text)).toBe(`${s}, Saurabh`);
    expect(g.facts).toMatchObject({ localHour: hour, timeZone: tz });
  });

  it("a client-reported hour wins over the zone", () => {
    const now = new Date("2026-10-31T03:30:00Z"); // 09:00 IST
    for (const [hour, s] of [[8, "Good morning"], [14, "Good afternoon"], [19, "Good evening"], [23, "Working late"]] as const)
      expect(opening(composeGreeting({ ...empty, now, tz: "Asia/Kolkata", hour }).text)).toBe(s);
  });

  it("an invalid zone or hour falls back to Asia/Kolkata", () => {
    const now = new Date("2026-10-31T13:30:00Z"); // 19:00 IST
    expect(opening(composeGreeting({ ...empty, now, tz: "Mars/Olympus_Mons", hour: 42 }).text)).toBe("Good evening");
    expect(opening(composeGreeting({ ...empty, now }).text)).toBe("Good evening");
  });

  it("validates time zones and hours", () => {
    expect(resolveTimeZone("Europe/Berlin")).toBe("Europe/Berlin");
    for (const bad of ["", "Not/AZone", "x".repeat(80), null, 7, undefined]) expect(resolveTimeZone(bad)).toBe("Asia/Kolkata");
    expect(parseHour("0")).toBe(0);
    expect(parseHour("23")).toBe(23);
    expect(parseHour(14)).toBe(14);
    for (const bad of ["24", "-1", "8.5", "eight", "", null, 8.5, 99]) expect(parseHour(bad)).toBeNull();
  });
});

describe("only the Today screen opens with a salutation", () => {
  it("screen lines never greet", () => {
    for (const screen of ["pipeline", "portfolio", "mandates", "brain", "agents", "agent", "ask", "slack", "settings", "home", "deal", "memo", "person", "room"])
      expect(composeScreenLine({ screen, subject: screen === "deal" ? "e2b.dev" : null }, empty.memory, []).text).not.toMatch(SALUTE);
  });

  it("strips a salutation a model adds", () => {
    expect(stripSalutation("Good morning, Saurabh. Here is the pipeline.")).toBe("Here is the pipeline.");
    expect(stripSalutation("Working late! Two deals are open.")).toBe("Two deals are open.");
    expect(stripSalutation("Hi there, three deals are open.")).toBe("Three deals are open.");
    expect(stripSalutation("His team grew 40 percent.")).toBe("His team grew 40 percent.");
    expect(stripSalutation("Helio has 52 people.")).toBe("Helio has 52 people.");
  });
});

describe("/api/voice/brief", () => {
  const get = (qs: string) => GET(new Request(`http://localhost/api/voice/brief?${qs}`));
  beforeEach(() => { llm.on = false; llm.systems.length = 0; process.env.DEALDESK_GREETING_NAME = "Saurabh"; vi.useFakeTimers({ toFake: ["Date"] }); });
  afterEach(() => { delete process.env.DEALDESK_GREETING_NAME; vi.useRealTimers(); });

  it.each([
    ["America/New_York", "2026-10-31T12:00:00Z", "Good morning"],
    ["Europe/Athens", "2026-10-31T12:00:00Z", "Good afternoon"],
    ["Asia/Bangkok", "2026-10-31T12:00:00Z", "Good evening"],
    ["Asia/Tokyo", "2026-10-31T14:00:00Z", "Working late"],
  ])("Today greets by the client's zone %s", async (tz, at, s) => {
    vi.setSystemTime(new Date(at));
    const r = await get(`screen=today&tz=${encodeURIComponent(tz)}`);
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(opening((await r.json()).text)).toBe(`${s}, Saurabh`);
  });

  it.each([[8, "Good morning"], [14, "Good afternoon"], [19, "Good evening"], [23, "Working late"]])("Today greets by the client's hour %i", async (hour, s) => {
    vi.setSystemTime(new Date("2026-10-31T03:30:00Z")); // 09:00 IST: the hour must win
    expect(opening((await (await get(`screen=today&tz=Asia/Kolkata&hour=${hour}`)).json()).text)).toBe(`${s}, Saurabh`);
  });

  it("falls back to IST for a bad zone/hour", async () => {
    vi.setSystemTime(new Date("2026-10-31T17:30:00Z")); // 23:00 IST
    expect(opening((await (await get("screen=today&tz=Bogus%2FZone&hour=99")).json()).text)).toBe("Working late, Saurabh");
  });

  it("non-Today screens start with page content (no salutation, no name), with or without a model", async () => {
    vi.setSystemTime(new Date("2026-10-31T03:30:00Z"));
    for (const on of [false, true]) {
      llm.on = on;
      for (const screen of ["pipeline", "portfolio", "deal", "settings", "brain", "agents"]) {
        const b = await (await get(`screen=${screen}&tz=Asia/Kolkata&hour=8`)).json();
        expect(b.text).not.toMatch(SALUTE);
        expect(b.text).not.toMatch(/^Saurabh\b/);
      }
      const asked = await (await POST(new Request("http://localhost/api/voice/brief", { method: "POST", body: JSON.stringify({ screen: "pipeline", question: "what's new?", tz: "Asia/Kolkata", hour: 8 }) }))).json();
      expect(asked.text).not.toMatch(SALUTE);
    }
    expect(llm.systems.every((s) => /Do not greet/.test(s))).toBe(true);
  });

  it("with a model, Today is told to keep the computed salutation", async () => {
    llm.on = true;
    vi.setSystemTime(new Date("2026-10-31T03:30:00Z"));
    await get("screen=today&tz=Asia/Kolkata&hour=19");
    expect(llm.systems.at(-1)).toMatch(/salutation in the facts exactly/);
  });
});

describe("client clock", () => {
  it("sends the browser's IANA zone and local hour", async () => {
    const { localClock } = await import("@/live/voice/useVoiceAgent");
    const c = localClock(new Date(2026, 9, 31, 19, 5));
    expect(c.hour).toBe("19");
    expect(resolveTimeZone(c.tz)).toBe(c.tz || "Asia/Kolkata");
  });
});
