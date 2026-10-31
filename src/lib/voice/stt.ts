// ElevenLabs speech-to-text (server only; the key never leaves the server).
// Docs: https://elevenlabs.io/docs/api-reference/speech-to-text/convert
//   POST /v1/speech-to-text (multipart): model_id, file, language_code?, tag_audio_events?, keyterms[]?
//   200 → { language_code, language_probability, text, words[], audio_duration_secs, transcription_id }
import { ELEVENLABS_BASE_URL, upstreamMessage } from "./elevenlabs";

/** Current Scribe model (the docs' example). Override with ELEVENLABS_STT_MODEL_ID (e.g. scribe_v1). */
export const DEFAULT_STT_MODEL_ID = "scribe_v2";
/** 30 s of Opus from MediaRecorder is ~150 KB; 4 MB leaves room for uncompressed-ish codecs and rejects junk. */
export const MAX_STT_BYTES = 4 * 1024 * 1024;
/** Hard cap on clip length (the MicButton stops at 30 s; a little slack for encoder padding). */
export const MAX_STT_DURATION_MS = 32_000;
/** Below the API's 100 ms minimum there is nothing to transcribe. */
export const MIN_STT_BYTES = 200;
export const STT_ALLOWED_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/wave", "video/webm"] as const;

/** Domain vocabulary passed as `keyterms` so Scribe biases towards them. */
export const STT_KEYTERMS = ["Crustdata", "Deal Desk", "B2B", "SaaS", "Series A", "Series B", "seed round", "ARR", "headcount", "founders", "fintech", "LinkedIn", "YC", "Y Combinator"];

export type SttConfig = { apiKey: string; modelId: string; keyterms: boolean };

export function sttConfig(env: Record<string, string | undefined> = process.env): SttConfig | null {
  const apiKey = env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, modelId: env.ELEVENLABS_STT_MODEL_ID?.trim() || DEFAULT_STT_MODEL_ID, keyterms: env.ELEVENLABS_STT_KEYTERMS !== "0" };
}

/** "audio/webm;codecs=opus" → "audio/webm" */
export const baseType = (t: string | null | undefined) => (t ?? "").split(";")[0]!.trim().toLowerCase();

export type AudioCheck = { ok: true } | { ok: false; status: 400 | 413 | 415; code: "bad_input" | "too_large" | "unsupported_type" | "too_long"; message: string };

export function checkAudio(file: { size: number; type: string }, clientDurationMs?: number | null): AudioCheck {
  const t = baseType(file.type);
  if (!(STT_ALLOWED_TYPES as readonly string[]).includes(t)) return { ok: false, status: 415, code: "unsupported_type", message: `Unsupported audio type "${file.type || "(none)"}"; send webm, ogg, mp4, mpeg or wav.` };
  if (file.size < MIN_STT_BYTES) return { ok: false, status: 400, code: "bad_input", message: "The recording is empty or too short to transcribe." };
  if (file.size > MAX_STT_BYTES) return { ok: false, status: 413, code: "too_large", message: `Audio must be at most ${MAX_STT_BYTES / 1024 / 1024} MB (got ${(file.size / 1024 / 1024).toFixed(1)} MB).` };
  if (clientDurationMs != null && Number.isFinite(clientDurationMs) && clientDurationMs > MAX_STT_DURATION_MS) return { ok: false, status: 413, code: "too_long", message: `Recordings are capped at ${MAX_STT_DURATION_MS / 1000} s.` };
  return { ok: true };
}

export function sttForm(cfg: SttConfig, file: Blob, filename: string, opts: { languageCode?: string | null } = {}): FormData {
  const fd = new FormData();
  fd.append("model_id", cfg.modelId);
  fd.append("file", file, filename);
  fd.append("tag_audio_events", "false");
  if (opts.languageCode) fd.append("language_code", opts.languageCode);
  if (cfg.keyterms) for (const k of STT_KEYTERMS) fd.append("keyterms", k);
  return fd;
}

export function elevenlabsStt(cfg: SttConfig, form: FormData, signal?: AbortSignal, f: typeof fetch = fetch) {
  return f(`${ELEVENLABS_BASE_URL}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": cfg.apiKey, accept: "application/json" }, body: form, signal });
}

export type SttErrorCode = "key_invalid" | "quota_exceeded" | "rate_limited" | "permission_denied" | "bad_audio" | "upstream_error";

/** Map an ElevenLabs error (HTTP status + body) to an honest code, our HTTP status, and a human message. */
export function mapSttError(status: number, body: string): { code: SttErrorCode; httpStatus: number; message: string } {
  const detail = upstreamMessage(body);
  let s = "";
  try { const d = (JSON.parse(body) as { detail?: { status?: string } }).detail; if (d && typeof d === "object" && !Array.isArray(d)) s = String(d.status ?? ""); } catch { /* not JSON */ }
  const quota = /quota|credits?|insufficient|limit_exceeded|payment/i.test(s) || /quota|credits/i.test(detail);
  if (quota) return { code: "quota_exceeded", httpStatus: 402, message: `ElevenLabs quota exceeded: ${detail}` };
  if (status === 403 || /missing_permissions/i.test(s)) return { code: "permission_denied", httpStatus: 502, message: `The ElevenLabs key lacks speech-to-text permission (${status}): ${detail}` };
  if (status === 401) return { code: "key_invalid", httpStatus: 502, message: `ElevenLabs rejected the API key (401): ${detail}` };
  if (status === 429) return { code: "rate_limited", httpStatus: 429, message: `ElevenLabs is rate-limiting requests (429): ${detail}` };
  if (status === 400 || status === 422) return { code: "bad_audio", httpStatus: 422, message: `ElevenLabs could not process the audio (${status}): ${detail}` };
  return { code: "upstream_error", httpStatus: 502, message: `ElevenLabs speech-to-text failed (${status}): ${detail}` };
}

export { correctTranscript } from "./transcript";
import { correctTranscript } from "./transcript";

export type SttResult = { text: string; raw: string; language: string | null; languageProbability: number | null; durationMs: number | null };

export function parseSttResponse(j: unknown): SttResult {
  const o = (j ?? {}) as { text?: unknown; language_code?: unknown; language_probability?: unknown; audio_duration_secs?: unknown };
  const raw = typeof o.text === "string" ? o.text : "";
  return {
    raw,
    text: correctTranscript(raw),
    language: typeof o.language_code === "string" ? o.language_code : null,
    languageProbability: typeof o.language_probability === "number" ? o.language_probability : null,
    durationMs: typeof o.audio_duration_secs === "number" ? Math.round(o.audio_duration_secs * 1000) : null,
  };
}
