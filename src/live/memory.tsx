"use client";
// Organizational memory in the UI: a live event list (short polling of GET /api/memory/events?since=) and a client
// helper that appends user actions (POST /api/memory/events). When the store isn't configured the panel shows the API's
// reason ("memory store not configured (DATABASE_URL)") — there is no local/in-memory substitute.
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Brain, X } from "lucide-react";
import { cx } from "@port/components/ui";
import { fmtDateTime, fmtTime } from "@/lib/format";
import type { MemoryEvent, MemoryEventInput } from "@/lib/memory/types";

const POLL_MS = 3000;
const FIRST_PAGE = 50;
const LOCAL_EVENT = "dealdesk:memory";

export type MemoryState =
  | { state: "loading" }
  | { state: "unavailable"; reason: string }
  | { state: "error"; message: string }
  | { state: "ok"; events: MemoryEvent[] };

/** Append a user action. Resolves with the API outcome (never throws); listeners refresh immediately. */
export async function recordEvent(input: Omit<MemoryEventInput, "actor" | "source"> & { actor?: MemoryEventInput["actor"]; source?: string }) {
  const body: MemoryEventInput = { actor: { type: "user" }, source: `ui:${typeof location === "undefined" ? "" : location.pathname}`, ...input };
  try {
    const r = await fetch("/api/memory/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => null)) as { status?: string; reason?: string; message?: string } | null;
    if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCAL_EVENT));
    return r.ok ? ({ status: "ok" } as const) : ({ status: j?.status === "unavailable" ? "unavailable" : "error", reason: j?.reason ?? j?.message ?? `HTTP ${r.status}` } as const);
  } catch (e) {
    return { status: "error", reason: e instanceof Error ? e.message : String(e) } as const;
  }
}

/** Live event list. `match` filters client-side (e.g. one company, or research runs only). */
export function useMemory(match?: (e: MemoryEvent) => boolean): MemoryState {
  const [st, setSt] = useState<MemoryState>({ state: "loading" });
  const cursor = useRef<string | null>(null);
  const events = useRef<MemoryEvent[]>([]);
  const busy = useRef(false);
  const stopped = useRef(false); // store not configured: do not keep polling a route that will keep answering 503
  const tick = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const qs = cursor.current ? `since=${cursor.current}&limit=200` : `limit=${FIRST_PAGE}`;
      const r = await fetch(`/api/memory/events?${qs}`, { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as { status?: string; reason?: string; message?: string; events?: MemoryEvent[]; cursor?: string | null } | null;
      if (r.status === 503 && j?.status === "unavailable") { stopped.current = true; return setSt({ state: "unavailable", reason: j.reason ?? "memory store unavailable" }); }
      if (!r.ok || !j?.events) return setSt({ state: "error", message: j?.message ?? `Memory API failed (HTTP ${r.status})` });
      if (j.events.length) {
        events.current = [...events.current, ...j.events];
        cursor.current = j.events.at(-1)!.id;
      } else if (j.cursor) cursor.current = j.cursor;
      setSt({ state: "ok", events: events.current });
    } catch (e) {
      setSt({ state: "error", message: `Memory API unreachable: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      busy.current = false;
    }
  }, []);
  useEffect(() => {
    void tick();
    const id = setInterval(() => { if (!stopped.current) void tick(); }, POLL_MS);
    const now = () => { stopped.current = false; void tick(); };
    window.addEventListener(LOCAL_EVENT, now);
    return () => { clearInterval(id); window.removeEventListener(LOCAL_EVENT, now); };
  }, [tick]);
  if (st.state !== "ok" || !match) return st;
  return { state: "ok", events: st.events.filter(match) };
}

const sameDay = (iso: string) => fmtDateTime(iso).split(",")[0] === fmtDateTime(new Date().toISOString()).split(",")[0];
const actorLabel = (e: MemoryEvent) => e.actor.name ?? (e.actor.type === "user" ? "You" : e.actor.type === "agent" ? "Agent" : "System");

export function MemoryList({ st, empty = "No events yet. Research a company, open a deal or add a note — each action is recorded here as it happens.", max }: { st: MemoryState; empty?: string; max?: number }) {
  if (st.state === "loading") return <div className="py-6 text-center text-[12.5px] text-zinc-400" aria-busy="true">Loading memory…</div>;
  if (st.state === "unavailable") return <div data-testid="memory-unavailable" className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-3 text-[12.5px] text-zinc-600"><b className="font-medium text-ink">Memory unavailable:</b> {st.reason}</div>;
  if (st.state === "error") return <div role="alert" className="rounded-xl bg-rust-50/60 px-4 py-3 text-[12.5px] text-rust ring-1 ring-rust-100">{st.message}</div>;
  const rows = [...st.events].reverse().slice(0, max);
  if (!rows.length) return <div className="py-6 text-center text-[12.5px] text-zinc-500">{empty}</div>;
  return (
    <ol data-testid="memory-list" className="divide-y divide-zinc-100">
      {rows.map((e) => (
        <li key={e.id} data-kind={e.kind} className="flex gap-3 py-2.5">
          <time dateTime={e.at} title={fmtDateTime(e.at)} className="w-[86px] shrink-0 pt-px text-[11.5px] text-zinc-400 tnum">{sameDay(e.at) ? fmtTime(e.at) : fmtDateTime(e.at).split(",")[0]}</time>
          <div className="min-w-0">
            <div className="text-[12.5px] leading-snug text-ink">{e.summary}</div>
            <div className="mt-0.5 truncate text-[11px] text-zinc-400">{e.kind} · {actorLabel(e)}{e.subject?.label || e.subject?.id ? ` · ${e.subject.label ?? e.subject.id}` : ""}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A note on a subject (or the firm). Appends "note.added". */
export function NoteBox({ subject }: { subject?: MemoryEventInput["subject"] }) {
  const [v, setV] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = v.trim();
    if (!text) return;
    const r = await recordEvent({ kind: "note.added", subject: subject ?? null, summary: text });
    if (r.status === "ok") { setV(""); setMsg(null); } else setMsg(`Not saved: ${r.reason}`);
  };
  return (
    <form onSubmit={submit} className="mt-3">
      <div className="flex gap-2">
        <input aria-label="Add a note" value={v} onChange={(e) => setV(e.target.value)} placeholder={subject?.label ? `Note on ${subject.label}…` : "Add a note to firm memory…"} className="h-8 min-w-0 flex-1 rounded-full bg-white px-3.5 text-[12.5px] ring-1 ring-zinc-200 outline-none focus:ring-zinc-400" />
        <button type="submit" className="h-8 rounded-full bg-ink px-3.5 text-[12.5px] font-medium text-white hover:bg-zinc-800">Add</button>
      </div>
      {msg && <div role="alert" className="mt-1.5 text-[11.5px] text-rust">{msg}</div>}
    </form>
  );
}

export function MemoryPanel({ title = "Memory", sub, match, subject, note = true, max, className }: { title?: string; sub?: string; match?: (e: MemoryEvent) => boolean; subject?: MemoryEventInput["subject"]; note?: boolean; max?: number; className?: string }) {
  const st = useMemory(match);
  return (
    <section data-testid="memory-panel" className={cx("rounded-2xl bg-white p-4 ring-1 ring-zinc-200/80", className)}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        {st.state === "ok" && <span className="flex items-center gap-1 text-[11px] text-zinc-400"><span className="size-1.5 rounded-full bg-[#2f9a5c]" />live</span>}
      </div>
      {sub && <p className="mt-0.5 text-[12px] text-zinc-500">{sub}</p>}
      <div className="mt-2">
        <MemoryList st={st} max={max} />
      </div>
      {note && st.state === "ok" && <NoteBox subject={subject} />}
    </section>
  );
}

/** Global launcher (mounted in the root layout): opens the live memory feed from any page. */
export function MemoryDock() {
  const [open, setOpen] = useState(false);
  // The app shell's sidebar "Memory" row (and anything else) toggles the panel with this event.
  useEffect(() => {
    const on = () => setOpen((o) => !o);
    window.addEventListener("dealdesk:memory-toggle", on);
    return () => window.removeEventListener("dealdesk:memory-toggle", on);
  }, []);
  const panel = useRef<HTMLElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { setOpen(false); launcher.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button ref={launcher} type="button" data-testid="memory-dock" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog"
        className="fixed bottom-[64px] focus-visible:outline-2 focus-visible:outline-ink left-3 z-[60] flex items-center gap-1.5 rounded-full max-lg:bottom-5 max-lg:size-12 max-lg:justify-center max-lg:px-0 max-lg:shadow-[0_6px_18px_-6px_rgba(9,9,11,.25)] bg-white/95 px-2.5 py-1 text-[11.5px] font-medium text-zinc-600 shadow-[0_1px_2px_rgba(9,9,11,.08)] ring-1 ring-zinc-200 backdrop-blur hover:text-ink">
        <Brain className="size-3.5 max-lg:size-[18px]" strokeWidth={1.75} /><span className="max-lg:sr-only">Memory</span>
      </button>
      {open && (
        <aside ref={panel} role="dialog" aria-label="Organizational memory" className="fixed bottom-3 left-3 z-[76] flex max-h-[70vh] w-[380px] max-w-[calc(100vw-24px)] flex-col max-lg:max-h-[80dvh] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-20px_rgba(9,9,11,.35)] ring-1 ring-zinc-200">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
            <span className="text-[13.5px] font-semibold">Organizational memory</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close memory" className="ml-auto text-zinc-400 hover:text-ink"><X className="size-4" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <MemoryPanel title="Recent actions" sub="Every research run, connector check, page action and note, as it happens." className="mt-3 !p-0 !ring-0" />
          </div>
        </aside>
      )}
    </>
  );
}
