"use client";
/**
 * v3.2 · Agent page. A trigger card, then numbered steps on a thin connector (icon, title, one line, toggle, … menu),
 * or the same agent as a flow canvas (dotted grid, dashed connectors, tiny edge labels, a red issues pill only where needed).
 * Motion: the running step's text shimmers, a glowing dot travels the connector into the next step, finished steps settle in with a check.
 * `run` freezes any moment for screenshots (?frame=n → agentRunAt(n)); omit it and `autoplay` loops the run.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, Scale, Landmark, Users, ChartNoAxesColumn, FileText, MessageSquareText, FolderInput, MoreHorizontal, Pencil, Plus, ListOrdered, Workflow, Play, Pause, Copy, History, Trash2, PlayCircle, Eye, ShieldCheck, Sparkles } from "lucide-react";
import { Page, TopBar } from "../components/shell";
import { AssistantDock } from "../components/assistant";
import { Btn, IconBtn, IconMenu, Logo, Toggle, cx, CompanyLogo } from "../components/ui";
import { Pulse, useReducedMotion } from "../components/motion";
import { AGENT_FRAMES, agentRunAt } from "../fixtures/agents";
import type { AgentData, AgentRunState, AgentStep, AgentStepIcon, AgentStepState, AssistantData, ShellData, Tone2 } from "../types";

const ICON: Record<AgentStepIcon, typeof FolderOpen> = { files: FolderOpen, claims: Scale, bank: Landmark, team: Users, value: ChartNoAxesColumn, memo: FileText, brief: MessageSquareText, trigger: FolderInput };
const ROW = 76, CIRCLE = 26, C0 = 22; // row height, number circle, circle centre offset in a row

function stateOf(i: number, step: AgentStep, run: AgentRunState): AgentStepState {
  if (!step.on) return "off";
  if (i < run.active) return "done";
  if (i === run.active) return run.t >= 1 ? "running" : "queued";
  return "queued";
}

/** Autoplay: odd frames = a step running (1.5s), even = the dot travelling into the next step (0.75s). */
function useRun(run: AgentRunState | undefined, autoplay: boolean): { run: AgentRunState; frame: number | null } {
  const [f, setF] = useState(1);
  const red = useReducedMotion();
  useEffect(() => {
    if (run || !autoplay || red) return;
    const ms = f === AGENT_FRAMES ? 2600 : f % 2 ? 1500 : 750;
    const id = setTimeout(() => setF((x) => (x >= AGENT_FRAMES ? 1 : x + 1)), ms);
    return () => clearTimeout(id);
  }, [f, run, autoplay, red]);
  if (run) return { run, frame: null };
  return { run: agentRunAt(f), frame: f };
}

function Circle({ n, s, frozen }: { n: number; s: AgentStepState; frozen: boolean }) {
  const base = "relative z-10 flex shrink-0 items-center justify-center rounded-full text-[11px] tnum";
  if (s === "done") return (
    <motion.span key="done" initial={frozen ? false : { scale: 0.55, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 520, damping: 24 }} style={{ width: CIRCLE, height: CIRCLE }} className={cx(base, "bg-ink text-white")}>
      <svg viewBox="0 0 12 12" className="size-3" aria-label="Done"><motion.path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" initial={frozen ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.08 }} /></svg>
    </motion.span>
  );
  if (s === "running") return (
    <span style={{ width: CIRCLE, height: CIRCLE }} className={cx(base, "bg-white font-medium text-ink shadow-[0_0_0_4px_var(--glow-soft)]")}>
      <svg viewBox="0 0 26 26" className={cx("absolute inset-0", !frozen && "motion-safe:animate-spin [animation-duration:1.6s]")} aria-hidden><circle cx="13" cy="13" r="11.5" fill="none" stroke="#e4e4e7" strokeWidth="1.5" /><path d="M13 1.5a11.5 11.5 0 0 1 11.5 11.5" fill="none" stroke="var(--glow)" strokeWidth="1.75" strokeLinecap="round" /></svg>
      {n}
    </span>
  );
  return <span style={{ width: CIRCLE, height: CIRCLE }} className={cx(base, s === "off" ? "border border-dashed border-zinc-300 bg-white text-zinc-300" : "border border-zinc-200 bg-white text-zinc-400")}>{n}</span>;
}

function StepMenu({ step }: { step: AgentStep }) {
  return <IconMenu icon={<MoreHorizontal />} label={`${step.title} options`} tone="bare" w={210} items={[
    { id: "edit", label: "Edit step", icon: <Pencil /> },
    { id: "once", label: "Run this step only", icon: <PlayCircle /> },
    { id: "out", label: "View last output", icon: <Eye /> },
    { id: "rm", label: "Remove", icon: <Trash2 /> },
  ]} />;
}

function IssuePill({ step }: { step: AgentStep }) {
  if (!step.issues) return null;
  return <span title={step.issues.note} className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-rust-50 px-2 text-[11px] font-medium text-rust ring-1 ring-rust-100 tnum"><span className="size-1.5 rounded-full bg-rust" />{step.issues.count} {step.issues.count === 1 ? "issue" : "issues"}</span>;
}

function Steps({ data, run, frame, frozen, on, setOn }: { data: AgentData; run: AgentRunState; frame: number | null; frozen: boolean; on: Record<string, boolean>; setOn: (id: string, v: boolean) => void }) {
  const n = data.steps.length;
  const y = (i: number) => i * ROW + C0;
  const fill = run.active === 0 ? 0 : y(Math.min(run.active, n - 1)) - (run.t < 1 ? ROW * (1 - run.t) : 0) - C0;
  const travelling = run.t < 1 && run.active > 0;
  return (
    <div className="relative px-5 pt-4 pb-2">
      {/* connector: hairline, inked up to the dot */}
      <div aria-hidden className="absolute w-px bg-zinc-200" style={{ left: 20 + CIRCLE / 2, top: 16 + C0, height: (n - 1) * ROW }} />
      <motion.div aria-hidden className="absolute w-px origin-top bg-ink" style={{ left: 20 + CIRCLE / 2, top: 16 + C0 }} initial={false} animate={{ height: Math.max(0, fill) }} transition={frozen ? { duration: 0 } : { duration: 0.7, ease: "easeInOut" }} />
      {travelling && (
        <motion.span aria-hidden key={`dot${frame ?? "f"}`} className="absolute z-20 size-[9px] rounded-full bg-[var(--glow)] shadow-[0_0_0_4px_var(--glow-soft),0_0_14px_3px_var(--glow-halo)]"
          style={{ left: 20 + CIRCLE / 2 - 4.5 }}
          initial={frozen ? false : { top: 16 + y(run.active - 1) - 4.5, opacity: 0 }}
          animate={{ top: 16 + y(run.active - 1) + ROW * run.t - 4.5 + (frozen ? 0 : ROW * (1 - run.t)), opacity: 1 }}
          transition={frozen ? { duration: 0 } : { duration: 0.72, ease: [0.45, 0, 0.2, 1] }} />
      )}
      <ol>
        {data.steps.map((st, i) => {
          const step = { ...st, on: on[st.id] ?? st.on };
          const s = stateOf(i, step, run), I = ICON[step.icon];
          const showIssue = !!step.issues && (s === "done" || s === "running");
          return (
            <li key={step.id} className={cx("relative grid items-start gap-3.5", s === "off" && "opacity-55")} style={{ height: ROW, gridTemplateColumns: `${CIRCLE}px 30px minmax(0,1fr) auto` }}>
              <span className="pt-[9px]"><AnimatePresence mode="wait" initial={false}><Circle key={s} n={i + 1} s={s} frozen={frozen} /></AnimatePresence></span>
              <span className={cx("mt-[7px] flex size-[30px] items-center justify-center rounded-lg ring-1 [&_svg]:size-[15px]", s === "running" ? "bg-white text-ink ring-zinc-300" : "bg-zinc-50 text-zinc-500 ring-zinc-200/80")}><I strokeWidth={1.75} /></span>
              <span className="min-w-0 pt-[8px]">
                <span className={cx("block truncate text-[13.5px] font-medium", s === "running" ? "shimmer shimmer-ink" : "text-ink", s === "running" && frozen && "shimmer-frozen")}>{step.title}</span>
                {s === "done" && step.result
                  ? <span title={step.desc} className="mt-0.5 block truncate text-[12.5px] text-zinc-600 tnum">{step.result}</span>
                  : <span className={cx("mt-0.5 block truncate text-[12.5px]", s === "running" ? cx("shimmer", frozen && "shimmer-frozen") : "text-zinc-500")}>{s === "running" && step.approval ? "Waiting for your approval…" : step.desc}</span>}
              </span>
              <span className="flex items-center gap-2 pt-[12px]">
                {showIssue && <IssuePill step={step} />}
                {step.approval && <ShieldCheck aria-label="Needs your approval" className="size-3.5 text-zinc-400" />}
                <Toggle on={step.on} onChange={(v) => setOn(step.id, v)} label={`${step.title} on`} />
                <StepMenu step={step} />
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------- flow canvas ---------- */
const NW = 200, NH = 96, ANCHOR = 38;
type Pt = { x: number; y: number };
function edgeGeom(a: Pt, b: Pt) {
  if (Math.abs(a.x - b.x) < 4) { // same column: bottom → top
    const p0 = { x: a.x + NW / 2, y: a.y + NH }, p3 = { x: b.x + NW / 2, y: b.y };
    return { d: `M${p0.x},${p0.y} L${p3.x},${p3.y}`, at: (t: number) => ({ x: p0.x, y: p0.y + (p3.y - p0.y) * t }) };
  }
  const p0 = { x: a.x + NW, y: a.y + ANCHOR }, p3 = { x: b.x, y: b.y + ANCHOR }, dx = (p3.x - p0.x) / 2;
  const p1 = { x: p0.x + dx, y: p0.y }, p2 = { x: p3.x - dx, y: p3.y };
  const at = (t: number) => { const u = 1 - t; return { x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x, y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y }; };
  return { d: `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`, at };
}

function Flow({ data, run, frozen }: { data: AgentData; run: AgentRunState; frozen: boolean }) {
  const pos = useMemo(() => Object.fromEntries(data.flow.nodes.map((nd) => [nd.stepId, nd])), [data]);
  const idx = (id: string) => data.steps.findIndex((s) => s.id === id);
  const activeId = data.steps[run.active]?.id;
  const travelling = run.t < 1;
  return (
    <div className="dot-grid relative" style={{ width: data.flow.w, height: data.flow.h }}>
      <svg className="absolute inset-0" width={data.flow.w} height={data.flow.h} aria-hidden>
        {data.flow.edges.map((e) => {
          const g = edgeGeom(pos[e.from], pos[e.to]);
          const into = e.to === activeId, doneEdge = idx(e.to) !== -1 && idx(e.to) < run.active || (e.from === "trigger" && run.active > 0);
          return <path key={`${e.from}-${e.to}`} d={g.d} fill="none" stroke={into ? "var(--ink-edge)" : doneEdge ? "#a1a1aa" : "#d4d4d8"} strokeWidth={into ? 1.4 : 1.1} strokeDasharray="4 4" className={cx(into && !frozen && "dash-flow")} />;
        })}
      </svg>
      {data.flow.edges.filter((e) => e.label).map((e) => {
        const p = edgeGeom(pos[e.from], pos[e.to]).at(0.5);
        return <span key={`l${e.from}-${e.to}`} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-1.5 py-[1px] text-[10px] whitespace-nowrap text-zinc-500 ring-1 ring-zinc-200" style={{ left: p.x, top: p.y }}>{e.label}</span>;
      })}
      {/* the glowing dot rides above the edge labels so a label never hides it */}
      <svg className="pointer-events-none absolute inset-0" width={data.flow.w} height={data.flow.h} aria-hidden>
        {data.flow.edges.filter((e) => e.to === activeId).map((e) => {
          const g = edgeGeom(pos[e.from], pos[e.to]);
          // frozen hand-off frames park the dot before the label (labels sit at t=.5)
          const p = g.at(0.3);
          return frozen ? (travelling && <g key={e.from}><circle cx={p.x} cy={p.y} r={8} fill="var(--glow)" opacity={0.35} filter="url(#glow2)" /><circle cx={p.x} cy={p.y} r={3.6} fill="var(--glow)" /></g>)
            : <g key={e.from}><circle r={8} fill="var(--glow)" opacity={0.35} filter="url(#glow2)"><animateMotion dur="1.4s" repeatCount="indefinite" path={g.d} /></circle><circle r={3.6} fill="var(--glow)"><animateMotion dur="1.4s" repeatCount="indefinite" path={g.d} /></circle></g>;
        })}
        <defs><filter id="glow2" x="-3" y="-3" width="7" height="7"><feGaussianBlur stdDeviation="3" /></filter></defs>
      </svg>
      {data.flow.nodes.map((nd) => {
        const isTrig = nd.stepId === "trigger";
        const i = idx(nd.stepId), st = i >= 0 ? data.steps[i] : undefined;
        const s: AgentStepState = isTrig ? "done" : stateOf(i, st!, run);
        const I = ICON[isTrig ? "trigger" : st!.icon];
        const title = isTrig ? "New files" : st!.short ?? st!.title;
        const desc = isTrig ? "Helio Sensors · any upload by the founders" : s === "done" && st!.result ? st!.result : st!.desc;
        return (
          <div key={nd.stepId} className={cx("absolute flex flex-col rounded-xl border bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(9,9,11,.04),0_6px_16px_-10px_rgba(9,9,11,.18)]", s === "running" ? "border-zinc-400 shadow-[0_0_0_4px_var(--glow-soft),0_6px_16px_-10px_rgba(9,9,11,.18)]" : "border-zinc-200")} style={{ left: nd.x, top: nd.y, width: NW, minHeight: NH }}>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200/80 [&_svg]:size-3.5"><I strokeWidth={1.75} /></span>
              <span className={cx("min-w-0 flex-1 truncate text-[12.5px] font-medium", s === "running" ? cx("shimmer shimmer-ink", frozen && "shimmer-frozen") : "text-ink")}>{title}</span>
              {isTrig ? <span className="text-[10px] text-zinc-400">Trigger</span> : <span className="scale-[.77] origin-right"><Circle n={i + 1} s={s} frozen={frozen} /></span>}
            </div>
            <div className="mt-2 border-t border-zinc-100 pt-2 text-[11.5px] leading-snug text-zinc-500 line-clamp-2">{desc}</div>
            {st?.issues && (s === "done" || s === "running") && <div className="mt-2"><IssuePill step={st} /></div>}
          </div>
        );
      })}
    </div>
  );
}

export function AgentScreen({ shell, data, assistant, view = "steps", run, autoplay = true, tone = "warm", onView, onRun }: {
  shell: ShellData; data: AgentData; assistant?: AssistantData; view?: "steps" | "flow";
  /** Freeze the run at a moment (screenshots). */ run?: AgentRunState; autoplay?: boolean; tone?: Tone2;
  onView?: (v: "steps" | "flow") => void; onRun?: () => void;
}) {
  const frozen = !!run;
  const { run: r, frame } = useRun(run, autoplay);
  const [on, setOnMap] = useState<Record<string, boolean>>({});
  const [v, setV] = useState(view);
  const setView = (x: "steps" | "flow") => { setV(x); onView?.(x); };
  const active = data.steps[r.active];
  const status: ReactNode = r.t < 1 ? <>Handing off to step {r.active + 1}</> : active?.approval ? <>Waiting for you · step {r.active + 1} of {data.steps.length}</> : <>Running · step {r.active + 1} of {data.steps.length}</>;
  return (
    <Page active="agents" shell={shell} tone={tone} dock={assistant ? <AssistantDock data={assistant} /> : undefined}
      top={<TopBar crumbs={[{ label: "Agents", href: "/agent" }, { label: data.name }]} ask={false} />}>
      <div className={cx("agent-root mx-auto w-full max-w-[880px] px-7 pt-8 pb-16", tone === "mono" ? "glow-mono" : "glow-warm")}>
        <div className="flex items-center gap-3.5">
          <CompanyLogo c={data.company} size={40} />
          <div className="min-w-0">
            <h1 className="serif truncate text-[28px] leading-none tracking-[-0.02em]">{data.name}</h1>
            <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-zinc-500" title={`${data.meta} · ${data.runId}`}><Pulse />{status}</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span role="tablist" aria-label="View" className="flex rounded-lg bg-zinc-100 p-0.5">
              {([["steps", ListOrdered, "Steps"], ["flow", Workflow, "Flow"]] as const).map(([k, Ic, l]) => (
                <button key={k} type="button" role="tab" aria-selected={v === k} aria-label={l} title={l} onClick={() => setView(k)} className={cx("flex h-7 w-8 items-center justify-center rounded-md [&_svg]:size-[15px]", v === k ? "bg-white text-ink shadow-sm" : "text-zinc-500 hover:text-ink")}><Ic strokeWidth={1.75} /></button>
              ))}
            </span>
            <IconBtn icon={<Pause />} label="Pause agent" />
            <IconMenu icon={<MoreHorizontal />} label="Agent options" w={220} items={[{ id: "dup", label: "Duplicate", icon: <Copy /> }, { id: "hist", label: "Run history", icon: <History />, hint: "38 runs" }, { id: "never", label: "Never emails founders, shares files or signs", icon: <ShieldCheck /> }]} />
            <Btn variant="primary" icon={<Play className="size-3.5" />} onClick={onRun}>Run now</Btn>
          </div>
        </div>

        {v === "steps" ? (
          <>
            <section className="mt-7 rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03)]">
              <div className="flex h-12 items-center px-5"><span className="text-[13.5px] font-medium">{data.trigger.title}</span><span className="ml-auto"><IconBtn icon={<Pencil />} label="Edit trigger" size="sm" /></span></div>
              <div className="flex items-center gap-3 border-t border-zinc-100 px-5 py-3.5 text-[13px] text-zinc-600">
                <span className="flex size-[30px] items-center justify-center rounded-lg bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200/80"><FolderInput className="size-[15px]" strokeWidth={1.75} /></span>
                <span>{data.trigger.when} <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[12px] font-medium text-ink">{data.trigger.chip}</span> {data.trigger.where}</span>
              </div>
            </section>
            <section className="mt-4 rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03)]">
              <div className="flex h-12 items-center gap-1 border-b border-zinc-100 px-5"><span className="text-[13.5px] font-medium">Steps</span><span className="ml-auto flex items-center gap-1"><IconBtn icon={<Sparkles />} label="Suggest a step" size="sm" /><IconBtn icon={<Plus />} label="Add step" size="sm" /></span></div>
              <Steps data={data} run={r} frame={frame} frozen={frozen} on={on} setOn={(id, x) => setOnMap((m) => ({ ...m, [id]: x }))} />
            </section>
          </>
        ) : (
          <section className="mt-7 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03)]">
            <div className="flex h-12 items-center border-b border-zinc-100 px-5"><span className="text-[13.5px] font-medium">Flow</span><span className="ml-auto flex items-center gap-1"><IconBtn icon={<Plus />} label="Add step" size="sm" /></span></div>
            <Flow data={data} run={r} frozen={frozen} />
          </section>
        )}
      </div>
    </Page>
  );
}
