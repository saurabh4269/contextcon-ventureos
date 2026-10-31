"use client";
// Overlays that sit on any screen: agent run panel, ⌘K palette, Ask (⌘J) panel.
import { Check, Lock, Search, CornerDownLeft, FileText, Users, Sparkles, Layers, BarChart3, ShieldAlert, ArrowUp, EyeOff } from "lucide-react";
import { SidePanel } from "./shell";
import { Btn, Kbd, Src, StepDot, Undo, cx } from "./ui";
import { Pop, Pulse, SlideHighlight } from "./motion";
import { WallBadge } from "./wall";
import type { AccessDenial, AgentRun, AskData, PaletteData, PaletteIcon } from "../types";

/* ---------- Agent run: slide-in panel (plan + how it got there, no raw reasoning) ---------- */
export function RunPanel({ run, onClose, onPause, onPrimary, onUndo }: { run: AgentRun; onClose?: () => void; onPause?: () => void; onPrimary?: (actionId: string) => void; onUndo?: (actionId: string) => void }) {
  return (
    <SidePanel w={500} onClose={onClose} title={run.title} sub={<span className="flex items-center gap-2">{run.status === "running" && <Pulse />}{run.status === "running" ? "Running" : run.status === "paused" ? "Paused" : run.status === "failed" ? "Failed" : "Finished"} since {run.since} · {run.trigger}</span>}
      foot={<div className="flex items-center gap-2"><Btn variant="primary" onClick={() => onPrimary?.(run.primary.id)}>{run.primary.label}</Btn><Btn variant="subtle" onClick={onPause}>Pause</Btn></div>}>
      <div className="grid grid-cols-3 gap-2">
        {run.stats.map((s) => <div key={s.label} className="rounded-xl bg-zinc-50 px-3 py-2.5"><div className="serif text-[24px] leading-none">{s.value}</div><div className="mt-1 text-[11.5px] text-zinc-500">{s.label}</div></div>)}
      </div>
      <div className="mt-5 eyebrow">Plan</div>
      <div className="relative mt-2 space-y-0 before:absolute before:top-3 before:bottom-3 before:left-[8.5px] before:w-px before:bg-zinc-200">
        {run.plan.map((p) => (
          <div key={p.id} className="relative flex h-[34px] items-center gap-3">
            <span className="z-10 bg-white">{p.state === "done" ? <Pop delay={0.2}><StepDot s="done" /></Pop> : <StepDot s={p.state} />}</span>
            <span className={cx("text-[13px]", p.state === "queued" ? "text-zinc-400" : "text-ink", p.state === "warn" && "text-warn")}>{p.label}</span>
            <span className={cx("tnum ml-auto text-[12px]", p.state === "running" ? "font-medium text-ok" : "text-zinc-500")}>{p.result}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 eyebrow">How it got there</div>
      <div className="dotgrid mt-2 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
        <div className="mx-auto w-fit rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px]">{run.graph.root}</div>
        <div className="mx-auto h-3 w-px bg-zinc-300" />
        <div className="grid grid-cols-3 gap-2 border-t border-zinc-300 pt-3">
          {run.graph.branches.map((b) => <div key={b.title} className="rounded-lg border border-zinc-200 bg-white p-2"><div className="text-[12px] font-medium">{b.title}</div><div className="mt-1"><Src k={b.source.kind}>{b.source.label}</Src></div></div>)}
        </div>
        <div className="mx-auto h-3 w-px bg-zinc-300" />
        <div className="mx-auto flex w-fit items-center gap-2 rounded-lg bg-ink px-3 py-1.5 text-[12px] text-white">{run.graph.result}</div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-[12px]">
        <div><div className="eyebrow">Did on its own</div><div className="mt-1.5 space-y-1">{run.didOnItsOwn.map((t) => <div key={t.id} className="flex items-center gap-1.5"><Check className="size-3.5 text-ok" />{t.label}<Undo className="ml-auto" onClick={() => onUndo?.(t.id)} /></div>)}</div></div>
        <div><div className="eyebrow">Never does</div><div className="mt-1.5 flex flex-wrap gap-1">{run.neverDoes.map((t) => <span key={t} className="flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-zinc-600"><Lock className="size-3" />{t}</span>)}</div></div>
      </div>
    </SidePanel>
  );
}

/* ---------- Denial (ephemeral, only the asker sees it) ---------- */
export function DenialNote({ d, onRequest, compact }: { d: AccessDenial; onRequest?: () => void; compact?: boolean }) {
  return (
    <div className={cx("rounded-xl border border-zinc-300 bg-zinc-50", compact ? "p-3" : "p-4")}>
      <div className="flex items-center gap-2 text-[13px]"><ShieldAlert className="size-4 text-ink" /><span className="font-semibold">{d.codename}</span><WallBadge size="xs" /><span className="ml-auto flex items-center gap-1 text-[11px] text-zinc-500"><EyeOff className="size-3" />Only you see this</span></div>
      <div className="mt-1.5 text-[12.5px] text-zinc-600">{d.reason}</div>
      {d.requestable && <div className="mt-2.5 flex items-center gap-2"><Btn onClick={onRequest} icon={<Lock className="size-3.5" />}>Request access</Btn><span className="text-[11px] text-zinc-400">Goes to compliance · logged</span></div>}
    </div>
  );
}

/* ---------- ⌘K palette ---------- */
const palIcon: Record<PaletteIcon, typeof Layers> = { deal: Layers, file: FileText, sheet: BarChart3, ask: Sparkles, person: Users };
export function CommandPalette({ data, onSelect, onClose, onRequestAccess }: { data: PaletteData; onSelect?: (id: string) => void; onClose?: () => void; onRequestAccess?: (codename: string) => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-zinc-900/20" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="fixed top-[120px] left-1/2 z-50 w-[620px] -translate-x-1/2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_30px_80px_-20px_rgba(9,9,11,.4)]">
        <div className="flex h-14 items-center gap-3 border-b border-zinc-100 px-4"><Search className="size-4 text-zinc-400" /><span className="text-[15px]">{data.query}</span><span className="h-5 w-px motion-safe:animate-pulse bg-ink" /><span className="ml-auto"><Kbd>Esc</Kbd></span></div>
        {data.denied && <div className="px-4 pt-3 pb-1"><DenialNote d={data.denied} compact onRequest={() => onRequestAccess?.(data.denied!.codename)} /></div>}
        {data.groups.map((g) => {
          const hl = g.items.findIndex((r) => r.id === data.selectedId);
          return (
            <div key={g.title} className="px-2 pb-1.5" role="group" aria-label={g.title}><div className="px-2 pt-2 pb-1 text-[11px] text-zinc-400">{g.title}</div>
              <div className="relative">
                {hl >= 0 && <SlideHighlight to={hl} from={g.items.length} rowH={36} />}
                {g.items.map((r) => { const I = palIcon[r.icon]; return <button type="button" key={r.id} onClick={() => onSelect?.(r.id)} className="relative flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px]"><I className="size-4 text-zinc-500" strokeWidth={1.75} /><span className="font-medium">{r.label}</span><span className="text-zinc-400">{r.meta}</span>{r.id === data.selectedId && <span className="ml-auto"><CornerDownLeft className="size-3.5 text-zinc-400" /></span>}</button>; })}
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-4 border-t border-zinc-100 bg-zinc-50 px-4 py-2 text-[11px] text-zinc-500"><span><Kbd>↑</Kbd> <Kbd>↓</Kbd> move</span><span><Kbd>↵</Kbd> open</span><span><Kbd>⌘J</Kbd> ask</span></div>
      </div>
    </>
  );
}

/* ---------- Ask (⌘J) panel ---------- */
export function AskPanel({ data, onClose, onFollowUp, onRequestAccess }: { data: AskData; onClose?: () => void; onFollowUp?: (q: string) => void; onRequestAccess?: (codename: string) => void }) {
  const a = data.answer;
  return (
    <SidePanel w={520} onClose={onClose} title={data.question} sub={<span className="flex items-center gap-1.5"><Sparkles className="size-3 text-rust" />Ask · {data.scope}</span>}
      foot={<div className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2"><span className="text-[13px] text-zinc-400">Ask a follow-up…</span><span className="ml-auto flex size-7 items-center justify-center rounded-lg bg-ink text-white"><ArrowUp className="size-3.5" /></span></div>}>
      {a.kind === "denied" ? (
        <div className="space-y-3">
          <DenialNote d={a.denial} onRequest={() => onRequestAccess?.(a.denial.codename)} />
          <div className="text-[12px] leading-relaxed text-zinc-500">Ask only searches deals you’re on. Nothing from behind the wall was read to answer this, and the channel you asked in sees nothing.</div>
        </div>
      ) : (
        <div>
          <div className="space-y-3 text-[14px] leading-6">
            {a.paragraphs.map((p, i) => <p key={i}>{p.text}{p.cites.map((c) => <sup key={c} className="ml-0.5 rounded bg-zinc-100 px-1 text-[9.5px] font-semibold text-zinc-600">{c}</sup>)}</p>)}
          </div>
          <div className="mt-4 eyebrow">Sources</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{a.sources.map((s) => <Src key={s.label} k={s.kind} n={s.n}>{s.label}</Src>)}</div>
          <div className="mt-5 flex flex-wrap gap-1.5">{a.followUps.map((f) => <button type="button" key={f} onClick={() => onFollowUp?.(f)} className="rounded-full border border-zinc-200 px-3 py-1 text-[12px] text-zinc-600 hover:bg-zinc-50">{f}</button>)}</div>
        </div>
      )}
    </SidePanel>
  );
}
