// ElevenLabs text-to-speech (server only; the key never leaves the server).
// Docs: https://elevenlabs.io/docs/api-reference/text-to-speech/stream (audio stream) and
//       https://elevenlabs.io/docs/api-reference/text-to-speech/stream-with-timestamps (JSON chunks with
//       audio_base64 + character alignment, used for captions).
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";
/** Default voice: "Brian — Deep, Resonant and Comforting" (from GET /v1/voices). Override with ELEVENLABS_VOICE_ID. */
export const DEFAULT_VOICE_ID = "nPczCjzI2devNBz1zQrb";
/** Low-latency model; override with ELEVENLABS_MODEL_ID (e.g. eleven_turbo_v2_5). */
export const DEFAULT_MODEL_ID = "eleven_flash_v2_5";
export const MAX_TTS_CHARS = 1200;

export type TtsConfig = { apiKey: string; voiceId: string; modelId: string };

export function ttsConfig(env: Record<string, string | undefined> = process.env): TtsConfig | null {
  const apiKey = env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, voiceId: env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID, modelId: env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID };
}

export function parseTtsInput(body: unknown): { ok: true; text: string } | { ok: false; message: string } {
  const text = (body as { text?: unknown } | null)?.text;
  if (typeof text !== "string" || !text.trim()) return { ok: false, message: "text is required (non-empty string)" };
  if (text.length > MAX_TTS_CHARS) return { ok: false, message: `text must be at most ${MAX_TTS_CHARS} characters (got ${text.length})` };
  return { ok: true, text: text.trim() };
}

/** Upstream call. `timestamps` selects the with-timestamps stream (JSON chunks) instead of raw audio. */
export function elevenlabsTts(cfg: TtsConfig, text: string, opts: { timestamps: boolean; signal?: AbortSignal }, f: typeof fetch = fetch) {
  const path = `/v1/text-to-speech/${encodeURIComponent(cfg.voiceId)}/stream${opts.timestamps ? "/with-timestamps" : ""}?output_format=mp3_44100_128`;
  return f(`${ELEVENLABS_BASE_URL}${path}`, {
    method: "POST",
    headers: { "xi-api-key": cfg.apiKey, "content-type": "application/json", accept: opts.timestamps ? "application/json" : "audio/mpeg" },
    body: JSON.stringify({ text, model_id: cfg.modelId, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true } }),
    signal: opts.signal,
  });
}

/** Human message from an ElevenLabs error body ({detail: {status, message}} or {detail: [...]}) */
export function upstreamMessage(text: string): string {
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    const d = j.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x) => (x as { msg?: string }).msg).filter(Boolean).join("; ");
    if (d && typeof d === "object") return String((d as { message?: string }).message ?? (d as { status?: string }).status ?? JSON.stringify(d));
  } catch { /* not JSON */ }
  return text.slice(0, 300) || "no error body";
}

/* ── dev-only response cache (DEALDESK_CACHE_DIR, like the Crustdata cache): identical text+voice+model is not
   re-synthesized while developing/verifying. Unset in production ⇒ every request goes to ElevenLabs. ── */

export function ttsCacheFile(cfg: TtsConfig, text: string, timestamps: boolean, env: Record<string, string | undefined> = process.env): string | null {
  const dir = env.DEALDESK_CACHE_DIR?.trim();
  if (!dir) return null;
  const key = createHash("sha256").update(JSON.stringify([cfg.voiceId, cfg.modelId, timestamps, text])).digest("hex");
  return path.join(dir, "voice", `${key}${timestamps ? ".ndjson" : ".mp3"}`);
}

/** Pass `body` through while saving a copy to `file` once the stream completes. */
export function teeToFile(body: ReadableStream<Uint8Array>, file: string): ReadableStream<Uint8Array> {
  const [a, b] = body.tee();
  void (async () => {
    const chunks: Uint8Array[] = [];
    const r = b.getReader();
    for (;;) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.concat(chunks));
  })().catch((e) => console.error(`[voice] cache write failed: ${e instanceof Error ? e.message : String(e)}`));
  return a;
}
