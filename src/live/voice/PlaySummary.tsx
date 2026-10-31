"use client";
// "Play summary": reads one line aloud on a click (a click is a user gesture, so the browser allows audio). Runs opened
// from a link (?q=) cannot autoplay, so this button is the visible way to hear it; failures are shown, never silent.
import { useEffect, useRef, useState } from "react";
import { Loader2, Square, Volume2 } from "lucide-react";
import { speak, stopSpeaking } from "./speak";

export function PlaySummary({ text, className = "" }: { text: string; className?: string }) {
  const [st, setSt] = useState<"idle" | "playing" | "error">("idle");
  const [msg, setMsg] = useState("");
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; stopSpeaking(); }; }, []);
  const click = async () => {
    if (st === "playing") { stopSpeaking(); setSt("idle"); return; }
    setSt("playing"); setMsg("");
    const r = await speak(text);
    if (!alive.current) return;
    if (r.played || r.reason === "stopped") setSt("idle");
    else { setSt("error"); setMsg(r.reason === "blocked" ? "The browser blocked audio. Tap again." : r.message ?? `Could not play audio (${r.reason}).`); }
  };
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button type="button" data-testid="play-summary" onClick={() => void click()} aria-label={st === "playing" ? "Stop reading the summary" : "Play summary aloud"}
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[12.5px] font-medium text-zinc-700 ring-1 ring-zinc-200 hover:text-ink">
        {st === "playing" ? <Square className="size-3.5 fill-current" /> : <Volume2 className="size-3.5" />}{st === "playing" ? "Stop" : "Play summary"}
      </button>
      {st === "error" && <span role="status" className="text-[12px] text-rust">{msg}</span>}
    </span>
  );
}
