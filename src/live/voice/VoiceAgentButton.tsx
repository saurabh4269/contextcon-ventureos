"use client";
// Live two-way voice conversation with the "Deal Desk" ElevenLabs agent (Agents platform, official @elevenlabs/react SDK).
//   session:  GET /api/voice/agent-session → signed WebSocket URL (the API key stays on the server)
//   tools:    the agent's CLIENT tools run here: run_sourcing → /agent?q=…, open_company → /deal?domain=…, open_screen → /<name>
//   context:  route changes are sent to the agent as contextual updates
// Honest states: unsupported browser, mic permission denied, agent not configured, quota/key errors from the server.
import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Loader2, PhoneOff, Radio } from "lucide-react";
import { cx } from "@port/components/ui";
import { toolRoute } from "@/lib/voice/agentTools";
import { micErrorMessage } from "./MicButton";
import { stopSpeaking } from "./speak";

export type AgentAvailability = { state: "checking" } | { state: "available" } | { state: "unavailable"; reason: string };

/** Whether the server has an ElevenLabs agent configured (no URL is minted). */
export function useVoiceAgentAvailable(): AgentAvailability {
  const [a, setA] = useState<AgentAvailability>({ state: "checking" });
  useEffect(() => {
    let live = true;
    fetch("/api/voice/agent-session?probe=1", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ available?: boolean; reason?: string }>)
      .then((j) => live && setA(j.available ? { state: "available" } : { state: "unavailable", reason: j.reason ?? "unavailable" }))
      .catch(() => live && setA({ state: "unavailable", reason: "unreachable" }));
    return () => { live = false; };
  }, []);
  return a;
}

export type LiveLine = { role: "user" | "agent"; text: string };

/** Must be rendered inside <ConversationProvider>. Returns controls + honest status for a Deal Desk conversation. */
export function useDealDeskConversation(opts: { onNavigate?: (href: string) => void } = {}) {
  const router = useRouter();
  const path = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [last, setLast] = useState<LiveLine | null>(null);
  const nav = useRef(opts.onNavigate);
  nav.current = opts.onNavigate;

  const go = (tool: "run_sourcing" | "open_company" | "open_screen") => (params: Record<string, unknown>) => {
    const r = toolRoute(tool, params);
    if ("error" in r) return `Error: ${r.error}`;
    if (nav.current) nav.current(r.href); else router.push(r.href);
    return tool === "run_sourcing" ? `Started the sourcing run; the results will appear on screen at ${r.href}.` : `Opened ${r.href}.`;
  };

  const conv = useConversation({
    clientTools: { run_sourcing: go("run_sourcing"), open_company: go("open_company"), open_screen: go("open_screen") },
    onError: (message: string) => setError(`Voice agent error: ${message}`),
    onMessage: (m: { message?: string; source?: string; role?: string }) => {
      if (!m?.message) return;
      setLast({ role: m.source === "user" || m.role === "user" ? "user" : "agent", text: m.message });
    },
  });

  // keep the agent aware of where the user is
  const connected = conv.status === "connected";
  useEffect(() => { if (connected) conv.sendContextualUpdate(`The user is now looking at the Deal Desk screen ${path}${typeof window !== "undefined" ? window.location.search : ""}.`); }, [path, connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async () => {
    setError(null);
    setLast(null);
    if (typeof window === "undefined" || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setError("Live voice needs a browser with microphone access over HTTPS."); return; }
    setPreparing(true);
    stopSpeaking();
    try {
      // ask for the mic first so a denial gets an honest message (the SDK would only report a generic failure)
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
    } catch (e) { setPreparing(false); setError(micErrorMessage(e)); return; }
    try {
      const r = await fetch("/api/voice/agent-session", { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as { signedUrl?: string; message?: string; code?: string } | null;
      if (!r.ok || !j?.signedUrl) throw new Error(j?.code === "quota_exceeded" ? "ElevenLabs quota exceeded, so live voice is unavailable." : j?.message ?? `Couldn’t start a voice session (HTTP ${r.status}).`);
      conv.startSession({ signedUrl: j.signedUrl, connectionType: "websocket" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setPreparing(false); }
  }, [conv]);

  const end = useCallback(() => conv.endSession(), [conv]);

  const status: "idle" | "connecting" | "listening" | "speaking" | "error" =
    error ? "error" : preparing || conv.status === "connecting" ? "connecting" : connected ? (conv.isSpeaking ? "speaking" : "listening") : "idle";
  return { status, connected, error, last, start, end, isMuted: conv.isMuted, setMuted: conv.setMuted, getOutputVolume: conv.getOutputVolume, getInputVolume: conv.getInputVolume, clearError: () => setError(null) };
}
export type DealDeskConversation = ReturnType<typeof useDealDeskConversation>;

/** Feeds the conversation's live output/input volume into a level ref (0..1) for orbs/meters. */
export function useConversationLevel(c: DealDeskConversation, level: MutableRefObject<number>) {
  useEffect(() => {
    if (!c.connected) { level.current = 0; return; }
    let id = 0;
    const tick = () => {
      try { level.current = Math.min(1, (c.status === "speaking" ? c.getOutputVolume() : c.getInputVolume()) * 1.6); } catch { level.current = 0; }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [c.connected, c.status]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function VoiceAgentProvider({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>;
}

const LABEL = { idle: "Talk to Deal Desk", connecting: "Connecting…", listening: "Listening (tap to end)", speaking: "Speaking (tap to end)", error: "Talk to Deal Desk" } as const;

/** Standalone pill button: starts/ends a live conversation. Includes its own provider. */
export function VoiceAgentButton(props: { onNavigate?: (href: string) => void; className?: string }) {
  return <VoiceAgentProvider><VoiceAgentButtonInner {...props} /></VoiceAgentProvider>;
}

function VoiceAgentButtonInner({ onNavigate, className }: { onNavigate?: (href: string) => void; className?: string }) {
  const avail = useVoiceAgentAvailable();
  const c = useDealDeskConversation({ onNavigate });
  useEffect(() => () => { c.end(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (avail.state !== "available") {
    return avail.state === "checking" ? null : <span className={cx("text-[12px] text-zinc-500", className)} title={avail.reason}>Live voice agent not configured</span>;
  }
  const live = c.connected;
  return (
    <span className={cx("inline-flex flex-col items-start gap-1", className)} data-testid="voice-agent-button" data-status={c.status}>
      <button type="button" aria-pressed={live} onClick={() => (live || c.status === "connecting" ? c.end() : void c.start())}
        className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rust",
          live ? "bg-rust text-white ring-rust" : "bg-white text-zinc-800 ring-zinc-300 hover:bg-rust-50 hover:text-rust")}>
        {c.status === "connecting" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : live ? <PhoneOff aria-hidden className="size-4" /> : <Radio aria-hidden className="size-4" />}
        {LABEL[c.status]}
      </button>
      <span aria-live="polite" className={cx("max-w-[320px] text-[12px] leading-snug", c.error ? "text-rust" : "text-zinc-500")}>
        {c.error ?? (live && c.last ? `${c.last.role === "user" ? "You" : "Deal Desk"}: ${c.last.text}` : "")}
      </span>
    </span>
  );
}
