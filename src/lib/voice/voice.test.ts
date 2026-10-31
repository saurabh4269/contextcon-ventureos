import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/voice/tts/route";
import { composeGreeting } from "./greeting";
import { DEFAULT_MODEL_ID, DEFAULT_VOICE_ID, MAX_TTS_CHARS } from "./elevenlabs";
import type { MemoryEvent } from "@/lib/memory/types";
import type { IntegrationInfo } from "@/lib/live/types";

const req = (body: unknown, qs = "") => new Request(`http://localhost/api/voice/tts${qs}`, { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });

describe("POST /api/voice/tts", () => {
  const calls: { url: string; init: RequestInit }[] = [];
  beforeEach(() => { calls.length = 0; process.env.ELEVENLABS_API_KEY = "test-key"; delete process.env.ELEVENLABS_VOICE_ID; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.ELEVENLABS_API_KEY; });
  const stub = (res: () => Response) => vi.stubGlobal("fetch", async (url: string, init: RequestInit) => { calls.push({ url: String(url), init }); return res(); });

  it("streams audio from the ElevenLabs stream endpoint with the default voice and flash model", async () => {
    const audio = new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]);
    stub(() => new Response(new ReadableStream({ start(c) { c.enqueue(audio); c.close(); } }), { status: 200, headers: { "content-type": "audio/mpeg" } }));
    const r = await POST(req({ text: "Good morning." }));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(audio);
    expect(calls[0]!.url).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}/stream?output_format=mp3_44100_128`);
    expect((calls[0]!.init.headers as Record<string, string>)["xi-api-key"]).toBe("test-key");
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ text: "Good morning.", model_id: DEFAULT_MODEL_ID });
  });

  it("uses the with-timestamps stream when asked, and the configured voice", async () => {
    process.env.ELEVENLABS_VOICE_ID = "voice123";
    stub(() => new Response('{"audio_base64":"AA==","alignment":null}\n', { status: 200 }));
    const r = await POST(req({ text: "Hi" }, "?timestamps=1"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/x-ndjson");
    expect(calls[0]!.url).toContain("/v1/text-to-speech/voice123/stream/with-timestamps");
  });

  it("returns the upstream status and message on an ElevenLabs error (no fallback audio)", async () => {
    stub(() => new Response(JSON.stringify({ detail: { status: "quota_exceeded", message: "This request exceeds your quota." } }), { status: 401 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await POST(req({ text: "Hello" }));
    expect(r.status).toBe(502);
    expect(await r.json()).toMatchObject({ status: "error", upstreamStatus: 401, message: expect.stringContaining("exceeds your quota") });
  });

  it("is not_connected without a key, and never calls upstream", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    stub(() => new Response("should not be called"));
    const r = await POST(req({ text: "Hello" }));
    expect(r.status).toBe(503);
    expect((await r.json()).status).toBe("not_connected");
    expect(calls).toHaveLength(0);
  });

  it.each([[{}], [{ text: "  " }], [{ text: 42 }], [{ text: "x".repeat(MAX_TTS_CHARS + 1) }], ["not json"]])("rejects bad input %#", async (body) => {
    stub(() => new Response("should not be called"));
    const r = await POST(req(body));
    expect(r.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

const ev = (id: number, kind: string, extra: Partial<MemoryEvent> = {}): MemoryEvent => ({ id: String(id), at: "2026-10-31T03:00:00Z", kind, actor: { type: "user" }, summary: kind, source: "test", ...extra });
const conn = (id: string, status: IntegrationInfo["status"]): IntegrationInfo => ({ id, name: id === "gmail" ? "Gmail" : id === "calendar" ? "Google Calendar / Meet" : id, status, mode: "env", wired: false, detail: "", env: [], docsUrl: "", lastCheckedAt: null });
const morning = new Date("2026-10-31T03:30:00Z"); // 09:00 IST

describe("composeGreeting (deterministic, real data only)", () => {
  it("says honestly that nothing came in when memory is empty", () => {
    const g = composeGreeting({ name: "Saurabh", memory: { status: "ok", events: [] }, connectors: [conn("crustdata", "connected")], now: morning });
    expect(g.text).toBe("Good morning, Saurabh. Nothing has come in yet: the firm's memory is empty. All connectors look healthy. There's no deal on your desk yet. Research a company from the pipeline to start one.");
  });

  it("reports the memory store's unavailability instead of inventing activity", () => {
    const g = composeGreeting({ memory: { status: "unavailable", reason: "memory store not configured (DATABASE_URL)" }, connectors: [conn("gmail", "not_configured")], now: morning });
    expect(g.text).toContain("memory store not configured (DATABASE_URL)");
    expect(g.text).toContain("Gmail isn't connected");
    expect(g.text).not.toMatch(/deal on your desk is/);
  });

  it("summarizes only events after the last played greeting, and cites the top deal's numbers", () => {
    const fields = { headcountLatest: { value: 52, endpoint: "POST /company/enrich", path: "…headcount.total" }, growthYoY: { value: 136.4, endpoint: "POST /company/enrich", path: "…yoy" }, lastFunding: { value: { amount: 21_000_000, currency: "USD" }, endpoint: "POST /company/enrich", path: "…last_round_amount_usd" }, lastRoundType: { value: "series_a", endpoint: "POST /company/enrich", path: "…last_round_type" } };
    const events = [
      ev(1, "research.run", { subject: { type: "company", id: "old.dev", label: "Old" }, data: { status: "ok" } }),
      ev(2, "greeting.played"),
      ev(3, "research.run", { subject: { type: "company", id: "e2b.dev", label: "E2B" }, data: { status: "ok", fields } }),
      ev(4, "note.added", { summary: "Call the founders on Monday" }),
    ];
    const g = composeGreeting({ name: null, memory: { status: "ok", events }, connectors: [conn("gmail", "not_configured"), conn("calendar", "not_configured")], now: morning });
    expect(g.text).toContain("2 things happened: E2B was researched and 1 note was added.");
    expect(g.text).not.toContain("Old");
    expect(g.text).toContain("“Call the founders on Monday”");
    expect(g.text).toContain("Gmail and Google Calendar / Meet aren't connected");
    expect(g.text).toContain("The latest deal on your desk is E2B: 52 people, headcount up 136 percent year over year and last round a Series A of $21M.");
    expect(g.sources.map((s) => s.ref).join("\n")).toContain("research.run #3");
  });
});

describe("voice client helpers", () => {
  it("parses the with-timestamps NDJSON into audio + cumulative alignment", async () => {
    const { parseTimestampStream } = await import("@/live/voice/useVoiceAgent");
    const nd = [
      JSON.stringify({ audio_base64: btoa("ab"), alignment: { characters: ["H", "i"], character_start_times_seconds: [0, 0.1], character_end_times_seconds: [0.1, 0.2] } }),
      JSON.stringify({ audio_base64: btoa("c"), alignment: null }),
      "",
    ].join("\n");
    const r = parseTimestampStream(nd);
    expect(r.audio.map((a) => a.length)).toEqual([2, 1]);
    expect(r.alignment).toEqual({ chars: ["H", "i"], starts: [0, 0.1] });
  });
  it("derives the screen context from the URL", async () => {
    const { screenContext } = await import("@/live/voice/FloatingVoice");
    expect(screenContext({ pathname: "/deal", search: "?domain=e2b.dev&tab=team" })).toEqual({ screen: "deal", subject: "e2b.dev" });
    expect(screenContext({ pathname: "/deal/room", search: "?id=e2b.dev" })).toEqual({ screen: "room", subject: "e2b.dev" });
    expect(screenContext({ pathname: "/settings", search: "" })).toEqual({ screen: "settings" });
  });
});
