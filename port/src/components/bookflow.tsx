"use client";
/**
 * v3.2 · The book-call flow, shared by Today, the deal page and the agent's "Book call" node.
 * Calendar not connected → the connect modal first; then the agent's pre-filled invite; Send → sent.
 * "Not now" leaves the step waiting (callers render <ConnectChip/>). Frames pin a stage for review shots.
 */
import { useEffect, useState } from "react";
import { ConnectModal } from "./connect";
import { BookCall } from "./meeting";
import type { BookCallData, ConnectAsk } from "../types";

export type BookStage = "closed" | "ask" | "connecting" | "connected" | "edit" | "conflict" | "sending" | "sent";
/** ?book=1..7 → a pinned stage. */
export const BOOK_FRAMES: BookStage[] = ["ask", "connecting", "connected", "edit", "conflict", "sending", "sent"];
export const bookFrame = (n?: string | number): BookStage | undefined => { const i = Number(n); return i >= 1 && i <= BOOK_FRAMES.length ? BOOK_FRAMES[i - 1] : undefined; };

/** `initial` opens at a stage but stays interactive (?meet=1 → edit, ?conflict=1 → conflict, ?connect=calendar → ask). */
export function useBookFlow({ connected: c0 = false, frame, initial }: { connected?: boolean; frame?: BookStage; initial?: BookStage }) {
  const [stage, setStage] = useState<BookStage>(frame ?? initial ?? "closed");
  const [connected, setConnected] = useState(c0);
  const [waiting, setWaiting] = useState(false);
  const pinned = !!frame;
  useEffect(() => {
    if (pinned) return;
    const next: Partial<Record<BookStage, [BookStage, number]>> = { connecting: ["connected", 1100], connected: ["edit", 800], sending: ["sent", 900] };
    const n = next[stage]; if (!n) return;
    const t = setTimeout(() => setStage(n[0]), n[1]); return () => clearTimeout(t);
  }, [stage, pinned]);
  return {
    stage, waiting,
    start: () => { setWaiting(false); setStage(connected ? "edit" : "ask"); },
    allow: () => { setConnected(true); setStage("connecting"); },
    later: () => { setWaiting(true); setStage("closed"); },
    send: () => setStage("sending"),
    close: () => setStage("closed"),
  };
}

export function BookFlow({ flow, data, ask, slot, onSlot }: { flow: ReturnType<typeof useBookFlow>; data: BookCallData; ask: ConnectAsk; slot?: string; onSlot?: (id: string) => void }) {
  const [sl, setSl] = useState(slot); const [du, setDu] = useState(data.duration);
  // Remember a clash for the whole visit: picking a better slot or sending keeps the card's choice.
  const [clash] = useState(flow.stage === "conflict");
  const s = flow.stage;
  if (s === "closed") return null;
  if (s === "ask" || s === "connecting" || s === "connected") return <ConnectModal ask={ask} state={s === "ask" ? "ask" : s} onAllow={flow.allow} onLater={flow.later} />;
  const first = data.conflict?.slots?.[0] ?? data.slots[0].id;
  return <BookCall d={data} state={s === "sending" ? "sending" : s === "sent" ? "sent" : s === "conflict" || clash ? "conflict" : "edit"} slot={sl ?? (s === "conflict" || clash ? first : undefined)} duration={du} onSlot={(id) => { setSl(id); onSlot?.(id); }} onDuration={setDu} onSend={flow.send} onCancel={flow.close} />;
}

/** A tool-only JIT connect (no booking behind it), e.g. ?connect=gmail. Not now → the step waits with <ConnectChip>. */
export function useConnectFlow(initial?: boolean) {
  const [state, setState] = useState<"closed" | "ask" | "connecting" | "connected">(initial ? "ask" : "closed");
  const [waiting, setWaiting] = useState(false);
  useEffect(() => { if (state !== "connecting") return; const t = setTimeout(() => setState("connected"), 1200); return () => clearTimeout(t); }, [state]);
  return { state, waiting, open: () => { setWaiting(false); setState("ask"); }, allow: () => setState("connecting"), later: () => { setWaiting(true); setState("closed"); }, close: () => setState("closed") };
}
export function ConnectFlow({ flow, ask }: { flow: ReturnType<typeof useConnectFlow>; ask: ConnectAsk }) {
  if (flow.state === "closed") return null;
  return <ConnectModal ask={ask} state={flow.state} onAllow={flow.allow} onLater={flow.later} onDone={flow.close} />;
}
