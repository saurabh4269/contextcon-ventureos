"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Download, Check, Scale, Share2, PenLine, Printer, Sparkles, Clock, AlertTriangle } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Page, TopBar } from "../components/shell";
import { Src, SrcPop, Btn, StepDot, Avatar, Severity, Waterfall, CapRange, cx, IconMenu } from "../components/ui";
import { Rise, useReducedMotion } from "../components/motion";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/states";
import { PriorsStrip } from "../components/priors";
import { RangeChart } from "../components/charts";
import { GrowthCard } from "../components/growthcard";
import { FitPill } from "../components/dealbits";
import { DeskMark, ToolLogo } from "../components/tools";
import { MemoCompanion, Prose, SharePopover, VoteSheet } from "../components/memocompanion";
import { ROUTES } from "../routes";
import type { FlagLevel, MemoAction, MemoBlock, MemoData, MemoDoc, MemoSection, ScreenStatus, ShellData, StepState } from "../types";

export interface MemoScreenProps extends ScreenStatus {
  shell: ShellData;
  data: MemoData;
  pinSources?: boolean;
  onOutline?: (sectionId: string) => void;
  onCite?: (n: number) => void;
  onExport?: (format: "docx" | "pdf" | "md") => void;
  /** v4 · screenshot frames: open the share popover / vote sheet, start in edit mode, or start with the vote queued. */
  initial?: { share?: boolean; vote?: boolean; queued?: boolean; edit?: string; override?: boolean; cite?: number };
}

const LEVEL: Record<FlagLevel, string> = { high: "High", mid: "Medium", low: "Low" };
const CARD = "rounded-[20px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03),0_12px_32px_-18px_rgba(9,9,11,.10)]";

/** Severity squares whose colour eases when a rating changes (Analyst override). */
const FLAG_HEX: Record<FlagLevel, string> = { high: "#9c440f", mid: "#d9a54a", low: "#d4d4d8" };
function FlagDots({ levels, size }: { levels: FlagLevel[]; size: number }) {
  const rm = useReducedMotion();
  return <span className="inline-flex gap-[3px]" aria-label={`${levels.length} red flags: ${levels.map((l) => LEVEL[l]).join(", ")}`}>{levels.map((l, i) => <motion.span key={i} initial={false} animate={{ backgroundColor: FLAG_HEX[l], scale: rm ? 1 : [1, 1.25, 1] }} transition={{ duration: rm ? 0 : 0.42, delay: rm ? 0 : 0.06 * i, ease: [0.22, 1, 0.36, 1] }} style={{ width: size, height: size }} className="rounded-[3px]" />)}</span>;
}
/** Text that crossfades (vertical nudge) when its key changes. */
function Swap({ k, children }: { k: string; children: React.ReactNode }) {
  const rm = useReducedMotion();
  return <AnimatePresence mode="popLayout" initial={false}><motion.span key={k} className="inline-block" initial={rm ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={rm ? { opacity: 0 } : { opacity: 0, y: -5 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.span></AnimatePresence>;
}

/* ---------- edit model: every prose field in a section gets a key ---------- */
type Draft = Record<string, string>;
/** Edit fields are the memo's own light markdown: **bold** and [n] footnotes round-trip through Save. */
function fieldsOf(blocks: MemoBlock[]): Draft {
  const f: Draft = {};
  blocks.forEach((b, i) => {
    if (b.kind === "p") f[`${i}`] = b.text;
    if (b.kind === "list") b.items.forEach((t, j) => (f[`${i}.${j}`] = t));
    if (b.kind === "facts") b.rows.forEach((r, j) => (f[`${i}.${j}`] = r.v));
    if (b.kind === "questions") b.items.forEach((q, j) => (f[`${i}.${j}`] = q.answer));
    if (b.kind === "risks") b.rows.forEach((r, j) => (f[`${i}.${j}`] = r.mitigant));
  });
  return f;
}
function applyDraft(blocks: MemoBlock[], draft: Draft): MemoBlock[] {
  const orig = (k: string, t: string) => draft[k] ?? t;
  return blocks.map((b, i): MemoBlock => {
    if (b.kind === "p") return { ...b, text: orig(`${i}`, b.text) };
    if (b.kind === "list") return { ...b, items: b.items.map((t, j) => orig(`${i}.${j}`, t)) };
    if (b.kind === "facts") return { ...b, rows: b.rows.map((r, j) => ({ ...r, v: orig(`${i}.${j}`, r.v) })) };
    if (b.kind === "questions") return { ...b, items: b.items.map((q, j) => ({ ...q, answer: orig(`${i}.${j}`, q.answer) })) };
    if (b.kind === "risks") return { ...b, rows: b.rows.map((r, j) => ({ ...r, mitigant: orig(`${i}.${j}`, r.mitigant) })) };
    return b;
  });
}

/** Markdown export of the memo as it stands (edits, override and resolved reviews included). */
function toMarkdown(d: MemoData, doc: MemoDoc, sections: MemoSection[], override: boolean): string {
  const v = override ? doc.override.analyst : doc.override.agent, r = d.recommendation.valuation;
  const md = (t: string) => t.replace(/\[(\d+)\]/g, "[^$1]");
  const out: string[] = [`# ${d.title}`, "", `_${doc.eyebrow} · Prepared by ${doc.author.name} with ${doc.preparedWith} · ${doc.date} · ${doc.status} · ${doc.ic.label} ${doc.ic.when}_`, ""];
  sections.forEach((s, i) => {
    out.push(`## ${i + 1}. ${s.title}`, "");
    s.blocks.forEach((b) => {
      if (b.kind === "recommendation") out.push(`**${v.verdict}** (${v.badge})`, "", `- Pre-money: our range $${r.low}–${r.high}${r.unit} · cap $${r.cap}${r.unit} · ask $${r.ask}${r.unit}`, `- Verified run-rate: ${d.recommendation.verifiedArr.value}`, `- Red flags: ${v.flags.map((f) => LEVEL[f]).join(", ")}`, `- ${md(v.note)}`, "");
      if (b.kind === "p") out.push(md(b.text), "");
      if (b.kind === "list") out.push(...b.items.map((t, j) => `${b.ordered ? `${j + 1}.` : "-"} ${md(t)}`), "");
      if (b.kind === "facts") out.push("| | |", "|---|---|", ...b.rows.map((x) => `| ${x.k} | ${md(x.v)} |`), "");
      if (b.kind === "risks") out.push("| Risk | Level | Mitigant |", "|---|---|---|", ...b.rows.map((x) => `| ${md(x.risk)} | ${LEVEL[override || !x.agentLevel ? x.level : x.agentLevel]} | ${md(x.mitigant)} |`), "");
      if (b.kind === "questions") out.push(...b.items.flatMap((q, j) => [`${j + 1}. **${q.q}** ${md(q.answer)}`]), "");
      if (b.kind === "figure") out.push(`_Figure: ${b.caption}_ ${b.cites.map((c) => `[^${c}]`).join("")}`, "");
      if (b.kind === "disagreement" && d.disagreement) out.push(`> You: ${d.disagreement.you}. Deal Desk: ${d.disagreement.agent}. Memo uses: ${override ? "your rating" : "the agent's rating"}.`, "");
    });
  });
  out.push("---", "", ...doc.sources.map((s) => `[^${s.n}]: ${s.label}, ${s.where}. “${s.quote}”`), "");
  return out.join("\n");
}

export function MemoScreen(p: MemoScreenProps) {
  const { data: d, status = "ready" } = p;
  const exportItems = (onMd?: () => void) => [
    ...(onMd ? [{ id: "md", label: "Markdown", hint: ".md", icon: <FileText />, onSelect: () => { onMd(); p.onExport?.("md"); } }] : [{ id: "docx", label: "Word document", hint: ".docx", icon: <FileText />, onSelect: () => p.onExport?.("docx") }]),
    { id: "pdf", label: "Print or save as PDF", hint: "⌘P", icon: <Printer />, onSelect: () => { p.onExport?.("pdf"); window.print(); } },
  ];
  const crumbs = [{ label: "Pipeline", href: ROUTES.pipeline }, { label: d.company.name, href: ROUTES.deal(d.company.id) }, { label: "IC memo" }];
  if (status !== "ready" || !d.doc) {
    return (
      <Page active="pipeline" shell={p.shell} top={<TopBar crumbs={crumbs} ctx="IC memo" right={status === "ready" ? <IconMenu icon={<Download />} label="Export memo" title={d.exportNote} w={250} items={exportItems()} /> : undefined} />}>
        {status === "loading" ? <ScreenSkeleton cols="grid-cols-[208px_1fr_340px]" />
          : status === "error" ? <ErrorState message={p.error} onRetry={p.onRetry} />
          : status === "empty" ? <EmptyState title="No memo yet" body={`Deal Desk drafts the IC memo for ${d.company.name} once diligence finishes.`} action={<Link href={ROUTES.deal(d.company.id)} className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[13px] font-medium text-white hover:bg-zinc-800">Open the deal</Link>} />
          : <LegacyMemo {...p} />}
      </Page>
    );
  }
  return <DocMemo {...p} doc={d.doc} exportItems={exportItems} crumbs={crumbs} />;
}

/* ───────── v4 · document-first memo ───────── */
function DocMemo(p: MemoScreenProps & { doc: MemoDoc; exportItems: (onMd?: () => void) => { id: string; label: string; hint: string; icon: React.ReactNode; onSelect: () => void }[]; crumbs: { label: string; href?: string }[] }) {
  const { data: d, doc, initial = {} } = p;
  const [active, setActive] = useState(doc.sections[0].id);
  const [override, setOverride] = useState(initial.override ?? doc.override.defaultOn);
  const [edits, setEdits] = useState<Record<string, MemoBlock[]>>({});
  const [editing, setEditing] = useState<string | null>(initial.edit ?? null);
  const [draft, setDraft] = useState<Draft>(() => (initial.edit ? fieldsOf(doc.sections.find((s) => s.id === initial.edit)?.blocks ?? []) : {}));
  const [edited, setEdited] = useState<string[]>([]);
  const [resolved, setResolved] = useState<string[]>([]);
  const [openSrc, setOpenSrc] = useState<number | null>(initial.cite ?? null);
  const [flash, setFlash] = useState<number | null>(initial.cite ?? null);
  const [vote, setVote] = useState(!!initial.vote);
  const [queued, setQueued] = useState(!!initial.queued);
  const [log, setLog] = useState<MemoAction[]>([]);
  const flashT = useRef<number | undefined>(undefined);
  const [flashKey, setFlashKey] = useState(0);
  const rm = useReducedMotion();
  const ease = [0.22, 1, 0.36, 1] as const;

  const verdict = override ? doc.override.analyst : doc.override.agent;
  const sections: MemoSection[] = useMemo(() => doc.sections.map((s) => {
    let blocks = edits[s.id] ?? s.blocks;
    // Resolved reviews that add a line land in their target section's ordered list.
    const adds = doc.sections.filter((x) => x.review?.adds?.target === s.id && resolved.includes(x.review.id)).map((x) => x.review!.adds!.text);
    if (adds.length) blocks = blocks.map((b) => (b.kind === "list" && b.ordered ? { ...b, items: [...b.items, ...adds.filter((t) => !b.items.includes(t))] } : b));
    const state: StepState = s.review && !resolved.includes(s.review.id) ? "warn" : s.state === "warn" ? "done" : s.state;
    return { ...s, blocks, state };
  }), [doc.sections, edits, resolved]);
  const toReview = sections.filter((s) => s.state === "warn").length;
  const ready = sections.length - toReview;
  const actions = [...doc.actions, ...log];
  const stamp = () => new Date().toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
  const logIt = (label: string, detail?: string) => setLog((l) => [...l, { id: `l${l.length}`, at: `Today ${stamp()}`, label, detail, by: "person", who: doc.author.initials }]);

  // Scroll-spy: the rail follows the section you are reading.
  useEffect(() => {
    const els = doc.sections.map((s) => document.getElementById(`memo-${s.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((es) => { const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setActive(v.target.id.replace("memo-", "")); }, { rootMargin: "-120px 0px -62% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [doc.sections]);
  useEffect(() => () => window.clearTimeout(flashT.current), []);

  const go = (id: string) => { setActive(id); p.onOutline?.(id); document.getElementById(`memo-${id}`)?.scrollIntoView({ behavior: rm ? "auto" : "smooth", block: "start" }); };
  const cite = (n: number) => {
    p.onCite?.(n); setOpenSrc(n); setFlash(n); setFlashKey((k) => k + 1);
    window.clearTimeout(flashT.current); flashT.current = window.setTimeout(() => setFlash(null), 2400);
    requestAnimationFrame(() => document.getElementById(`memo-src-${n}`)?.scrollIntoView({ behavior: rm ? "auto" : "smooth", block: "center" }));
  };
  const startEdit = (id = active) => { const s = sections.find((x) => x.id === id)!; setEditing(id); setDraft(fieldsOf(s.blocks)); go(id); };
  const saveEdit = () => {
    if (!editing) return;
    const s = sections.find((x) => x.id === editing)!;
    setEdits((e) => ({ ...e, [editing]: applyDraft(s.blocks, draft) }));
    setEdited((e) => (e.includes(editing) ? e : [...e, editing]));
    logIt(`You edited ${s.title}`); setEditing(null);
  };
  const resolve = (s: MemoSection) => { if (!s.review) return; setResolved((r) => [...r, s.review!.id]); logIt(s.review.done, s.title); };
  const download = () => {
    const blob = new Blob([toMarkdown(d, doc, sections, override)], { type: "text/markdown" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${doc.exportName}.md` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const prose = (t: string) => <Prose text={t} onCite={cite} active={flash} />;
  const field = (k: string, rows = 3) => (
    <textarea aria-label="Edit text" value={draft[k] ?? ""} onChange={(e) => setDraft((x) => ({ ...x, [k]: e.target.value }))} rows={rows}
      className="block w-full resize-none rounded-[10px] bg-[#fbf8f4] px-3 py-2 text-[14px] leading-6 text-ink ring-1 ring-rust-100 outline-none [field-sizing:content] focus:ring-2 focus:ring-rust/30" />
  );

  return (
    <Page active="pipeline" shell={p.shell} top={<TopBar crumbs={p.crumbs} ctx="IC memo" right={<IconMenu icon={<Download />} label="Export memo" title="Export this draft" w={250} items={p.exportItems(download)} />} />}>
      <div className="grid flex-1 grid-cols-[208px_minmax(0,1fr)_340px] @max-[1120px]/main:grid-cols-[196px_minmax(0,1fr)_296px]">
        {/* Template rail */}
        <nav data-print-hide aria-label="Memo sections" className="sticky top-[52px] flex h-[calc(100vh-52px)] flex-col border-r border-zinc-200/70 px-3 pt-6 pb-4">
          <div className="eyebrow px-2">IC memo template</div>
          <ol className="mt-3 space-y-0.5">
            {sections.map((s, i) => (
              <li key={s.id}>
                <button type="button" onClick={() => go(s.id)} aria-current={active === s.id ? "true" : undefined}
                  className={cx("relative flex w-full items-start gap-2.5 rounded-[10px] px-2 py-[7px] text-left text-[13px] transition-colors", active === s.id ? "font-medium text-ink" : "text-zinc-600 hover:bg-white/60 hover:text-ink")}>
                  {active === s.id && <motion.span layoutId="memo-rail-active" aria-hidden className="absolute inset-0 rounded-[10px] bg-white shadow-[0_1px_2px_rgba(9,9,11,.05)] ring-1 ring-zinc-200/80" transition={rm ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42, mass: 0.7 }} />}
                  <span className="relative mt-[2px] grid size-[15px] place-items-center">
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span key={s.state} className="col-start-1 row-start-1" initial={rm ? { opacity: 0 } : { opacity: 0, scale: 0.4, rotate: -40 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={rm ? { opacity: 0 } : { opacity: 0, scale: 0.4 }} transition={rm ? { duration: 0.12 } : { type: "spring", stiffness: 500, damping: 26 }}><StepDot s={s.state} size={15} /></motion.span>
                    </AnimatePresence>
                  </span>
                  <span className="relative min-w-0 flex-1"><span className="block leading-[18px]"><span className="tnum mr-1 text-zinc-400">{i + 1}.</span>{s.title}</span>
                    <AnimatePresence initial={false}>{s.state === "warn" && s.review && <motion.span key="rv" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: rm ? 0.1 : 0.28, ease }} className="block overflow-hidden"><span className="mt-0.5 block truncate text-[11px] font-normal text-warn">{s.review.label}</span></motion.span>}</AnimatePresence></span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-auto space-y-3 px-1">
            <div>
              <div className="flex items-baseline justify-between text-[11.5px]"><span className="text-zinc-500">Ready for IC</span><span className="tnum font-medium"><AnimatePresence mode="popLayout" initial={false}><motion.span key={ready} className="inline-block" initial={rm ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={rm ? { opacity: 0 } : { opacity: 0, y: -6 }} transition={{ duration: 0.22, ease }}>{ready}</motion.span></AnimatePresence> of {sections.length}</span></div>
              <div className="mt-1.5 flex h-1.5 gap-[3px]">{sections.map((s) => <span key={s.id} className="relative flex-1 overflow-hidden rounded-full bg-[#ecd6ab]"><motion.span className="absolute inset-0 origin-left rounded-full bg-ink" initial={false} animate={{ scaleX: s.state === "warn" ? 0 : 1 }} transition={{ duration: rm ? 0 : 0.6, ease, delay: rm ? 0 : 0.15 }} /></span>)}</div>
            </div>
            <div className="rounded-[14px] border border-zinc-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(9,9,11,.03)]">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500"><Clock className="size-3 text-rust" />{doc.ic.label}</div>
              <div className="mt-0.5 text-[13px] font-medium text-ink">{doc.ic.when}</div>
              <div className="mt-2 flex items-center gap-2"><span className="flex -space-x-1">{doc.share.people.map((x) => <Avatar key={x.initials} i={x.initials} size={22} tone="sand" />)}</span><span className="truncate whitespace-nowrap text-[11px] text-zinc-500">{queued ? "Vote queued" : `${doc.share.people.length} partners vote`}</span></div>
            </div>
          </div>
        </nav>

        {/* Paper */}
        <section className="min-w-0 px-8 pb-16 @max-[1120px]/main:px-5">
          <div data-print-hide className="sticky top-[52px] z-10 -mx-8 flex items-center gap-2 bg-[#f8f8f7]/85 px-8 py-3 backdrop-blur-md @max-[1120px]/main:-mx-5 @max-[1120px]/main:px-5">
            <span className={cx("size-1.5 rounded-full", toReview ? "bg-[#c58a26]" : "bg-[#5a8f6c]")} />
            <span className="min-w-0 truncate text-[12.5px] text-zinc-500"><b className="font-medium text-ink">{doc.status}</b> · {toReview ? `${toReview} to review` : "Ready to vote"}</span>
            <span className="ml-auto flex items-center gap-2">
              {editing ? (
                <>
                  <span className="mr-1 hidden text-[12px] text-zinc-500 @min-[1180px]/main:inline">Editing {sections.find((s) => s.id === editing)?.title}</span>
                  <Btn onClick={() => setEditing(null)}>Cancel</Btn>
                  <Btn variant="primary" icon={<Check className="size-3.5" />} onClick={saveEdit}>Save</Btn>
                </>
              ) : (
                <>
                  <SharePopover share={doc.share} defaultOpen={initial.share} trigger={(open, toggle) => <Btn onClick={toggle} icon={<Share2 className="size-3.5" />} className={cx(open && "bg-zinc-50 ring-2 ring-ink/5", "@max-[1120px]/main:px-2.5")}>Share</Btn>} />
                  <Btn onClick={() => startEdit()} className="@max-[1120px]/main:px-2.5" icon={<PenLine className="size-3.5" />}><span>Edit<span className="@max-[1120px]/main:hidden"> memo</span></span></Btn>
                  <Btn variant="primary" onClick={() => setVote(true)} icon={queued ? <Clock className="size-3.5 text-[#e9b98f]" /> : <span className="grid size-[18px] place-items-center rounded-[5px] bg-white"><ToolLogo id="slack" size={12} bare /></span>}>{queued ? <span>Queued<span className="@max-[1120px]/main:hidden"> · {doc.ic.when}</span></span> : <span><span className="@max-[1120px]/main:hidden">Run </span>IC vote<span className="@max-[1120px]/main:hidden"> in Slack</span></span>}</Btn>
                </>
              )}
            </span>
          </div>

          <Rise className={cx(CARD, "mx-auto mt-1 max-w-[760px] px-14 pt-11 pb-12 @max-[1120px]/main:px-10")}>
            <article data-memo-paper>
              <div className="flex items-center gap-2 text-[11.5px] text-zinc-500">
                <span className="eyebrow whitespace-nowrap">{doc.eyebrow}<span className="@max-[1120px]/main:hidden"> · {doc.date}</span></span>
                <span className="ml-auto inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-rust-50 px-2.5 text-[11.5px] font-medium text-rust ring-1 ring-rust-100"><span className="size-1.5 rounded-full bg-rust motion-safe:animate-pulse" />{doc.ic.label} · {doc.ic.when}</span>
              </div>
              <h1 className="serif mt-3 text-[40px] leading-[1.05] tracking-[-0.01em] @max-[1120px]/main:text-[34px]">{d.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-zinc-500">
                <Avatar i={doc.author.initials} size={20} tone="ink" />
                <span>Prepared by <b className="font-medium text-ink">{doc.author.name}</b> with</span>
                <DeskMark size={16} /><b className="font-medium text-ink">{doc.preparedWith}</b>
                <span className="inline-flex items-center gap-1" title={`${d.meta.citations} citations · ${d.meta.unsupported} unsupported`}><span className="mr-0.5 text-zinc-300">·</span><Check className="size-3.5 text-ok" /><span className="tnum">{d.meta.citations} cited<span className="@max-[1120px]/main:hidden"> · {d.meta.unsupported} unsupported</span></span></span>
              </div>
              <dl className="mt-6 grid grid-cols-[auto_repeat(4,minmax(0,1fr))] gap-x-5 @max-[1120px]/main:gap-x-3.5 border-y border-zinc-200/70 py-3.5">
                <div><dt className="text-[11px] text-zinc-500">Fit</dt><dd className="mt-1"><FitPill score={doc.fit.score} signals={doc.fit.signals} /></dd></div>
                {doc.facts.map((f) => (
                  <div key={f.id} className="min-w-0"><dt className="truncate text-[11px] text-zinc-500">{f.label}</dt>
                    <dd className={cx("tnum mt-0.5 text-[17px] font-semibold leading-6", f.tone === "rust" ? "text-rust" : "text-ink")}>{f.value}</dd>
                    {f.sub && <dd className="truncate text-[11px] text-zinc-400">{f.sub}</dd>}</div>
                ))}
              </dl>

              {sections.map((s, si) => {
                const isEdit = editing === s.id;
                return (
                  <section key={s.id} id={`memo-${s.id}`} aria-labelledby={`memo-h-${s.id}`} className="scroll-mt-[120px] pt-9">
                    <div className="flex items-baseline gap-3">
                      <h2 id={`memo-h-${s.id}`} className="serif text-[24px] leading-tight"><span className="tnum text-zinc-400">{si + 1}.</span> {s.title}</h2>
                      {edited.includes(s.id) && !isEdit && <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500"><PenLine className="size-3" />Edited by you</span>}
                      {!isEdit && !editing && <button type="button" onClick={() => startEdit(s.id)} data-print-hide aria-label={`Edit ${s.title}`} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] text-zinc-400 hover:bg-zinc-100 hover:text-ink"><PenLine className="size-3" />Edit</button>}
                      {isEdit && <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-rust-50 px-2 py-0.5 text-[11px] font-medium text-rust ring-1 ring-rust-100"><PenLine className="size-3" />Editing · **bold** and [n] footnotes kept</span>}
                    </div>
                    {/* Resolving a review: the amber banner folds away and a quiet confirmation takes its place. */}
                    {s.review && <AnimatePresence mode="wait" initial={false}>{resolved.includes(s.review.id)
                      ? <motion.div key="done" initial={rm ? { opacity: 0 } : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease }} className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-ok"><motion.span initial={rm ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 20, delay: 0.08 }}><Check className="size-3.5" /></motion.span>{s.review.done}</motion.div>
                      : (
                        <motion.div key="todo" exit={rm ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0, scale: 0.98 }} transition={{ duration: 0.28, ease }} data-print-hide className="mt-3 flex items-center gap-3 overflow-hidden rounded-[14px] border border-[#ecd9b4] bg-[#fbf6ea] px-3.5 py-2.5">
                          <AlertTriangle className="size-4 shrink-0 text-warn" />
                          <div className="min-w-0 flex-1 text-[12.5px] leading-snug"><b className="font-semibold text-ink">Needs review · {s.review.label}.</b> <span className="text-zinc-600">{prose(s.review.detail)}</span></div>
                          <button type="button" onClick={() => resolve(s)} className="inline-flex h-8 shrink-0 items-center rounded-full bg-ink px-3.5 text-[12px] font-medium text-white transition-transform hover:bg-zinc-800 active:scale-[.97]">{s.review.action}</button>
                        </motion.div>
                      )}</AnimatePresence>}
                    <div className="mt-3 space-y-4 text-[14px] leading-[1.7] text-zinc-700">
                      {s.blocks.map((b, bi) => <Fragment key={bi}>{block(b, `${bi}`)}</Fragment>)}
                    </div>
                  </section>
                );

                function block(b: MemoBlock, k: string) {
                  const v = d.recommendation.valuation;
                  if (b.kind === "p") return isEdit ? field(k) : <p className="max-w-[68ch]">{prose(b.text)}</p>;
                  if (b.kind === "list") return (
                    <ol className="max-w-[68ch] space-y-2">
                      <AnimatePresence initial={false}>{b.items.map((t, j) => <motion.li key={j} initial={rm ? { opacity: 0 } : { opacity: 0, height: 0, x: -6 }} animate={{ opacity: 1, height: "auto", x: 0 }} transition={{ duration: 0.35, ease, delay: rm ? 0 : 0.2 }} className="flex gap-3">{b.ordered ? <span className="tnum w-4 shrink-0 text-right text-zinc-400">{j + 1}.</span> : <span className="mt-[11px] size-1 shrink-0 rounded-full bg-zinc-400" />}<span className="min-w-0 flex-1">{isEdit && j < Object.keys(draft).filter((x) => x.startsWith(`${k}.`)).length ? field(`${k}.${j}`, 2) : prose(t)}</span></motion.li>)}</AnimatePresence>
                    </ol>
                  );
                  if (b.kind === "facts") return (
                    <dl className="divide-y divide-zinc-100 rounded-[14px] border border-zinc-200/70">
                      {b.rows.map((r, j) => <div key={r.k} className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 px-4 py-2.5 text-[13.5px] leading-6"><dt className="text-zinc-500">{r.k}</dt><dd className="text-ink">{isEdit ? field(`${k}.${j}`, 1) : prose(r.v)}</dd></div>)}
                    </dl>
                  );
                  if (b.kind === "recommendation") return (
                    <div className="rounded-[16px] border border-ink/80 p-5">
                      <div className="flex items-center gap-2">
                        <span className="eyebrow">Verdict</span>
                        {/* Override morphs the badge: width and tint ease between states, the label crossfades. */}
                        <motion.span layout={rm ? false : "size"} initial={false} style={{ borderRadius: 999 }}
                          animate={override ? { backgroundColor: "#09090b", color: "#ffffff", boxShadow: "0 0 0 1px #09090b" } : { backgroundColor: "#fbf3ee", color: "#9c440f", boxShadow: "0 0 0 1px #f5e3d7" }}
                          transition={{ duration: rm ? 0 : 0.34, ease }} className="ml-auto inline-flex h-6 items-center overflow-hidden text-[11.5px] font-medium whitespace-nowrap">
                          <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span key={verdict.badge} layout={rm ? false : "position"} initial={rm ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={rm ? { opacity: 0 } : { opacity: 0, y: -8 }} transition={{ duration: 0.22, ease }}
                              className={cx("inline-flex items-center gap-1.5 pr-2.5", override ? "pl-0.5" : "pl-2")}>
                              {override ? <Avatar i={doc.override.by.initials} size={20} tone="sand" /> : <Sparkles className="size-3" />}{verdict.badge}
                            </motion.span>
                          </AnimatePresence>
                        </motion.span>
                      </div>
                      <div className="serif mt-1.5 text-[28px] leading-tight text-ink">{verdict.verdict}</div>
                      <div className="mt-4 grid grid-cols-[minmax(0,2fr)_minmax(0,1.05fr)_minmax(0,1fr)] gap-4 text-[12px]">
                        <div className="min-w-0"><div className="text-zinc-500">Pre-money · our range</div><div className="tnum mt-0.5 whitespace-nowrap text-[15px] font-semibold text-ink"><CapRange v={v} short /><Prose text={` [${d.recommendation.valuationCite}]`} onCite={cite} active={flash} /></div><div className="text-[11px] text-rust">Ask ${v.ask}{v.unit}</div></div>
                        <div className="min-w-0"><div className="truncate whitespace-nowrap text-zinc-500">Verified run-rate</div><div className="tnum text-[18px] font-semibold text-ink">{d.recommendation.verifiedArr.value}<Prose text={` [${d.recommendation.verifiedArr.cite}]`} onCite={cite} active={flash} /></div><div className="text-[11px] text-zinc-400">{doc.facts.find((f) => f.id === "mrr")?.value} MRR</div></div>
                        <div className="min-w-0"><div className="text-zinc-500">Red flags</div><div className="mt-1.5 flex items-center gap-2"><FlagDots levels={verdict.flags} size={11} /><span className="tnum font-semibold text-ink">{verdict.flags.length}</span></div><div className="mt-1 truncate whitespace-nowrap text-[11px] text-zinc-400"><Swap k={verdict.flags.join()}>{verdict.flags.map((f) => LEVEL[f]).join(" · ")}</Swap></div></div>
                      </div>
                      <div className="mt-4 border-t border-zinc-100 pt-3 text-[12.5px] leading-snug text-zinc-600">{prose(verdict.note)}</div>
                    </div>
                  );
                  if (b.kind === "figure") return (
                    <figure className="rounded-[16px] border border-zinc-200/80 px-5 pt-4 pb-3">
                      <figcaption className="mb-2 flex items-baseline justify-between gap-3 text-[11px] text-zinc-500"><span><b className="font-semibold text-ink">Figure {b.figure === "growth" ? 1 : 2}</b> · {b.caption}</span><span className="shrink-0">Sources <Prose text={b.cites.map((c) => `[${c}]`).join("")} onCite={cite} active={flash} /></span></figcaption>
                      {b.figure === "growth" && d.growth ? <GrowthCard g={d.growth} w={560} compact /> : <RangeChart v={v} w={560} rowH={28} labelW={118} />}
                    </figure>
                  );
                  if (b.kind === "risks") return (
                    <div className="overflow-hidden rounded-[14px] border border-zinc-200/70">
                      <div className="grid grid-cols-[minmax(0,1.1fr)_92px_minmax(0,1fr)] gap-4 border-b border-zinc-200/70 bg-zinc-50/70 px-4 py-2 text-[11px] font-medium text-zinc-500"><span>Risk</span><span>Level</span><span>Mitigant</span></div>
                      {b.rows.map((r, j) => {
                        const lv = override || !r.agentLevel ? r.level : r.agentLevel, other = r.agentLevel ? (override ? r.agentLevel : r.level) : undefined;
                        return (
                          <div key={r.id} className="grid grid-cols-[minmax(0,1.1fr)_92px_minmax(0,1fr)] gap-4 border-b border-zinc-100 px-4 py-3 text-[13px] leading-[1.55] last:border-0">
                            <span className="text-ink">{prose(r.risk)}</span>
                            <span><span className="inline-flex items-center gap-1.5 font-medium text-ink"><FlagDots levels={[lv]} size={9} /><Swap k={lv}>{LEVEL[lv]}</Swap></span>{other && <span className="mt-0.5 block text-[10.5px] text-zinc-400"><Swap k={String(override)}>{override ? "Agent" : "You"}: {LEVEL[other]}</Swap></span>}</span>
                            <span className="text-zinc-600">{isEdit ? field(`${k}.${j}`, 2) : prose(r.mitigant)}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                  if (b.kind === "questions") return (
                    <ol className="max-w-[68ch] space-y-3.5">
                      {b.items.map((q, j) => <li key={q.id} className="flex gap-3"><span className="tnum w-4 shrink-0 text-right text-zinc-400">{j + 1}.</span><div className="min-w-0 flex-1"><div className="font-medium text-ink">{q.q}</div><div className="text-zinc-600">{isEdit ? field(`${k}.${j}`, 2) : prose(q.answer)}</div></div></li>)}
                    </ol>
                  );
                  if (b.kind === "disagreement" && d.disagreement) return (
                    <div className="flex items-start gap-3 rounded-[14px] border border-[#ecd9b4] bg-[#fbf6ea] p-4">
                      <Scale className="mt-0.5 size-4 shrink-0 text-warn" />
                      <div className="min-w-0 flex-1 text-[13px] leading-snug">
                        <div className="flex items-center gap-2"><span className="font-semibold text-ink">You and the agent disagree</span><span className="ml-auto text-[11px] text-zinc-500">Memo uses {override ? "your rating" : "the agent’s"}</span></div>
                        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                          {([["you", d.disagreement.you, override], ["agent", d.disagreement.agent, !override]] as const).map(([who, text, on]) => (
                            <div key={who} className={cx("rounded-[10px] bg-white p-2.5 transition-shadow", on ? "ring-2 ring-ink/80" : "ring-1 ring-zinc-200/70")}>
                              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">{who === "you" ? <Avatar i={p.shell.user.initials} size={16} tone="ink" /> : <DeskMark size={16} />}{who === "you" ? "You" : "Deal Desk"}{on && <Check className="ml-auto size-3.5 text-ink" />}</div>
                              <div className="mt-1 text-ink">{text}{who === "agent" && <Prose text={` [${d.disagreement!.cite}]`} onCite={cite} active={flash} />}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                  return null;
                }
              })}
              <div className="mt-12 flex items-center gap-2 border-t border-zinc-200/70 pt-4 text-[11.5px] text-zinc-400">
                <DeskMark size={14} /><span>{doc.status} · {doc.savedAt} · {doc.sources.length} sources · {d.meta.citations} citations</span><span className="ml-auto">{doc.override.label} {override ? "on" : "off"}</span>
              </div>
            </article>
          </Rise>
        </section>

        {/* Memo companion */}
        <aside className="sticky top-[52px] h-[calc(100vh-52px)] overflow-y-auto border-l border-zinc-200/70 bg-[#fbfbfa]">
          <MemoCompanion doc={doc} override={override} onOverride={(on) => { setOverride(on); logIt(on ? "Analyst override on" : "Analyst override off", on ? "Your ratings win" : "Agent ratings win"); }}
            openSrc={openSrc} onOpenSrc={setOpenSrc} flashSrc={flash} flashKey={flashKey} actions={actions} />
        </aside>
      </div>
      {vote && <VoteSheet vote={doc.vote} queued={queued} onClose={() => setVote(false)} onQueue={() => { setQueued(true); setLog((l) => [...l, { id: `l${l.length}`, at: `Today ${stamp()}`, label: "Queued the IC vote", detail: doc.vote.message.channel + " · " + doc.ic.when, by: "agent", who: "Memo agent" }]); }} />}
    </Page>
  );
}

/* ───────── v3 memo (no doc): kept as is for NexaFlow ───────── */
function LegacyMemo(p: MemoScreenProps) {
  const { data: d } = p, r = d.recommendation, v = r.valuation;
  const C = ({ n }: { n: number }) => <sup role="button" tabIndex={0} onClick={() => p.onCite?.(n)} className="ml-0.5 cursor-pointer rounded bg-zinc-100 px-1 text-[9.5px] font-semibold text-zinc-600">{n}</sup>;
  const [first, ...rest] = d.sources;
  return (
    <div className="grid flex-1 grid-cols-[220px_1fr_360px]">
      <nav className="border-r border-zinc-200/70 px-3 pt-5">
        <div className="eyebrow px-2">IC memo template</div>
        <div className="mt-2 space-y-px">
          {d.outline.map((o) => <button type="button" key={o.id} onClick={() => p.onOutline?.(o.id)} className={cx("flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px]", o.selected ? "bg-white font-medium ring-1 ring-zinc-200" : "text-zinc-600")}><StepDot s={o.state} size={14} />{o.label}</button>)}
        </div>
      </nav>
      <section className="bg-zinc-100/60 px-10 pt-7 pb-12">
        <Rise className="mx-auto max-w-[760px] rounded-sm bg-white px-14 py-12 shadow-[0_1px_3px_rgba(9,9,11,.08),0_12px_40px_-20px_rgba(9,9,11,.2)]">
          <div className="flex items-center gap-2 text-[11.5px] text-zinc-500"><span>{d.meta.draft}</span><span className="ml-auto flex items-center gap-1.5" title={`${d.meta.citations} citations · ${d.meta.unsupported} unsupported`}>{d.meta.unsupported ? <b className="tnum text-rust">{d.meta.unsupported} unsupported</b> : <><Check className="size-3.5 text-ok" /><span className="tnum">{d.meta.citations} cited</span></>}</span></div>
          <h1 className="serif mt-3 text-[40px] leading-none">{d.title}</h1>
          <div className="mt-6 rounded-xl border border-ink/80 p-5">
            <div className="eyebrow">Recommendation</div>
            <div className="serif mt-1 text-[28px] leading-tight">{r.verdict}</div>
            <div className="mt-3 grid grid-cols-[2.5fr_1fr_.8fr] gap-3 text-[12.5px]">
              <div><div className="text-zinc-500">{v.basis === "EV" ? "Enterprise value" : "Pre-money"}</div><div className="tnum mt-0.5 whitespace-nowrap text-[15px] font-semibold"><CapRange v={v} /><C n={r.valuationCite} /></div></div>
              <div><div className="text-zinc-500">Verified ARR</div><div className="tnum text-[18px] font-semibold">{r.verifiedArr.value}<C n={r.verifiedArr.cite} /></div></div>
              <div className="min-w-0"><div className="text-zinc-500">Red flags</div><div className="mt-1.5 flex items-center gap-2"><Severity levels={r.flags} size={11} /><span className="tnum font-semibold">{r.flags.length}</span></div></div>
            </div>
          </div>
          <h3 className="mt-7 text-[13px] font-semibold">Closing conditions</h3>
          <ol className="mt-2 space-y-1.5 text-[14px] leading-6">
            {d.conditions.map((c, i) => <li key={c.id}><span className="tnum mr-2 text-zinc-400">{i + 1}</span>{c.text}{c.showValuation && <CapRange v={v} />}<C n={c.cite} /></li>)}
          </ol>
          <h3 className="mt-7 text-[13px] font-semibold">Diligence findings</h3>
          {d.bridge.length > 0 ? (
            <figure className="mt-3 rounded-xl border border-zinc-200/80 px-5 pt-4 pb-3">
              <figcaption className="mb-2 flex items-baseline justify-between text-[11px] text-zinc-500"><span><b className="font-semibold text-ink">Figure 1</b> · ARR bridge, deck to verified ($M)</span><span>Sources 3, 4, 7</span></figcaption>
              <Waterfall h={140} barW={46} parts={d.bridge} delta />
            </figure>
          ) : d.growth ? (
            <figure className="mt-3 rounded-xl border border-zinc-200/80 px-5 pt-4 pb-3">
              <figcaption className="mb-3 flex items-baseline justify-between text-[11px] text-zinc-500"><span><b className="font-semibold text-ink">Figure 1</b> · Monthly revenue, deck claim vs bank deposits (${d.growth.unit})</span><span>Sources 4, 9</span></figcaption>
              <GrowthCard g={d.growth} w={600} compact />
            </figure>
          ) : null}
          {d.disagreement && <div className="mt-4 flex items-start gap-3 rounded-xl border border-warn/40 bg-[#fbf6ea] p-4">
            <Scale className="mt-0.5 size-4 shrink-0 text-warn" />
            <div className="flex-1 text-[13px]">
              <div className="font-semibold">You and the agent disagree</div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white p-2.5"><div className="flex items-center gap-1.5 text-[11px] text-zinc-500"><Avatar i={p.shell.user.initials} size={16} tone="ink" />You</div><div className="mt-1">{d.disagreement.you}</div></div>
                <div className="rounded-lg bg-white p-2.5"><div className="flex items-center gap-1.5 text-[11px] text-zinc-500"><Avatar i="DD" size={16} />Deal Desk</div><div className="mt-1"><span>{d.disagreement.agent}</span><C n={d.disagreement.cite} /></div></div>
              </div>
            </div>
          </div>}
          <h3 className="mt-7 text-[13px] font-semibold">Valuation range</h3>
          <figure className="mt-3 rounded-xl border border-zinc-200/80 px-5 pt-4 pb-3">
            <figcaption className="mb-2 flex items-baseline justify-between text-[11px] text-zinc-500"><span><b className="font-semibold text-ink">Figure 2</b> · {v.basis === "EV" ? "Enterprise value" : "Pre-money"} by method ($M)</span><span>Source {r.valuationCite}</span></figcaption>
            <RangeChart v={v} w={600} rowH={28} labelW={118} />
          </figure>
          {d.priors && <div className="mt-4"><PriorsStrip p={d.priors} cap={v.cap} ask={v.ask} /></div>}
          <h3 className="mt-7 text-[13px] font-semibold">Expected IC questions</h3>
          <div className="mt-2 space-y-1.5 text-[14px]">{d.questions.map((q) => <div key={q} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-zinc-400" />{q}</div>)}</div>
        </Rise>
      </section>
      <aside className="border-l border-zinc-200/70 bg-white px-6 pt-6">
        <div className="flex items-center justify-between"><span className="eyebrow">Sources & activity</span></div>
        {first && <div className="mt-4">{first.excerpt ? <SrcPop source={first} pinned={p.pinSources} w={308} /> : <Src k={first.kind}>{first.label}</Src>}</div>}
        {/* Spacer only when the popover is pinned open, so the list never jumps in normal use. */}
        <div className={cx("space-y-2", p.pinSources ? "mt-[132px]" : "mt-3")}>
          {rest.map((s) => <div key={s.label} className="flex items-center gap-2 text-[12.5px]"><span className="tnum w-5 text-zinc-400">{s.n}</span><Src k={s.kind}>{s.label}</Src></div>)}
        </div>
        <div className="relative mt-6 space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[6.5px] before:w-px before:bg-zinc-200">
          {d.activity.map((a) => <div key={a.id} className="relative flex items-center gap-3 text-[12.5px]"><StepDot s="done" size={14} /><span>{a.label}</span><span className="tnum ml-auto text-[11px] text-zinc-400">{a.at}</span></div>)}
        </div>
      </aside>
    </div>
  );
}
