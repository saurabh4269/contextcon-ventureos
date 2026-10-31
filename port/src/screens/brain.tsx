"use client";
/**
 * v4 · Firm brain in Today's language. Left column: memory categories (each filters real memories), the warm
 * "Use in Claude / ChatGPT" card (opens the MCP setup sheet), agent reads and the access log. Main: serif title with
 * one hero number, then either the overview (growth, thesis, proposals that land in the thesis with undo, outcomes,
 * priors, pass reasons, anti-portfolio, recent memories) or one category's memories.
 */
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Braces, Check, ChevronRight, Copy, Download, FileText, Pencil, Plug, Sparkles, X } from "lucide-react";
import { useReducedMotion, Rise, Count } from "../components/motion";
import { Page, TopBar } from "../components/shell";
import { Src, Undo, cx, CompanyLogo, Avatar, CARD } from "../components/ui";
import { StagePill } from "../components/dealbits";
import { MiniBars } from "../components/charts";
import { MemoryGrowth, Composition, PassReasons, OutcomeScore, PriorViz } from "../components/brainviz";
import { Sheet, PillBtn, Popover, downloadText } from "../components/sheet";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/states";
import type { BrainData, Memory, ScreenStatus, ShellData, ThesisLine, ThesisProposal } from "../types";

export type ProposalDecision = "approve" | "reject";
export interface BrainScreenProps extends ScreenStatus {
  shell: ShellData;
  data: BrainData;
  onSelectKind?: (kindId: string) => void;
  onEditMemory?: (memoryId: string) => void;
  onUndoLearned?: (id: string) => void;
  /** POST /api/firm/thesis-proposals/[id] {decision}. Optimistic; reject the promise to roll back. */
  onDecideProposal?: (id: string, decision: ProposalDecision) => void | Promise<void>;
  onUndoDecision?: (id: string) => void;
  onExport?: () => void;
}
const nf = (n: number) => n.toLocaleString("en-US");
const H = ({ children, right, sub }: { children: ReactNode; right?: ReactNode; sub?: ReactNode }) => (
  <div className="flex items-start gap-3"><span className="min-w-0"><span className="block text-[14px] font-medium">{children}</span>{sub && <span className="block truncate text-[12px] text-zinc-500">{sub}</span>}</span>{right && <span className="ml-auto shrink-0">{right}</span>}</div>
);

/* ───────── Thesis + proposals ───────── */
function ThesisCard({ lines }: { lines: ThesisLine[] }) {
  const red = useReducedMotion();
  const live = lines.find((l) => l.state === "updating" || l.state === "learned");
  return (
    <section className={cx(CARD, "overflow-hidden")}>
      <div className="flex items-center gap-2 px-5 pt-5 pb-3"><H sub="What every memo and agent is checked against">Firm thesis</H>{live && <span className="ml-auto flex items-center gap-1.5 text-[12px] text-zinc-500"><span className={cx("size-1.5 rounded-full", live.state === "learned" ? "bg-ok" : "bg-rust animate-pulse")} />{live.state === "learned" ? `Updated · ${lines.filter((l) => l.state === "learned").length} line${lines.filter((l) => l.state === "learned").length > 1 ? "s" : ""}` : "Updating"}</span>}</div>
      <dl className="divide-y divide-zinc-100 border-t border-zinc-100">
        {lines.map((l) => (
          <div key={l.id} className={cx("relative grid grid-cols-[120px_minmax(0,1fr)_auto] items-start gap-4 px-5 py-3 text-[13px] transition-colors", l.state === "updating" && "bg-rust-50/40", l.state === "learned" && "bg-ok-50/50")}>
            {l.state && l.state !== "steady" && <motion.span layoutId={`edge-${l.id}`} className={cx("absolute inset-y-0 left-0 w-[3px]", l.state === "updating" ? "bg-rust" : "bg-ok")} />}
            <dt className="pt-px text-[12px] text-zinc-500">{l.field}</dt>
            <dd className="min-w-0 leading-snug">
              {(l.state === "updating" || l.state === "learned") && l.before && <div className="mb-0.5 text-[12px] text-zinc-400 line-through decoration-rust/50">{l.before}</div>}
              <span className="relative">
                {l.state === "updating" && <motion.span aria-hidden initial={red ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }} style={{ originX: 0 }} className="absolute -inset-x-1 inset-y-0 rounded-[3px] bg-[#f6e3d5]" />}
                <span className={cx("relative", l.state && l.state !== "steady" && "font-medium text-ink")}>{l.text}</span>
              </span>
            </dd>
            <span className="pt-px">{l.learnedFrom && l.state === "learned" ? <motion.span initial={red ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-white"><Sparkles className="size-3 text-[#f0b48a]" />{l.learnedFrom}</motion.span> : l.state === "updating" ? <span className="text-[11.5px] text-rust">applying…</span> : null}</span>
          </div>
        ))}
      </dl>
    </section>
  );
}
function ProposalRow({ p, primary, done, onDecide, onUndo }: { p: ThesisProposal; primary?: boolean; done?: ProposalDecision; onDecide: (d: ProposalDecision) => void; onUndo: () => void }) {
  return (
    <div className="grid grid-cols-[170px_minmax(0,1fr)_176px] items-center gap-5 border-t border-zinc-100 px-5 py-4">
      <div className="min-w-0 text-[13px] leading-snug"><div className="text-[12px] text-zinc-500">{p.field}</div><div className="mt-0.5 text-[12px] text-zinc-400 line-through decoration-zinc-300">{p.from}</div><div className="font-medium text-ink">{p.to}</div></div>
      <div className="min-w-0 text-[13px] leading-snug"><div className="text-zinc-800">{p.why}</div><div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-zinc-500"><Sparkles className="size-3 text-rust/70" />{p.proposedBy}<Src k="db">{p.evidence}</Src></div></div>
      <div className="flex justify-end">
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.span key="done" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className={cx("flex items-center gap-2.5 text-[12.5px] font-medium whitespace-nowrap", done === "approve" ? "text-ok" : "text-zinc-500")}>
              {done === "approve" ? <><Check className="size-3.5" />Thesis updated</> : <><X className="size-3.5" />Dismissed</>}
              <Undo onClick={onUndo} />
            </motion.span>
          ) : (
            <motion.span key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
              <PillBtn size="sm" onClick={() => onDecide("reject")}>Reject</PillBtn><PillBtn size="sm" primary={primary} onClick={() => onDecide("approve")}>Approve</PillBtn>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────── Memories ───────── */
function MemoryRow({ m, text, onSave, onEdit }: { m: Memory; text: string; onSave: (t: string) => void; onEdit?: () => void }) {
  const [editing, setEditing] = useState(false), [v, setV] = useState(text);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const save = () => { onSave(v.trim() || text); setEditing(false); };
  return (
    <li className="group/mem grid min-h-[60px] grid-cols-[minmax(0,1fr)_auto_64px_auto_28px] items-center gap-3 border-t border-zinc-100 px-5 py-2 text-[13px] transition-colors first:border-0 hover:bg-[#f8f7f5]">
      {editing
        ? <input ref={ref} value={v} aria-label="Memory text" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setV(text); setEditing(false); } }} onBlur={save} className="h-9 min-w-0 rounded-[10px] bg-white px-3 text-[13px] ring-1 ring-rust/40 outline-none" />
        : <span className="min-w-0"><span className="block truncate text-zinc-800" title={text}>{text}</span>{m.at && <span className="block text-[11.5px] text-zinc-400">{m.at}{text !== m.text && " · edited"}</span>}</span>}
      <StagePill>{m.kind}</StagePill>
      <span className="tnum truncate text-right text-[12px] text-zinc-500">{m.usage}</span>
      <Src k={m.source.kind}>{m.source.label}</Src>
      <button type="button" aria-label={editing ? "Save memory" : "Edit memory"} onMouseDown={(e) => editing && e.preventDefault()} onClick={() => { if (editing) save(); else { setEditing(true); onEdit?.(); } }} className={cx("grid size-7 place-items-center rounded-full text-zinc-400 transition-all hover:bg-white hover:text-ink hover:shadow-[0_0_0_1px_rgba(9,9,11,.08)]", editing ? "opacity-100 text-rust" : "opacity-0 group-hover/mem:opacity-100 focus-visible:opacity-100")}>{editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}</button>
    </li>
  );
}
function MemoryList({ items, edits, onSave, onEdit, title, sub, right }: { items: Memory[]; edits: Record<string, string>; onSave: (id: string, t: string) => void; onEdit?: (id: string) => void; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <section className={cx(CARD, "overflow-hidden")}>
      <div className="px-5 pt-5 pb-3"><H sub={sub} right={right}>{title}</H></div>
      <ul className="border-t border-zinc-100">{items.map((m) => <MemoryRow key={m.id} m={m} text={edits[m.id] ?? m.text} onSave={(t) => onSave(m.id, t)} onEdit={() => onEdit?.(m.id)} />)}</ul>
    </section>
  );
}

/* ───────── MCP setup sheet ───────── */
function McpSheet({ mcp, onClose }: { mcp: BrainData["mcp"]; onClose: () => void }) {
  const clients = mcp.setup?.clients ?? [];
  const [tab, setTab] = useState(clients[0]?.id ?? ""), [copied, setCopied] = useState(false);
  const url = `https://${mcp.url}`, c = clients.find((x) => x.id === tab);
  const copy = async () => { try { await navigator.clipboard?.writeText(url); } catch { /* clipboard blocked: still show the URL selected */ } setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return (
    <Sheet title="Use the firm brain in Claude or ChatGPT" sub={mcp.note} onClose={onClose} w={520}
      eyebrow={<span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-rust"><Plug className="size-3.5" />MCP connector</span>}
      foot={<><span className="text-[12px] text-zinc-500">Nothing leaves Deal Desk until a partner signs in.</span><span className="ml-auto flex gap-2"><PillBtn size="sm" onClick={onClose}>Done</PillBtn><PillBtn size="sm" primary icon={copied ? <Check /> : <Copy />} onClick={copy}>{copied ? "Copied" : "Copy URL"}</PillBtn></span></>}>
      <div className="space-y-6">
        <section>
          <h3 className="text-[12px] font-medium text-zinc-500">Server URL</h3>
          <div className="mt-2 flex h-11 items-center gap-2 rounded-full bg-[#fafaf9] pr-1.5 pl-4 ring-1 ring-zinc-200/80">
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-zinc-700 select-all">{url}</span>
            <button type="button" onClick={copy} className={cx("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors", copied ? "bg-ok-50 text-ok" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:text-ink")}>{copied ? <><Check className="size-3.5" />Copied</> : <><Copy className="size-3.5" />Copy</>}</button>
          </div>
        </section>
        {clients.length > 0 && <section>
          <div role="tablist" aria-label="Client" className="flex gap-1.5">{clients.map((x) => <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className={cx("inline-flex h-9 items-center rounded-full px-4 text-[13px] transition-colors", tab === x.id ? "bg-ink text-white" : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200/70 hover:bg-white hover:text-ink")}>{x.label}</button>)}</div>
          <ol className="mt-3 space-y-2">{c?.steps.map((s, i) => <li key={s} className="flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-[13px] ring-1 ring-zinc-200/70"><span className="tnum grid size-6 shrink-0 place-items-center rounded-full bg-[#fbf6f0] text-[11.5px] font-semibold text-rust ring-1 ring-[#f1e2d2]">{i + 1}</span>{s}</li>)}</ol>
        </section>}
        {mcp.setup && <section>
          <h3 className="text-[12px] font-medium text-zinc-500">What it can read</h3>
          <ul className="mt-2 space-y-1.5">{mcp.setup.scopes.map((s) => <li key={s} className="flex items-center gap-2 text-[13px] text-zinc-700"><span className="grid size-[18px] place-items-center rounded-full bg-ink text-white"><Check className="size-2.5" strokeWidth={3} /></span>{s}</li>)}</ul>
        </section>}
        {mcp.setup && <section>
          <h3 className="text-[12px] font-medium text-zinc-500">Connected</h3>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-[14px] ring-1 ring-zinc-200/70">{mcp.setup.people.map((p) => <li key={p.name} className="flex h-12 items-center gap-3 px-3.5 text-[13px]"><Avatar i={p.initials} size={26} tone="sand" /><span className="flex-1">{p.name}</span><StagePill tone="ok">{p.client}</StagePill></li>)}</ul>
        </section>}
      </div>
    </Sheet>
  );
}

/* ───────── Left column ───────── */
function KindNav({ d, kind, onKind }: { d: BrainData; kind: string; onKind: (k: string) => void }) {
  return (
    <section className={cx(CARD, "p-3")}>
      <div className="px-2 pt-1.5 pb-2"><H sub={d.since}>Memories</H></div>
      <nav aria-label="Memory categories" className="space-y-0.5">
        {d.kinds.map((k) => (
          <button key={k.id} type="button" aria-current={kind === k.id ? "page" : undefined} onClick={() => onKind(k.id)} className={cx("flex h-10 w-full items-center gap-2 rounded-full px-3.5 text-left text-[13px] transition-colors", kind === k.id ? "bg-ink text-white shadow-[0_1px_2px_rgba(9,9,11,.2)]" : "text-zinc-700 hover:bg-zinc-50 hover:text-ink")}>
            <span className="truncate">{k.label}</span><span className={cx("tnum ml-auto text-[11.5px]", kind === k.id ? "text-zinc-400" : "text-zinc-400")}>{k.id === "all" ? nf(d.total) : k.count}</span>
          </button>
        ))}
      </nav>
    </section>
  );
}
function McpCard({ mcp, onOpen }: { mcp: BrainData["mcp"]; onOpen: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[20px] border border-[#f1e2d2] bg-[#fbf6f0] p-5 shadow-[0_1px_2px_rgba(120,60,20,.04),0_16px_36px_-20px_rgba(156,68,15,.28)]">
      <span aria-hidden className="pointer-events-none absolute -top-16 -right-14 size-48 rounded-full bg-[radial-gradient(circle,rgba(226,140,80,.35),rgba(226,140,80,0)_70%)]" />
      <div className="relative flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#d27a3e,#9c440f_70%)] text-white shadow-[0_6px_14px_-6px_rgba(156,68,15,.7),inset_0_1px_0_rgba(255,255,255,.3)]"><Plug className="size-4" strokeWidth={1.75} /></span><span className="text-[14px] font-medium">Use in Claude / ChatGPT</span></div>
      <p className="serif relative mt-3 text-[20px] leading-[1.2] tracking-[-0.01em]">Ask the firm’s memory from the chat you already use.</p>
      <div className="relative mt-4 flex items-center gap-2">
        {mcp.setup && <span className="flex -space-x-1">{mcp.setup.people.map((p) => <span key={p.initials} title={p.name} className="inline-flex rounded-full ring-2 ring-[#fbf6f0]"><Avatar i={p.initials} size={26} tone="sand" /></span>)}</span>}
        <span className="truncate text-[12px] text-zinc-600">{mcp.note}</span>
      </div>
      <PillBtn primary onClick={onOpen} icon={<ArrowUpRight />} className="relative mt-4 w-full">Set up connector</PillBtn>
    </section>
  );
}
function UsageCard({ u }: { u: NonNullable<BrainData["usage"]> }) {
  return (
    <section className={cx(CARD, "p-5")}>
      <H sub="Memories read by agents · 7 days" right={<span className="tnum inline-flex h-6 items-center rounded-full bg-ok-50 px-2 text-[11.5px] font-medium text-ok">{u.delta}</span>}>Read by agents</H>
      <div className="mt-3 flex items-end justify-between gap-3"><div><div className="numeral text-[36px] leading-[.9]"><Count to={u.reads.reduce((a, b) => a + b, 0)} /></div><div className="tnum mt-1.5 text-[12px] text-zinc-500">{u.reads[u.reads.length - 1]} today</div></div><MiniBars d={u.reads} w={112} h={40} hl={u.reads.length - 1} /></div>
      <div className="mt-4 grid grid-cols-2 divide-x divide-zinc-100 border-t border-zinc-100 pt-3 text-[12px]">
        <div><div className="text-zinc-500">Cited in memos</div><div className="tnum mt-0.5 text-[15px] font-medium">{u.cited}<span className="ml-1 text-[11.5px] font-normal text-zinc-400">this month</span></div></div>
        <div className="pl-4"><div className="text-zinc-500">Needs review</div><div className="tnum mt-0.5 text-[15px] font-medium text-rust">{u.stale}<span className="ml-1 text-[11.5px] font-normal text-zinc-400">stale</span></div></div>
      </div>
    </section>
  );
}
function AccessLog({ rows, onKind }: { rows: BrainData["accessLog"]; onKind: (k: string) => void }) {
  return (
    <section className={cx(CARD, "p-5")}>
      <H sub="Who read what · newest first">Access log</H>
      <ul className="mt-2 -mx-2">
        {rows.map((a) => {
          const body = <><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{a.who}</span><span className="block truncate text-[12px] text-zinc-500">{a.what}</span></span><span className="tnum shrink-0 text-[11.5px] text-zinc-400">{a.at}</span><ChevronRight className="size-3.5 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" /></>;
          const cls = "group flex h-12 w-full items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-zinc-50";
          return <li key={a.id}>{a.href ? <Link href={a.href} className={cls}>{body}</Link> : <button type="button" onClick={() => a.kindId && onKind(a.kindId)} className={cls}>{body}</button>}</li>;
        })}
      </ul>
    </section>
  );
}

/* ───────── Export ───────── */
function exportBrain(d: BrainData, lines: ThesisLine[], edits: Record<string, string>, fmt: "md" | "json") {
  const mems = d.memories.map((m) => ({ ...m, text: edits[m.id] ?? m.text }));
  const name = `${d.exportName ?? "firm-brain"}.${fmt}`;
  if (fmt === "json") return downloadText(name, JSON.stringify({ scope: d.scope, thesis: lines.map(({ field, text }) => ({ field, text })), memories: mems, outcomes: d.outcomes, priors: d.priors }, null, 2), "application/json");
  const md = [`# Firm brain${d.scope ? ` · ${d.scope}` : ""}`, "", "## Thesis", ...lines.map((l) => `- **${l.field}:** ${l.text}`), "",
    ...d.kinds.filter((k) => k.id !== "all").flatMap((k) => { const ms = mems.filter((m) => m.kindId === k.id); return ms.length ? [`## ${k.label}`, ...ms.map((m) => `- ${m.text} _(${m.source.label})_`), ""] : []; }),
    "## Outcomes", ...d.outcomes.map((o) => `- ${o.date} · ${o.company} ${o.decision}: ${o.result}`)].join("\n");
  downloadText(name, md, "text/markdown");
}

export function BrainScreen(p: BrainScreenProps) {
  const { data: d, status = "ready" } = p;
  const [kind, setKind] = useState(d.kinds.find((k) => k.selected)?.id ?? "all");
  const [decided, setDecided] = useState<Record<string, ProposalDecision>>({});
  const [landing, setLanding] = useState<Record<string, boolean>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [forgot, setForgot] = useState(false), [mcpOpen, setMcpOpen] = useState(false), [saved, setSaved] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const onKind = (k: string) => { setKind(k); p.onSelectKind?.(k); mainRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); };
  const decide = async (x: ThesisProposal, dec: ProposalDecision) => {
    setDecided((s) => ({ ...s, [x.id]: dec }));
    if (dec === "approve" && x.lineId) { setLanding((s) => ({ ...s, [x.id]: true })); setTimeout(() => setLanding((s) => ({ ...s, [x.id]: false })), 1100); }
    try { await p.onDecideProposal?.(x.id, dec); } catch { setDecided((s) => { const n = { ...s }; delete n[x.id]; return n; }); }
  };
  const undoDecision = (id: string) => { setDecided((s) => { const n = { ...s }; delete n[id]; return n; }); p.onUndoDecision?.(id); };
  // Approved proposals land in the thesis: struck old wording, new wording highlighted, then "Approved just now".
  const lines: ThesisLine[] = (d.thesis ?? []).map((l) => {
    const x = d.proposals.find((q) => q.lineId === l.id && decided[q.id] === "approve");
    return x?.next ? { ...l, before: l.text, text: x.next, state: landing[x.id] ? "updating" : "learned", learnedFrom: "Approved just now" } : l;
  });
  const waiting = d.proposals.filter((x) => !decided[x.id]).length;
  const k = d.kinds.find((x) => x.id === kind) ?? d.kinds[0];
  const list = kind === "all" ? d.memories : d.memories.filter((m) => m.kindId === kind);
  const kCount = Number((k?.count ?? "0").replace(/,/g, "")) || list.length;
  const doExport = (fmt: "md" | "json") => { exportBrain(d, lines, edits, fmt); p.onExport?.(); setSaved(fmt === "md" ? "Markdown saved" : "JSON saved"); setTimeout(() => setSaved(null), 2400); };
  const exportBtn = (
    <span className="flex items-center gap-2">
      <AnimatePresence>{saved && <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} role="status" className="flex items-center gap-1 text-[11.5px] text-ok"><Check className="size-3.5" />{saved}</motion.span>}</AnimatePresence>
      <Popover icon={<Download />} label="Export memories" w={250}>{(close) => <>
        <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-500">{d.exportNote}</div>
        <button type="button" onClick={() => { doExport("md"); close(); }} className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] hover:bg-zinc-50"><FileText className="size-3.5 text-zinc-400" />Markdown<span className="ml-auto text-[11.5px] text-zinc-400">.md</span></button>
        <button type="button" onClick={() => { doExport("json"); close(); }} className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] hover:bg-zinc-50"><Braces className="size-3.5 text-zinc-400" />JSON<span className="ml-auto text-[11.5px] text-zinc-400">.json</span></button>
      </>}</Popover>
    </span>
  );
  const top = <TopBar crumbs={[{ label: "Firm brain" }]} ctx="Firm brain" right={status === "ready" ? exportBtn : undefined} lead={<span className="flex items-baseline gap-2"><span className="text-[13px] font-medium text-ink">Firm brain</span>{d.scope && <><span className="text-zinc-300">/</span><span className="truncate">{d.scope}</span></>}</span>} />;
  const saveEdit = (id: string, t: string) => setEdits((s) => ({ ...s, [id]: t }));

  return (
    <Page active="brain" shell={p.shell} top={top} overlay={mcpOpen ? <McpSheet mcp={d.mcp} onClose={() => setMcpOpen(false)} /> : undefined}>
      {status === "loading" ? <ScreenSkeleton cols="grid-cols-[300px_1fr]" /> : status === "error" ? <ErrorState message={p.error} onRetry={p.onRetry} /> : status === "empty" ? <EmptyState title="Nothing learned yet" body="Memories appear after your first passes, memos and IC decisions. Connect Gmail and your IC notes to start." /> : (
      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[300px_minmax(0,1fr)] items-start gap-5 px-7 pt-7 pb-16">
        <div className="flex flex-col gap-4">
          <KindNav d={d} kind={kind} onKind={onKind} />
          <McpCard mcp={d.mcp} onOpen={() => setMcpOpen(true)} />
          {d.usage && <UsageCard u={d.usage} />}
          <AccessLog rows={d.accessLog} onKind={onKind} />
        </div>

        <div ref={mainRef} className="flex min-w-0 scroll-mt-20 flex-col gap-4">
          <div className="flex items-end justify-between px-1 pt-1 pb-2">
            <div><h1 className="serif text-[36px] leading-none tracking-[-0.02em]">Firm brain</h1><p className="mt-2.5 text-[14px] text-zinc-500">What Northbeam has learned from every deal, pass and IC since 2019.</p></div>
            <div className="text-right"><span className="numeral block text-[52px] leading-[.85]"><Count to={d.total} /></span><span className="mt-1.5 flex items-center justify-end gap-1.5 text-[12px] text-zinc-500"><Sparkles className="size-3.5" />memories</span><span className="tnum mt-1 block text-[11.5px] font-medium text-ok">+{d.weekDelta} this week</span></div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
          {kind === "all" ? (
            <motion.div key="all" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col gap-4">
              <Rise i={0}>
                <section className={cx(CARD, "overflow-hidden")}>
                  <div className="grid grid-cols-[210px_minmax(0,1fr)] gap-6 px-5 pt-5">
                    <div className="pb-4"><H sub={d.since}>Memory growth</H><div className="numeral mt-4 text-[40px] leading-[.9]">+{nf(d.total - d.trend[0])}</div><div className="mt-2 text-[12px] text-zinc-500">in {d.trend.length - 1} months · hover for monthly adds</div></div>
                    <div className="min-w-0"><MemoryGrowth trend={d.trend} labels={d.trendLabels} weekDelta={d.weekDelta} h={128} /></div>
                  </div>
                  <div className="border-t border-zinc-100 bg-zinc-50/50 px-5 py-4"><div className="mb-2.5 text-[12px] font-medium text-zinc-500">What it knows</div><Composition kinds={d.kinds} total={d.total} /></div>
                </section>
              </Rise>
              {lines.length > 0 && <Rise i={1}><ThesisCard lines={lines} /></Rise>}
              <Rise i={1}>
                <section className={cx(CARD, "overflow-hidden")}>
                  <div className="px-5 pt-5 pb-3"><H sub="Learned from outcomes · nothing changes until a partner approves" right={<StagePill tone={waiting ? "rust" : "ok"}>{waiting ? `${waiting} waiting` : "All decided"}</StagePill>}>Thesis proposals</H></div>
                  {d.proposals.length ? d.proposals.map((x, i) => <ProposalRow key={x.id} p={x} primary={i === 0} done={decided[x.id]} onDecide={(dec) => decide(x, dec)} onUndo={() => undoDecision(x.id)} />) : <div className="border-t border-zinc-100 px-5 py-6 text-[13px] text-zinc-500">No proposals. Deal Desk suggests thesis changes after 3+ outcomes point the same way.</div>}
                </section>
              </Rise>
              <Rise i={2} className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4">
                <section className={cx(CARD, "p-5")}>
                  <H sub="What happened after we decided">Outcomes</H>
                  <div className="mt-4 rounded-[14px] bg-[#fafaf9] px-3.5 py-3 ring-1 ring-zinc-200/60"><OutcomeScore outcomes={d.outcomes} /></div>
                  <ol className="relative mt-4 space-y-1 before:absolute before:top-4 before:bottom-4 before:left-[4.5px] before:w-px before:bg-zinc-200">
                    {d.outcomes.map((o) => (
                      <li key={o.id} className="relative grid h-9 grid-cols-[10px_52px_minmax(0,1fr)_auto] items-center gap-3 text-[13px]">
                        <span className={cx("size-[10px] rounded-full ring-2 ring-white", o.decision === "invested" ? "bg-ink" : "border-[1.5px] border-zinc-400 bg-white")} />
                        <span className="tnum text-[11.5px] text-zinc-400">{o.date}</span>
                        <span className="flex min-w-0 items-center gap-2"><CompanyLogo c={o.co ?? { name: o.company, initial: o.company[0] }} size={20} /><span className="truncate"><b className="font-medium">{o.company}</b> <span className="text-zinc-500">{o.decision}</span></span></span>
                        <span className={cx("tnum text-right text-[12.5px] whitespace-nowrap", o.tone === "ok" ? "text-ok" : o.tone === "rust" ? "text-rust" : o.tone === "warn" ? "text-warn" : "text-zinc-500")}>{o.result}</span>
                      </li>
                    ))}
                  </ol>
                </section>
                <section className={cx(CARD, "p-5")}>
                  <H sub="Used in every memo">Priors</H>
                  <div className="mt-3 divide-y divide-zinc-100">
                    {d.priors.map((r) => <div key={r.label} className="py-3 first:pt-1 last:pb-0"><div className="flex items-baseline gap-2 text-[13px]"><span className="text-zinc-700">{r.label}</span><span className="tnum ml-auto font-medium">{r.value}</span></div><div className="mt-0.5 text-[11.5px] text-zinc-400">{r.basis}</div><div className="mt-2"><PriorViz value={r.value} /></div></div>)}
                  </div>
                </section>
              </Rise>
              <Rise i={3} className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4">
                <button type="button" onClick={() => onKind("pass")} className={cx(CARD, "group p-5 text-left")}>
                  <H sub={`Based on ${d.passCount} passes`} right={<ArrowUpRight className="size-4 text-zinc-300 transition-colors group-hover:text-ink" />}>Pass reasons</H>
                  <div className="mt-3"><PassReasons reasons={d.passReasons} total={d.passCount} /></div>
                </button>
                <button type="button" onClick={() => onKind("anti")} className={cx(CARD, "group flex flex-col p-5 text-left")}>
                  <H sub="Passes worth revisiting" right={<ArrowUpRight className="size-4 text-zinc-300 transition-colors group-hover:text-ink" />}>Anti-portfolio</H>
                  <div className="mt-2 divide-y divide-zinc-100">{d.antiPortfolio.map((a) => <div key={a.company.id} className="flex h-12 items-center gap-3 text-[13px]"><CompanyLogo c={a.company} size={28} /><span className="font-medium">{a.company.name}</span><span className="tnum ml-auto text-[12.5px] text-rust">{a.outcome}</span></div>)}</div>
                </button>
              </Rise>
              {d.memories.length ? <Rise i={4}><MemoryList items={d.memories.slice(0, 6)} edits={edits} onSave={saveEdit} onEdit={p.onEditMemory} title="Recent memories" sub={`${Math.min(6, d.memories.length)} of ${nf(d.total)} · pick a category to see more`} /></Rise>
                : <EmptyState title="Nothing learned yet" body="Memories appear after your first passes, memos and IC decisions." />}
              <div className="flex items-center gap-2 px-1 text-[12.5px] text-zinc-500" role="status">
                <Sparkles className="size-3.5 text-rust/70" />Learned overnight:
                <span className={cx("text-ink", forgot && "text-zinc-400 line-through")}>{d.learnedOvernight.text}</span>
                {forgot ? <><span className="text-zinc-400">· forgotten</span><Undo label="Restore" onClick={() => setForgot(false)} /></> : <Undo onClick={() => { setForgot(true); p.onUndoLearned?.(d.learnedOvernight.id); }} />}
              </div>
            </motion.div>
          ) : (
            <motion.div key={kind} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col gap-4">
              {kind === "pass" && <section className={cx(CARD, "p-5")}><H sub={`Based on ${d.passCount} passes`}>Why we pass</H><div className="mt-3"><PassReasons reasons={d.passReasons} total={d.passCount} /></div></section>}
              {kind === "anti" && <section className={cx(CARD, "p-5")}><H sub="What happened after we passed">Anti-portfolio</H><div className="mt-2 grid grid-cols-3 gap-3">{d.antiPortfolio.map((a) => <div key={a.company.id} className="rounded-[14px] p-3.5 ring-1 ring-zinc-200/70"><div className="flex items-center gap-2.5"><CompanyLogo c={a.company} size={28} /><span className="text-[13px] font-medium">{a.company.name}</span></div><div className="tnum mt-3 text-[13px] text-rust">{a.outcome}</div></div>)}</div></section>}
              {list.length ? (
                <MemoryList items={list} edits={edits} onSave={saveEdit} onEdit={p.onEditMemory} title={k.label}
                  sub={`Showing ${list.length} of ${nf(kCount)} · most used first`}
                  right={<PillBtn size="sm" icon={<ArrowLeft />} onClick={() => onKind("all")}>All memories</PillBtn>} />
              ) : <section className={cx(CARD, "p-8 text-center")}><div className="serif text-[22px]">No {k.label.toLowerCase()} yet</div><p className="mt-1.5 text-[13px] text-zinc-500">They appear as partners pass, write memos and decide at IC.</p><PillBtn size="sm" className="mt-4" icon={<ArrowLeft />} onClick={() => onKind("all")}>All memories</PillBtn></section>}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
      )}
    </Page>
  );
}
