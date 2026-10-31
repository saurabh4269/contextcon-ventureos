"use client";
/**
 * v4 · Person / founder page (inspo 24827568 Activity tab; agent pills from 26523922_4).
 * Header: avatar with the company mark, relationship, stage, fit, last touched, Email / Book meeting.
 * Main: tabs with counts derived from the events; a timeline grouped This week / History with nested runs,
 * "from chip → to chip" changes, agent rows marked "AI drafted" / "Escalated", Crustdata field chips.
 * Right (sticky): queue navigation built from the people fixtures, AI insights with a status pill, details, deal team.
 * The signed-in user reads as "You" everywhere (timeline actors, owner, deal team).
 */
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CalendarDays, Check, Send, CalendarPlus, ChevronDown, ChevronUp, Copy, FileText, Gauge, Handshake, Inbox, Mail, MessageSquareText, Radar, Sparkles, StickyNote, TriangleAlert, UserCheck, Workflow, Phone } from "lucide-react";
import { Page, SidePanel, TopBar } from "../components/shell";
import { ErrorState, Skeleton } from "../components/states";
import { CompanyLogo, cx, srcIcon } from "../components/ui";
import { FitPill, OwnerChip, StagePill } from "../components/dealbits";
import { ToolLogo, TOOL_NAME } from "../components/tools";
import { Rise, useReducedMotion } from "../components/motion";
import { ROUTES } from "../routes";
import type { PersonAlertAction, PersonChip, PersonData, PersonDraft, PersonEvent, PersonEventKind, PersonTab, PersonRef, RichSeg, ScreenStatus, ShellData, SourceRef } from "../types";

/** Shared card chrome (same as Today): 20px radius, hairline border, soft layered shadow. */
const CARD = "rounded-[20px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03),0_12px_32px_-18px_rgba(9,9,11,.10)]";

const TABS: { id: PersonTab; label: string; icon: ReactNode; kinds?: PersonEventKind[]; empty: (first: string) => [string, string] }[] = [
  { id: "activity", label: "Activity", icon: <Workflow />, empty: (f) => ["No activity yet", `Emails, meetings and agent work with ${f} will show up here.`] },
  { id: "emails", label: "Emails", icon: <Mail />, kinds: ["email"], empty: (f) => ["No emails yet", `Threads with ${f} land here once Gmail syncs.`] },
  { id: "meetings", label: "Meetings", icon: <CalendarDays />, kinds: ["meeting", "call"], empty: (f) => ["No meetings yet", `Book a call with ${f}; the agent pre-fills the invite.`] },
  { id: "notes", label: "Notes", icon: <StickyNote />, kinds: ["note"], empty: (f) => ["No notes yet", `Notes your team writes about ${f} will live here.`] },
  { id: "files", label: "Files", icon: <FileText />, kinds: ["file"], empty: (f) => ["No files yet", `Decks and documents ${f} shares, or the agents collect, land here.`] },
];

const KIND_ICON: Record<PersonEventKind, ReactNode> = {
  email: <Mail />, meeting: <CalendarDays />, call: <Phone />, note: <MessageSquareText />, file: <FileText />,
  stage: <Workflow />, fit: <Gauge />, signal: <Radar />, intro: <Handshake />, claim: <UserCheck />,
};

/** Chip tones for from → to changes; same palette as the stage pills, compact. */
const CHIP: Record<NonNullable<PersonChip["tone"]>, { c: string; d: string }> = {
  neutral: { c: "bg-white text-zinc-700 ring-1 ring-zinc-200", d: "bg-zinc-400" },
  warn: { c: "bg-warn-50 text-warn ring-1 ring-warn-100", d: "bg-[#d39a2c]" },
  rust: { c: "bg-rust-50 text-rust ring-1 ring-rust-100", d: "bg-rust" },
  ok: { c: "bg-ok-50 text-ok ring-1 ring-ok-100", d: "bg-[#2f9a5c]" },
  ink: { c: "bg-ink text-white", d: "bg-[#f0b48a]" },
};
function Chip({ c }: { c: PersonChip }) {
  const t = CHIP[c.tone ?? "neutral"];
  return <span className={cx("tnum mx-0.5 inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 align-[1px] text-[12px] leading-none font-medium whitespace-nowrap", t.c)}><span className={cx("size-1.5 rounded-full", t.d)} />{c.label}</span>;
}

/** Who is looking (actors that match read "You") and where alert actions go. */
const PersonCtx = createContext<{ me?: ShellData["user"]; onAlert?: (eventId: string, a: PersonAlertAction) => void; requested?: Set<string> }>({});
/** Which way the last queue arrow went, so the next founder slides in from that side (module scope survives client navigation). */
let queueDir: -1 | 0 | 1 = 0;
const isMe = (p: PersonRef, me?: ShellData["user"]) => !!me && (p.id ? p.id === me.id : p.name === me.name);

/** Nested runs and alerts share one frame: same edges (text column → time column), radius and padding. */
const SUBCARD = "mt-2 overflow-hidden rounded-2xl border px-4";
/** Timestamps: 12px, quiet, right-aligned on the first line's baseline. */
const TIME = "tnum text-right text-[12px] leading-[26px] whitespace-nowrap text-zinc-400";

const kindsOf = (tab: PersonTab) => TABS.find((t) => t.id === tab)?.kinds;
/** Events shown under a tab: everything for Activity; otherwise matching events, nested ones lifted out. */
function eventsFor(events: PersonEvent[], tab: PersonTab): PersonEvent[] {
  const k = kindsOf(tab);
  if (!k) return events;
  return events.flatMap((e) => [e, ...(e.children ?? [])]).filter((e) => k.includes(e.kind)).map((e) => ({ ...e, children: undefined }));
}
const countFor = (d: PersonData, tab: PersonTab) => d.groups.reduce((n, g) => n + eventsFor(g.events, tab).length, 0);
const firstName = (p: PersonRef) => p.name.split(" ")[0];
/** Clipboard write that never throws: the async API when allowed, else a hidden-textarea copy. */
async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove(); return ok;
  }
}

/* ───────────── atoms ───────────── */

/** Founder avatar: warm initials disc with the company mark tucked bottom-right. */
function FounderAvatar({ d, size = 60 }: { d: PersonData; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span style={{ fontSize: size * 0.34 }} className="grid size-full place-items-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#fbefe3,#ecd9c6_62%,#e2c8b0)] font-semibold tracking-tight text-[#6b4428] shadow-[inset_0_1px_0_rgba(255,255,255,.7),0_6px_16px_-8px_rgba(120,60,20,.45)] ring-1 ring-[#e7d3c0]">{d.person.initials}</span>
      <span className="absolute right-0 bottom-0 inline-flex rounded-[6px] ring-2 ring-white"><CompanyLogo c={d.company} size={18} /></span>
    </span>
  );
}

/** One of our agents: a small sienna orb with a spark. */
function AgentAvatar({ size = 28 }: { size?: number }) {
  return <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#d8854a,#9c440f_72%)] text-white shadow-[0_4px_10px_-4px_rgba(156,68,15,.7),inset_0_1px_0_rgba(255,255,255,.3)]"><Sparkles style={{ width: size * 0.45, height: size * 0.45 }} strokeWidth={2} /></span>;
}

/** "AI drafted" (the agent prepared it, a human sends) and "Escalated" (the agent handed it to a human). */
function AgentMark({ m }: { m: NonNullable<PersonEvent["agentMark"]> }) {
  return m === "drafted"
    ? <span className="mr-0.5 inline-flex h-[22px] items-center gap-1 rounded-full align-[1px] bg-zinc-100 px-2 text-[11.5px] font-medium whitespace-nowrap text-zinc-600 ring-1 ring-zinc-200/80"><Sparkles className="size-3 text-rust/80" strokeWidth={2} />AI drafted</span>
    : <EscalatedPill />;
}
/** Escalated: one soft amber pulse when it first appears, then still. */
function EscalatedPill() {
  const rm = useReducedMotion();
  return (
    <motion.span initial={false} animate={rm ? undefined : { boxShadow: ["0 0 0 0 rgba(211,154,44,0)", "0 0 0 5px rgba(211,154,44,.28)", "0 0 0 0 rgba(211,154,44,0)"] }} transition={{ duration: 1.6, delay: 0.7, ease: "easeOut" }}
      className="mr-0.5 inline-flex h-[22px] items-center gap-1 rounded-full align-[1px] bg-rust-50 px-2 text-[11.5px] font-medium whitespace-nowrap text-rust ring-1 ring-rust-100"><TriangleAlert className="size-3" strokeWidth={2} />Escalated</motion.span>
  );
}

/** Source chip; provider-sourced (Crustdata) shows the provider mark, the field path and freshness. */
function SourceChip({ s, compact }: { s: SourceRef; /** provider name only; the field path moves to the tooltip */ compact?: boolean }) {
  const chip = cx("inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-zinc-200 bg-white pr-1.5 pl-1 text-zinc-600 shadow-[0_1px_1px_rgba(9,9,11,.03)]", compact ? "h-[22px] text-[11px]" : "h-5 text-[10.5px]");
  if (!s.provider) { const I = srcIcon[s.kind]; return <span title={s.label} className={chip}><I className="size-[11px] shrink-0 text-zinc-400" strokeWidth={1.75} /><span className="min-w-0 truncate">{s.label}</span></span>; }
  const tip = `${TOOL_NAME[s.provider]} · ${s.label}${s.asOf ? ` · ${s.asOf}` : ""}`;
  if (compact) return <span title={tip} className={cx(chip, "gap-1.5 pr-2 pl-1.5 font-medium text-zinc-700")}><ToolLogo id={s.provider} bare size={12} />{TOOL_NAME[s.provider]}</span>;
  return (
    <span title={tip} className={chip}>
      <ToolLogo id={s.provider} bare size={11} /><span className="font-medium text-zinc-700">{TOOL_NAME[s.provider]}</span>
      <span className="min-w-0 truncate border-l border-zinc-200 pl-1 font-mono text-[10px] tracking-[-0.02em] text-zinc-500">{s.label}</span>
    </span>
  );
}

const Rich = ({ segs }: { segs: RichSeg[] }) => <>{segs.map((s, i) => s.b ? <span key={i} className="font-medium text-ink">{s.t}</span> : <span key={i}>{s.t}</span>)}</>;
const actorName = (e: PersonEvent, me?: ShellData["user"]) => ("agent" in e.by ? e.by.agent : isMe(e.by.person, me) ? "You" : e.by.person.name);

const Change = ({ c }: { c: NonNullable<PersonEvent["change"]> }) => <span className="whitespace-nowrap"><Chip c={c.from} /><ArrowRight className="mx-0.5 inline size-3.5 align-[-2px] text-zinc-400" /><Chip c={c.to} /></span>;

/** Sentence for one event: actor, text, optional from → to change and note, and the source chip inline at the end. */
function Sentence({ e, actor = true, src, change = true }: { e: PersonEvent; actor?: boolean; src?: SourceRef; change?: boolean }) {
  const { me } = useContext(PersonCtx);
  return (
    <span className="text-[13.5px] leading-[26px] text-zinc-600">
      {actor && <span className="font-medium text-ink">{actorName(e, me)} </span>}
      {actor && e.agentMark && <><AgentMark m={e.agentMark} /> </>}
      <Rich segs={e.text} />
      {change && e.change && <> <Change c={e.change} />{e.change.note && <span className="text-zinc-500"> {e.change.note}</span>}</>}
      {src && <span className="ml-2 inline-flex max-w-full align-[1px]"><SourceChip s={src} /></span>}
    </span>
  );
}

/** Diligence alert (S2_B): what doesn't tie out, the evidence, and two small next steps. */
function AlertCard({ e }: { e: PersonEvent }) {
  const { onAlert, requested } = useContext(PersonCtx);
  const a = e.alert!;
  return (
    <div className={cx(SUBCARD, "border-rust-100 bg-white shadow-[0_1px_2px_rgba(120,60,20,.04),0_10px_24px_-18px_rgba(156,68,15,.45)]")}>
      <div className="-mx-4 flex items-center gap-1.5 bg-rust-50/80 px-4 py-1.5 text-[11.5px] font-medium text-rust"><TriangleAlert className="size-3.5" strokeWidth={2} />Diligence alert</div>
      <div className="pt-2.5 pb-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-[14px] font-medium text-ink">{a.title}</span>{e.change && <Change c={e.change} />}</div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">{a.sources.map((s) => <SourceChip key={s.label} s={s} />)}</span>
          <span className="ml-auto flex gap-1.5">{a.actions.map((x) => { const done = x.kind === "request" && requested?.has(`${e.id}:${x.id}`); return (
            <button key={x.id} type="button" disabled={done} onClick={() => onAlert?.(e.id, x)} className={cx("inline-flex h-7 items-center gap-1 rounded-full px-3 text-[12px] font-medium whitespace-nowrap transition-all", done ? "bg-ok-50 text-ok ring-1 ring-ok-100" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:-translate-y-px hover:text-ink hover:ring-zinc-300 hover:shadow-[0_4px_10px_-6px_rgba(9,9,11,.3)]")}>
              {done ? <><Check className="size-3.5" />Requested</> : <>{x.kind === "compose" && <Mail className="size-3.5 text-zinc-400" />}{x.label}</>}
            </button>
          ); })}</span>
        </div>
      </div>
    </div>
  );
}

/* ───────────── timeline ───────────── */

function Nested({ e, preview }: { e: PersonEvent; preview: number }) {
  const kids = e.children ?? [];
  const [all, setAll] = useState(false);
  const shown = all ? kids : kids.slice(0, preview);
  return (
    <div className={cx(SUBCARD, "border-zinc-200/70 bg-[#fbfaf9] py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]")}>
      <ul className="divide-y divide-zinc-100">
        {shown.map((c, i) => (
          <Rise key={c.id} i={all && i >= preview ? i - preview : 0}>
            <li className="flex items-start gap-3 py-1">
              <span className="mt-[10px] size-1.5 shrink-0 rounded-full bg-rust/70" />
              <span className="min-w-0 flex-1"><Sentence e={c} actor={false} src={c.source} /></span>
              <span className={cx(TIME, "shrink-0")}>{c.when}</span>
            </li>
          </Rise>
        ))}
      </ul>
      {kids.length > preview && (
        <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className="mt-0.5 mb-1 inline-flex h-7 items-center gap-1 rounded-full px-2 -ml-2 text-[12px] font-medium text-zinc-600 transition-colors hover:bg-white hover:text-ink">
          {all ? "View less" : `View all ${kids.length}`}<ChevronDown className={cx("size-3.5 transition-transform", all && "rotate-180")} />
        </button>
      )}
    </div>
  );
}

function EventRow({ e, preview, last }: { e: PersonEvent; preview: number; last: boolean }) {
  const agent = "agent" in e.by;
  return (
    <li className="group relative grid grid-cols-[28px_minmax(0,1fr)_auto] gap-x-3.5 pb-4">
      {!last && <span aria-hidden className="absolute top-[30px] bottom-0.5 left-[13.5px] w-px bg-zinc-200" />}
      {agent ? <AgentAvatar /> : <span className="grid size-7 place-items-center rounded-full bg-white text-zinc-500 ring-1 ring-zinc-200 transition-colors group-hover:text-ink group-hover:ring-zinc-300 [&_svg]:size-3.5">{KIND_ICON[e.kind]}</span>}
      <div className="min-w-0 rounded-lg -mx-2 px-2 transition-colors group-hover:bg-[#f8f7f5]">
        <Sentence e={e} src={e.children || e.alert ? undefined : e.source} change={!e.alert} />
      </div>
      <span className={TIME}>{e.when}</span>
      {e.alert && <div className="col-span-2 col-start-2"><AlertCard e={e} /></div>}
      {e.children && <div className="col-span-2 col-start-2"><Nested e={e} preview={preview} /></div>}
    </li>
  );
}

function Group({ label, events, preview, start }: { label: string; events: PersonEvent[]; preview: number; start: number }) {
  const [open, setOpen] = useState(true);
  const rm = useReducedMotion();
  return (
    <section className="pt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="group/g mb-3 inline-flex items-center gap-1.5 rounded-lg py-1 text-ink">
        <span className="serif text-[21px] leading-none tracking-[-0.01em]">{label}</span>
        <span className="tnum ml-1 text-[12px] text-zinc-400">{events.length}</span>
        <ChevronDown className={cx("size-4 text-zinc-400 transition-transform group-hover/g:text-ink", !open && "-rotate-90")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul key="rows" initial={rm ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={rm ? { height: 0, opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            {events.map((e, i) => <Rise key={e.id} i={start + i}><EventRow e={e} preview={preview} last={i === events.length - 1} /></Rise>)}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}

function Tabs({ d, tab, onTab }: { d: PersonData; tab: PersonTab; onTab: (t: PersonTab) => void }) {
  const rm = useReducedMotion();
  return (
    <div role="tablist" aria-label="Activity type" className="flex items-center gap-1 overflow-x-auto border-b border-zinc-100 px-4 [scrollbar-width:none] @max-[720px]/main:px-2">
      {TABS.map((t) => { const on = tab === t.id, n = countFor(d, t.id); return (
        <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => onTab(t.id)} className={cx("relative inline-flex h-12 shrink-0 items-center gap-1.5 px-3 text-[13px] whitespace-nowrap transition-colors [&>svg]:size-3.5", on ? "font-medium text-ink" : "text-zinc-500 hover:text-ink")}>
          {t.icon}{t.label}
          <span className={cx("tnum ml-0.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10.5px] font-medium transition-colors", on ? "bg-rust-50 text-rust" : "bg-zinc-100 text-zinc-500")}>{n}</span>
          {on && <motion.span layoutId="person-tab" transition={rm ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }} className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-rust" />}
        </button>
      ); })}
    </div>
  );
}

/** Closes the timeline so a short history reads as complete, not cut off. */
function TimelineEnd({ label }: { label: string }) {
  return <div className="flex items-center gap-3 pt-1 pb-4 pl-[7px]"><span className="size-3.5 rounded-full border-2 border-zinc-200 bg-white" /><span className="text-[12px] text-zinc-400">{label}</span></div>;
}

function TabEmpty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-zinc-50 text-zinc-400 ring-1 ring-zinc-200/80"><Inbox className="size-[18px]" strokeWidth={1.75} /></span>
      <div className="serif mt-3 text-[20px] text-ink">{title}</div>
      <p className="mt-1 max-w-[340px] text-[13px] text-zinc-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ───────────── header + right panel ───────────── */

const pillBtn = "inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition-all duration-150 hover:-translate-y-px";
const ghostBtn = cx(pillBtn, "bg-white text-zinc-800 ring-1 ring-zinc-200 shadow-[0_1px_1px_rgba(9,9,11,.04)] hover:ring-zinc-300 hover:shadow-[0_6px_14px_-8px_rgba(9,9,11,.25)]");
const inkBtn = cx(pillBtn, "bg-ink text-white shadow-[0_1px_2px_rgba(9,9,11,.2),inset_0_1px_0_rgba(255,255,255,.12)] hover:bg-zinc-800 hover:shadow-[0_8px_18px_-8px_rgba(9,9,11,.5),inset_0_1px_0_rgba(255,255,255,.12)]");

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div className={cx("min-w-0 flex-auto px-5 first:pl-0 last:pr-0 @max-[720px]/main:px-0", className)}><div className="text-[12px] text-zinc-500">{label}</div><div className="mt-2 flex h-6 min-w-0 items-center text-[13.5px] font-medium text-ink">{children}</div></div>;
}

function Header({ d, onEmail, onBook }: { d: PersonData; onEmail?: () => void; onBook?: () => void }) {
  const { me } = useContext(PersonCtx);
  const next = d.next && <><CalendarDays className="mr-1.5 size-3.5 shrink-0 text-rust" /><span className="truncate">{d.next.label}<span className="font-normal text-zinc-500"> · {d.next.when}</span></span></>;
  return (
    <section className={cx(CARD, "px-6 pt-6 pb-5 @min-[900px]/main:col-span-2 @max-[720px]/main:px-4 @max-[720px]/main:pt-4")}>
      <div className="flex flex-wrap items-center gap-5 @max-[720px]/main:gap-x-3 @max-[720px]/main:gap-y-4">
        <FounderAvatar d={d} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h1 className="serif min-w-0 truncate text-[32px] leading-none tracking-[-0.02em] @max-[720px]/main:text-[26px]">{d.person.name}</h1><span className="text-[12.5px] whitespace-nowrap text-zinc-400">Last touched <span className="text-zinc-600">{d.lastTouched}</span></span></div>
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13.5px] text-zinc-500">
            <span>{d.person.title}</span><span className="text-zinc-300">·</span>
            {d.company.dealId ? <Link href={ROUTES.deal(d.company.dealId)} className="inline-flex items-center gap-1.5 font-medium text-zinc-800 underline-offset-[3px] hover:text-ink hover:underline"><CompanyLogo c={d.company} size={18} />{d.company.name}</Link> : <span className="inline-flex items-center gap-1.5 font-medium text-zinc-800"><CompanyLogo c={d.company} size={18} />{d.company.name}</span>}
            {d.person.location && <><span className="text-zinc-300">·</span><span>{d.person.location}</span></>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 @max-[720px]/main:w-full @max-[720px]/main:[&>button]:h-10 @max-[720px]/main:[&>button]:flex-1 @max-[720px]/main:[&>button]:justify-center">
          <button type="button" onClick={onEmail} className={ghostBtn}><ToolLogo id="gmail" bare size={14} />Email</button>
          {onBook && <button type="button" onClick={onBook} className={inkBtn}><CalendarPlus className="size-4" strokeWidth={1.9} />Book meeting</button>}
        </div>
      </div>
      <div className="mt-5 flex divide-x divide-zinc-100 border-t border-zinc-100 pt-4 @max-[720px]/main:grid @max-[720px]/main:grid-cols-2 @max-[720px]/main:gap-x-4 @max-[720px]/main:gap-y-3 @max-[720px]/main:divide-x-0">
        <Fact label="Relationship"><StagePill tone={d.relationship.tone}>{d.relationship.label}</StagePill></Fact>
        <Fact label="Stage"><StagePill tone={d.stage.tone}>{d.stage.label}</StagePill></Fact>
        {d.status && <Fact label="Status"><StagePill tone={d.status.tone}>{d.status.label}</StagePill></Fact>}
        {d.fit ? <Fact label="Fit"><FitPill score={d.fit.score} signals={d.fit.signals} /></Fact> : <Fact label="Fit"><span className="text-zinc-400">Not scored</span></Fact>}
        {d.round && <Fact label="Round"><span className="tnum truncate">{d.round}</span></Fact>}
        {d.next && <Fact label="Next">{d.next.href
          ? <Link href={d.next.href} className="group/nx -mx-2 -my-1 flex min-w-0 items-center rounded-full px-2 py-1 transition-colors hover:bg-rust-50/70">{next}<span className="ml-2 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white px-2 text-[11.5px] leading-[20px] font-medium text-zinc-600 ring-1 ring-zinc-200 transition-colors group-hover/nx:text-ink group-hover/nx:ring-zinc-300">Prep<ArrowRight className="size-3 transition-transform group-hover/nx:translate-x-0.5" /></span></Link>
          : next}</Fact>}
        <Fact label="Owner"><OwnerChip o={d.owner} me={me} /></Fact>
      </div>
    </section>
  );
}

function QueueNav({ q, why }: { q: PersonData["queue"]; why?: string }) {
  const btn = "grid size-8 place-items-center rounded-full ring-1 ring-zinc-200 transition-all [&_svg]:size-4";
  const nav = (id: string | undefined, label: string, icon: ReactNode, dir: -1 | 1) => id
    ? <Link href={ROUTES.person(id)} onClick={() => { queueDir = dir; }} aria-label={label} title={label} className={cx(btn, "bg-white text-zinc-600 hover:-translate-y-px hover:bg-zinc-50 hover:text-ink hover:ring-zinc-300 active:translate-y-0")}>{icon}</Link>
    : <span aria-disabled className={cx(btn, "text-zinc-300")}>{icon}</span>;
  return (
    <section className={cx(CARD, "flex items-center gap-3 px-4 py-3")}>
      <span className="min-w-0 flex-1"><span className="flex items-baseline gap-1.5"><span className="tnum text-[13.5px] font-medium text-ink">{q.index} of {q.total}</span><span className="truncate text-[12px] text-zinc-500">{q.label}</span></span>{why && <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-rust"><span className="size-1.5 shrink-0 rounded-full bg-rust" />{why}</span>}</span>
      {nav(q.prevId, "Previous founder", <ChevronUp />, -1)}{nav(q.nextId, "Next founder", <ChevronDown />, 1)}
    </section>
  );
}

function Insights({ d }: { d: PersonData }) {
  const i = d.insights;
  return (
    <section className="relative overflow-hidden rounded-[20px] border border-[#f1e2d2] bg-[#fcf8f4] p-5 shadow-[0_1px_2px_rgba(120,60,20,.04),0_14px_32px_-20px_rgba(156,68,15,.30)]">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-[220px] rounded-full bg-[radial-gradient(circle,rgba(214,128,66,.22),transparent_68%)]" />
      <div className="relative">
        <div className="flex items-center gap-2.5"><AgentAvatar size={30} /><span className="min-w-0"><span className="block text-[14px] leading-tight font-medium">AI insights</span><span className="block text-[11.5px] text-zinc-500">{i.updated}</span></span><span className="ml-auto"><StagePill tone={i.status.tone}>{i.status.label}</StagePill></span></div>
        <p className="mt-3.5 text-[13.5px] leading-[1.55] text-zinc-700">{i.summary}</p>
        <ul className="mt-3 space-y-1.5">{i.points.map((p) => <li key={p} className="flex gap-2.5 text-[12.5px] leading-[1.45] text-zinc-600"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-rust/70" />{p}</li>)}</ul>
        {i.sources.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[#efe1d3] pt-3">{i.sources.map((s) => <SourceChip key={s.label} s={s} compact />)}</div>}
      </div>
    </section>
  );
}

function Details({ d }: { d: PersonData }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { void copyText(d.person.email).then((ok) => { if (!ok) return; setCopied(true); setTimeout(() => setCopied(false), 1400); }); };
  return (
    <section className={cx(CARD, "p-5")}>
      <h2 className="text-[14px] font-medium">Details</h2>
      <dl className="mt-3 space-y-0.5">
        <div className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3 rounded-lg -mx-2 px-2 py-[5px] text-[13px] transition-colors hover:bg-zinc-50"><dt className="text-zinc-500">Email</dt><dd className="flex min-w-0 items-center justify-end gap-1 text-zinc-800"><span className={cx("truncate transition-colors @max-[480px]/main:text-right @max-[480px]/main:whitespace-normal", copied && "font-medium text-ok")}>{copied ? "Copied" : d.person.email}</span><button type="button" onClick={copy} disabled={!d.person.email.includes("@")} title={d.person.email.includes("@") ? undefined : "No email address to copy"} aria-label={copied ? "Copied" : "Copy email"} className={cx("inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1 text-[11.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 max-sm:h-10 max-sm:px-2.5", copied ? "text-ok" : "text-zinc-400 enabled:hover:bg-zinc-100 enabled:hover:text-ink")}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</button></dd></div>
        {d.details.map((r) => <div key={r.k} className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3 rounded-lg -mx-2 px-2 py-[5px] text-[13px] transition-colors hover:bg-zinc-50"><dt className="text-zinc-500">{r.k}</dt><dd className="tnum truncate text-right text-zinc-800 @max-[480px]/main:whitespace-normal">{r.v}</dd></div>)}
      </dl>
    </section>
  );
}

function Team({ d }: { d: PersonData }) {
  const { me } = useContext(PersonCtx);
  return (
    <section className={cx(CARD, "p-5")}>
      <h2 className="text-[14px] font-medium">Deal team</h2>
      <ul className="mt-3 space-y-0.5">{d.team.map((m) => (
        <li key={m.role} className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3 rounded-lg -mx-2 px-2 py-1 text-[13px] transition-colors hover:bg-zinc-50">
          <span className="text-zinc-500">{m.role}</span>
          <span className="flex min-w-0 items-center justify-end gap-2">{m.agent ? <><span className="truncate text-zinc-800">{m.agent}</span><AgentAvatar size={24} /></> : m.person && <><span className="truncate text-zinc-800">{m.person.name}{isMe(m.person, me) && <span className="text-zinc-400"> (you)</span>}</span><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#ece7df] text-[9.5px] font-semibold text-[#5b5245]">{m.person.initials}</span></>}</span>
        </li>
      ))}</ul>
    </section>
  );
}

/** The agent's pre-written email, opened for a check before sending. Esc or the backdrop closes it. */
function Compose({ to, draft, onClose, onSend, onSave }: { to: PersonData["person"]; draft: PersonDraft; onClose: () => void; onSend: () => void; onSave: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const field = "w-full rounded-xl bg-white px-3 text-[13px] text-ink ring-1 ring-zinc-200 outline-none transition-shadow focus:ring-rust/40";
  return (
    <SidePanel w={460} title="Email" sub={draft.by} onClose={onClose}
      foot={<div className="flex items-center gap-2"><span className="flex items-center gap-1.5 text-[12px] text-zinc-500"><ToolLogo id="gmail" bare size={13} />Sends from Gmail</span><button type="button" onClick={onSave} className={cx(ghostBtn, "ml-auto h-8 px-3")}>Save draft</button><button type="button" onClick={onSend} className={cx(inkBtn, "h-8 px-3")}><Send className="size-3.5" />Send</button></div>}>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200/70"><span className="text-[12px] text-zinc-500">To</span><span className="grid size-6 place-items-center rounded-full bg-[#ece7df] text-[9.5px] font-semibold text-[#5b5245]">{to.initials}</span><span className="text-[13px] font-medium">{to.name}</span><span className="truncate text-[12.5px] text-zinc-500">{to.email}</span></div>
        <label className="block"><span className="mb-1 block text-[12px] text-zinc-500">Subject</span><input defaultValue={draft.subject} className={cx(field, "h-10")} /></label>
        <label className="flex min-h-0 flex-1 flex-col"><span className="mb-1 block text-[12px] text-zinc-500">Message</span><textarea defaultValue={draft.body} className={cx(field, "min-h-[260px] flex-1 resize-none py-2.5 leading-[1.55]")} /></label>
      </div>
    </SidePanel>
  );
}

export interface PersonToast { id: number; text: string; undo?: () => void }
/** Bottom toast in the hold-queue style (ink pill, Undo); slides up, leaves after a few seconds. */
function Toast({ t, onDone }: { t: PersonToast | null; onDone: () => void }) {
  const rm = useReducedMotion();
  useEffect(() => { if (!t) return; const h = setTimeout(onDone, 5000); return () => clearTimeout(h); }, [t, onDone]);
  return (
    <AnimatePresence>
      {t && (
        <motion.div key={t.id} role="status" initial={rm ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={rm ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 12 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-6 left-1/2 z-50 -ml-[min(180px,calc(50vw-12px))] flex w-[min(360px,calc(100vw-24px))] items-center gap-3 rounded-2xl bg-ink py-2.5 pr-2.5 pl-4 text-[13px] text-white shadow-[0_20px_50px_-12px_rgba(9,9,11,.55)]">
          <Check className="size-4 shrink-0 text-[#f0b48a]" /><span className="min-w-0 flex-1 truncate">{t.text}</span>
          {t.undo && <button type="button" onClick={() => { t.undo!(); onDone(); }} className="rounded-lg bg-white px-3 py-1 text-[12.5px] font-semibold text-ink transition-colors hover:bg-zinc-100">Undo</button>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PersonSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto grid w-full max-w-[1240px] grid-cols-1 gap-5 px-7 pt-6 pb-16 max-lg:pb-24 @min-[900px]/main:grid-cols-[minmax(0,1fr)_340px] @max-[720px]/main:px-4">
      <div className={cx(CARD, "@min-[900px]/main:col-span-2 flex overflow-hidden items-center gap-5 p-6")}><span className="size-16 shrink-0 overflow-hidden rounded-full"><Skeleton className="size-full" /></span><div className="flex-1 space-y-2"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-80" /></div><Skeleton className="h-9 w-56 rounded-full" /></div>
      <div className={cx(CARD, "space-y-5 p-6")}><Skeleton className="h-8 w-2/3" />{Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex gap-3"><span className="size-7 shrink-0 overflow-hidden rounded-full"><Skeleton className="size-full" /></span><Skeleton className="h-5 flex-1" /></div>)}</div>
      <div className="space-y-4">{[2, 5, 4].map((n, i) => <div key={i} className={cx(CARD, "space-y-2.5 p-5")}><Skeleton className="h-4 w-1/3" />{Array.from({ length: n - 1 }).map((_, j) => <Skeleton key={j} className="h-3.5" />)}</div>)}</div>
    </div>
  );
}

/* ───────────── screen ───────────── */

export function PersonScreen({ shell, data, tab: tab0 = "activity", overlay, onEmail, onBook, onAlertAction, status = "ready", error, onRetry }: {
  shell: ShellData; data: PersonData; tab?: PersonTab; overlay?: ReactNode; onEmail?: () => void; onBook?: () => void;
  /** A diligence alert's action, e.g. ("a1", "verify"). */
  onAlertAction?: (eventId: string, actionId: string) => void;
} & ScreenStatus) {
  const [tab, setTab] = useState<PersonTab>(tab0);
  const rm = useReducedMotion();
  const [compose, setCompose] = useState<PersonDraft | null>(null);
  const [toast, setToast] = useState<PersonToast | null>(null);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const seq = useRef(0);
  const say = (text: string, undo?: () => void) => setToast({ id: ++seq.current, text, undo });
  const first = firstName(data.person);
  // Arriving from a queue arrow: slide in from that side (once), then forget the direction.
  const [dir] = useState(() => queueDir);
  useEffect(() => { queueDir = 0; }, []);
  const onAlert = (eventId: string, a: PersonAlertAction) => {
    onAlertAction?.(eventId, a.id);
    if (a.kind === "compose" && a.draft) setCompose(a.draft);
    if (a.kind === "request") {
      const k = `${eventId}:${a.id}`;
      setRequested((s) => new Set(s).add(k));
      say(a.toast ?? a.label, () => setRequested((s) => { const n = new Set(s); n.delete(k); return n; }));
    }
  };
  const top = <TopBar crumbs={[{ label: "Pipeline", href: ROUTES.pipeline }, { label: data.person.name }]} ctx={data.person.name} />;
  const empty = status === "empty";
  // Empty: header and panel stay, the timeline and every tab count read zero.
  if (empty) data = { ...data, groups: [] };
  const groups = data.groups.map((g) => ({ ...g, events: eventsFor(g.events, tab) })).filter((g) => g.events.length > 0);
  const t = TABS.find((x) => x.id === tab)!;
  const [title, body] = t.empty(firstName(data.person));
  let start = 0;
  return (
    <PersonCtx.Provider value={{ me: shell.user, onAlert, requested }}>
    <Page active="pipeline" shell={shell} top={top} overlay={<>
      {overlay}
      {compose && <Compose to={data.person} draft={compose} onClose={() => setCompose(null)} onSave={() => { setCompose(null); say("Draft saved · held for you"); }} onSend={() => { const d = compose; setCompose(null); say(`Sent to ${first}`, () => setCompose(d)); }} />}
      <Toast t={toast} onDone={() => setToast(null)} />
    </>}>
      {status === "loading" ? <PersonSkeleton /> : status === "error" ? <ErrorState message={error ?? `Couldn’t load ${data.person.name}.`} onRetry={onRetry} /> : (
        <motion.div initial={rm || !dir ? false : { opacity: 0, y: dir * 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="mx-auto grid w-full max-w-[1240px] grid-cols-1 items-start gap-5 px-7 pt-6 pb-16 max-lg:pb-24 @min-[900px]/main:grid-cols-[minmax(0,1fr)_340px] @max-[720px]/main:gap-4 @max-[720px]/main:px-4 @max-[720px]/main:pt-4">
          <Rise className="min-w-0 @min-[900px]/main:col-span-2"><Header d={data} onEmail={onEmail ?? (() => setCompose(data.email))} onBook={onBook} /></Rise>
          <section className={cx(CARD, "min-w-0 overflow-hidden")}>
            <Tabs d={data} tab={tab} onTab={setTab} />
            <div className="px-6 pt-4 pb-2 @max-[720px]/main:px-4">
              {groups.length === 0
                ? <TabEmpty title={empty ? "No activity yet" : title} body={empty ? TABS[0].empty(firstName(data.person))[1] : body} action={(empty || tab === "meetings") && onBook ? <button type="button" onClick={onBook} className={ghostBtn}><CalendarPlus className="size-4" />Book meeting</button> : undefined} />
                : <div key={tab}>
                    {groups.map((g) => { const s = start; start += g.events.length; return <Group key={g.id} label={g.label} events={g.events} preview={data.nestedPreview} start={s} />; })}
                    {tab === "activity" && <TimelineEnd label={`Start of your history with ${firstName(data.person)}`} />}
                  </div>}
            </div>
          </section>
          <aside className="flex min-w-0 flex-col gap-4 @min-[900px]/main:sticky @min-[900px]/main:top-[72px]">
            <Rise i={1}><QueueNav q={data.queue} why={data.waitingFor} /></Rise>
            <Rise i={2}><Insights d={data} /></Rise>
            <Rise i={3}><Details d={data} /></Rise>
            <Rise i={4}><Team d={data} /></Rise>
          </aside>
        </motion.div>
      )}
    </Page>
    </PersonCtx.Provider>
  );
}
