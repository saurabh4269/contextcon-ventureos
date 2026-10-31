// POST /api/voice/stt (multipart: file=<audio blob>, durationMs?=<client-measured length>, language?=<ISO-639>)
//   → 200 { text, language, durationMs, raw, source }
// Errors (always JSON { status:"error"|"not_connected", code, message, source }):
//   400 bad_input · 413 too_large/too_long · 415 unsupported_type · 503 not_connected (no key)
//   402 quota_exceeded · 429 rate_limited · 422 bad_audio · 502 key_invalid / permission_denied / upstream_error
import { NextResponse } from "next/server";
import { baseType, checkAudio, elevenlabsStt, mapSttError, MAX_STT_BYTES, parseSttResponse, sttConfig, sttForm } from "@/lib/voice/stt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };
const err = (status: number, code: string, message: string, source: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ status: code === "not_connected" ? "not_connected" : "error", code, message, source, ...extra }, { status, headers: NO_STORE });

export async function POST(req: Request) {
  const cfg = sttConfig();
  const source = { provider: "ElevenLabs", endpoint: "POST /v1/speech-to-text", model: cfg?.modelId ?? null };
  if (!cfg) return err(503, "not_connected", "ElevenLabs is not configured: set ELEVENLABS_API_KEY on the server.", source);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_STT_BYTES + 64 * 1024) return err(413, "too_large", `Audio must be at most ${MAX_STT_BYTES / 1024 / 1024} MB.`, source);
  if (!/multipart\/form-data/i.test(req.headers.get("content-type") ?? "")) return err(415, "unsupported_type", "Send multipart/form-data with a `file` field.", source);

  let form: FormData;
  try { form = await req.formData(); } catch { return err(400, "bad_input", "Could not read the multipart body.", source); }
  const file = form.get("file");
  if (!(file instanceof Blob)) return err(400, "bad_input", "A `file` field with the audio is required.", source);
  const dur = form.get("durationMs");
  const check = checkAudio({ size: file.size, type: file.type }, typeof dur === "string" && dur ? Number(dur) : null);
  if (!check.ok) return err(check.status, check.code, check.message, source);
  const lang = form.get("language");
  const languageCode = typeof lang === "string" && /^[a-z]{2,3}$/i.test(lang) ? lang.toLowerCase() : null;
  const ext = baseType(file.type).split("/")[1] ?? "webm";

  let up: Response;
  try {
    up = await elevenlabsStt(cfg, sttForm(cfg, file, `speech.${ext}`, { languageCode }), req.signal);
  } catch (e) {
    return err(502, "upstream_error", `ElevenLabs request failed: ${e instanceof Error ? e.message : String(e)}`, source);
  }
  if (!up.ok) {
    const m = mapSttError(up.status, await up.text().catch(() => ""));
    console.error(`[voice] ElevenLabs STT → ${up.status} (${m.code})`);
    return err(m.httpStatus, m.code, m.message, source, { upstreamStatus: up.status });
  }
  const r = parseSttResponse(await up.json().catch(() => null));
  return NextResponse.json({ text: r.text, language: r.language, durationMs: r.durationMs, raw: r.raw, languageProbability: r.languageProbability, source }, { headers: NO_STORE });
}
