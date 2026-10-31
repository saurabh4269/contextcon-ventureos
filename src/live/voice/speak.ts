"use client";
// Imperative text-to-speech for any component: `await speak("…")` plays ElevenLabs audio via POST /api/voice/tts.
// One clip at a time: a new speak() (or stopSpeaking()) stops the previous clip, whose promise resolves {reason:"stopped"}.
// Never throws: autoplay refusal resolves {played:false, reason:"blocked"} so the caller can offer a "Tap to hear" button
// (call speak() again from that click). Server/upstream errors resolve {reason:"error", message} with the real cause.
// (useVoiceAgent keeps its own captioned player for the Today/orb panels; this is the light path for one-off lines.)

export type SpeakResult =
  | { played: true }
  | { played: false; reason: "blocked" | "stopped" | "error" | "unsupported"; message?: string; status?: number };

export type SpeakOptions = { signal?: AbortSignal; volume?: number; onStart?: () => void };

let current: { audio: HTMLAudioElement; url: string; ctrl: AbortController; settle: (r: SpeakResult) => void } | null = null;

/** Stop whatever speak() is playing (or fetching). Safe to call any time. */
export function stopSpeaking(): void {
  const c = current;
  current = null;
  if (!c) return;
  c.ctrl.abort();
  c.audio.pause();
  c.audio.removeAttribute("src");
  URL.revokeObjectURL(c.url);
  c.settle({ played: false, reason: "stopped" });
}

export function isSpeaking(): boolean {
  return !!current && !current.audio.paused;
}

export async function speak(text: string, opts: SpeakOptions = {}): Promise<SpeakResult> {
  if (typeof window === "undefined" || typeof Audio === "undefined") return { played: false, reason: "unsupported", message: "Audio playback is not available here." };
  if (!text.trim()) return { played: false, reason: "error", message: "Nothing to say." };
  stopSpeaking();
  window.dispatchEvent(new CustomEvent("dealdesk:speak")); // lets other players (e.g. the orb) pause
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  const audio = new Audio();
  let settle!: (r: SpeakResult) => void;
  const done = new Promise<SpeakResult>((res) => { settle = res; });
  let settled = false;
  const finish = (r: SpeakResult) => { if (settled) return; settled = true; opts.signal?.removeEventListener("abort", onAbort); settle(r); };
  const me = { audio, url: "", ctrl, settle: finish };
  current = me;

  try {
    const r = await fetch("/api/voice/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal: ctrl.signal });
    if (!r.ok) {
      const j = (await r.json().catch(() => null)) as { message?: string } | null;
      if (current === me) current = null;
      finish({ played: false, reason: "error", status: r.status, message: j?.message ?? `Voice unavailable (HTTP ${r.status})` });
      return done;
    }
    const blob = await r.blob();
    if (current !== me) return done; // superseded while fetching (already settled "stopped")
    me.url = URL.createObjectURL(blob);
    audio.src = me.url;
    if (opts.volume != null) audio.volume = Math.max(0, Math.min(1, opts.volume));
    const cleanup = () => { if (current === me) current = null; URL.revokeObjectURL(me.url); };
    audio.addEventListener("ended", () => { cleanup(); finish({ played: true }); }, { once: true });
    audio.addEventListener("error", () => { cleanup(); finish({ played: false, reason: "error", message: "The browser could not decode the audio." }); }, { once: true });
    try {
      await audio.play();
      opts.onStart?.();
    } catch (e) {
      cleanup();
      const blocked = e instanceof DOMException && e.name === "NotAllowedError";
      finish(blocked ? { played: false, reason: "blocked", message: "The browser blocked autoplay; tap to hear it." } : { played: false, reason: "error", message: e instanceof Error ? e.message : String(e) });
    }
  } catch (e) {
    if (current === me) current = null;
    const aborted = e instanceof DOMException && e.name === "AbortError";
    finish(aborted ? { played: false, reason: "stopped" } : { played: false, reason: "error", message: `Voice request failed: ${e instanceof Error ? e.message : String(e)}` });
  }
  return done;
}
