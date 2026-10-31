"use client";
import type { ReactNode } from "react";
import { ExternalLink, ArrowRight, Check, X, Mail, MessageSquare, FileText, Calendar, Moon, Lock, Inbox, MailCheck } from "lucide-react";
import { Page, TopBar, Composer } from "../components/shell";
import { Src, Pill, Btn, Undo, Avatar, Logo, Spark, Waterfall, Delta, HL, cx, IconBtn, IconMenu, DetailRows, CompanyLogo } from "../components/ui";
import { Rise, Count, Pop, Grow, EdgePulse } from "../components/motion";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/states";
import { OutboundQueue, HoldToast } from "../components/outbound";
import type { DecisionCard, Draft, InsightTile, Meeting, OutboundItem, PulseTile, ScreenStatus, ShellData, TodayData } from "../types";
import { Gauge, MiniBars } from "../components/charts";

export interface TodayScreenProps extends ScreenStatus {
  shell: ShellData;
  data: TodayData;
  /** RunPanel / CommandPalette / AskPanel element, rendered above the page. */
  overlay?: ReactNode;
  holdMinutes?: number;
  /** false = freeze countdowns (screenshots/tests). */
  tick?: boolean;
  onAsk?: (q?: string) => void;
  onDecision?: (cardId: string, actionId: string) => void;
  onUndoBatch?: (batchId: string) => void;
  onPrep?: (meetingId: string) => void;
  onOpenTile?: (tileId: string) => void;
  onUndoSend?: (outboundId: string) => void;
  onSendNow?: (outboundId: string) => void;
}

/* ---------- Needs you: one primary action per card ---------- */
function CardHead({ c }: { c: DecisionCard }) {
  return <div className="flex items-center gap-2"><CompanyLogo c={c.company} size={22} /><span className="text-[12.5px] font-medium">{c.company.name}</span><Pill tone={c.tag.tone}>{c.tag.label}</Pill><span className="ml-auto text-[11px] text-zinc-400">{c.time}</span></div>;
}
function CardFoot({ c, onDecision }: { c: DecisionCard; onDecision?: TodayScreenProps["onDecision"] }) {
  return (
    <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3.5">
      <Btn variant="primary" onClick={() => onDecision?.(c.id, c.action.id)}>{c.action.label}</Btn>
      <span className="ml-auto flex items-center gap-1">{c.sources.map((s) => <Src key={s.label} k={s.kind}>{s.label}</Src>)}</span>
    </div>
  );
}
function Decision({ c, onDecision }: { c: DecisionCard; onDecision?: TodayScreenProps["onDecision"] }) {
  let body: ReactNode = null;
  if (c.kind === "arrGap") body = <div className="mt-4 flex items-end justify-between"><Waterfall h={104} barW={40} parts={c.bridge} /></div>;
  if (c.kind === "personMove") body = (
    <div className="mt-4 grid flex-1 grid-cols-[1fr_1fr] items-center gap-4">
      <div className="flex items-center justify-center gap-3 rounded-xl bg-zinc-50 py-5">
        <div className="text-center"><Avatar i={c.person.initials} size={40} /><div className="mt-1 text-[11.5px] font-medium">{c.person.name}</div></div>
        <div className="flex flex-col items-center"><span className="text-[10.5px] text-zinc-500">{c.date}</span><ArrowRight className="size-5 text-rust" /></div>
        <div className="text-center"><CompanyLogo c={c.to} size={40} /><div className="mt-1 text-[11.5px] font-medium">{c.to.name}</div></div>
      </div>
      <div><div className="text-[11.5px] text-zinc-500">{c.metric.label}</div><Delta a={c.metric.before} b={c.metric.after} /><div className="mt-2"><Spark d={c.metric.trend} w={150} h={40} color="#9c440f" /></div></div>
    </div>
  );
  if (c.kind === "tieOut") body = (
    <div className="mt-5 flex-1 space-y-3 text-[12.5px]">
      {c.rows.map((r, i) => <div key={r.label} className="grid grid-cols-[90px_1fr_56px] items-center gap-3"><span className="text-zinc-500">{r.label}</span><span className="h-5 rounded bg-[repeating-linear-gradient(135deg,#f4f4f5_0_4px,#fafafa_4px_8px)]"><Grow w={`${(r.value / c.scaleMax) * 100}%`} className={cx("h-full rounded", i === c.rows.length - 1 ? "bg-ink" : "bg-zinc-300")} /></span><span className="tnum text-right font-semibold">${r.value}M</span></div>)}
      <div className="text-[12px] text-zinc-500">{c.note}</div>
    </div>
  );
  if (c.kind === "quietBuyer") body = (
    <div className="mt-4 grid flex-1 grid-cols-2 items-center gap-4">
      <div><div className="text-[11.5px] text-zinc-500">{c.trendLabel}</div><div className="mt-2"><Spark d={c.trend} w={170} h={44} color="#9c440f" /></div></div>
      <div className="well flex items-center gap-3 px-4 py-3"><Gauge v={Math.min(1, c.countdown.value / 30)} size={56} tone="rust" ticks={30}><span className="numeral text-[17px] text-rust">{c.countdown.value}</span></Gauge><div><div className="text-[12px] font-medium">{c.countdown.unit}</div><div className="mt-0.5 text-[11.5px] text-zinc-500">{c.countdown.caption}</div></div></div>
    </div>
  );
  if (c.kind === "inboundFit") return (
    <div className="card-raised col-span-2 grid grid-cols-[1fr_auto] gap-8 p-5">
      <div className="flex min-w-0 flex-col">
        <CardHead c={c} />
        <div className="mt-2 serif text-[24px] leading-tight"><HL h={c.title} /></div>
        <div className="mt-2 flex items-center gap-2.5 text-[12.5px] text-zinc-600"><Avatar i={c.founder.initials} size={22} /><span><b className="font-medium text-ink">{c.founder.name}</b> · {c.founder.title}</span><span className="divider-v h-3" /><span className="flex items-center gap-1 text-zinc-500"><Inbox className="size-3.5" />{c.via}</span></div>
        <div className="mt-1.5 text-[12.5px] text-zinc-500">{c.ask}</div>
        <div className="mt-3 flex flex-wrap gap-1.5">{c.chips.map((x) => <span key={x.label} className={cx("inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11.5px]", x.ok ? "border-zinc-200 bg-white text-zinc-700" : "border-rust/25 bg-rust-50 text-rust")}>{x.ok ? <Check className="size-3 text-ok" /> : <X className="size-3" />}{x.label}</span>)}</div>
        <div className="mt-auto pt-4"><CardFoot c={c} onDecision={onDecision} /></div>
      </div>
      <div className="well flex w-[220px] flex-col items-center justify-center px-4 py-4">
        <Gauge v={c.fit} size={96} stroke={6} tone="ok" ticks={40}><span className="numeral text-[26px]">{Math.round(c.fit * 100)}</span></Gauge>
        <div className="mt-2 text-[12px] font-medium">Fit with {c.thesis}</div>
        <div className="mt-0.5 text-center text-[11px] text-zinc-500">{c.chips.filter((x) => x.ok).length} of {c.chips.length} thesis checks pass</div>
      </div>
    </div>
  );
  return (
    <div className="card-raised flex flex-col p-5">
      <CardHead c={c} />
      <div className="mt-2 serif text-[24px] leading-tight"><HL h={c.title} /></div>
      {body}
      <CardFoot c={c} onDecision={onDecision} />
    </div>
  );
}

/* ---------- Your day: meetings + drafts (never sent) ---------- */
function Meetings({ m, onPrep }: { m: TodayData["meetings"]; onPrep?: (id: string) => void }) {
  return (
    <div className="card-raised overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3"><span className="flex items-center gap-2 text-[13px] font-medium" title={`${m.items.length} meetings · ${m.app}`}><Calendar className="size-4 text-zinc-500" />{m.dayLabel}</span></div>
      <div className="divide-y divide-zinc-100 border-t border-zinc-100">
        {m.items.length === 0 && <div className="flex h-[44px] items-center px-5 text-[12.5px] text-zinc-400">No meetings today</div>}
        {m.items.map((x: Meeting) => (
          <div key={x.id} className={cx("flex h-[44px] items-center gap-3 px-5 text-[12.5px] hover:bg-zinc-50", x.next && "shadow-[inset_3px_0_0_#09090b]")}>
            <span className="tnum w-[42px] shrink-0 font-semibold">{x.time}</span>
            <span className="min-w-0 flex-1 truncate"><span className="font-medium">{x.title}</span><span className="text-zinc-500"> · {x.sub}</span></span>
                        <IconBtn size="sm" tone="bare" icon={<FileText />} label="Prep notes" onClick={() => onPrep?.(x.id)} />
          </div>
        ))}
        <div className="flex h-[44px] items-center gap-3 px-5 text-[12.5px] text-zinc-400"><span className="tnum w-[42px] shrink-0">{m.freeAfter}</span><span>Free after that</span></div>
      </div>
      <DayStrip items={m.items} />
    </div>
  );
}
/** Day at a glance: 08:00–19:00 with meeting blocks and a now marker. */
function DayStrip({ items }: { items: Meeting[] }) {
  const t = (s: string) => { const [h, mm] = s.split(":").map(Number); return ((h + mm / 60 - 8) / 11) * 100; };
  return (
    <div className="border-t border-zinc-100 px-5 pt-3 pb-4">
      <div className="relative h-7 rounded-md bg-[repeating-linear-gradient(90deg,transparent_0_calc(100%/11_-_1px),#ececec_calc(100%/11_-_1px)_calc(100%/11))] ring-1 ring-zinc-100">
        {items.map((x) => <span key={x.id} title={x.title} className={cx("absolute inset-y-1 rounded-[4px]", x.next ? "bg-ink" : "bg-zinc-300")} style={{ left: `${t(x.time)}%`, width: `${100 / 11}%` }} />)}
        <span className="absolute -inset-y-1 w-[2px] rounded bg-rust" style={{ left: `${t("08:30")}%` }} />
      </div>
      <div className="tnum relative mt-1.5 h-3 text-[10.5px] text-zinc-400">{[8, 10, 12, 14, 16, 18].map((h) => <span key={h} className="absolute -translate-x-1/2 first:translate-x-0" style={{ left: `${((h - 8) / 11) * 100}%` }}>{String(h).padStart(2, "0")}</span>)}</div>
    </div>
  );
}
function Drafts({ d }: { d: TodayData["drafts"] }) {
  return (
    <div className="card-raised overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3"><span className="flex items-center gap-2 text-[13px] font-medium"><Mail className="size-4 text-zinc-500" /><b className="tnum">{d.items.length}</b> drafts in {d.app}</span><span title="Not sent. Drafts wait for you."><Lock className="size-3.5 text-zinc-400" /></span></div>
      <div className="divide-y divide-zinc-100 border-t border-zinc-100">
        {d.items.length === 0 && <div className="flex h-[44px] items-center px-5 text-[12.5px] text-zinc-400">No drafts waiting</div>}
        {d.items.map((x: Draft) => x.preview ? (
          <div key={x.id} className="row-hover group grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-2.5 text-[12.5px]">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2"><span className="font-semibold">{x.to}</span><span className="min-w-0 truncate text-zinc-700">{x.subject}</span><span className="tnum ml-auto shrink-0 text-[11px] text-zinc-400">{x.time}</span></div>
              <div className="mt-0.5 truncate text-[12px] text-zinc-500" title={x.basis ? `Grounded in ${x.basis}` : undefined}>{x.preview}</div>
            </div>
            <IconBtn size="sm" tone="bare" href={x.href} icon={<ExternalLink />} label={`Review in ${d.app}`} />
          </div>
        ) : (
          <div key={x.id} className="group flex h-[44px] items-center gap-3 px-5 text-[12.5px] hover:bg-zinc-50">
            <span className="w-[104px] shrink-0 truncate font-semibold">{x.to}</span>
            <span className="min-w-0 flex-1 truncate text-zinc-600">{x.subject}</span>
            <span className="tnum text-[11px] text-zinc-400">{x.time}</span>
            <IconBtn size="sm" tone="bare" href={x.href} icon={<ExternalLink />} label={`Review in ${d.app}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Worth a look: insight tiles ---------- */
function Tile({ t, onOpen }: { t: InsightTile; onOpen?: (id: string) => void }) {
  const head = <div className="flex items-center gap-2"><CompanyLogo c={t.company} size={22} /><span className="text-[12.5px] font-medium">{t.company.name}</span>{t.pill && <Pill tone={t.pillTone ?? "neutral"} dot={false}>{t.pill}</Pill>}</div>;
  const srcs = <>{t.sources.map((s) => <Src key={s.label} k={s.kind}>{s.label}</Src>)}</>;
  if (t.kind === "runway") return (
    <div className="card relative overflow-hidden p-4">
      <EdgePulse />{head}
      <div className="mt-2 flex items-end justify-between"><span className="serif text-[28px] leading-none text-rust">{t.months}<span className="ml-1 text-[13px] text-zinc-500">mo</span></span><Spark d={t.trend} w={90} h={30} color="#9c440f" /></div>
      <div className="mt-2 flex items-center justify-between text-[11.5px]">{srcs}<a href={t.link.href} onClick={() => onOpen?.(t.id)} className="flex items-center gap-1 font-medium">{t.link.label}<ArrowRight className="size-3" /></a></div>
    </div>
  );
  return (
    <div className="card p-4">
      {head}
      {t.title && <div className="mt-2 text-[13px]">{t.title}</div>}
      {t.kind === "quietContact" && <><div className="mt-3 flex items-center gap-[3px]">{Array.from({ length: t.totalBars }).map((_, i) => <span key={i} className={cx("h-4 w-[5px] rounded-[1px]", i < t.activeBars ? "bg-ink" : "bg-zinc-200")} />)}</div><div className="mt-1 flex justify-between text-[11px] text-zinc-500"><span>{t.caption}</span><span className="font-medium text-rust">{t.value}</span></div></>}
      {t.kind === "secondLook" && <div className="mt-3 text-[18px]"><Delta a={t.before} b={t.after} tone="ok" /></div>}
      {t.kind === "rangeBars" && <><div className="mt-3 space-y-1">{t.ranges.map(([a, b], i) => <span key={i} className="relative block h-2 rounded bg-zinc-100"><span className={cx("absolute inset-y-0 rounded", i === t.emphasis ? "bg-ink" : "bg-zinc-300")} style={{ left: `${a}%`, width: `${b - a}%` }} /></span>)}</div><div className="tnum mt-1 flex justify-between text-[11px] text-zinc-500"><span>{t.axisLabels[0]}</span><span>{t.axisLabels[1]}</span></div></>}
      {t.kind === "progress" && <div className="mt-3 flex gap-[3px]">{Array.from({ length: t.total }).map((_, i) => <span key={i} className={cx("h-4 flex-1 rounded-[2px]", i < t.done ? "bg-ink" : "bg-zinc-200")} />)}</div>}
      {t.kind === "personMove" && <div className="mt-3 flex items-center gap-2 text-[12px] text-zinc-500"><Avatar i={t.person.initials} size={24} />{t.person.name} · {t.caption}</div>}
      {t.kind !== "rangeBars" && <div className={cx(t.kind === "secondLook" ? "mt-3" : "mt-2", "flex gap-1")}>{srcs}</div>}
    </div>
  );
}

/* ---------- Pulse: four numbers, each with a small visual ---------- */
function Pulse({ items }: { items: PulseTile[] }) {
  return (
    <div className="grid grid-cols-4 gap-px overflow-hidden rounded-[14px] bg-zinc-200/70 shadow-[var(--dd-e1)] ring-1 ring-zinc-200/70">
      {items.map((t) => (
        <div key={t.id} title={t.delta?.label} className={cx("relative flex items-center gap-3 bg-white px-4 py-3.5", t.tone === "rust" && "bg-[linear-gradient(180deg,#fff,#fdf8f5)]")}>
          {t.tone === "rust" && <span className="absolute inset-y-0 left-0 w-[3px] bg-rust" />}
          <div className="min-w-0 flex-1">
            <div className="eyebrow truncate">{t.label}</div>
            <div className={cx("numeral mt-1.5 text-[30px] leading-none", t.tone === "rust" && "text-rust")}>{t.value}{t.unit && <span className="ml-1 font-sans text-[12.5px] text-zinc-500">{t.unit}</span>}</div>
            <div className="mt-1.5 truncate text-[11.5px] text-zinc-500">{t.note}</div>
          </div>
          {t.viz?.kind === "bars" && <MiniBars d={t.viz.d} w={76} h={40} hl={t.viz.hl} />}
          {t.viz?.kind === "gauge" && <Gauge v={t.viz.v} size={56} ticks={24}><span className="tnum text-[11px] font-semibold">{t.viz.center}</span></Gauge>}
          {t.viz?.kind === "spark" && <Spark d={t.viz.d} w={84} h={42} color={t.tone === "rust" ? "#9c440f" : t.tone === "ok" ? "#3d6b4f" : "#09090b"} />}
        </div>
      ))}
    </div>
  );
}

function Hero({ d, onAsk, onUndoBatch }: { d: TodayData; onAsk?: TodayScreenProps["onAsk"]; onUndoBatch?: TodayScreenProps["onUndoBatch"] }) {
  return (
    <Rise className="grid grid-cols-[1fr_minmax(420px,560px)] items-end gap-10">
      <div>
        <div className="eyebrow eyebrow-mark">{d.dateLabel}</div>
        <h1 className="serif mt-1.5 text-[46px] leading-[1.05] tracking-[-0.02em]">{d.greeting}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[14px]">
          <span className="flex items-center gap-1.5 font-medium text-rust"><span className="size-2 rounded-full bg-rust" />{d.needYou} need you</span><span className="text-zinc-300">·</span>
          <span className="group/done flex items-center gap-1.5 text-zinc-600" title={d.doneWithoutYou.breakdown}><Pop><Check className="size-4 text-ok" /></Pop><span className="border-b border-dotted border-zinc-300"><Count to={d.doneWithoutYou.count} /> done without you</span><span className="opacity-0 transition-opacity group-hover/done:opacity-100 focus-within:opacity-100"><Undo onClick={() => onUndoBatch?.(d.doneWithoutYou.batchId)} /></span></span>
        </div>
      </div>
      <Composer placeholder={d.ask.placeholder} onAsk={() => onAsk?.()} onChip={(c) => onAsk?.(c)} />
    </Rise>
  );
}

export function TodayScreen(p: TodayScreenProps) {
  const { shell, data: d, status = "ready" } = p;
  const holding: OutboundItem | undefined = d.outbound?.find((o) => o.status === "holding");
  const top = <TopBar ask={false} crumbs={[{ label: "Today" }]} right={<IconMenu icon={<MailCheck />} label={`Brief sent ${d.briefSent.at}`} w={250} title="Morning brief"><DetailRows rows={[{ k: "Sent", v: <span className="tnum">{d.briefSent.at}</span> }, ...(d.briefSent.channels ? [{ k: "To", v: d.briefSent.channels }] : []), { k: "Evening brief", v: <span className="tnum">{d.eveningBrief}</span> }]} /></IconMenu>} />;
  const overlay = p.overlay ?? (holding ? <HoldToast o={holding} tick={p.tick} onUndo={p.onUndoSend} onSendNow={p.onSendNow} /> : undefined);
  return (
    <Page active="today" mode={d.mode} shell={shell} overlay={overlay} top={top}>
      {status === "loading" ? <ScreenSkeleton cols="grid-cols-[1fr]" /> : status === "error" ? <ErrorState message={p.error} onRetry={p.onRetry} /> : (
        <div className="mx-auto max-w-[1300px] space-y-6 px-8 pt-8 pb-14">
          <Hero d={d} onAsk={p.onAsk} onUndoBatch={p.onUndoBatch} />
          {d.pulse?.length ? <Rise i={1}><Pulse items={d.pulse} /></Rise> : null}
          {d.decisions.length === 0 || status === "empty"
            ? <EmptyState title="Nothing needs you" body={`${d.doneWithoutYou.count} things handled overnight. Undo any of them from the line above.`} />
            : <Rise i={1} className="grid grid-cols-2 gap-5">{d.decisions.map((c) => <Decision key={c.id} c={c} onDecision={p.onDecision} />)}</Rise>}
          <Rise i={2} className="grid grid-cols-2 gap-5"><Meetings m={d.meetings} onPrep={p.onPrep} />{d.outbound?.length ? <OutboundQueue items={d.outbound} holdMinutes={p.holdMinutes ?? 5} tick={p.tick} onUndo={p.onUndoSend} /> : <Drafts d={d.drafts} />}</Rise>
          <Rise i={3}>
            <div className="mb-2.5 flex items-center justify-between"><span className="eyebrow" title={d.worthALook.sourceNote}>Worth a look</span></div>
            <div className="grid grid-cols-3 gap-4">{d.worthALook.items.map((t) => <Tile key={t.id} t={t} onOpen={p.onOpenTile} />)}</div>
          </Rise>
          <div className="flex items-center justify-center gap-2 pt-1 text-[13px] text-zinc-500"><Pop delay={0.9}><Check className="size-4 text-ok" /></Pop>{d.closingLine}</div>
        </div>
      )}
    </Page>
  );
}
