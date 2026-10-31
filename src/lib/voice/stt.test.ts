import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/voice/stt/route";
import { checkAudio, correctTranscript, DEFAULT_STT_MODEL_ID, mapSttError, MAX_STT_BYTES, parseSttResponse, STT_KEYTERMS } from "./stt";

describe("correctTranscript", () => {
  it.each([
    ["find companies on crust data", "find companies on Crustdata"],
    ["Crust-Data API", "Crustdata API"],
    ["use crust that to search", "use Crustdata to search"],
    ["indian b to b software", "indian B2B software"],
    ["B 2 B and b2c", "B2B and B2C"],
    ["a sass company", "a SaaS company"],
    ["raised a series a last year", "raised a Series A last year"],
    ["series b, series c", "Series B, Series C"],
    ["open the deal desk", "open the Deal Desk"],
    ["their a r r grew", "their ARR grew"],
    ["linked in profiles", "LinkedIn profiles"],
  ])("%s → %s", (input, want) => expect(correctTranscript(input)).toBe(want));

  it("leaves ordinary words alone", () => {
    for (const s of ["Find ten companies founded since 2023", "a bee to bee meeting", "crusty bread", "arrow", "series of events", "the desk"]) expect(correctTranscript(s)).toBe(s);
  });
});

describe("mapSttError", () => {
  it("401 invalid key → key_invalid", () => {
    const m = mapSttError(401, JSON.stringify({ detail: { status: "invalid_api_key", message: "Invalid API key" } }));
    expect(m).toMatchObject({ code: "key_invalid", httpStatus: 502 });
    expect(m.message).toContain("Invalid API key");
  });
  it("quota_exceeded (ElevenLabs sends it as 401) → quota_exceeded 402", () => {
    expect(mapSttError(401, JSON.stringify({ detail: { status: "quota_exceeded", message: "This request exceeds your quota." } }))).toMatchObject({ code: "quota_exceeded", httpStatus: 402 });
  });
  it("429 → rate_limited", () => expect(mapSttError(429, JSON.stringify({ detail: { status: "too_many_concurrent_requests", message: "slow down" } }))).toMatchObject({ code: "rate_limited", httpStatus: 429 }));
  it("403 / missing_permissions → permission_denied", () => {
    expect(mapSttError(403, "{}")).toMatchObject({ code: "permission_denied" });
    expect(mapSttError(401, JSON.stringify({ detail: { status: "missing_permissions", message: "needs speech_to_text" } }))).toMatchObject({ code: "permission_denied" });
  });
  it("422 validation → bad_audio with the upstream msg", () => {
    const m = mapSttError(422, JSON.stringify({ detail: [{ loc: ["body", "file"], msg: "audio too short", type: "value_error" }] }));
    expect(m).toMatchObject({ code: "bad_audio", httpStatus: 422 });
    expect(m.message).toContain("audio too short");
  });
  it("5xx / non-JSON → upstream_error", () => expect(mapSttError(503, "Service Unavailable")).toMatchObject({ code: "upstream_error", httpStatus: 502 }));
});

describe("checkAudio / parseSttResponse", () => {
  it("accepts MediaRecorder webm/ogg with codec params", () => {
    expect(checkAudio({ size: 20_000, type: "audio/webm;codecs=opus" }).ok).toBe(true);
    expect(checkAudio({ size: 20_000, type: "audio/ogg; codecs=opus" }).ok).toBe(true);
  });
  it("rejects wrong type, empty, too big, too long", () => {
    expect(checkAudio({ size: 20_000, type: "text/plain" })).toMatchObject({ ok: false, status: 415 });
    expect(checkAudio({ size: 10, type: "audio/webm" })).toMatchObject({ ok: false, status: 400 });
    expect(checkAudio({ size: MAX_STT_BYTES + 1, type: "audio/webm" })).toMatchObject({ ok: false, status: 413, code: "too_large" });
    expect(checkAudio({ size: 20_000, type: "audio/webm" }, 45_000)).toMatchObject({ ok: false, status: 413, code: "too_long" });
  });
  it("parses the Scribe response and post-corrects the text", () => {
    expect(parseSttResponse({ text: "crust data b to b", language_code: "eng", language_probability: 0.98, audio_duration_secs: 2.5 })).toEqual({ raw: "crust data b to b", text: "Crustdata B2B", language: "eng", languageProbability: 0.98, durationMs: 2500 });
  });
});

describe("POST /api/voice/stt", () => {
  const calls: { url: string; init: RequestInit }[] = [];
  beforeEach(() => { calls.length = 0; process.env.ELEVENLABS_API_KEY = "test-key"; });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete process.env.ELEVENLABS_API_KEY; });
  const stub = (res: () => Response) => vi.stubGlobal("fetch", async (url: string, init: RequestInit) => { calls.push({ url: String(url), init }); return res(); });
  const audioReq = (type = "audio/webm;codecs=opus", size = 2048) => {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(size)], { type }), "speech.webm");
    return new Request("http://localhost/api/voice/stt", { method: "POST", body: fd });
  };

  it("sends model, file, tag_audio_events=false and keyterms; returns {text, language, durationMs, source}", async () => {
    stub(() => Response.json({ text: "Find B2B companies on crust data", language_code: "eng", audio_duration_secs: 3.2 }));
    const r = await POST(audioReq());
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j).toMatchObject({ text: "Find B2B companies on Crustdata", language: "eng", durationMs: 3200, source: { provider: "ElevenLabs", model: DEFAULT_STT_MODEL_ID } });
    expect(calls[0]!.url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect((calls[0]!.init.headers as Record<string, string>)["xi-api-key"]).toBe("test-key");
    const sent = calls[0]!.init.body as FormData;
    expect(sent.get("model_id")).toBe(DEFAULT_STT_MODEL_ID);
    expect(sent.get("tag_audio_events")).toBe("false");
    expect(sent.getAll("keyterms")).toEqual(STT_KEYTERMS);
    expect(sent.get("file")).toBeInstanceOf(Blob);
  });

  it("503 not_connected without a key (no upstream call)", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    stub(() => Response.json({}));
    const r = await POST(audioReq());
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ status: "not_connected", code: "not_connected" });
    expect(calls).toHaveLength(0);
  });

  it("415 for a non-audio upload (no upstream call)", async () => {
    stub(() => Response.json({}));
    const r = await POST(audioReq("text/plain"));
    expect(r.status).toBe(415);
    expect(calls).toHaveLength(0);
  });

  it("maps an upstream quota error honestly (no fake transcript)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stub(() => new Response(JSON.stringify({ detail: { status: "quota_exceeded", message: "This request exceeds your quota." } }), { status: 401 }));
    const r = await POST(audioReq());
    expect(r.status).toBe(402);
    const j = await r.json();
    expect(j).toMatchObject({ status: "error", code: "quota_exceeded", upstreamStatus: 401 });
    expect(j.text).toBeUndefined();
  });
});
