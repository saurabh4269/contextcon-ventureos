"use client";
/**
 * v4 · IC memo (S3_B) pieces: the "Memo companion" rail (Analyst override, Sources cited, Agent actions), the Share popover,
 * the Slack IC-vote preview and the memo prose renderer (`[n]` footnotes, `**bold**`). Nothing here sends anything:
 * Share copies a link, the vote sheet only queues locally.
 */
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, Clock, Copy, Eye, Link2, Lock, Sparkles } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import type { MemoAction, MemoDoc, MemoSourceDoc, MemoText, SlackMessage } from "../types";
import { ModalClose, ModalFrame } from "./connect";
import { useReducedMotion } from "./motion";
import { SlackCard, SlackFrame } from "./slack";
import { ToolLogo } from "./tools";
import { Avatar, cx, srcIcon, Toggle } from "./ui";

/* ---------- prose ---------- */
/** Renders memo prose: `**x**` bold, `[n]` a footnote superscript that calls `onCite(n)`. */
export function Prose({ text, onCite, active }: { text: MemoText; onCite?: (n: number) => void; active?: number | null }) {
  // A footnote is glued to the word before it and the punctuation after it, so it never wraps alone: word¹,².
  const parts = text.replace(/\s+(?=\[\d+\])/g, "").split(/(\*\*[^*]+\*\*|(?:\[\d+\])+)/g).filter(Boolean);
  const out: ReactNode[] = [];
  parts.forEach((t, i) => {
    if (t.startsWith("**")) { out.push(<b key={i} className="font-semibold text-ink">{t.slice(2, -2)}</b>); return; }
    if (!/^\[\d+\]/.test(t)) { out.push(t); return; }
    const ns = [...t.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
    const prev = out[out.length - 1];
    let lead: ReactNode = null;
    if (typeof prev === "string") { const m = prev.match(/^([\s\S]*?)(\S+)$/); if (m) { out[out.length - 1] = m[1]; lead = m[2]; } }
    else if (prev != null) { out.pop(); lead = prev; }
    let tail = "";
    const next = parts[i + 1];
    if (next && !next.startsWith("**")) { const m = next.match(/^[.,;:)]+/); if (m) { tail = m[0]; parts[i + 1] = next.slice(tail.length); } }
    out.push(<span key={i} className="whitespace-nowrap">{lead}{ns.map((n, j) => <Fragment key={j}>{j > 0 && <span className="relative -top-[0.5em] text-[10px] text-rust/60">,</span>}<Cite n={n} onCite={onCite} on={active === n} /></Fragment>)}{tail}</span>);
  });
  return <>{out.map((x, i) => typeof x === "string" ? <Fragment key={`t${i}`}>{x}</Fragment> : x)}</>;
}
export function Cite({ n, onCite, on }: { n: number; onCite?: (n: number) => void; on?: boolean }) {
  return (
    <button type="button" onClick={() => onCite?.(n)} aria-label={`Source ${n}`}
      className={cx("relative -top-[0.5em] inline-block cursor-pointer rounded-[4px] px-[1.5px] align-baseline text-[10px] leading-none font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-rust/50",
        on ? "bg-rust py-[1px] text-white" : "text-rust hover:bg-rust-50")}>{n}</button>
  );
}
/** Strips the markup for plain contexts (exports, aria). */
export const plain = (t: MemoText) => t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\s*\[\d+\]/g, "").trim();

/* ---------- companion rail ---------- */
const CARD = "rounded-[16px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03),0_12px_32px_-22px_rgba(9,9,11,.14)]";

function SourceMark({ s }: { s: MemoSourceDoc }) {
  if (s.provider) return <ToolLogo id={s.provider} size={26} />;
  const I = srcIcon[s.kind];
  return <span className="grid size-[26px] shrink-0 place-items-center rounded-[7px] border border-zinc-200 bg-white shadow-[0_1px_1px_rgba(9,9,11,.05)]"><I className="size-[13px] text-zinc-500" strokeWidth={1.75} /></span>;
}

function SourceRow({ s, open, flash, flashKey, onToggle }: { s: MemoSourceDoc; open: boolean; flash: boolean; flashKey: number; onToggle: () => void }) {
  const [a, b] = s.quote.split(s.highlight);
  const r = useReducedMotion();
  return (
    <li id={`memo-src-${s.n}`} className={cx("relative scroll-mt-24 rounded-[12px] transition-[background-color,box-shadow] duration-700", flash ? "bg-rust-50/60 ring-1 ring-rust-100" : open ? "bg-zinc-50/80" : "")}>
      {/* Footnote landed here: one soft sienna pulse (fade only with reduced motion). */}
      <AnimatePresence>{flash && <motion.span key={flashKey} aria-hidden className="pointer-events-none absolute inset-0 rounded-[12px] ring-2 ring-rust/35"
        initial={{ opacity: 0, scale: r ? 1 : 0.97 }} animate={{ opacity: [0, 1, 0.35], scale: r ? 1 : [0.97, 1.012, 1] }} exit={{ opacity: 0 }} transition={{ duration: r ? 0.2 : 0.9, ease: [0.22, 1, 0.36, 1], times: [0, 0.35, 1] }} />}</AnimatePresence>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full cursor-pointer items-center gap-2.5 rounded-[12px] px-2 py-1.5 text-left hover:bg-zinc-50">
        <span className={cx("tnum w-4 shrink-0 text-right text-[11px] font-semibold", flash ? "text-rust" : "text-zinc-400")}>{s.n}</span>
        <SourceMark s={s} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-ink">{s.label}</span>
          <span className="block truncate text-[11px] text-zinc-500">{s.where}{s.asOf && <> · {s.asOf}</>}</span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-2 pt-0.5 pb-2.5 pl-[50px]">
              <p className="border-l-2 border-zinc-200 pl-2.5 text-[12px] leading-[18px] text-zinc-700">“{a}<mark className="rounded-[3px] bg-[#fdf0c4] px-0.5 text-ink">{s.highlight}</mark>{b}”</p>
              <Link href={s.href} className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-ink hover:underline">Open {s.kind === "crust" || s.kind === "web" ? "evidence" : "file"}<ArrowUpRight className="size-3" /></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function ActionRow({ a, last }: { a: MemoAction; last: boolean }) {
  const r = useReducedMotion();
  return (
    <motion.li layout={r ? false : "position"} initial={r ? { opacity: 0 } : { opacity: 0, x: 14, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }} transition={{ duration: r ? 0.15 : 0.36, ease: [0.22, 1, 0.36, 1] }} className="relative flex gap-3 pb-3.5 last:pb-0">
      {!last && <span aria-hidden className="absolute top-6 bottom-0 left-[10.5px] w-px bg-zinc-200" />}
      {a.by === "person" ? <Avatar i={a.who} size={22} tone="ink" /> : (
        <span className={cx("grid size-[22px] shrink-0 place-items-center rounded-full ring-2 ring-white", a.tone === "rust" ? "bg-rust-50 text-rust" : "bg-zinc-100 text-zinc-500")}><Sparkles className="size-3" strokeWidth={2} /></span>
      )}
      <div className="min-w-0 flex-1 pt-px">
        <div className="flex items-baseline gap-2"><span className="min-w-0 flex-1 text-[12.5px] leading-[17px] text-ink">{a.label}</span><span className="tnum shrink-0 text-[10.5px] text-zinc-400">{a.at}</span></div>
        {a.detail && <div className={cx("mt-0.5 text-[11.5px]", a.tone === "rust" ? "text-rust" : "text-zinc-500")}>{a.by === "agent" ? `${a.who} · ` : ""}{a.detail}</div>}
      </div>
    </motion.li>
  );
}

export function MemoCompanion({ doc, override, onOverride, openSrc, onOpenSrc, flashSrc, flashKey = 0, actions }: {
  doc: MemoDoc; override: boolean; onOverride: (on: boolean) => void;
  openSrc: number | null; onOpenSrc: (n: number | null) => void; flashSrc: number | null; flashKey?: number;
  actions: MemoAction[];
}) {
  const o = doc.override, cur = override ? o.analyst : o.agent;
  const rm = useReducedMotion();
  return (
    <div className="space-y-3 px-5 pt-6 pb-10">
      <div className="flex items-baseline justify-between px-1"><h2 className="serif text-[22px] leading-none">Memo companion</h2><span className="tnum text-[11.5px] text-zinc-500">{doc.sources.length} sources</span></div>
      <section className={cx(CARD, "p-4")} aria-label={o.label}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1"><div className="text-[13px] font-medium">{o.label}</div><div className="mt-0.5 text-[11.5px] leading-snug text-zinc-500">{o.hint}</div></div>
          <Toggle on={override} onChange={onOverride} label={o.label} />
        </div>
        {/* The note card morphs between the agent's and your rating: tint crossfades, content swaps in place. */}
        <motion.div layout={rm ? false : true} initial={false} animate={override ? { backgroundColor: "#fafafa", color: "#3f3f46", boxShadow: "inset 0 0 0 1px rgba(228,228,231,.7)" } : { backgroundColor: "#fbf3ee", color: "#9c440f", boxShadow: "inset 0 0 0 1px #f5e3d7" }}
          transition={{ duration: rm ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }} className="mt-3 overflow-hidden rounded-[10px] px-2.5 py-2 text-[11.5px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={String(override)} initial={rm ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={rm ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }} transition={{ duration: rm ? 0.1 : 0.18 }} className="flex items-center gap-2">
              {override ? <Avatar i={o.by.initials} size={18} tone="ink" /> : <Sparkles className="size-3.5 shrink-0" />}
              <span className="min-w-0 flex-1 leading-snug">{plain(cur.note)}</span>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </section>
      <section className={cx(CARD, "px-2 pt-3.5 pb-2")} aria-label="Sources cited">
        <div className="flex items-center justify-between px-2 pb-1.5"><span className="text-[13px] font-medium">Sources cited</span><span className="text-[11px] text-zinc-400">Click to open</span></div>
        <ul className="space-y-px">{doc.sources.map((s) => <SourceRow key={s.n} s={s} open={openSrc === s.n} flash={flashSrc === s.n} flashKey={flashKey} onToggle={() => onOpenSrc(openSrc === s.n ? null : s.n)} />)}</ul>
      </section>
      <section className={cx(CARD, "p-4")} aria-label="Agent actions">
        <div className="flex items-center justify-between pb-3"><span className="text-[13px] font-medium">Agent actions</span><span className="tnum text-[11px] text-zinc-400">{actions.length} logged</span></div>
        <ol><AnimatePresence initial={false}>{actions.map((a, i) => <ActionRow key={a.id} a={a} last={i === actions.length - 1} />)}</AnimatePresence></ol>
      </section>
    </div>
  );
}

/* ---------- share ---------- */
export function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const c = useRef(close); c.current = close;
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) c.current(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") c.current(); };
    document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return ref;
}

export function SharePopover({ share, trigger, defaultOpen = false }: { share: MemoDoc["share"]; trigger: (open: boolean, toggle: () => void) => ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const rm = useReducedMotion();
  const ref = useOutside(open, () => setOpen(false));
  const copy = async () => {
    try { await navigator.clipboard?.writeText(`https://${share.url}`); } catch { /* clipboard blocked: still show the link selected */ }
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div ref={ref} className="relative">
      {trigger(open, () => setOpen((o) => !o))}
      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label="Share memo" initial={rm ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={rm ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: rm ? 0.12 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute top-full right-0 z-40 mt-2 w-[340px] origin-top-right rounded-[16px] border border-zinc-200 bg-white p-4 text-left shadow-[0_16px_40px_-12px_rgba(9,9,11,.28),0_2px_6px_rgba(9,9,11,.06)]">
            <div className="text-[13.5px] font-medium">Share memo</div>
            <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-zinc-50 py-1 pr-1 pl-3 ring-1 ring-zinc-200/80">
              <Link2 className="size-3.5 shrink-0 text-zinc-400" />
              <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-zinc-700">{share.url}</span>
              <button type="button" onClick={copy} className={cx("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-medium transition-colors", copied ? "bg-ok-50 text-ok" : "bg-ink text-white hover:bg-zinc-800")}>{copied ? <><Check className="size-3.5" />Copied</> : <><Copy className="size-3.5" />Copy link</>}</button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11.5px] text-zinc-500"><Lock className="size-3.5 shrink-0" />{share.access}</div>
            <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
              <span className="flex -space-x-1.5">{share.people.map((p) => <Avatar key={p.initials} i={p.initials} size={24} tone={p.initials === share.people[0].initials ? "ink" : "sand"} />)}</span>
              <span className="min-w-0 truncate text-[12px] text-zinc-600">{share.people.map((p) => p.name.split(" ")[0]).join(", ")} have access</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Slack IC vote preview ---------- */
export function VoteSheet({ vote, queued, onQueue, onClose }: { vote: MemoDoc["vote"]; queued: boolean; onQueue: () => void; onClose: () => void }) {
  const [hint, setHint] = useState<string | null>(null);
  const m: SlackMessage = queued ? { ...vote.message, resolved: { icon: "clock", text: vote.queued, tone: "ok" } } : vote.message;
  return (
    <ModalFrame label="Run IC vote in Slack" onClose={onClose} width={600}>
      <div className="flex items-center gap-3 px-6 pt-5">
        <ToolLogo id="slack" size={34} />
        <div className="min-w-0"><div className="text-[15px] font-medium">Run IC vote in Slack</div><div className="text-[12px] text-zinc-500">What Deal Desk will post to {vote.message.channel} when voting opens</div></div>
        <ModalClose className="ml-auto" onClick={onClose} />
      </div>
      <div className="mx-6 mt-5"><SlackFrame channel={vote.message.channel.replace("#", "")}><SlackCard m={m} onAction={() => setHint("Partners vote here once the message posts.")} /></SlackFrame></div>
      <div className="flex min-h-5 items-center px-6 pt-2 text-[11.5px] text-zinc-500" aria-live="polite">{hint}</div>
      <div className="flex items-center gap-2 px-6 pt-2 pb-5">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] text-zinc-500"><Eye className="size-3.5 shrink-0" />{vote.note}</span>
        <button type="button" disabled title={vote.note} className="ml-auto inline-flex h-9 cursor-not-allowed items-center rounded-full px-4 text-[13px] font-medium text-zinc-400 ring-1 ring-zinc-200">Send now</button>
        {queued
          ? <button type="button" data-autofocus onClick={onClose} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-white hover:bg-zinc-800"><Check className="size-3.5" />Done</button>
          : <button type="button" data-autofocus onClick={onQueue} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-white hover:bg-zinc-800"><Clock className="size-3.5" />{vote.queue}</button>}
      </div>
    </ModalFrame>
  );
}
