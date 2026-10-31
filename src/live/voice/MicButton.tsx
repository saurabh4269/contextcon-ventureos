"use client";
// Push-to-talk mic → ElevenLabs Scribe (POST /api/voice/stt) → onTranscript(text).
// Click to start, click to stop. Also stops on ~1.5 s of silence after speech (AnalyserNode RMS) and at a 30 s hard cap.
// States: idle · listening (pulsing rust ring + live level meter) · transcribing (spinner) · error (inline reason).
// Support (getUserMedia + MediaRecorder, secure context) is decided after mount so SSR and client markup match.
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Square } from "lucide-react";
import { cx } from "@port/components/ui";
import { stopSpeaking } from "./speak";

export const MAX_RECORD_MS = 30_000;
const SILENCE_MS = 1_500;
const SPEECH_RMS = 0.045; // RMS above this counts as speech
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

type MicState = "idle" | "listening" | "transcribing" | "error";

/** Human reason for a getUserMedia / MediaRecorder failure. */
export function micErrorMessage(e: unknown): string {
  const name = e instanceof DOMException || e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone permission denied. Allow mic access for this site in your browser settings, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone found on this device.";
  if (name === "NotSupportedError" || name === "TypeError") return "This browser can’t record from the microphone here (it needs mic support and HTTPS).";
  if (name === "NotReadableError" || name === "AbortError") return "The microphone is busy or unavailable (another app may be using it).";
  return `Couldn’t start the microphone: ${e instanceof Error ? e.message : String(e)}`;
}

/** Human reason for a /api/voice/stt error response. */
export function sttErrorMessage(status: number, body: { code?: string; message?: string } | null): string {
  switch (body?.code) {
    case "not_connected": return "Voice input is not configured on the server (ElevenLabs key missing).";
    case "key_invalid": return "The server’s ElevenLabs key was rejected.";
    case "permission_denied": return "The ElevenLabs key isn’t allowed to use speech-to-text.";
    case "quota_exceeded": return "ElevenLabs quota exceeded, so voice input is unavailable right now.";
    case "rate_limited": return "Too many voice requests. Wait a moment and try again.";
    case "too_large": case "too_long": return "That recording is too long (max 30 s).";
    case "bad_audio": return "Couldn’t understand the recording. Try again closer to the mic.";
  }
  return body?.message ?? `Transcription failed (HTTP ${status}).`;
}

export function MicButton({ onTranscript, disabled, size = "md" }: { onTranscript(text: string): void; disabled?: boolean; size?: "sm" | "md" }) {
  const [supported, setSupported] = useState<boolean | null>(null); // null until mounted
  const [state, setState] = useState<MicState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; ctx: AudioContext | null; started: number; timer: number; raf: number; cancelled: boolean } | null>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const cb = useRef(onTranscript);
  cb.current = onTranscript;

  useEffect(() => {
    setSupported(typeof window !== "undefined" && window.isSecureContext !== false && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined");
  }, []);

  const teardown = () => {
    const r = rec.current;
    if (!r) return;
    clearTimeout(r.timer);
    cancelAnimationFrame(r.raf);
    r.stream.getTracks().forEach((t) => t.stop());
    void r.ctx?.close().catch(() => {});
    if (meter.current) meter.current.style.transform = "scaleX(0)";
  };

  const stop = useCallback(() => {
    const r = rec.current;
    if (r && r.mr.state !== "inactive") r.mr.stop();
  }, []);

  const send = async (blob: Blob, durationMs: number) => {
    setState("transcribing");
    setAnnounce("Transcribing…");
    const fd = new FormData();
    const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "mp4" : "webm";
    fd.append("file", blob, `speech.${ext}`);
    fd.append("durationMs", String(Math.round(durationMs)));
    try {
      const r = await fetch("/api/voice/stt", { method: "POST", body: fd });
      const j = (await r.json().catch(() => null)) as { text?: string; code?: string; message?: string } | null;
      if (!r.ok) throw new Error(sttErrorMessage(r.status, j));
      const text = (j?.text ?? "").trim();
      if (!text) throw new Error("Didn’t catch any speech. Try again.");
      setState("idle");
      setAnnounce(`Heard: ${text}`);
      cb.current(text);
    } catch (e) {
      const m = e instanceof TypeError ? "Couldn’t reach the server for transcription." : e instanceof Error ? e.message : String(e);
      setError(m);
      setState("error");
      setAnnounce(m);
    }
  };

  const start = useCallback(async () => {
    setError(null);
    stopSpeaking(); // don't record our own voice
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const m = micErrorMessage(e);
      setError(m); setState("error"); setAnnounce(m);
      return;
    }
    const mimeType = MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported?.(t));
    let mr: MediaRecorder;
    try { mr = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined); }
    catch (e) { stream.getTracks().forEach((t) => t.stop()); const m = micErrorMessage(e); setError(m); setState("error"); setAnnounce(m); return; }
    const chunks: Blob[] = [];
    let ctx: AudioContext | null = null;
    const r: { mr: MediaRecorder; stream: MediaStream; ctx: AudioContext | null; started: number; timer: number; raf: number; cancelled: boolean } = { mr, stream, ctx, started: performance.now(), timer: 0, raf: 0, cancelled: false };
    rec.current = r;
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      const dur = performance.now() - r.started;
      teardown();
      rec.current = null;
      if (r.cancelled) { setState("idle"); return; }
      void send(new Blob(chunks, { type: mr.mimeType || mimeType || "audio/webm" }), dur);
    };
    // level meter + silence auto-stop
    try {
      ctx = new AudioContext();
      r.ctx = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let heardSpeech = false, quietSince = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i]! - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        if (meter.current) meter.current.style.transform = `scaleX(${Math.min(1, rms * 6).toFixed(3)})`;
        const now = performance.now();
        if (rms > SPEECH_RMS) { heardSpeech = true; quietSince = 0; }
        else if (heardSpeech) { quietSince ||= now; if (now - quietSince > SILENCE_MS) { stop(); return; } }
        r.raf = requestAnimationFrame(tick);
      };
      r.raf = requestAnimationFrame(tick);
    } catch { /* no Web Audio: still records; click or the 30 s cap stops it */ }
    r.timer = window.setTimeout(stop, MAX_RECORD_MS);
    mr.start(250);
    setState("listening");
    setAnnounce("Listening. Click again to stop.");
  }, [stop]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { const r = rec.current; if (r) { r.cancelled = true; if (r.mr.state !== "inactive") r.mr.stop(); teardown(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const px = size === "sm" ? "size-8" : "size-10";
  const icon = size === "sm" ? "size-4" : "size-[18px]";
  const listening = state === "listening";
  const unsupported = supported === false;
  const label = unsupported ? "Voice input is not supported in this browser" : listening ? "Stop recording" : state === "transcribing" ? "Transcribing" : "Speak your request";

  return (
    <span className="relative inline-flex items-center gap-2" data-testid="mic-button" data-state={unsupported ? "unsupported" : state}>
      <button type="button" aria-pressed={listening} aria-label={label} title={unsupported ? "Voice input needs a browser with microphone recording (and HTTPS)." : label}
        disabled={disabled || unsupported || supported === null || state === "transcribing"}
        onClick={() => (listening ? stop() : void start())}
        className={cx("relative grid shrink-0 place-items-center rounded-full ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rust disabled:cursor-not-allowed disabled:opacity-50", px,
          listening ? "bg-rust text-white ring-rust" : state === "error" ? "bg-white text-rust ring-rust/40 hover:bg-rust-50" : "bg-white text-zinc-700 ring-zinc-300 hover:bg-rust-50 hover:text-rust")}>
        {listening && <span aria-hidden className="pointer-events-none absolute -inset-1 animate-ping rounded-full ring-2 ring-rust/50 motion-reduce:animate-none" />}
        {state === "transcribing" ? <Loader2 aria-hidden className={cx(icon, "animate-spin")} /> : listening ? <Square aria-hidden className={cx(icon, "fill-current")} /> : unsupported ? <MicOff aria-hidden className={icon} /> : <Mic aria-hidden className={icon} />}
      </button>
      {listening && (
        <span aria-hidden className="h-1.5 w-12 overflow-hidden rounded-full bg-rust-100">
          <span ref={meter} className="block h-full origin-left rounded-full bg-rust" style={{ transform: "scaleX(0)" }} />
        </span>
      )}
      {state === "transcribing" && <span className="text-[12px] text-zinc-500">Transcribing…</span>}
      {state === "error" && error && <span className="max-w-[260px] text-[12px] leading-snug text-rust">{error}</span>}
      <span aria-live="polite" className="sr-only">{announce}</span>
    </span>
  );
}
