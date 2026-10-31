"use client";
// Today: real inbound (Gmail inbox threads, metadata only) and upcoming meetings (Google Calendar primary), today's
// organizational memory, and the voice greeting in the assistant dock. Each section shows its own honest state
// (not connected / expired / error) from the API. Book a call creates a real event (POST /api/connectors/calendar/events,
// sendUpdates=none). Personal content is marked data-private (masked in verification screenshots).
import { useState, type FormEvent } from "react";
import { Page, TopBar } from "@port/components/shell";
import { cx } from "@port/components/ui";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import type { InboxThread } from "@/lib/google/gmail";
import type { Meeting } from "@/lib/google/calendar";
import { MemoryPanel } from "./memory";
import { liveShell } from "./shell";
import { failureMessage, useLiveJson } from "./useLiveJson";
import { Requirements } from "./unavailable";
import { TodayVoiceDock } from "./voice/TodayVoice";

const INBOX_MAX = 10;
const MEETINGS_MAX = 5;
const DURATIONS = [15, 30, 45, 60]; // minutes offered in the book-call form (UI choices, not data)

const when = (iso: string, today: string) => (fmtDate(iso) === today ? fmtTime(iso) : fmtDateTime(iso));

function Card({ title, sub, children, testId }: { title: string; sub?: string; children: React.ReactNode; testId: string }) {
  return (
    <section data-testid={testId} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200/80">
      <div className="flex items-baseline gap-2"><h2 className="text-[13.5px] font-semibold">{title}</h2>{sub && <span className="text-[11.5px] text-zinc-400">{sub}</span>}</div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Failed({ res, what, need }: { res: Parameters<typeof failureMessage>[0]; what: string; need: string }) {
  return <div><p role="alert" className="text-[12.5px] text-zinc-600">{failureMessage(res, what)}</p><Requirements needs={[need]} /></div>;
}

export function LiveToday() {
  const today = fmtDate(new Date().toISOString());
  const inbox = useLiveJson<{ threads: InboxThread[]; estimate: number }>(`/api/connectors/gmail/threads?max=${INBOX_MAX}`);
  const cal = useLiveJson<{ events: Meeting[] }>(`/api/connectors/calendar/events?max=${MEETINGS_MAX}`);
  return (
    <Page active="today" shell={liveShell} dock={<TodayVoiceDock />} top={<TopBar crumbs={[{ label: "Today" }]} ctx="Today" />}>
      <div className="mx-auto grid w-full max-w-[980px] grid-cols-1 gap-5 px-8 pt-8 pb-16 @min-[900px]/main:grid-cols-2">
        <div className="@min-[900px]/main:col-span-2">
          <h1 className="serif text-[34px] leading-none tracking-[-0.02em]">Today</h1>
          <p className="mt-2 text-[13px] text-zinc-500">{today} · times in IST</p>
        </div>
        <Card testId="today-inbox" title="Inbound" sub="Gmail · inbox">
          {inbox.state === "loading" ? <p className="text-[12.5px] text-zinc-400">Loading inbox…</p>
            : inbox.state === "failed" ? <Failed res={inbox} what="Inbox" need="gmail" />
            : inbox.data.threads.length === 0 ? <p className="text-[12.5px] text-zinc-500">No threads in your inbox.</p>
            : <ol data-private className="divide-y divide-zinc-100">{inbox.data.threads.map((t) => (
                <li key={t.id} className="flex gap-3 py-2">
                  <span className={cx("mt-1.5 size-1.5 shrink-0 rounded-full", t.unread ? "bg-rust" : "bg-transparent")} aria-label={t.unread ? "unread" : undefined} />
                  <span className="min-w-0 flex-1"><span className={cx("block truncate text-[12.5px]", t.unread ? "font-medium text-ink" : "text-zinc-700")}>{t.from}</span><span className="block truncate text-[12px] text-zinc-500">{t.subject}</span></span>
                  <time dateTime={t.lastMessageAt} title={fmtDateTime(t.lastMessageAt)} className="shrink-0 text-[11.5px] text-zinc-400 tnum">{when(t.lastMessageAt, today)}</time>
                </li>))}</ol>}
        </Card>
        <Card testId="today-meetings" title="Upcoming meetings" sub="Google Calendar · primary">
          {cal.state === "loading" ? <p className="text-[12.5px] text-zinc-400">Loading calendar…</p>
            : cal.state === "failed" ? <Failed res={cal} what="Calendar" need="calendar" />
            : <>
                {cal.data.events.length === 0 ? <p className="text-[12.5px] text-zinc-500">Nothing on your calendar ahead.</p>
                  : <ol data-private className="divide-y divide-zinc-100">{cal.data.events.map((m) => (
                      <li key={m.id} className="flex gap-3 py-2">
                        <time dateTime={m.start} className="w-[120px] shrink-0 text-[12px] text-zinc-500 tnum">{m.allDay ? fmtDate(m.start) : when(m.start, today)}</time>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{m.summary}</span>
                        {m.attendees > 0 && <span className="shrink-0 text-[11.5px] text-zinc-400">{m.attendees} guests</span>}
                      </li>))}</ol>}
                <BookCall onBooked={() => void cal.reload()} />
              </>}
        </Card>
        <div className="@min-[900px]/main:col-span-2">
          <MemoryPanel title="Today’s activity" sub={`Latest actions recorded today (${today}, IST), live.`} match={(e) => fmtDate(e.at) === today} max={12} />
        </div>
      </div>
    </Page>
  );
}

/** Book a call: creates the event on the primary calendar (no invitations are sent: sendUpdates=none). */
function BookCall({ onBooked }: { onBooked: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [mins, setMins] = useState(DURATIONS[1]!);
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !start) return setMsg("Add a title and a start time.");
    // <input type="datetime-local"> is the browser's local wall time; convert to an absolute UTC instant
    const s = new Date(start), end = new Date(s.getTime() + mins * 60_000);
    const r = await fetch("/api/connectors/calendar/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ summary: title.trim(), start: s.toISOString(), end: end.toISOString() }) });
    const j = (await r.json().catch(() => null)) as { message?: string; transport?: string; label?: string } | null;
    if (!r.ok) return setMsg(`Not booked (HTTP ${r.status}): ${j?.message ?? r.statusText}`);
    if (j?.transport === "dry_run") return setMsg(`${j.label}: would book “${title.trim()}” for ${fmtDateTime(s.toISOString())}.`);
    setMsg(`Booked for ${fmtDateTime(s.toISOString())}.`); setTitle(""); setStart(""); onBooked();
  };
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-3 h-8 rounded-full bg-white px-3.5 text-[12.5px] font-medium ring-1 ring-zinc-200 hover:text-ink">Book a call</button>;
  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl bg-zinc-50 p-3" data-testid="book-call">
      <input aria-label="Meeting title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call with …" className="h-8 w-full rounded-lg bg-white px-3 text-[12.5px] ring-1 ring-zinc-200 outline-none focus:ring-zinc-400" />
      <div className="flex gap-2">
        <input aria-label="Start time" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="h-8 min-w-0 flex-1 rounded-lg bg-white px-2 text-[12.5px] ring-1 ring-zinc-200" />
        <select aria-label="Duration" value={mins} onChange={(e) => setMins(Number(e.target.value))} className="h-8 rounded-lg bg-white px-2 text-[12.5px] ring-1 ring-zinc-200">{DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}</select>
      </div>
      <div className="flex items-center gap-2"><button type="submit" className="h-8 rounded-full bg-ink px-3.5 text-[12.5px] font-medium text-white hover:bg-zinc-800">Book</button><button type="button" onClick={() => setOpen(false)} className="h-8 px-2 text-[12.5px] text-zinc-500">Cancel</button><span className="text-[11.5px] text-zinc-500">Dry run unless the server allows outbound; no invitations either way.</span></div>
      {msg && <p role="status" className="text-[12px] text-zinc-600">{msg}</p>}
    </form>
  );
}
