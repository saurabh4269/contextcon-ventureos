"use client";
// Loading states that mirror each loaded screen: the same wrapper grids (so every responsive rule applies), and every
// card at the height it has once data arrives, so nothing moves when the data lands. Row counts are the common case
// (stated on each block). Measured by scripts/skeleton-audit.mjs.
import { Skeleton, SkCard } from "./states";
import { cx } from "./ui";

const bars = (n: number, cls = "h-3.5") => Array.from({ length: n }, (_, i) => <Skeleton key={i} className={cls} />);
const rows = (n: number, rowCls: string) => Array.from({ length: n }, (_, i) => <Skeleton key={i} className={rowCls} />);

/** Firm brain: memories nav, Claude/ChatGPT card, access log | growth, thesis, proposals, outcomes + priors, six memories. */
export function BrainSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto grid w-full max-w-[1240px] grid-cols-[300px_minmax(0,1fr)] items-start gap-5 px-7 pt-7 pb-16 @max-[900px]/main:grid-cols-1 @max-[720px]/main:px-4">
      <div className="flex flex-col gap-4">
        <SkCard className="h-[329px] space-y-3 p-5"><Skeleton className="h-4 w-1/2" />{rows(6, "h-7")}</SkCard>
        <SkCard className="h-[224px] space-y-3 p-5"><Skeleton className="h-4 w-2/3" />{bars(3)}<Skeleton className="h-9" /></SkCard>
        <SkCard className="h-[120px] space-y-3 p-5"><Skeleton className="h-4 w-1/2" />{bars(2)}</SkCard>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="h-[101px] pt-[26px]"><Skeleton className="h-9 w-[619px] max-w-full" /></div>
        <SkCard className="h-[255px] p-5"><Skeleton className="h-4 w-1/5" /><Skeleton className="-mt-[1px] ml-[234px] h-[128px]" /></SkCard>
        <SkCard className="h-[249px] space-y-3 p-5"><Skeleton className="h-4 w-1/3" />{bars(4)}</SkCard>
        <SkCard className="h-[142px] space-y-3 p-5"><Skeleton className="h-4 w-1/3" />{bars(2)}</SkCard>
        <div className="grid grid-cols-[1.35fr_1fr] gap-4 @max-[720px]/main:grid-cols-1"><SkCard className="h-[180px] space-y-3 p-5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-[66px]" /></SkCard><SkCard className="h-[180px] space-y-3 p-5"><Skeleton className="h-4 w-1/3" />{bars(3)}</SkCard></div>
        <Skeleton className="h-[115px]" />
        <SkCard className="h-[434px] p-5"><Skeleton className="h-4 w-1/3" /><div className="-mx-5 mt-[97px]">{Array.from({ length: 6 }, (_, i) => <div key={i} className="flex h-[60px] items-center px-5"><Skeleton className="h-9 w-full" /></div>)}</div></SkCard>
      </div>
    </div>
  );
}

/** Portfolio: heading, three stat cards, table + the selected company's panel (one company). */
export function PortfolioSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-7 pt-7 pb-16">
      <div className="px-1 pt-1"><Skeleton className="h-9 w-[315px] max-w-full" /><Skeleton className="mt-2.5 h-[21px] w-1/2" /></div>
      <div className="grid grid-cols-4 gap-4 @max-[900px]/main:grid-cols-2 @max-[720px]/main:grid-cols-1">{Array.from({ length: 3 }, (_, i) => <SkCard key={i} className="h-[127px] space-y-3 p-5"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-8 w-2/3" /></SkCard>)}</div>
      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5 @max-[1120px]/main:grid-cols-[minmax(0,1fr)_340px] @max-[900px]/main:grid-cols-1">
        <SkCard className="h-[166px] space-y-3 p-4"><Skeleton className="h-9 w-1/2 rounded-full" /><Skeleton className="h-11" /></SkCard>
        <SkCard className="h-[674px] p-5"><Skeleton className="h-10 w-2/3" /><Skeleton className="mt-[77px] h-[190px]" /><Skeleton className="mt-[193px] h-[81px]" /></SkCard>
      </div>
    </div>
  );
}

/** IC memo (document, three columns): outline | draft | sources. */
export function MemoSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid flex-1 grid-cols-[208px_minmax(0,1fr)_340px] @max-[1120px]/main:grid-cols-[196px_minmax(0,1fr)_296px] @max-[900px]/main:grid-cols-1">
      <div className="space-y-2 border-r border-zinc-200/70 px-3 pt-5 @max-[900px]/main:hidden">{rows(6, "h-7")}</div>
      <section className="min-h-[1807px] bg-zinc-100/60 px-10 pt-7 pb-12 @max-[900px]/main:min-h-[3274px] @max-[720px]/main:px-4">
        <div className="mx-auto w-full max-w-[448px]">
          <div className="h-[77px]"><Skeleton className="h-4 w-1/3" /></div>
          <Skeleton className="h-10 w-2/3" />
          <SkCard className="mt-6 h-[173px] space-y-3 p-5"><Skeleton className="h-4 w-1/3" />{bars(3)}</SkCard>
          <div className="h-[154px] space-y-3 pt-6">{bars(6)}</div>
          <SkCard className="h-[139px] p-5"><Skeleton className="h-full" /></SkCard>
          <div className="space-y-3 pt-6">{bars(24)}</div>
        </div>
      </section>
      <aside className="space-y-3 border-l border-zinc-200/70 bg-white px-6 pt-6 @max-[900px]/main:hidden"><Skeleton className="h-5 w-1/3" />{rows(5, "h-6")}</aside>
    </div>
  );
}

/** Deal page: header band, then outline | signals graph + fit rail (the Signals tab). */
export function DealSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="flex h-[146px] flex-col justify-center gap-3 border-b border-zinc-200/70 px-8 @max-[720px]/main:h-[248px] @max-[720px]/main:px-4"><Skeleton className="h-7 w-1/4" /><Skeleton className="h-4 w-1/2" /></div>
      <div className="grid grid-cols-1 content-start @min-[720px]/main:grid-cols-[168px_minmax(0,1fr)] @min-[1100px]/main:grid-cols-[200px_minmax(0,1fr)]">
        <div className="flex h-[55px] items-center gap-2 border-b border-zinc-200/70 px-3 @min-[720px]/main:block @min-[720px]/main:h-auto @min-[720px]/main:space-y-2 @min-[720px]/main:border-r @min-[720px]/main:border-b-0 @min-[720px]/main:pt-5">{rows(7, "h-8 w-20 shrink-0 @min-[720px]/main:w-full")}</div>
        <section className="min-h-[694px] min-w-0 px-8 pt-4 pb-6 @max-[720px]/main:px-4">
          <div className="flex h-[48px] items-center @max-[720px]/main:h-[92px]"><Skeleton className="h-8 w-1/2" /></div>
          <div className="grid grid-cols-1 gap-4 @min-[1100px]/main:grid-cols-[minmax(0,1fr)_276px]">
            <SkCard className="relative h-[594px] p-6"><Skeleton className="h-full" /><Skeleton className="absolute top-[215px] left-[282px] size-[176px] rounded-2xl bg-zinc-200/70 @max-[720px]/main:left-[291px]" /></SkCard>
            <SkCard className="flex h-[594px] flex-col p-4 @max-[1100px]/main:h-[364px]"><div className="h-[91px] @max-[1100px]/main:h-[75px]"><Skeleton className="h-4 w-1/2" /></div><Skeleton className="h-[139px]" /><Skeleton className="mt-auto h-[122px]" /></SkCard>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Settings: section list | the section's content. `cards` = connector tiles when the Connectors section is open. */
export function SettingsSkeleton({ connectors = 0 }: { connectors?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="grid flex-1 grid-cols-1 content-start @min-[720px]/main:content-stretch @min-[720px]/main:grid-cols-[200px_minmax(0,1fr)] @min-[1180px]/main:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex items-center gap-1 border-b border-zinc-200/70 px-3 py-2 @min-[720px]/main:row-span-2 @min-[720px]/main:block @min-[720px]/main:space-y-px @min-[720px]/main:border-r @min-[720px]/main:border-b-0 @min-[720px]/main:pt-5 @min-[720px]/main:pb-0">{rows(6, "h-8 w-24 shrink-0 @min-[720px]/main:w-full")}</div>
      <section className="min-w-0 px-8 pt-7 pb-12 @max-[720px]/main:px-4">
        {connectors ? (
          <div className="space-y-4"><Skeleton className="h-8 w-[534px] max-w-full" /><Skeleton className="h-[160px]" /><Skeleton className="h-[136px]" />
            <div className="grid grid-cols-3 gap-4 @max-[1100px]/main:grid-cols-2 @max-[720px]/main:grid-cols-1">{Array.from({ length: connectors }, (_, i) => <SkCard key={i} className="h-[252px] space-y-3 p-5"><Skeleton className="h-5 w-1/2" />{bars(3)}</SkCard>)}</div></div>
        ) : <SkCard className="mx-auto mt-14 h-[224px] max-w-[560px] space-y-3 p-7 @max-[720px]/main:mt-6 @max-[720px]/main:h-[273px]"><Skeleton className="mx-auto h-6 w-1/2" />{bars(2)}<Skeleton className="h-[58px] @max-[720px]/main:h-[95px]" /></SkCard>}
      </section>
    </div>
  );
}

/** Review queue: three open-item cards and the runs (inside the page's own heading block). */
export function ReviewSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="mt-6 grid grid-cols-1 gap-6">
      <section><Skeleton className="h-[18px] w-24" />
        <div className="mt-2 grid grid-cols-1 gap-3">{Array.from({ length: 3 }, (_, i) => <article key={i} className={cx("h-[254px] space-y-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200/80")}><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-8" /><Skeleton className="h-8 w-40" /></article>)}</div>
      </section>
      <section><Skeleton className="h-[18px] w-12" />
        <div className="mt-2 grid grid-cols-1 gap-2 @min-[900px]/main:grid-cols-2">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-[130px] rounded-xl" />)}</div>
      </section>
    </div>
  );
}
