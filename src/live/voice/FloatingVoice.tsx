"use client";
// The floating sparkle orb (every screen except /today, which has the full panel). Clicking it opens a compact
// assistant popover that immediately speaks a line about the CURRENT screen, built from its real data.
// Keyboard: the orb is a button; Esc closes the popover; Tab is trapped inside it; focus returns to the orb.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useVoiceAgent, type VoiceContext } from "./useVoiceAgent";
import { VoiceOrb, VoicePanel } from "./VoicePanel";

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

export function FloatingVoice() {
  const path = usePathname();
  if (HIDDEN.has(path)) return null;
  return <Floating key={path} />;
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
        className="voice-orb fixed right-5 bottom-5 z-[62] grid size-12 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
        <VoiceOrb level={agent.level} phase={open ? agent.phase : "rest"} size={48} />
        <Sparkles aria-hidden className="pointer-events-none absolute size-4 text-white/90" strokeWidth={2} />
      </button>
      {open && (
        <div ref={pop} role="dialog" aria-modal="true" aria-label="Voice assistant" className="voice-pop fixed right-5 bottom-[84px] z-[62] w-[340px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-20px_rgba(9,9,11,.35)] ring-1 ring-zinc-200">
          <VoicePanel agent={agent} variant="popover" onClose={close} />
        </div>
      )}
    </>
  );
}
