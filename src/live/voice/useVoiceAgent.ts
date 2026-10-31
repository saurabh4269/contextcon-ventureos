"use client";
// The one voice-agent hook behind the /today panel and the floating orb.
//   brief:   GET /api/voice/brief?screen=&subject=  (or POST with a question) — text composed from real data
//   speech:  POST /api/voice/tts?timestamps=1 — ElevenLabs with-timestamps stream (NDJSON chunks of audio_base64 +
//            character alignment). Chunks are collected, then played from one MP3 blob; captions follow the exact
//            per-character start times (not a proportional estimate).
//   level:   Web Audio AnalyserNode on the playing audio (or the mic while listening) → RMS 0..1 in `level.current`.
//   listen:  push-to-talk with the browser's SpeechRecognition when available; otherwise the UI shows a text input.
// Autoplay: if the browser refuses play() without a gesture, phase becomes "blocked" and the UI offers "Tap to hear".
import { useCallback, useEffect, useRef, useState } from "react";
import type { Greeting } from "@/lib/voice/greeting";
import { recordEvent } from "../memory";

export type VoicePhase = "idle" | "preparing" | "blocked" | "speaking" | "listening" | "thinking" | "error";
export type VoiceContext = { screen: string; subject?: string | null };
type Alignment = { chars: string[]; starts: number[] };

type SR = { start(): void; stop(): void; abort(): void; lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
const speechRecognition = (): (new () => SR) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

async function failure(r: Response, what: string): Promise<string> {
  const j = (await r.json().catch(() => null)) as { message?: string; reason?: string } | null;
  return `${what} (HTTP ${r.status}): ${j?.message ?? j?.reason ?? r.statusText}`;
}

/** Parse the with-timestamps NDJSON into one MP3 blob + concatenated character alignment (times are cumulative). */
export function parseTimestampStream(ndjson: string): { audio: Uint8Array[]; alignment: Alignment } {
  const audio: Uint8Array[] = [];
  const alignment: Alignment = { chars: [], starts: [] };
  for (const line of ndjson.split("\n")) {
    if (!line.trim()) continue;
    const j = JSON.parse(line) as { audio_base64?: string; alignment?: { characters: string[]; character_start_times_seconds: number[] } | null };
    if (j.audio_base64) audio.push(Uint8Array.from(atob(j.audio_base64), (c) => c.charCodeAt(0)));
    if (j.alignment) { alignment.chars.push(...j.alignment.characters); alignment.starts.push(...j.alignment.character_start_times_seconds); }
  }
  return { audio, alignment };
}

export function useVoiceAgent({ context, autoStart = false }: { context: () => VoiceContext; autoStart?: boolean }) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [brief, setBrief] = useState<Greeting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spoken, setSpoken] = useState(0); // characters of brief.text spoken so far
  const [muted, setMutedState] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const level = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const ac = useRef<{ ctx: AudioContext; analyser: AnalyserNode; gain: GainNode } | null>(null);
  const mic = useRef<{ stream: MediaStream; src: MediaStreamAudioSourceNode } | null>(null);
  const align = useRef<Alignment>({ chars: [], starts: [] });
  const rec = useRef<SR | null>(null);
  const raf = useRef(0);
  const ctxRef = useRef(context);
  ctxRef.current = context;
  const canListen = typeof window !== "undefined" && !!speechRecognition();

  /** Create/resume the audio graph. Call from a user gesture when possible (autoplay policy). */
  const element = useCallback(() => {
    if (!audio.current) { audio.current = new Audio(); audio.current.preload = "auto"; }
    return audio.current;
  }, []);
  const ensureAudio = useCallback(() => {
    element();
    if (!ac.current && typeof AudioContext !== "undefined") {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const gain = ctx.createGain();
      ctx.createMediaElementSource(audio.current!).connect(analyser);
      analyser.connect(gain).connect(ctx.destination);
      ac.current = { ctx, analyser, gain };
    }
    void ac.current?.ctx.resume().catch(() => {});
    return audio.current!;
  }, [element]);

  // amplitude + caption loop
  useEffect(() => {
    const buf = new Uint8Array(512);
    const tick = () => {
      const a = ac.current;
      if (a) {
        a.analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i]! - 128) / 128; sum += v * v; }
        level.current = Math.min(1, Math.sqrt(sum / buf.length) * 4);
      }
      const el = audio.current;
      if (el && !el.paused) {
        const t = el.currentTime, s = align.current.starts;
        let n = 0;
        while (n < s.length && s[n]! <= t) n++;
        setSpoken((p) => (p === n ? p : n));
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const play = useCallback(async () => {
    const el = ensureAudio();
    try {
      await el.play();
      setPhase("speaking");
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") setPhase("blocked");
      else { setError(`Couldn’t play audio: ${e instanceof Error ? e.message : String(e)}`); setPhase("error"); }
    }
  }, [ensureAudio]);

  const speak = useCallback(async (text: string) => {
    setPhase("preparing");
    setSpoken(0);
    const r = await fetch("/api/voice/tts?timestamps=1", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    if (!r.ok) throw new Error(await failure(r, "Voice unavailable"));
    const { audio: parts, alignment } = parseTimestampStream(await r.text());
    if (!parts.length) throw new Error("Voice unavailable: ElevenLabs returned no audio");
    align.current = alignment;
    const el = ensureAudio();
    if (el.src.startsWith("blob:")) URL.revokeObjectURL(el.src);
    el.src = URL.createObjectURL(new Blob(parts as BlobPart[], { type: "audio/mpeg" }));
    await play();
  }, [ensureAudio, play]);

  const run = useCallback(async (get: () => Promise<Response>) => {
    setError(null);
    setPhase("preparing");
    try {
      const r = await get();
      if (!r.ok) throw new Error(await failure(r, "Couldn’t compose what to say"));
      const b = (await r.json()) as Greeting;
      setBrief(b);
      await speak(b.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [speak]);

  const start = useCallback(() => {
    ensureAudio();
    const c = ctxRef.current();
    const qs = new URLSearchParams({ screen: c.screen, ...(c.subject ? { subject: c.subject } : {}) });
    return run(() => fetch(`/api/voice/brief?${qs}`, { cache: "no-store" }));
  }, [ensureAudio, run]);

  const ask = useCallback((question: string) => {
    ensureAudio();
    setHeard(question);
    const c = ctxRef.current();
    setPhase("thinking");
    return run(() => fetch("/api/voice/brief", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ screen: c.screen, subject: c.subject ?? null, question }) }));
  }, [ensureAudio, run]);

  const stopMic = () => {
    mic.current?.src.disconnect();
    mic.current?.stream.getTracks().forEach((t) => t.stop());
    mic.current = null;
  };

  /** Push-to-talk: begin listening (mic level drives the orb). */
  const listenStart = useCallback(async () => {
    const Rec = speechRecognition();
    if (!Rec) return;
    audio.current?.pause();
    ensureAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (ac.current) { const src = ac.current.ctx.createMediaStreamSource(stream); src.connect(ac.current.analyser); mic.current = { stream, src }; }
    } catch { /* level stays flat; recognition still reports its own permission error below */ }
    const r = new Rec();
    r.lang = "en-IN";
    r.interimResults = false;
    r.continuous = false;
    let said = "";
    r.onresult = (e) => { said = Array.from(e.results).map((x) => x[0]!.transcript).join(" ").trim(); };
    r.onerror = (e) => { stopMic(); setError(`Speech recognition error: ${e.error}`); setPhase("error"); };
    r.onend = () => { stopMic(); rec.current = null; if (said) void ask(said); else setPhase((p) => (p === "listening" ? "idle" : p)); };
    rec.current = r;
    setPhase("listening");
    r.start();
  }, [ask, ensureAudio]);
  const listenStop = useCallback(() => rec.current?.stop(), []);

  const stop = useCallback(() => { audio.current?.pause(); rec.current?.abort(); stopMic(); setPhase((p) => (p === "error" ? p : "idle")); }, []);
  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    if (ac.current) ac.current.gain.gain.value = m ? 0 : 1;
    else if (audio.current) audio.current.muted = m;
  }, []);

  // end of speech → idle; the Today greeting records that it was heard
  useEffect(() => {
    const el = element();
    const ended = () => {
      setSpoken(align.current.chars.length);
      setPhase("idle");
      const c = ctxRef.current();
      if (c.screen === "today") void recordEvent({ kind: "greeting.played", actor: { type: "agent", name: "Voice greeting" }, summary: "Played the Today greeting" });
    };
    el.addEventListener("ended", ended);
    return () => el.removeEventListener("ended", ended);
  }, [element]);

  useEffect(() => { if (autoStart) void start(); }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { audio.current?.pause(); rec.current?.abort(); stopMic(); void ac.current?.ctx.close().catch(() => {}); }, []);

  const replay = useCallback(() => {
    if (!audio.current?.src) return start();
    audio.current.currentTime = 0;
    return play();
  }, [play, start]);

  return { phase, brief, error, spoken, muted, setMuted, level, heard, canListen, start, replay, play, stop, ask, listenStart, listenStop };
}
export type VoiceAgent = ReturnType<typeof useVoiceAgent>;
