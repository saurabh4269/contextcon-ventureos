"use client";
import { RangeChart } from "../components/charts";
import { Mail, Download, FileSpreadsheet, Presentation, Lock, ShieldCheck } from "lucide-react";
import { Page, TopBar } from "../components/shell";
import { Src, Pill, Btn, Logo, CompanyLogo, Spark, StepDot, Kbd, Avatar, cx, IconBtn, IconMenu } from "../components/ui";
import { Rise, Count, Grow } from "../components/motion";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/states";
import { WallBadge } from "../components/wall";
import { GateChecklist, GateStrip } from "../components/gates";
import { fmtMoney, pct } from "../lib/format";
import type { MandateGate, MandatesData, MilestoneState, ScreenStatus, ShellData } from "../types";

export interface MandatesScreenProps extends ScreenStatus {
  shell: ShellData;
  data: MandatesData;
  onSelectMandate?: (mandateId: string) => void;
  onSection?: (sectionId: string) => void;
  onExport?: () => void;
  onDraftReminders?: () => void;
  onOpenBuyer?: (buyerId: string) => void;
  onOpenQa?: (qaId: string) => void;
  onExportField?: (kind: "pptx" | "xlsx") => void;
  /** Gate action: request conflict check / send EL for signature / start KYC / nudge. */
  onGateAction?: (gateId: MandateGate["id"]) => void;
}
const dot = (m: MilestoneState) => (m === "done" ? "done" : m === "active" ? "running" : "queued");
const BCOLS = "grid-cols-[minmax(0,1fr)_58px_repeat(6,32px)_56px_62px] gap-x-1";

export function MandatesScreen(p: MandatesScreenProps) {
  const { data: d, status = "ready" } = p, ff = d.footballField;
  const gated = d.gates.some((g) => g.state !== "cleared");
  const top = d.funnel[0]?.n || 1;
  return (
    <Page active="mandates" mode="bank" shell={p.shell} top={<TopBar crumbs={[{ label: "Mandates" }, { label: d.selectedName }]} ctx={d.selectedName.replace("Project ", "")} />}>
      {status === "loading" ? <ScreenSkeleton cols="grid-cols-[210px_1fr_360px]" /> : status === "error" ? <ErrorState message={p.error} onRetry={p.onRetry} /> : d.mandates.length === 0 ? <EmptyState title="No mandates yet" body="New mandates appear here once conflicts clear." /> : (
      <div className="grid flex-1 grid-cols-[210px_1fr_360px]">
        <nav className="border-r border-zinc-200/70 px-3 pt-5">
          <div className="eyebrow px-2">Mandates</div>
          <div className="mt-2 space-y-1">
            {d.mandates.map((m) => (
              <button type="button" key={m.id} onClick={() => p.onSelectMandate?.(m.id)} aria-current={m.selected || undefined} className={cx("block w-full rounded-lg px-2.5 py-2 text-left", m.selected ? "bg-white shadow-[0_1px_2px_rgba(9,9,11,.06)] ring-1 ring-zinc-200" : "hover:bg-zinc-100")}>
                <div className="flex items-center gap-1.5 text-[13px] font-medium">{m.name}{m.walled && <ShieldCheck aria-label="Walled" className="size-3.5 text-zinc-400" />}</div>
                <div className="mt-0.5 text-[11.5px] text-zinc-500">{m.gatesOpen ? <span className="text-warn">{m.gatesOpen} gates open</span> : m.sub}</div>
                <div className="mt-1.5 h-1 rounded-full bg-zinc-100"><Grow w={`${m.progress * 100}%`} className="h-full rounded-full bg-ink" /></div>
              </button>
            ))}
          </div>
          <div className="mt-5 eyebrow px-2">In {d.selectedName.replace("Project ", "")}</div>
          <div className="mt-1.5 space-y-px text-[13px]">
            {d.sections.map((s) => <button type="button" key={s.id} disabled={gated} onClick={() => p.onSection?.(s.id)} className={cx("flex h-8 w-full items-center rounded-md px-2.5 text-left", s.selected && !gated ? "bg-zinc-200/60 font-medium" : "text-zinc-600", gated && "cursor-not-allowed text-zinc-400")}>{gated && <Lock className="mr-1.5 size-3" />}{s.label}<span className="ml-auto text-[11px] text-zinc-400">{s.meta}</span></button>)}
          </div>
        </nav>

        {gated ? (
          <section className="px-8 pt-6 pb-10">
            <div className="flex items-end justify-between">
              <div><div className="flex items-center gap-2"><span className="eyebrow">{d.eyebrow}</span>{d.walled && <WallBadge inside iconOnly />}</div><h1 className="serif mt-1 text-[32px] leading-none">{d.title}</h1>
                <p className="mt-2 max-w-[560px] text-[13px] text-zinc-500">Buyer work, the data room and outreach unlock when all three clear. Compliance signs off; every crossing is logged.</p></div>
            </div>
            <Rise i={1} className="mt-5"><GateChecklist gates={d.gates} onAction={p.onGateAction} /></Rise>
            <Rise i={2} className="mt-4 grid grid-cols-3 gap-4">
              {["Buyer list", "Data room", "Outreach drafts"].map((t) => (
                <div key={t} className="relative overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-white/60 p-4">
                  <div className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-500"><Lock className="size-3.5" />{t}</div>
                  <div className="mt-3 space-y-1.5">{[80, 64, 72].map((w, i) => <div key={i} className="h-2 rounded bg-zinc-100" style={{ width: `${w}%` }} />)}</div>
                  <div className="mt-3 text-[11px] text-zinc-400">Unlocks when all 3 gates clear</div>
                </div>
              ))}
            </Rise>
          </section>
        ) : (
        <section className="px-8 pt-6 pb-10">
          <div className="flex items-end justify-between">
            <div><div className="flex items-center gap-2"><span className="eyebrow">{d.eyebrow}</span>{d.walled && <WallBadge inside iconOnly />}</div><h1 className="serif mt-1 text-[32px] leading-none">{d.title}</h1></div>
            <div className="flex items-center gap-2"><IconBtn icon={<Download />} label="Export to Excel" onClick={p.onExport} /><Btn variant="primary" icon={<Mail className="size-3.5" />} onClick={p.onDraftReminders}>Draft IOI reminders</Btn></div>
          </div>
          <Rise i={1} className="mt-5 grid grid-cols-[1fr_260px] gap-4">
            <div className="card flex items-center p-5">
              {d.process.steps.map((s, i, a) => (
                <div key={s} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5"><StepDot s={i < d.process.currentIndex ? "done" : i === d.process.currentIndex ? "running" : "queued"} size={20} /><span className={cx("text-[12px]", i === d.process.currentIndex ? "font-semibold" : i > d.process.currentIndex ? "text-zinc-400" : "")}>{s}</span></div>
                  {i < a.length - 1 && <span className={cx("mx-2 mb-5 h-px flex-1", i < d.process.currentIndex ? "bg-ink" : "bg-zinc-200")} />}
                </div>
              ))}
            </div>
            <div className="card flex items-center gap-3 p-5"><div className="serif text-[40px] leading-none text-rust"><Count to={d.countdown.days} /></div><div className="text-[12.5px] leading-tight"><div className="font-medium">{d.countdown.label}</div><div className="text-zinc-500">{d.countdown.due}</div></div></div>
          </Rise>
          <Rise i={2} className="card mt-4 p-5">
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${d.funnel.length}, minmax(0,1fr))` }}>
              {d.funnel.map((f, i, a) => (
                <div key={f.label}>
                  <div className="serif text-[30px] leading-none"><Count to={f.n} /></div>
                  <div className="mt-2 h-2 rounded-full bg-zinc-100"><Grow w={`${(f.n / top) * 100}%`} delay={0.12 * i} className={cx("h-full rounded-full", i === a.length - 1 ? "bg-rust" : "bg-ink")} /></div>
                  <div className="mt-1.5 text-[12px] text-zinc-500">{f.label}</div>
                </div>
              ))}
            </div>
          </Rise>
          <Rise i={3} className="card mt-4 overflow-hidden">
            <div className={cx("grid h-9 items-center border-b border-zinc-100 bg-zinc-50/70 px-4 text-[11.5px] font-medium text-zinc-500", BCOLS)}>
              <span>Buyer</span><span>Type</span>{d.milestoneLabels.map((m) => <span key={m} title={m} className="text-center whitespace-nowrap">{m.split(" ")[0]}</span>)}<span title="VDR views">VDR</span><span className="truncate text-right" title="Last touch">Last</span>
            </div>
            {d.buyers.map((b) => (
              <button type="button" key={b.id} onClick={() => p.onOpenBuyer?.(b.id)} className={cx("grid h-[50px] w-full items-center border-b border-zinc-100 px-4 text-left text-[12.5px] last:border-0 hover:bg-zinc-50", BCOLS)}>
                <span className="flex min-w-0 items-center gap-2"><CompanyLogo c={b} size={22} /><span className="truncate font-medium" title={b.name}>{b.name}</span></span>
                <span className="truncate text-zinc-500">{b.type}</span>
                {b.milestones.map((x, i) => <span key={i} className="flex justify-center"><StepDot s={dot(x)} size={14} /></span>)}
                <span><Spark d={b.vdrViews} w={50} h={20} color={b.quiet ? "#9c440f" : "#09090b"} /></span>
                <span className={cx("tnum truncate text-right", b.quiet ? "font-medium text-rust" : "text-zinc-500")}>{b.lastTouch}</span>
              </button>
            ))}
            <div className="flex h-9 items-center border-t border-zinc-100 bg-zinc-50/50 px-4 text-[11.5px] text-zinc-500" title={`Synced ${d.sync.at} from ${d.sync.sources.map((s) => s.label).join(", ")}`}>+ {d.moreBuyers} more buyers</div>
          </Rise>
        </section>
        )}

        <aside className="border-l border-zinc-200/70 bg-white px-6 pt-6 pb-8">
          {gated ? <>
            <div className="flex items-center justify-between"><span className="eyebrow">Wall · {d.selectedName}</span><WallBadge inside size="xs" /></div>
            <div className="mt-3 space-y-1.5">
              {d.wall.members.map((m) => <div key={m.initials} className="flex h-9 items-center gap-2.5 text-[12.5px]"><Avatar i={m.initials} size={24} /><span className="font-medium">{m.name}</span><span className="ml-auto text-[11.5px] text-zinc-500">{m.role}</span></div>)}
            </div>
            <div className="mt-4 rounded-xl bg-zinc-50 p-3.5 text-[12px] leading-relaxed text-zinc-600">
              Outside this list, the mandate shows as <b className="font-semibold text-ink">{d.selectedName}</b> with no client, sector or numbers. Ask and search skip it.
            </div>
            <div className="mt-4 space-y-2 text-[12.5px]">
              <div className="flex justify-between"><span className="text-zinc-500">Crossings approved by</span><span className="font-medium">{d.wall.approver}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Crossings logged</span><span className="tnum font-medium">{d.wall.crossings}</span></div>
            </div>
            <div className="mt-5"><Btn>Request wall crossing</Btn></div>
          </> : <>
          <GateStrip gates={d.gates} />
          <div className="mt-5 flex items-center justify-between"><span className="eyebrow">Q&A log</span><span className="text-[11.5px] text-zinc-500"><b className="tnum text-ink">{d.qa.answered}</b>/{d.qa.total} answered</span></div>
          <div className="mt-3 h-1.5 rounded-full bg-zinc-100"><Grow w={`${(d.qa.answered / Math.max(d.qa.total, 1)) * 100}%`} className="h-full rounded-full bg-ink" /></div>
          <div className="mt-4 space-y-2.5">
            {d.qa.items.map((q) => q.status === "tieOut" ? (
              <button type="button" key={q.id} onClick={() => p.onOpenQa?.(q.id)} className="block w-full rounded-xl border border-rust-100 bg-rust-50/60 p-3.5 text-left">
                <div className="flex items-center gap-2"><Pill tone="rust">Doesn’t tie out</Pill><span className="ml-auto text-[11px] text-zinc-500">{q.buyer}</span></div>
                <div className="mt-2 text-[13px] font-medium">{q.question}</div>
                <div className="mt-2 flex gap-1">{q.sources.map((s) => <Src key={s.label} k={s.kind}>{s.label}</Src>)}</div>
              </button>
            ) : (
              <button type="button" key={q.id} onClick={() => p.onOpenQa?.(q.id)} className="block w-full rounded-xl border border-zinc-200 p-3.5 text-left">
                <div className="flex items-center gap-2"><Pill tone={q.status === "draftReady" ? "ok" : "warn"}>{q.status === "draftReady" ? "Draft ready" : "Needs client"}</Pill><span className="ml-auto text-[11px] text-zinc-500">{q.buyer}</span></div>
                <div className="mt-2 text-[13px]">{q.question}</div>
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between"><span className="eyebrow">Football field · {ff.basis}</span><IconMenu icon={<Download />} label="Export football field" title="Firm template" w={220} tone="bare" items={[{ id: "pptx", label: "PowerPoint", hint: ".pptx", icon: <Presentation />, onSelect: () => p.onExportField?.("pptx") }, { id: "xlsx", label: "Excel", hint: ".xlsx", icon: <FileSpreadsheet />, onSelect: () => p.onExportField?.("xlsx") }]} /></div>
          <div className="card-raised mt-2 px-3 pt-4 pb-2"><RangeChart v={ff} w={286} stacked ourLabel="Fair range" /></div>
          </>}
        </aside>
      </div>
      )}
    </Page>
  );
}
