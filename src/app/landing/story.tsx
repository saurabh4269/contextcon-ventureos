"use client";
/**
 * Landing value story, shown under the hero: "an outcome, not a tool" (who pays, what it replaces, what you get, the
 * pricing hypothesis) and the strip of how a request becomes finished work (request → plan → Crustdata → checks →
 * a person for exceptions → cited shortlist/memo). Every word comes from `LandingStory`; the illustrations are bars
 * and endpoint names only, never sample data.
 */
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Database, FileCheck2, FileText, ListChecks, MessageSquareText, Repeat2, ShieldCheck, Sparkles, UserCheck, Wallet, type LucideIcon } from "lucide-react";
import { Src, cx } from "@port/components/ui";
import { useReducedMotion } from "@port/components/motion";
import type { AccentLine } from "@port/types";
import { askHref, type LandingStory } from "@/content/landing-story";

const STEP_ICON: Record<string, LucideIcon> = { request: MessageSquareText, plan: ListChecks, crustdata: Database, checks: ShieldCheck, exceptions: UserCheck, done: FileCheck2 };
const CARD_ICON: Record<string, LucideIcon> = { pays: Wallet, replaces: Repeat2, outcome: FileText };
const CARD = "rounded-[24px] border border-[#efe2d4] bg-white shadow-[0_1px_2px_rgba(60,20,0,.04),0_18px_40px_-28px_rgba(120,48,10,.28)]";
const KEYFRAMES = "@keyframes ls-travel{0%{left:0;opacity:0}8%{opacity:1}92%{opacity:1}100%{left:100%;opacity:0}}";

function Title({ l }: { l: AccentLine }) {
  return <>{l.before}<span className="text-rust italic">{l.accent}</span>{l.after}</>;
}

function Eyebrow({ children }: { children: string }) {
  return <span className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-[.08em] text-rust uppercase"><Sparkles className="size-3.5" />{children}</span>;
}

/** Bars standing in for text: the shape of the output, with no content. */
function Bars({ widths, tone }: { widths: number[]; tone: "grey" | "warm" }) {
  return <>{widths.map((w, i) => <span key={i} className={cx("block h-2 rounded-full", tone === "grey" ? "bg-zinc-200" : "bg-[#efe2d4]")} style={{ width: `${w}%` }} />)}</>;
}

function ToolPanel({ label, line }: { label: string; line: string }) {
  return (
    <div className="flex flex-col rounded-[20px] bg-zinc-50 p-5 ring-1 ring-zinc-200/80">
      <div aria-hidden className="space-y-2.5 rounded-[14px] bg-white p-4 ring-1 ring-zinc-200/70">
        {[0, 1, 2, 3, 4].map((r) => (
          <div key={r} className="grid grid-cols-[1.4fr_1fr_1fr_.8fr] gap-3">{[70, 55, 40, 60].map((w, c) => <span key={c} className="block h-2 rounded-full bg-zinc-200" style={{ width: `${w - r * 3}%` }} />)}</div>
        ))}
      </div>
      <p className="mt-4 text-[13px] font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-[14px] leading-[1.5] text-zinc-600">{line}</p>
    </div>
  );
}

function ServicePanel({ label, line }: { label: string; line: string }) {
  return (
    <div className="flex flex-col rounded-[20px] bg-[#fbf3ee] p-5 ring-1 ring-rust-100">
      <div aria-hidden className="rounded-[14px] bg-white p-4 shadow-[0_10px_24px_-18px_rgba(120,48,10,.45)] ring-1 ring-[#efe2d4]">
        <div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-rust text-white"><FileText className="size-3" /></span><Bars widths={[38]} tone="warm" /><span className="ml-auto grid size-5 place-items-center rounded-full bg-[#2f9a5c] text-white"><Check className="size-3" strokeWidth={3} /></span></div>
        <div className="mt-3 space-y-2"><Bars widths={[92, 84, 66]} tone="warm" /></div>
        <div className="mt-3 flex flex-wrap gap-1.5"><Src k="crust" n={1}>/company/enrich</Src><Src k="crust" n={2}>/person/enrich</Src></div>
        <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-[#fbf6f0] px-2.5 py-1.5 ring-1 ring-[#f1e2d2]"><UserCheck className="size-3.5 text-rust" /><Bars widths={[46]} tone="warm" /><span className="ml-auto h-5 w-14 rounded-full bg-ink" /></div>
      </div>
      <p className="mt-4 text-[13px] font-medium text-rust">{label}</p>
      <p className="mt-1 text-[14px] leading-[1.5] text-zinc-700">{line}</p>
    </div>
  );
}

function Value({ d }: { d: LandingStory["value"] }) {
  return (
    <section id="value" aria-labelledby="value-title" className="mx-auto max-w-[1240px] scroll-mt-24 px-6 pt-24 max-sm:px-3 max-sm:pt-14">
      <div className="mx-auto max-w-[760px] text-center">
        <Eyebrow>{d.eyebrow}</Eyebrow>
        <h2 id="value-title" className="serif mt-4 text-[48px] leading-[1.04] tracking-[-0.03em] max-sm:text-[34px]"><Title l={d.title} /></h2>
        <p className="mx-auto mt-4 max-w-[540px] text-[15px] leading-[1.6] text-zinc-500">{d.sub}</p>
      </div>
      <div className="mt-12 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
        <ToolPanel {...d.tool} />
        <span aria-hidden className="grid place-items-center text-rust max-md:rotate-90"><ArrowRight className="size-5" /></span>
        <ServicePanel {...d.service} />
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {d.cards.map((c) => {
          const I = CARD_ICON[c.id] ?? FileText;
          return (
            <article key={c.id} className={cx(CARD, "p-5")}>
              <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-full bg-rust-50 text-rust ring-1 ring-rust-100"><I className="size-4" /></span><span className="text-[12px] font-medium tracking-[.06em] text-zinc-500 uppercase">{c.label}</span></div>
              <h3 className="serif mt-3 text-[22px] leading-tight tracking-[-0.015em]">{c.title}</h3>
              <p className="mt-1.5 text-[14px] leading-[1.55] text-zinc-500">{c.body}</p>
              {c.tags && <div className="mt-3 flex flex-wrap gap-1.5">{c.tags.map((t) => <span key={t} className="rounded-full bg-zinc-50 px-2.5 py-1 text-[12px] text-zinc-700 ring-1 ring-zinc-200">{t}</span>)}</div>}
            </article>
          );
        })}
      </div>
      <p className="mt-5 flex flex-wrap items-center justify-center gap-2 text-center text-[13.5px] text-zinc-600">
        <span className="rounded-full bg-[#fff6e6] px-2.5 py-0.5 text-[11.5px] font-medium tracking-[.04em] text-[#8a5a00] uppercase ring-1 ring-[#f3dfb5]">{d.pricing.badge}</span>{d.pricing.line}
      </p>
    </section>
  );
}

function Flow({ d, moving }: { d: LandingStory["flow"]; moving: boolean }) {
  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-[1240px] scroll-mt-24 px-6 pt-24 max-sm:px-3 max-sm:pt-14">
      <div className="mx-auto max-w-[760px] text-center">
        <Eyebrow>{d.eyebrow}</Eyebrow>
        <h2 id="how-title" className="serif mt-4 text-[48px] leading-[1.04] tracking-[-0.03em] max-sm:text-[34px]"><Title l={d.title} /></h2>
      </div>
      <div className={cx(CARD, "mt-12 p-6 max-sm:p-4")}>
        <div className="ml-auto max-w-[720px] rounded-[18px] rounded-br-[6px] bg-ink px-4 py-3 text-[14px] leading-[1.5] text-white shadow-[0_8px_18px_-10px_rgba(9,9,11,.6)]">{d.request}</div>
        <div className="relative mt-8">
          {/* connector behind the step icons (desktop row only) */}
          <div aria-hidden className="absolute top-[22px] right-[8%] left-[8%] hidden h-px bg-[linear-gradient(90deg,#efe2d4,#c2652b_50%,#efe2d4)] lg:block">
            {moving && <span className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c2652b] shadow-[0_0_10px_rgba(194,101,43,.7)]" style={{ animation: "ls-travel 6s linear infinite" }} />}
          </div>
          <ol className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-6 lg:gap-3">
            {d.steps.map((s, i) => {
              const I = STEP_ICON[s.id] ?? Check;
              return (
                <li key={s.id} className={cx("flex flex-col items-start lg:items-center lg:text-center", s.person && "rounded-[16px] bg-[#fbf3ee] p-3 ring-1 ring-rust-100 lg:-m-3")}>
                  <span className={cx("grid size-11 place-items-center rounded-full ring-4 ring-white", s.person ? "bg-rust text-white" : i === d.steps.length - 1 ? "bg-[#2f9a5c] text-white" : "bg-white text-ink shadow-[inset_0_0_0_1px_#e7d6c4]")}><I className="size-[18px]" strokeWidth={1.75} /></span>
                  <span className="tnum mt-3 text-[11px] font-medium tracking-[.08em] text-zinc-400 uppercase">{i + 1} · {s.label}</span>
                  <h3 className="mt-1 text-[14.5px] leading-tight font-medium">{s.title}</h3>
                  <p className="mt-1 text-[12.5px] leading-[1.5] text-zinc-500">{s.body}</p>
                  {s.endpoints && <div className="mt-2 flex flex-wrap gap-1 lg:justify-center">{s.endpoints.map((e) => <Src key={e} k="crust">{e}</Src>)}</div>}
                </li>
              );
            })}
          </ol>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-5">
          <p className="min-w-0 flex-1 text-[13px] text-zinc-500">{d.note}</p>
          <Link href={d.open.href} className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-ink">{d.open.label}<ArrowUpRight className="size-3.5" /></Link>
          <Link href={askHref(d.request)} className="group inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-white shadow-[0_8px_18px_-10px_rgba(9,9,11,.6)] hover:bg-zinc-800">{d.try}<ArrowRight className="size-3.5 text-[#f0b48a] transition-transform group-hover:translate-x-0.5" /></Link>
        </div>
      </div>
    </section>
  );
}

export function LandingStorySections({ d, still = false }: { d: LandingStory; still?: boolean }) {
  const rm = useReducedMotion();
  return (
    <>
      <style>{KEYFRAMES}</style>
      <Value d={d.value} />
      <Flow d={d.flow} moving={!still && !rm} />
    </>
  );
}
