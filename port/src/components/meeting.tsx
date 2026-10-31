"use client";
/**
 * v3.2 · Meetings without a calendar grid (deal teams live in Google Calendar):
 *  - <BookCall>: the agent pre-fills everything; the partner checks and sends. Never an empty form.
 *  - <BetterSlots>: inline, only when there's a clash.
 *  - <NextMeetings>: Today's compact card; each row opens <MeetingPanel> with the prep brief.
 */
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, CalendarPlus, Check, ChevronRight, Copy, FileText, Gavel, Loader2, Pencil, Plus, Presentation, Send, Sparkles, Undo2, Users, Video, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BookCallData, MeetingItem, MeetingKind, MeetPerson } from "../types";
import { ModalClose, ModalFrame } from "./connect";
import { FitPill } from "./dealbits";
import { useReducedMotion } from "./motion";
import { ToolLogo } from "./tools";
import { Avatar, CompanyLogo, cx, IconBtn } from "./ui";

const L = "text-[12px] font-medium text-zinc-500";
const field = "h-10 w-full rounded-xl bg-white px-3.5 text-[13.5px] text-ink ring-1 ring-zinc-200 outline-none transition-shadow placeholder:text-zinc-400 hover:ring-zinc-300 focus:ring-2 focus:ring-rust/30";
type Slot = BookCallData["slots"][number];

/** Slots as a radiogroup: arrows move + select, one tab stop; the ink fill slides between chips. */
/** `other` (a node, e.g. the free-text input) replaces the three slots in place, so picking "Other time" never changes the modal's height. */
function SlotGroup({ slots, value, onChange, group, label, other, onOther }: { slots: Slot[]; value: string; onChange: (id: string) => void; group: string; label: string; other?: ReactNode; onOther?: () => void }) {
  const r = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, slots.findIndex((s) => s.id === value));
  const n = other ? 1 : slots.length + (onOther ? 1 : 0);
  const pick = (i: number) => { if (other) { onOther?.(); return; } if (i < slots.length) onChange(slots[i].id); else onOther?.(); refs.current[i]?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return; e.preventDefault();
    const cur = refs.current.findIndex((b) => b === document.activeElement);
    pick(((cur < 0 ? idx : cur) + d + n) % n);
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className={cx("grid gap-2", onOther ? "grid-cols-[1fr_1fr_1fr_112px]" : "grid-cols-3")}>
      {other && onOther ? <div className="col-span-3">{other}</div> : slots.map((s, i) => { const on = s.id === value; return (
        <button key={s.id} ref={(b) => { refs.current[i] = b; }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => pick(i)}
          className={cx("relative flex h-12 flex-col items-start justify-center rounded-xl px-3 text-left leading-tight ring-1 transition-[box-shadow,color] outline-none focus-visible:ring-2 focus-visible:ring-rust/40", on ? "text-white ring-ink" : "bg-white ring-zinc-200 hover:ring-zinc-300")}>
          {on && <motion.span layoutId={`slot-${group}`} transition={r ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }} className="absolute inset-0 rounded-xl bg-ink shadow-[0_6px_14px_-8px_rgba(9,9,11,.6)]" />}
          <span className="relative tnum text-[13px] font-medium whitespace-nowrap">{s.day} · {s.time}</span>
          {s.note && <span className={cx("relative mt-0.5 text-[11.5px] whitespace-nowrap", on ? "text-zinc-300" : "text-zinc-500")}>{s.note}</span>}
        </button>
      ); })}
      {onOther && (
        <button ref={(b) => { refs.current[slots.length] = b; }} type="button" role={other ? undefined : "radio"} aria-checked={other ? undefined : false} aria-label={other ? "Back to suggested times" : undefined} tabIndex={other ? 0 : -1} onClick={() => pick(slots.length)}
          className="relative flex h-12 items-center justify-center gap-1.5 rounded-xl bg-zinc-50/80 text-[13px] font-medium text-zinc-600 ring-1 ring-zinc-200 transition-colors outline-none hover:text-ink hover:ring-zinc-300 focus-visible:ring-2 focus-visible:ring-rust/40">
          {other ? <><Undo2 className="relative size-4" /><span className="relative whitespace-nowrap">Suggested</span></> : <><CalendarPlus className="relative size-4" /><span className="relative whitespace-nowrap">Other time</span></>}
        </button>
      )}
    </div>
  );
}

export function BetterSlots({ c, slots, slot, onSlot }: { c: NonNullable<BookCallData["conflict"]>; slots: BookCallData["slots"]; slot: string; onSlot?: (id: string) => void }) {
  const r = useReducedMotion();
  const better = c.slots ? slots.filter((s) => c.slots!.includes(s.id)) : slots;
  return (
    <motion.div initial={r ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }} className="rounded-2xl bg-gradient-to-b from-[#fbf3ea] to-[#fdf9f4] p-3 ring-1 ring-[#ecdcc9]">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#d0773a] to-rust text-white shadow-[0_4px_10px_-4px_rgba(156,68,15,.6)]"><Sparkles className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13.5px] font-medium">Agent found {better.length} better slots</div>
          <div className="mt-0.5 text-[12.5px] text-zinc-600">{c.clash ? <><span className="font-medium text-zinc-500 line-through decoration-rust/60">{c.clash}</span> clashes with {c.with}. </> : <>Your first choice clashes with {c.with}. </>}{c.found}</div>
        </div>
      </div>
      <div className="mt-2.5"><SlotGroup slots={better} value={slot} onChange={(id) => onSlot?.(id)} group="better" label="Better slots" /></div>
    </motion.div>
  );
}

export type BookState = "edit" | "conflict" | "sending" | "sent";

function PersonChip({ p, onRemove }: { p: MeetPerson; onRemove?: () => void }) {
  const r = useReducedMotion();
  return (
    <motion.li layout={!r} initial={r ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={r ? { opacity: 0 } : { opacity: 0, scale: 0.9 }} transition={{ duration: 0.18 }}
      title={p.email} className="flex h-9 items-center gap-2 rounded-full bg-white py-1 pr-1 pl-1 ring-1 ring-zinc-200">
      <Avatar i={p.initials} size={26} tone={p.role === "Partner" ? "ink" : p.from ? "sand" : "zinc"} />
      <span className="text-[13px] leading-none whitespace-nowrap"><span className="font-medium text-ink">{p.name.split(" ")[0]}</span><span className="text-zinc-500"> · {p.role.split(" & ")[0]}</span></span>
      <button type="button" aria-label={`Remove ${p.name}`} onClick={onRemove} className="grid size-6 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-ink"><X className="size-3.5" /></button>
    </motion.li>
  );
}

export function BookCall({ d, state = "edit", slot, duration, onSlot, onDuration, onSend, onCancel }: { d: BookCallData; state?: BookState; slot?: string; duration?: number; onSlot?: (id: string) => void; onDuration?: (n: number) => void; onSend?: () => void; onCancel?: () => void }) {
  const r = useReducedMotion();
  const sl = slot ?? d.slot, du = duration ?? d.duration;
  const [other, setOther] = useState<string | undefined>();
  const [people, setPeople] = useState(d.people);
  const [adding, setAdding] = useState(false);
  const [agenda, setAgenda] = useState(d.agenda);
  const [title, setTitle] = useState(d.title);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 1400); return () => clearTimeout(t); }, [copied]);
  const chosen = d.slots.find((s) => s.id === sl) ?? d.slots[0];
  const when = other !== undefined ? (other || "Pick a time") : `${chosen.day}, ${chosen.time}`;
  const founder = people.find((p) => p.from) ?? people[0];
  const conflict = state === "conflict" && d.conflict;
  const team = people.filter((p) => !p.from).map((p) => `${p.name.split(" ")[0]}’s`);
  const canSend = people.length > 0 && (other === undefined || other.trim().length > 0);

  if (state === "sent") return (
    <ModalFrame label="Invite sent" width={480} onClose={onCancel}>
      <ModalClose onClick={onCancel} className="absolute top-4 right-4" />
      <div className="px-8 pt-9 pb-8 text-center">
        <motion.span initial={r ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 20 }} className="mx-auto grid size-12 place-items-center rounded-full bg-ink text-white shadow-[0_8px_20px_-8px_rgba(9,9,11,.5)]"><Check className="size-6" strokeWidth={2.5} /></motion.span>
        <h2 className="serif mt-4 text-[28px] leading-tight">Invite sent</h2>
        <p className="mt-1.5 text-[14px] text-zinc-500">{founder?.name ?? "Everyone"} has the invite for {when} · {du} min.</p>
        <div className="mt-6 rounded-2xl p-4 text-left ring-1 ring-zinc-200/80">
          <div className="flex items-center gap-3"><CompanyLogo c={d.company} size={36} /><span className="min-w-0"><span className="block truncate text-[14px] font-medium">{title}</span><span className="text-[12.5px] text-zinc-500">{when} · Google Meet</span></span></div>
          <div className="mt-3.5 space-y-2 border-t border-zinc-100 pt-3.5 text-[13px] text-zinc-600">
            <div className="flex items-center gap-2"><Check className="size-3.5 text-ok" />{team.length ? `On ${team.join(" and ")} calendar${team.length > 1 ? "s" : ""}` : "On the founder’s calendar"}</div>
            <div className="flex items-center gap-2"><Check className="size-3.5 text-ok" />Agenda added to the invite</div>
            <div className="flex items-center gap-2"><FileText className="size-3.5 text-zinc-400" />Prep brief will be ready an hour before</div>
          </div>
        </div>
        <button type="button" data-autofocus onClick={onCancel} className="mt-6 h-11 w-full rounded-full bg-ink text-[14px] font-medium text-white hover:bg-zinc-800">Done</button>
      </div>
    </ModalFrame>
  );

  return (
    <ModalFrame label="Book a founder call" width={640} onClose={onCancel}>
      <div className="flex items-start justify-between gap-4 px-7 pt-5 pb-4">
        <div>
          <h2 className="serif text-[26px] leading-[1.1] tracking-[-0.01em]">Book a founder call</h2>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] text-zinc-500"><Sparkles className="size-3.5 text-rust" />{d.origin}. Check and send.</p>
        </div>
        <ModalClose onClick={onCancel} />
      </div>
      <div className="space-y-4 border-t border-zinc-100 px-7 pt-5 pb-5">
        <div className="rounded-2xl px-4 py-3.5 ring-1 ring-zinc-200/80">
          <div className="flex items-center gap-3">
            <CompanyLogo c={d.company} size={40} />
            <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{d.company.name}</span><span className="text-[12.5px] text-zinc-500">{d.company.line}{d.people.find((p) => p.from) && <> · {d.people.find((p) => p.from)!.name}, {d.people.find((p) => p.from)!.role}</>}</span></span>
            {d.fitScore !== undefined && <span className="flex items-center gap-2 text-[12px] text-zinc-500">Fit<FitPill score={d.fitScore} signals={d.fitSignals} /></span>}
          </div>
          {!conflict && <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-6 border-t border-dashed border-zinc-200 pt-2.5">
            <div className="min-w-0"><div className="text-[12px] text-zinc-500">Why it fits</div><div className="mt-1.5 flex flex-wrap gap-1.5">{d.fit.map((f) => <span key={f} className="inline-flex h-6 items-center rounded-full bg-zinc-100 px-2.5 text-[12px] text-zinc-700">{f}</span>)}</div></div>
            {d.round && <div><div className="text-[12px] text-zinc-500">Round</div><div className="mt-1.5 flex gap-1.5">{d.round.map((f) => <span key={f} className="inline-flex h-6 items-center rounded-full bg-[#f6efe7] px-2.5 text-[12px] whitespace-nowrap text-[#7a4a26]">{f}</span>)}</div></div>}
          </div>}
        </div>

        <label className="block"><span className={L}>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} className={cx(field, "mt-2")} /></label>

        <div>
          <div className="flex items-baseline justify-between"><span className={L}>When</span><span className="text-[12px] text-zinc-400">{conflict ? "Re-checked everyone’s free/busy" : "From everyone’s free/busy"}</span></div>
          <div className="mt-2">
            {conflict ? <BetterSlots c={d.conflict!} slots={d.slots} slot={sl} onSlot={onSlot} />
              : <SlotGroup slots={d.slots} value={sl} onChange={(id) => { setOther(undefined); onSlot?.(id); }} group="main" label="Suggested times" onOther={() => setOther((o) => (o === undefined ? "" : undefined))}
                  other={other !== undefined && <motion.input initial={r ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} autoFocus value={other} onChange={(e) => setOther(e.target.value)} placeholder={d.otherHint ? `Any day and time, e.g. ${d.otherHint}` : "Any day and time"} aria-label="Other time" className={cx(field, "h-12")} />} />}
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-4">
          <div><span className={L}>Duration</span>
            <div role="radiogroup" aria-label="Duration" className="mt-2 flex h-10 rounded-xl bg-zinc-100 p-1">
              {d.durations.map((n) => <button key={n} type="button" role="radio" aria-checked={n === du} onClick={() => onDuration?.(n)}
                className={cx("relative w-[66px] rounded-[9px] text-[13px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-rust/40", n === du ? "font-medium text-ink" : "text-zinc-500 hover:text-ink")}>
                {n === du && <motion.span layoutId="dur" transition={r ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }} className="absolute inset-0 rounded-[9px] bg-white shadow-[0_1px_2px_rgba(9,9,11,.1),0_0_0_1px_rgba(9,9,11,.04)]" />}
                <span className="relative">{n} min</span></button>)}
            </div>
          </div>
          <div className="min-w-0"><span className={L}>Google Meet</span>
            <div className="mt-2 flex h-10 items-center gap-2.5 rounded-xl bg-zinc-50/80 pr-1.5 pl-3 ring-1 ring-zinc-200">
              <ToolLogo id="googlemeet" size={16} bare /><span className="min-w-0 flex-1 truncate text-[13px] text-zinc-600">{d.meetLink}</span>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(`https://${d.meetLink}`).catch(() => {}); setCopied(true); }} aria-label="Copy Meet link" className={cx("inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] font-medium transition-colors", copied ? "text-ok" : "text-zinc-500 hover:bg-white hover:text-ink hover:shadow-[0_0_0_1px_rgba(9,9,11,.08)]")}>{copied ? <><Check className="size-3.5" />Copied</> : <><Copy className="size-3.5" />Copy</>}</button>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between"><span className={L}>Attendees</span><span className="text-[12px] text-zinc-400">{people.length} invited</span></div>
          <ul className="mt-2 flex flex-wrap items-center gap-2">
            <AnimatePresence initial={false}>{people.map((p) => <PersonChip key={p.email} p={p} onRemove={() => setPeople((ps) => ps.filter((x) => x.email !== p.email))} />)}</AnimatePresence>
            <li>{adding
              ? <input autoFocus type="email" placeholder="name@firm.com" aria-label="Add attendee email" className="h-9 w-[190px] rounded-full bg-white px-3.5 text-[13px] ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-rust/30"
                  onBlur={() => setAdding(false)} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setAdding(false); } if (e.key === "Enter") { const v = e.currentTarget.value.trim(); if (/^\S+@\S+\.\S+$/.test(v) && !people.some((p) => p.email === v)) { const nm = v.split("@")[0]; setPeople((ps) => [...ps, { name: nm.charAt(0).toUpperCase() + nm.slice(1), email: v, role: "Guest", initials: nm.slice(0, 2).toUpperCase() }]); } setAdding(false); } }} />
              : <button type="button" onClick={() => setAdding(true)} aria-label="Add attendee" title="Add attendee" className="grid size-9 place-items-center rounded-full border border-dashed border-zinc-300 text-zinc-500 transition-colors hover:border-zinc-400 hover:text-ink"><Plus className="size-4" /></button>}
            </li>
          </ul>
        </div>

        <div>
          <div className="flex items-baseline justify-between"><span className={L}>Agenda</span><span className="inline-flex items-center gap-1 text-[12px] text-zinc-400"><Pencil className="size-3" />Drafted by the agent · editable</span></div>
          <ol className="mt-2 divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200 focus-within:ring-zinc-300">
            {agenda.map((a, i) => (
              <li key={i} className="flex h-9 items-center gap-3 px-3">
                <span className="tnum grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 text-[11px] font-medium text-zinc-500">{i + 1}</span>
                <input value={a} aria-label={`Agenda item ${i + 1}`} onChange={(e) => setAgenda((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} className="min-w-0 flex-1 bg-transparent text-[13.5px] text-zinc-700 outline-none" />
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-zinc-100 bg-white/95 px-7 py-4 backdrop-blur">
        <span className="mr-auto min-w-0 truncate text-[12.5px] text-zinc-500"><span className="font-medium text-ink">{when}</span> · {du} min · {people.length} attendee{people.length === 1 ? "" : "s"}</span>
        <button type="button" onClick={onCancel} className="h-10 rounded-full px-4 text-[13.5px] text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">Cancel</button>
        <button type="button" onClick={onSend} disabled={state === "sending" || !canSend} aria-busy={state === "sending"} className="inline-flex h-10 w-[148px] items-center justify-center gap-2 rounded-full bg-ink text-[13.5px] font-medium text-white shadow-[0_1px_2px_rgba(9,9,11,.2),inset_0_1px_0_rgba(255,255,255,.12)] transition-colors hover:bg-zinc-800 disabled:opacity-50">
          {state === "sending" ? <><Loader2 className="size-4 animate-spin" />Sending…</> : <><Send className="size-3.5" />Send invite</>}
        </button>
      </div>
    </ModalFrame>
  );
}

const KIND: Record<MeetingKind, { icon: typeof Video; label: string }> = { founder: { icon: Video, label: "Founder call" }, ic: { icon: Gavel, label: "Investment committee" }, board: { icon: Presentation, label: "Board" }, lp: { icon: Users, label: "LP" } };

export function NextMeetings({ items, onOpen, active, className, prepFooter, empty }: { items: MeetingItem[]; onOpen?: (id: string) => void; active?: string; className?: string; /** footer: how many prep briefs are ready (derived from items) */ prepFooter?: boolean; /** shown in the list when there are no meetings (e.g. calendar not connected) */ empty?: string }) {
  const withPrep = items.filter((m) => m.prep), ready = withPrep.filter((m) => m.prep?.ready).length;
  return (
    <section className={cx("flex flex-col", className ?? "rounded-2xl border border-zinc-200/80 bg-white")}>
      <div className="flex h-11 items-center justify-between px-4"><span className="text-[13px] font-medium">Next meetings</span><CalendarClock className="size-4 text-zinc-400" /></div>
      <ul className="border-t border-zinc-100">
        {items.map((m) => { const K = KIND[m.kind]; return (
          <li key={m.id}><button type="button" onClick={() => onOpen?.(m.id)} aria-pressed={active === m.id} className={cx("grid h-12 w-full grid-cols-[64px_auto_1fr_auto] items-center gap-2.5 px-4 text-left hover:bg-zinc-50", active === m.id && "bg-zinc-50")}>
            <span className="tnum text-[12.5px] font-medium whitespace-nowrap">{m.time}<span className="block text-[10.5px] font-normal text-zinc-400">{m.day}</span></span>
            {m.company ? <CompanyLogo c={m.company} size={24} /> : <Avatar i={m.people[0].initials} size={24} />}
            <span className="min-w-0"><span className="block truncate text-[13px] font-medium">{m.title}</span><span className="flex min-w-0 items-center gap-1 text-[11.5px] text-zinc-500"><K.icon className="size-3 shrink-0" /><span className="truncate">{K.label} · {m.duration}</span></span></span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] text-zinc-500">{m.prep ? (m.prep.ready ? "Prep" : "Prep at 2pm") : null}<ChevronRight className="size-3.5" /></span>
          </button></li>
        ); })}
        {items.length === 0 && empty && <li data-testid="meetings-empty" className="flex items-center gap-2.5 px-4 py-4 text-[12.5px] text-zinc-500"><CalendarClock className="size-3.5 shrink-0 text-zinc-300" />{empty}</li>}
      </ul>
      {prepFooter && withPrep.length > 0 && (
        <div className="mt-auto flex items-center gap-3 border-t border-zinc-100 px-4 py-3 text-[11.5px] text-zinc-500">
          <span className="flex gap-1">{withPrep.map((m) => <span key={m.id} className={cx("h-1.5 w-5 rounded-full", m.prep?.ready ? "bg-ok" : "bg-zinc-200")} />)}</span>
          <span className="tnum">{ready} of {withPrep.length} prep briefs ready</span>
        </div>
      )}
    </section>
  );
}

export function MeetingPanel({ m, onClose }: { m: MeetingItem; onClose?: () => void }) {
  const K = KIND[m.kind];
  return (
    <motion.aside initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.22 }} aria-label="Meeting details" className="fixed top-0 right-0 z-50 flex h-screen w-[400px] flex-col border-l border-zinc-200 bg-white shadow-[-16px_0_40px_-16px_rgba(9,9,11,.18)]">
      <div className="flex h-14 items-center justify-between border-b border-zinc-100 px-5"><span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500"><K.icon className="size-3.5" />{K.label}</span><IconBtn icon={<X />} label="Close" tone="bare" size="sm" onClick={onClose} /></div>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div>
          <h2 className="serif text-[22px] leading-tight">{m.title}</h2>
          <div className="tnum mt-1 text-[13px] text-zinc-500">{m.day} · {m.time} · {m.duration}</div>
        </div>
        {m.company && <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 p-3"><CompanyLogo c={m.company} size={34} /><span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold">{m.company.name}</span><span className="text-[12px] text-zinc-500">{m.company.line}</span></span>{m.founder && <span className="flex items-center gap-2 text-right text-[12px]"><span><span className="block font-medium">{m.founder.name}</span><span className="text-zinc-500">{m.founder.role}</span></span><Avatar i={m.founder.initials} size={28} tone="sand" /></span>}</div>}
        <div><div className="eyebrow">Agenda</div><ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-zinc-700">{m.agenda.map((a) => <li key={a}>{a}</li>)}</ol></div>
        <div><div className="eyebrow">Join</div><a href="#" className="mt-2 flex h-10 items-center gap-2.5 rounded-lg border border-zinc-200 px-3 text-[13px] hover:bg-zinc-50"><ToolLogo id="calendar" size={16} bare /><span className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-600">{m.meetLink}</span><Copy className="size-3.5 text-zinc-400" /></a></div>
        {m.prep && <div><div className="eyebrow">Prep brief</div><a href={m.prep.href ?? "#"} className="mt-2 flex items-center gap-3 rounded-lg border border-zinc-200 p-2.5 hover:bg-zinc-50"><span className="grid h-10 w-8 place-items-center rounded border border-zinc-200 bg-zinc-50"><FileText className="size-4 text-zinc-500" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{m.prep.label}</span><span className="text-[11.5px] text-zinc-500">{m.prep.pages} pages · {m.prep.ready ? "ready" : "drafting"} · by the meeting prep agent</span></span></a></div>}
        <div><div className="eyebrow">People</div><div className="mt-2 space-y-2">{m.people.map((p) => <div key={p.email} className="flex items-center gap-2.5 text-[13px]"><Avatar i={p.initials} size={24} tone={p.role === "Partner" ? "ink" : "zinc"} /><span className="font-medium">{p.name}</span><span className="text-zinc-500">{p.role}</span></div>)}</div></div>
      </div>
      <div className="flex gap-2 border-t border-zinc-100 px-5 py-4">
        <button type="button" className="h-9 flex-1 rounded-lg text-[13px] ring-1 ring-zinc-200 hover:bg-zinc-50">Reschedule</button>
        <button type="button" className="h-9 flex-1 rounded-lg bg-ink text-[13px] font-medium text-white hover:bg-zinc-800">Edit</button>
      </div>
    </motion.aside>
  );
}
