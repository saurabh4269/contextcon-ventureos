// POST /api/voice/tts {text} → streams audio/mpeg from ElevenLabs (server-side key).
// POST /api/voice/tts?timestamps=1 {text} → streams ElevenLabs' with-timestamps JSON chunks
//   ({audio_base64, alignment{characters, character_start_times_seconds, character_end_times_seconds}}) for captions.
// Errors: 400 bad input · 503 not_connected (no ELEVENLABS_API_KEY) · 502 upstream error (with upstream status + message).
import { NextResponse } from "next/server";
import fs from "node:fs";
import { elevenlabsTts, parseTtsInput, teeToFile, ttsCacheFile, ttsConfig, upstreamMessage } from "@/lib/voice/elevenlabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(req: Request) {
  const cfg = ttsConfig();
  if (!cfg) return NextResponse.json({ status: "not_connected", message: "ElevenLabs is not configured: set ELEVENLABS_API_KEY on the server." }, { status: 503, headers: NO_STORE });
  const parsed = parseTtsInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ status: "error", message: parsed.message }, { status: 400, headers: NO_STORE });
  const timestamps = new URL(req.url).searchParams.get("timestamps") === "1";
  const type = timestamps ? "application/x-ndjson" : "audio/mpeg";
  const meta = { ...NO_STORE, "x-voice-id": cfg.voiceId, "x-model-id": cfg.modelId };
  const cached = ttsCacheFile(cfg, parsed.text, timestamps);
  if (cached) {
    try { return new Response(fs.readFileSync(cached), { status: 200, headers: { ...meta, "content-type": type, "x-cache": "hit" } }); }
    catch { /* no cached copy (or unreadable): synthesize */ }
  }
  let up: Response;
  try {
    up = await elevenlabsTts(cfg, parsed.text, { timestamps, signal: req.signal });
  } catch (e) {
    return NextResponse.json({ status: "error", message: `ElevenLabs request failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 502, headers: NO_STORE });
  }
  if (!up.ok || !up.body) {
    const msg = upstreamMessage(await up.text().catch(() => ""));
    console.error(`[voice] ElevenLabs TTS → ${up.status}: ${msg}`);
    return NextResponse.json({ status: "error", upstreamStatus: up.status, message: `ElevenLabs TTS failed (${up.status}): ${msg}` }, { status: 502, headers: NO_STORE });
  }
  return new Response(cached ? teeToFile(up.body, cached) : up.body, { status: 200, headers: { ...meta, "content-type": type } });
}
