"use client";
// The floating sparkle orb (every screen except /today, which has the full panel). Clicking it opens a compact
// assistant popover that immediately speaks a line about the CURRENT screen, built from its real data.
// Keyboard: the orb is a button; Esc closes the popover; Tab is trapped inside it; focus returns to the orb.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Mic, MicOff, PhoneOff, Sparkles } from "lucide-react";
import { useVoiceAgent, type VoiceContext } from "./useVoiceAgent";
import { VoiceOrb, VoicePanel } from "./VoicePanel";
import { useConversationLevel, useDealDeskConversation, useVoiceAgentAvailable, VoiceAgentProvider } from "./VoiceAgentButton";

const HIDDEN = new Set(["/today"]);

/** Screen id + subject from the current URL (read at click time, so it is always the page being looked at). */
export function screenContext(loc: { pathname: string; search: string }): VoiceContext {
  const q = new URLSearchParams(loc.search);
  const seg = loc.pathname.split("/").filter(Boolean);
  if (seg[0] === "deal" && seg[1] === "room") return { screen: "room", subject: q.get("id") };
  if (seg[0] === "deal") return { screen: "deal", subject: q.get("domain") ?? q.get("company") };
  if (seg[0] === "memo") return { screen: "memo", subject: q.get("id") };
  if (seg[0] === "person") return { screen: "person", subject: q.get("linkedin") };
  if (seg[0] === "preview") return { screen: "slack" };
  if (seg[0] === "ask") return { screen: "ask" };
  return { screen: seg[0] ?? "home" };
}

/** With an ElevenLabs agent configured (ELEVENLABS_AGENT_ID) the orb is a live two-way conversation that survives
 *  navigation (its client tools move the page); otherwise it is the screen-brief popover below. */
export function FloatingVoice() {
  const path = usePathname();
  const avail = useVoiceAgentAvailable();
  if (avail.state === "available") return <VoiceAgentProvider><LiveFloating onToday={HIDDEN.has(path)} /></VoiceAgentProvider>;
  if (HIDDEN.has(path)) return null;
  return <Floating key={path} />;
}

const LIVE_STATUS = { idle: "", connecting: "Connecting to Deal Desk…", listening: "Listening", speaking: "Deal Desk is speaking", error: "Voice agent unavailable" } as const;

function LiveFloating({ onToday }: { onToday: boolean }) {
  const c = useDealDeskConversation();
  const level = useRef(0);
  useConversationLevel(c, level);
  const active = c.status !== "idle";
  if (onToday && !active) return null; // /today has its own voice panel
  const phase = c.status === "speaking" ? "speaking" : c.status === "listening" ? "listening" : c.status === "connecting" ? "preparing" : c.status === "error" ? "error" : "rest";
  const toggle = () => { if (c.connected || c.status === "connecting") c.end(); else if (c.status === "error") c.clearError(); else void c.start(); };
  return (
    <>
      <button type="button" data-testid="voice-orb" data-live-status={c.status} aria-pressed={c.connected}
        aria-label={c.connected ? "End the voice conversation" : "Talk to Deal Desk (live voice)"} onClick={toggle}
        className="voice-orb fixed right-3 bottom-5 z-[62] grid size-12 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink sm:right-5 sm:bottom-5">
        <VoiceOrb level={level} phase={phase} size={48} />
        {c.connected ? <PhoneOff aria-hidden className="pointer-events-none absolute size-4 text-white/90" strokeWidth={2} /> : <Sparkles aria-hidden className="pointer-events-none absolute size-4 text-white/90" strokeWidth={2} />}
      </button>
      {active && (
        <div role="status" aria-live="polite" className="voice-pop fixed right-3 bottom-[76px] z-[62] w-[min(320px,calc(100vw-24px))] rounded-2xl bg-white px-3.5 py-3 text-[13px] shadow-[0_24px_60px_-20px_rgba(9,9,11,.35)] ring-1 ring-zinc-200 sm:right-5 sm:bottom-[84px]">
          <div className="flex items-center justify-between gap-2">
            <span className={c.status === "error" ? "font-medium text-rust" : "font-medium text-ink"}>{LIVE_STATUS[c.status]}</span>
            {c.connected && (
              <span className="flex items-center gap-1">
                <button type="button" onClick={() => c.setMuted(!c.isMuted)} aria-pressed={c.isMuted} aria-label={c.isMuted ? "Unmute microphone" : "Mute microphone"} className="grid size-7 place-items-center rounded-full text-zinc-600 hover:bg-zinc-100">
                  {c.isMuted ? <MicOff aria-hidden className="size-4" /> : <Mic aria-hidden className="size-4" />}
                </button>
                <button type="button" onClick={c.end} className="rounded-full px-2 py-1 text-[12px] font-medium text-rust hover:bg-rust-50">End</button>
              </span>
            )}
            {c.status === "error" && <button type="button" onClick={c.clearError} className="rounded-full px-2 py-1 text-[12px] text-zinc-600 hover:bg-zinc-100">Dismiss</button>}
          </div>
          {c.error ? <p className="mt-1 leading-snug text-zinc-700">{c.error}</p>
            : c.last ? <p className="mt-1 leading-snug text-zinc-600"><span className="font-medium text-zinc-800">{c.last.role === "user" ? "You" : "Deal Desk"}:</span> {c.last.text}</p>
            : c.connected ? <p className="mt-1 leading-snug text-zinc-500">Try: “Find ten Indian B2B software companies founded since 2023.”</p> : null}
        </div>
      )}
    </>
  );
}

function Floating() {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const agent = useVoiceAgent({ context: () => screenContext(window.location) });
  const close = () => { agent.stop(); setOpen(false); btn.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    pop.current?.querySelector<HTMLElement>("button, input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab" || !pop.current) return;
      const f = [...pop.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), summary, a[href]")];
      if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button ref={btn} type="button" data-testid="voice-orb" aria-label={open ? "Close the assistant" : "Open the voice assistant"} aria-expanded={open} aria-haspopup="dialog"
        onClick={() => { if (open) close(); else { setOpen(true); void agent.start(); } }}
        className="voice-orb fixed right-3 bottom-5 z-[62] grid size-12 sm:right-5 sm:bottom-5 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
        <VoiceOrb level={agent.level} phase={open ? agent.phase : "rest"} size={48} />
        <Sparkles aria-hidden className="pointer-events-none absolute size-4 text-white/90" strokeWidth={2} />
      </button>
      {open && (
        <div ref={pop} role="dialog" aria-modal="true" aria-label="Voice assistant" className="voice-pop fixed right-3 bottom-[76px] z-[62] w-[min(340px,calc(100vw-24px))] sm:right-5 sm:bottom-[84px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-20px_rgba(9,9,11,.35)] ring-1 ring-zinc-200">
          <VoicePanel agent={agent} variant="popover" onClose={close} />
        </div>
      )}
    </>
  );
}
