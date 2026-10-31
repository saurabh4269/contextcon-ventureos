"use client";
/**
 * v3.4 · "How this agent works": the agent as a read-mostly flow canvas (Callora Composer craft, Deal Desk content).
 * Click a node → its settings slide in on the right. "Flow settings" → guardrails over a blurred canvas.
 * Run → a sienna dot travels each connector, the working node shimmers with a pulsing ring, finished nodes settle with a check.
 * Screenshots: `frozenMs` freezes the run (?t=ms / ?frame=n), `autoplay` starts it (?run=1).
 */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ListOrdered, Workflow, Play, RotateCcw, Settings2 } from "lucide-react";
import Link from "next/link";
import { Page, TopBar } from "../components/shell";
import { Btn, CompanyLogo, cx } from "../components/ui";
import { Pulse, useReducedMotion } from "../components/motion";
import { Skeleton, EmptyState, ErrorState } from "../components/states";
import { CARD, FlowCanvas, FlowIconChip, GuardrailsModal, NodePanel, flowRunAt, flowTotal, useFlowClock } from "../components/flowcanvas";
import { FitPill } from "../components/dealbits";
import { ROUTES } from "../routes";
import type { AgentFlowData, LoadStatus, ShellData } from "../types";

/** The deal the run is working on: logo, name and the same fit pill as Today and Pipeline. */
function Subject({ data }: { data: AgentFlowData }) {
  const d = data.run.deal;
  if (!d) return <span>{data.run.subject}</span>;
  return (
    <Link href={d.href ?? ROUTES.pipeline} className="inline-flex items-center gap-1.5 text-ink hover:underline">
      <CompanyLogo c={d.company} size={18} /><span className="font-medium">{d.company.name}</span><FitPill score={d.fit} signals={d.signals} />
    </Link>
  );
}

export function AgentFlowScreen({ shell, data, autoplay = false, frozenMs, node: node0 = null, modal = false, status = "ready", error, onRetry }: {
  shell: ShellData; data: AgentFlowData; autoplay?: boolean; frozenMs?: number; node?: string | null; modal?: boolean;
  status?: LoadStatus; error?: string; onRetry?: () => void;
}) {
  const reduced = useReducedMotion();
  const total = flowTotal(data);
  const { ms, playing, play } = useFlowClock(total, frozenMs, autoplay, reduced);
  const run = flowRunAt(data, ms);
  const frozen = frozenMs != null;
  const [sel, setSel] = useState<string | null>(node0);
  const [gr, setGr] = useState(modal);
  const selNode = data.nodes.find((n) => n.id === sel) ?? null;
  const cur = run.live && !run.complete ? data.run.events[run.i] : undefined;
  const curNode = cur && data.nodes.find((n) => n.id === (cur.at === "node" ? cur.ref : data.edges.find((e) => e.id === cur.ref)?.to));
  const empty = status === "empty" || data.nodes.length === 0;

  return (
    <Page active="agents" shell={shell} top={<TopBar crumbs={[{ label: "Agents", href: "/agent" }, { label: data.name }]} />}
      overlay={<AnimatePresence>{gr && <GuardrailsModal key="gr" d={data} onClose={() => setGr(false)} />}</AnimatePresence>}>
      <div className="glow-sienna flex h-[calc(100vh-52px)] min-h-[640px] flex-col px-6 pt-5 pb-6">
        <div className="flex shrink-0 items-center gap-3.5">
          {data.company ? <CompanyLogo c={data.company} size={40} /> : <FlowIconChip icon={data.icon} />}
          <div className="min-w-0">
            <div className="flex items-baseline gap-2.5">
              <h1 className="serif text-[30px] leading-none tracking-[-0.02em]">{data.name}</h1>
              <span className="text-[12px] text-zinc-400">{data.eyebrow}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-zinc-500">
              {cur ? <><Pulse className="bg-[#c2652b]" /><span className="shimmer shimmer-think">{cur.log ?? curNode?.title}</span><span className="text-zinc-300">·</span><Subject data={data} /></>
                : run.complete ? <><Pulse /><span>Finished</span><span className="text-zinc-300">·</span><Subject data={data} /><span className="text-zinc-300">·</span><span>{data.run.events.filter((e) => e.at === "node").slice(-1)[0]?.done}</span></>
                : <><Pulse /><span>On · {data.meta}</span></>}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {data.stepsHref && (
              <span role="tablist" aria-label="View" className="flex rounded-lg bg-zinc-100 p-0.5">
                <Link href={data.stepsHref} role="tab" aria-selected={false} aria-label="Steps" title="Steps" className="flex h-7 w-8 items-center justify-center rounded-md text-zinc-500 hover:text-ink"><ListOrdered className="size-[15px]" strokeWidth={1.75} /></Link>
                <span role="tab" aria-selected aria-label="Flow" title="Flow" className="flex h-7 w-8 items-center justify-center rounded-md bg-white text-ink shadow-sm"><Workflow className="size-[15px]" strokeWidth={1.75} /></span>
              </span>
            )}
            <Btn icon={<Settings2 className="size-3.5" />} onClick={() => setGr(true)}>Flow settings</Btn>
            <Btn variant="primary" className="!bg-rust shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_1px_2px_rgba(156,68,15,.3)] hover:!bg-[#87390c]" icon={run.complete ? <RotateCcw className="size-3.5" /> : <Play className="size-3.5" />} onClick={play} disabled={playing || empty || status !== "ready"}>{playing ? "Running…" : run.complete ? "Run again" : "Run on last pitch"}</Btn>
          </div>
        </div>

        <div className="mt-5 flex min-h-0 flex-1 gap-3">
          <section aria-label="Flow canvas" className={cx(CARD, "relative min-w-0 flex-1 overflow-hidden", gr && "blur-[2px]")}>
            {status === "loading" ? (
              <div className="flow-grid flex h-full items-center justify-center gap-14" aria-busy="true">{[0, 1, 2, 3].map((k) => <Skeleton key={k} className={cx("w-[200px] rounded-2xl", k === 1 ? "h-[260px]" : "h-[112px]")} />)}</div>
            ) : status === "error" ? (
              <div className="flow-grid h-full pt-10"><ErrorState message={error ?? "Couldn’t load this flow."} onRetry={onRetry ?? (() => window.location.reload())} /></div>
            ) : empty ? (
              <div className="flow-grid h-full pt-10"><EmptyState title="No steps yet" body="Describe what this agent should do and Deal Desk drafts the flow for you to review." action={<Link href={ROUTES.ask("agent")} className="inline-flex h-8 items-center rounded-lg bg-ink px-3 text-[12.5px] font-medium text-white hover:bg-zinc-800">Describe the agent</Link>} /></div>
            ) : (
              <FlowCanvas d={data} run={run} frozen={frozen} selected={sel} onSelect={setSel} />
            )}
          </section>
          <AnimatePresence initial={false}>
            {selNode && status === "ready" && (
              <motion.aside key="panel" aria-label={`${selNode.title} settings`} initial={{ width: 0, opacity: 0 }} animate={{ width: 340, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 36 }} className={cx(CARD, "shrink-0 overflow-hidden")}>
                <div className="h-full w-[340px]"><NodePanel key={selNode.id} n={selNode} onClose={() => setSel(null)} /></div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Page>
  );
}
