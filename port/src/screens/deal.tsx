"use client";
import { MiniBars } from "../components/charts";
import { FileText, FolderOpen, Plus, ExternalLink, Lock, Hash, Info, Check, MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Page, TopBar } from "../components/shell";
import { DealHead } from "../components/dealhead";
import { DealTeamPanel } from "../components/dealteam";
import { GrowthCard } from "../components/growthcard";
import { LiveRail } from "../components/liverail";
import { SignalSection } from "../components/signalgraph";
import { AlertCard, type AlertInit } from "../components/dealalert";
import { DealSectionView, CARD } from "../components/dealsections";
import { Src, SrcPop, srcIcon, Pill, Btn, IconBtn, IconMenu, Waterfall, StepDot, Confidence, Kbd, HL, Undo, cx } from "../components/ui";
import { Rise, GrowUp } from "../components/motion";
import { ScreenSkeleton, ErrorState } from "../components/states";
import { WallBadge, Masked } from "../components/wall";
import { ROUTES } from "../routes";
import type { DealData, EmailDraft, EvidenceItem, LoadStatus, OutlineItem, RestrictedDeal, ScreenStatus, ShellData, SourceRef } from "../types";

export interface DealScreenProps extends ScreenStatus {
  shell: ShellData;
  data: DealData;
  /** Keep source popovers open (screenshots / pixel checks). */
  pinSources?: boolean;
  onOpenRoom?: () => void;
  onOpenMemo?: () => void;
  onOutline?: (sectionId: string) => void;
  onAsk?: (actionId: string) => void;
  onClaim?: () => void | Promise<void>;
  onAssign?: (userId: string) => void;
  onUndoClaim?: () => void;
  /** v4 · "signals" shows the Crustdata Signal graph (needs `data.signals`); it spans the content + rail columns.
   *  Any other outline id with an entry in `data.sections` renders that section; otherwise the default (Growth) section. */
  view?: string;
  /** v4 · diligence alert: initial state (screenshots) and callbacks (verify = draft saved, request = raw data asked; undo → true). */
  alertInit?: AlertInit;
  onVerify?: (draft: EmailDraft) => void;
  onRequestData?: (undo?: boolean) => void;
  onAddReviewer?: (userId: string | null) => void;
  reviewerAdded?: boolean;
  /** v4 · the "Add to IC questions" row starts added (screenshots). */
  askAdded?: boolean;
  /** Signal graph: freeze the live research at this ms (screenshots), its own load state, and its actions. */
  signalsAt?: number;
  signalsStatus?: LoadStatus;
  onSignalAction?: (actionId: string) => void;
}
// With the docked assistant open (<main> narrower, container query) Source collapses to an icon chip with a tooltip.
const CL = "grid-cols-[minmax(0,.85fr)_58px_58px_58px_124px_minmax(0,1fr)] @max-[1040px]/main:grid-cols-[minmax(0,1fr)_64px_64px_64px_124px_36px] gap-x-3";
const WIDE = "@max-[1040px]/main:hidden", NARROW = "hidden @max-[1040px]/main:inline-flex";

/** Compact source: file-type icon in a round chip, label (and the quoted line) in the tooltip. */
function SrcIcon({ s }: { s: SourceRef }) {
  const I = srcIcon[s.kind];
  return <span tabIndex={0} title={s.excerpt ? `${s.label} · ${s.excerpt.where}: “${s.excerpt.quote}”` : s.label} aria-label={`Source: ${s.label}`} className="grid size-7 place-items-center rounded-full bg-white text-zinc-500 ring-1 ring-zinc-200 transition-colors hover:text-ink hover:ring-zinc-300 focus-visible:outline-2 focus-visible:outline-ink"><I className="size-3.5" strokeWidth={1.75} /></span>;
}

const PAPER = "rounded-[12px] bg-white shadow-[0_0_0_1px_rgba(9,9,11,.05),0_1px_3px_rgba(9,9,11,.06)]";
function Evidence({ e, href }: { e: EvidenceItem; href: string }) {
  const h = e.href ?? href;
  return (
    <div className={cx(CARD, "mt-3 p-4")}>
      <div className="flex items-center gap-2 text-[12px]"><Src k={e.source.kind}>{e.source.label}</Src><span className="text-zinc-500">{e.where}</span>
        <Link href={h} aria-label={`Open ${e.source.label} in the data room`} title="Open in the data room" className="ml-auto grid size-7 place-items-center rounded-full text-zinc-400 ring-1 ring-transparent transition-colors hover:bg-zinc-50 hover:text-ink hover:ring-zinc-200"><ExternalLink className="size-3.5" /></Link>
      </div>
      {e.kind === "doc" && <Link href={h} className={cx(PAPER, "mt-3 block px-4 pt-3.5 pb-4 transition-shadow hover:shadow-[0_0_0_1px_rgba(9,9,11,.08),0_8px_20px_-12px_rgba(9,9,11,.25)]")}>
        {e.page ? <>
          <div className="flex items-center justify-between"><span className="serif text-[15px] leading-none">{e.page.title}</span><span className="tnum text-[10.5px] text-zinc-400">{e.where}</span></div>
          <div className="mt-2.5 space-y-1 text-[11.5px] leading-[17px] text-zinc-500">{e.page.before.map((l) => <p key={l}>{l}</p>)}</div>
          <p className="-mx-1.5 my-1.5 rounded-[6px] bg-rust-50 px-1.5 py-1 text-[11.5px] leading-[17px] font-medium text-ink shadow-[inset_2px_0_0_#9c440f]">{e.highlight}</p>
          <div className="space-y-1 text-[11.5px] leading-[17px] text-zinc-500">{e.page.after.map((l) => <p key={l}>{l}</p>)}</div>
        </> : <p className="rounded-[6px] bg-rust-50 px-1.5 py-1 text-[11.5px] leading-[17px] font-medium shadow-[inset_2px_0_0_#9c440f]">{e.highlight}</p>}
      </Link>}
      {e.kind === "sheet" && <div className={cx(PAPER, "mt-3 overflow-hidden font-mono text-[11px]")}>
        {e.rows.map((r) => <div key={r.row} className={cx("grid grid-cols-[28px_1fr_60px] border-b border-zinc-100 last:border-0", r.highlight && "bg-rust-50")}><span className="border-r border-zinc-100 bg-zinc-50 py-1.5 text-center text-zinc-400">{r.row}</span><span className="px-2 py-1.5">{r.label}</span><span className="px-2 py-1.5 text-right">{r.value}</span></div>)}
      </div>}
      {e.kind === "bars" && <><div className={cx(PAPER, "mt-3 px-3 pt-3 pb-2")}><MiniBars d={e.values.map((v, _, a) => v - Math.min(...a) * 0.6)} w={276} h={52} />{e.labels && <div className="mt-1 flex justify-between px-1 text-[10.5px] text-zinc-400">{e.labels.map((l, i) => <span key={l} className={i === e.labels!.length - 1 ? "font-medium text-ink" : undefined}>{l}</span>)}</div>}</div><div className="mt-2 text-[12px] text-zinc-500">{e.caption}</div></>}
    </div>
  );
}

/** "Ask the founder" row: adds the question to the IC list in place (Undo puts it back). */
function AskRow({ text, label, init, onAsk }: { text: string; label: string; init?: boolean; onAsk?: () => void }) {
  const [added, setAdded] = useState(!!init);
  return (
    <div className={cx(CARD, "mt-4 flex flex-wrap items-center gap-3 p-4")}>
      <span className={cx("grid size-9 shrink-0 place-items-center rounded-full", added ? "bg-ok-50 text-ok" : "bg-[#fbf3ea] text-rust")}>{added ? <Check className="size-4" strokeWidth={2.25} /> : <MessageSquarePlus className="size-4" strokeWidth={1.75} />}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] @max-[720px]/main:basis-[calc(100%-48px)] @max-[720px]/main:whitespace-normal">{text}</span>
      {added ? <span className="flex shrink-0 items-center gap-3 text-[12.5px] text-ok">Added to IC questions<Undo onClick={() => setAdded(false)} /></span>
        : <button type="button" onClick={() => { setAdded(true); onAsk?.(); }} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(9,9,11,.2),inset_0_1px_0_rgba(255,255,255,.12)] transition-all hover:-translate-y-px hover:bg-zinc-800"><Plus className="size-3.5" />{label}</button>}
    </div>
  );
}

export function DealScreen(p: DealScreenProps) {
  const { data: d, status = "ready" } = p, s = d.section, name = d.header.company.name;
  const sig = p.view === "signals" && d.signals ? d.signals : null;
  const sec = !sig && p.view ? d.sections?.[p.view] ?? null : null;
  const base = d.outline.map((o) => (sig || sec ? { ...o, selected: !!sec && o.id === sec.id } : o));
  const outline: OutlineItem[] = d.signals ? [{ id: "signals", label: "Signals", state: "done", count: d.signals.calls.length, selected: !!sig }, ...base] : base;
  const id = d.header.company.id, onOutline = p.onOutline;
  // [ and ] step through the outline (the hint under the rail).
  useEffect(() => {
    if (!onOutline) return;
    const ids = outline.map((o) => o.id), cur = Math.max(0, outline.findIndex((o) => o.selected));
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
      if (e.key === "]" && cur < ids.length - 1) onOutline(ids[cur + 1]);
      if (e.key === "[" && cur > 0) onOutline(ids[cur - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOutline, outline.map((o) => `${o.id}${o.selected ? "*" : ""}`).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Page active="pipeline" shell={p.shell} top={<TopBar crumbs={[{ label: "Pipeline", href: ROUTES.pipeline }, { label: name }]} ctx={name} />}>
      {status === "loading" ? <ScreenSkeleton cols="grid-cols-[200px_minmax(0,1fr)_360px]" /> : status === "error" ? <ErrorState message={p.error} onRetry={p.onRetry} /> : <>
      <DealHead h={d.header} walled={d.walled} primary={<><IconBtn icon={<FolderOpen />} label="Data room" onClick={p.onOpenRoom} href={p.onOpenRoom ? undefined : ROUTES.dataRoom(id)} /><IconBtn icon={<FileText />} label="IC memo" onClick={p.onOpenMemo} href={p.onOpenMemo ? undefined : ROUTES.memo(id)} /></>} />
      {/* Phone: one column, the outline becomes a scrolling tab strip. Tablet: outline + content, the rail drops below.
          Desktop: outline · content · rail. With the assistant docked the rail steps aside. */}
      <div className={cx("grid flex-1 grid-cols-1 content-start @min-[720px]/main:content-stretch @min-[720px]/main:grid-cols-[168px_minmax(0,1fr)] group-data-[dock=open]/page:@min-[720px]/main:grid-cols-[168px_minmax(0,1fr)]", sig ? "@min-[1100px]/main:grid-cols-[200px_minmax(0,1fr)]" : "@min-[1100px]/main:grid-cols-[200px_minmax(0,1fr)_360px]")}>
        <nav aria-label="Diligence sections" className="border-b border-zinc-200/70 px-3 py-2 @min-[720px]/main:row-span-2 @min-[720px]/main:border-r @min-[720px]/main:border-b-0 @min-[720px]/main:pt-5 @min-[720px]/main:pb-0">
          <div className="eyebrow px-2 @max-[720px]/main:hidden">Diligence</div>
          <div className="mt-2 space-y-px @max-[720px]/main:[scrollbar-width:none] @max-[720px]/main:mt-0 @max-[720px]/main:-mx-3 @max-[720px]/main:flex @max-[720px]/main:gap-1 @max-[720px]/main:space-y-0 @max-[720px]/main:overflow-x-auto @max-[720px]/main:px-3">
            {outline.map((o) => (
              <button type="button" key={o.id} onClick={() => p.onOutline?.(o.id)} aria-current={o.selected || undefined} className={cx("flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] @max-[720px]/main:h-10 @max-[720px]/main:w-auto @max-[720px]/main:shrink-0 @max-[720px]/main:gap-2 @max-[720px]/main:rounded-full @max-[720px]/main:px-3 @max-[720px]/main:whitespace-nowrap", o.selected ? "bg-white font-medium shadow-[0_1px_2px_rgba(9,9,11,.06)] ring-1 ring-zinc-200" : "text-zinc-600 hover:bg-zinc-100")}>
                <StepDot s={o.state} size={14} />{o.label}{o.count != null && <span className={cx("tnum ml-auto text-[11px] @max-[720px]/main:ml-0.5", o.state === "warn" ? "text-rust" : "text-zinc-400")}>{o.count}</span>}
              </button>
            ))}
          </div>
          <div className="mt-6 px-2 text-[11px] text-zinc-400 @max-[720px]/main:hidden"><Kbd>[</Kbd> <Kbd>]</Kbd> prev / next</div>
        </nav>
        {sig ? <SignalSection data={sig} status={p.signalsStatus} freezeAt={p.signalsAt} autoplayKey={d.header.company.id} onAction={p.onSignalAction} onRetry={p.onRetry} /> : <>
        <section key={sec?.id ?? "main"} className="min-w-0 px-8 pt-7 pb-12 @max-[720px]/main:px-4 @max-[720px]/main:pt-5">
          {sec ? <DealSectionView s={sec} /> : <>
          <Rise>
            <div className="flex items-center gap-2"><span className="eyebrow" title={`${s.confidence} confidence`}>{s.eyebrow}</span></div>
            <h2 className="serif mt-2 text-[34px] leading-tight text-pretty @max-[1180px]/main:text-[30px] @max-[720px]/main:text-[26px]"><HL h={s.headline} /></h2>
          </Rise>
          {d.alert && <Rise i={1} className="mt-5"><AlertCard a={d.alert} init={p.alertInit} onVerify={p.onVerify} onRequest={p.onRequestData} /></Rise>}
          {s.growth ? (
            <Rise i={2} className={cx(CARD, "mt-4 p-6")}>
              <div className="mb-4"><span className="text-[14px] font-medium">Monthly revenue</span><span className="ml-2 text-[12.5px] text-zinc-500">deck vs verified</span></div>
              <GrowthCard g={s.growth} w={600} />
            </Rise>
          ) : (
            <Rise i={1} className="card-raised mt-5 p-6">
              <div className="flex items-start justify-between"><span className="eyebrow eyebrow-mark">ARR bridge</span>{s.bridgeNote && <IconMenu icon={<Info />} label="About this bridge" w={260}><span className="text-[12px] text-zinc-600">{s.bridgeNote}</span></IconMenu>}</div>
              <div className="mt-3"><Waterfall h={170} barW={56} parts={s.bridge} delta /></div>
            </Rise>
          )}
          <Rise i={3} className={cx(CARD, "mt-4 overflow-visible @max-[720px]/main:overflow-x-auto")}>
            <div className="@max-[720px]/main:min-w-[600px]">
            <div className={cx("grid h-9 items-center border-b border-zinc-100 bg-zinc-50/70 px-5 text-[11.5px] font-medium text-zinc-500", CL)}><span>Claim</span><span className="text-right">Reported</span><span className="text-right">Verified</span><span className="text-right">Variance</span><span>Status</span><span className={WIDE}>Source</span><span className={cx(NARROW, "justify-end")} aria-hidden /></div>
            {s.claims.map((c, i) => (
              <div key={c.id} className={cx("grid h-[56px] items-center border-b border-zinc-100 px-5 text-[13px] last:border-0", CL)}>
                <span className="truncate font-medium">{c.label}</span>
                <span className="text-right leading-tight"><span className="tnum block text-zinc-500 underline decoration-zinc-300 decoration-dotted underline-offset-2">{c.reported.value}</span><span className="text-[10.5px] text-zinc-400">{c.reported.source}</span></span>
                <span className="text-right leading-tight"><span className="tnum block font-semibold underline decoration-zinc-300 decoration-dotted underline-offset-2">{c.verified.value}</span><span className="text-[10.5px] text-zinc-400">{c.verified.source}</span></span>
                <span className={cx("tnum text-right", c.status.tone === "rust" ? "font-medium text-rust" : c.status.tone === "warn" ? "text-warn" : "text-zinc-500")}>{c.variance}</span>
                <span><Pill tone={c.status.tone === "neutral" ? "ok" : c.status.tone}>{c.status.label}</Pill></span>
                {/* First row opens ABOVE and right-aligned so it never covers the GM / NRR rows below. */}
                <span className={cx(NARROW, "justify-end")}><SrcIcon s={c.source} /></span>
                <span className={cx("flex min-w-0", WIDE)}>{c.source.excerpt ? <SrcPop source={c.source} pinned={p.pinSources && i === 0} side={i === 0 ? "above" : "below"} align="end" w={300} /> : <Src k={c.source.kind}>{c.source.label}</Src>}</span>
              </div>
            ))}
            </div>
          </Rise>
          <AskRow text={s.ask.text} label={s.ask.action.label} init={p.askAdded} onAsk={() => p.onAsk?.(s.ask.action.id)} />
          </>}
        </section>
        {/* v3.2: with the assistant docked, this column steps aside; the answers cite the same evidence */}
        <aside className="border-t border-zinc-200/70 bg-white px-6 pt-6 pb-10 max-lg:pb-24 group-data-[dock=open]/page:hidden @max-[720px]/main:px-4 @min-[720px]/main:col-start-2 @min-[1100px]/main:col-start-auto @min-[1100px]/main:border-t-0 @min-[1100px]/main:border-l">
          {d.live && <div className="mb-4"><LiveRail run={d.live} boxed /></div>}
          <DealTeamPanel team={d.team} me={p.shell.user.initials} onClaim={p.onClaim} onAssign={p.onAssign} onUndoClaim={p.onUndoClaim} onAddReviewer={p.onAddReviewer} reviewerAdded={p.reviewerAdded} />
          <div className="mt-6 flex items-center justify-between"><span className="text-[14px] font-medium">Evidence</span><span className="inline-flex items-center gap-1.5 text-[12px] text-ok"><Check className="size-3.5" />{d.evidence.agreeNote}</span></div>
          {d.evidence.items.map((e) => <Evidence key={e.id} e={e} href={ROUTES.dataRoom(id)} />)}
        </aside>
        </>}
      </div>
      </>}
    </Page>
  );
}

/* ============ Restricted deal (GET /api/deals/[id] → 403) ============ */
export interface RestrictedDealScreenProps { shell: ShellData; data: RestrictedDeal; mode?: "invest" | "bank"; channel?: string; onRequestAccess?: (codename: string) => void | Promise<void>; onWithdraw?: () => void }
export function RestrictedDealScreen(p: RestrictedDealScreenProps) {
  const d = p.data;
  const [requested, setRequested] = useState(!!d.requested);
  const req = async () => { setRequested(true); try { await p.onRequestAccess?.(d.codename); } catch { setRequested(false); } };
  return (
    <Page active="pipeline" mode={p.mode} shell={p.shell} top={<TopBar crumbs={[{ label: "Pipeline", href: ROUTES.pipeline }, { label: d.codename }]} ctx="All deals" />}>
      <div className="border-b border-zinc-200/70 bg-white px-8 py-5">
        <div className="flex items-center gap-3">
          <span className="size-10 rounded-[10px] bg-[repeating-linear-gradient(135deg,#e4e4e7_0_4px,#f4f4f5_4px_8px)]" />
          <div><div className="flex items-center gap-2"><h1 className="serif text-[28px] leading-none">{d.codename}</h1><WallBadge /></div>
            <div className="mt-1.5 flex items-center gap-3 text-[12px] text-zinc-500">{d.stageLabel && <Pill dot={false}>{d.stageLabel}</Pill>}<Masked w={120} /><Masked w={70} /><Masked w={90} /></div></div>
        </div>
      </div>
      <div className="dotgrid flex min-h-[calc(100vh-52px-81px)] items-start justify-center px-8 pt-16">
        <Rise className="card w-[520px] p-7">
          <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-white"><Lock className="size-[18px]" /></span>
          <h2 className="serif mt-4 text-[26px] leading-tight">You’re not on this deal’s wall</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">{d.reason} Names, numbers and files stay hidden, and Ask and search skip it for you.</p>
          <div className="mt-5 space-y-2 text-[12.5px]">
            {p.channel && <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2"><Hash className="size-3.5 text-zinc-400" />If you’re already working on it, ask in <b className="font-medium">{p.channel}</b></div>}
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2"><Lock className="size-3.5 text-zinc-400" />Access requests go to {d.approverRole}. Every request is logged.</div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            {requested ? <><Pill tone="ok">Requested · {d.approverRole} will reply in Slack</Pill><Undo label="Withdraw" onClick={() => { setRequested(false); p.onWithdraw?.(); }} /></> : <Btn variant="primary" onClick={req}>Request access</Btn>}
          </div>
        </Rise>
      </div>
    </Page>
  );
}
