"use client";
// First run = onboarding wizard (POST /api/firm/onboarding on finish). Steps: firm → mail → thesis → team → approvals.
import { Check, Globe, Lock, Mail, Calendar, Sparkles, UserPlus, Slack as SlackIcon, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Page, TopBar, Composer } from "../components/shell";
import { Btn, Ring, StepDot, Avatar, cx } from "../components/ui";
import { Rise, Count, Pulse } from "../components/motion";
import { AutonomyControl, Field, Segmented, Chip } from "../components/firm";
import { SlackCard } from "../components/slack";
import type { Autonomy, Mode, OnboardingData, ShellData, SlackMessage } from "../types";

export interface OnboardingScreenProps {
  shell: ShellData;
  data: OnboardingData;
  /** Preview card shown on step 5 (what an approval will look like in Slack/Teams). */
  slackPreview?: SlackMessage;
  onStep?: (step: OnboardingData["step"]) => void;
  onChange?: (patch: Partial<OnboardingData>) => void;
  /** Step 1–4 primary. Step 5 calls onFinish → POST /api/firm/onboarding. */
  onNext?: () => void;
  onBack?: () => void;
  onFinish?: (data: OnboardingData) => void;
  onConnect?: (provider: "google" | "microsoft" | "slack" | "teams") => void;
  onAsk?: (q?: string) => void;
  busy?: boolean;
  error?: string;
}

function Stepper({ steps, step, onStep }: { steps: string[]; step: number; onStep?: OnboardingScreenProps["onStep"] }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => {
        const n = i + 1, done = n < step, on = n === step;
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <button type="button" onClick={() => done && onStep?.(n as OnboardingData["step"])} aria-current={on ? "step" : undefined} className={cx("flex items-center gap-2 text-[12.5px]", on ? "font-medium text-ink" : done ? "text-zinc-600" : "text-zinc-400")}>
              <span className={cx("flex size-6 items-center justify-center rounded-full text-[11px] font-semibold tnum", done ? "bg-ink text-white" : on ? "bg-white text-ink ring-2 ring-ink" : "bg-white text-zinc-400 ring-1 ring-zinc-300")}>{done ? <Check className="size-3.5" /> : n}</span>{s}
            </button>
            {i < steps.length - 1 && <span className={cx("h-px flex-1", done ? "bg-ink" : "bg-zinc-200")} />}
          </li>
        );
      })}
    </ol>
  );
}

const money = (n: number, u: string) => `$${n}${u}`;

function StepBody({ p }: { p: OnboardingScreenProps }) {
  const d = p.data, set = p.onChange;
  switch (d.step) {
    case 1: return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Firm name" value={d.firm.name} onChange={set && ((v) => set({ firm: { ...d.firm, name: v } }))} />
          <Field label="Website" value={d.firm.website} prefix={<Globe className="size-3.5 text-zinc-400" />} hint="We read it once to pre-fill your thesis." onChange={set && ((v) => set({ firm: { ...d.firm, website: v } }))} />
        </div>
        <div>
          <span className="text-[12px] font-medium text-zinc-600">What does the firm do?</span>
          <div className="mt-1"><Segmented<Mode> label="Mode" value={d.firm.mode} onChange={set && ((m) => set({ firm: { ...d.firm, mode: m } }))} options={[{ id: "invest", label: "Venture investing", sub: "Pipeline · Portfolio · IC memos" }, { id: "bank", label: "Investment banking", sub: "Mandates · buyers · walls on" }]} /></div>
        </div>
        <div>
          <span className="text-[12px] font-medium text-zinc-600">{d.firm.mode === "bank" ? "Typical deal size (EV)" : "Typical check size"}</span>
          <div className="mt-1 flex items-center gap-3">
            <span className="relative h-2 flex-1 rounded-full bg-zinc-100"><span className="absolute inset-y-0 rounded-full bg-ink" style={{ left: `${(d.firm.checkSize.min / 10) * 100}%`, width: `${((d.firm.checkSize.max - d.firm.checkSize.min) / 10) * 100}%` }} /><span className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-ink bg-white" style={{ left: `${(d.firm.checkSize.min / 10) * 100}%` }} /><span className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-ink bg-white" style={{ left: `${(d.firm.checkSize.max / 10) * 100}%` }} /></span>
            <span className="tnum w-[110px] text-right text-[14px] font-semibold">{money(d.firm.checkSize.min, d.firm.checkSize.unit)}–{money(d.firm.checkSize.max, d.firm.checkSize.unit)}</span>
          </div>
        </div>
      </div>
    );
    case 2: return (
      <div className="space-y-3">
        {[[Mail, "Gmail or Outlook", "Read-only. Drafts go to your drafts folder.", "google"], [Calendar, "Calendar", "Meeting prep and free slots.", "google"]].map(([I, t, s, prov], i) => { const Icon = I as typeof Mail; return (
          <div key={t as string} className="flex items-center gap-3 rounded-xl border border-ink bg-white p-4 shadow-[0_6px_20px_-12px_rgba(9,9,11,.4)]"><span className="flex size-9 items-center justify-center rounded-lg bg-ink text-white"><Icon className="size-4" /></span><span><span className="block text-[14px] font-medium">{t as string}</span><span className="text-[12px] text-zinc-500">{s as string}</span></span><Btn variant={i === 0 ? "primary" : "ghost"} className="ml-auto" onClick={() => p.onConnect?.(prov as "google")}>Connect</Btn></div>
        ); })}
      </div>
    );
    case 3: return (
      <div className="space-y-4">
        {d.prefill && <div className="flex items-center gap-1.5 text-[12px] text-zinc-500"><Sparkles className="size-3.5 text-rust" />Pre-filled from {d.prefill.source}. Click to change.</div>}
        {d.prefill && ([["Sectors", d.prefill.sectors], ["Stages", d.prefill.stages], ["Geography", d.prefill.geos]] as const).map(([l, xs]) => <div key={l}><div className="text-[12px] font-medium text-zinc-600">{l}</div><div className="mt-1.5 flex flex-wrap gap-1.5">{xs.map((x) => <Chip key={x}>{x}</Chip>)}<Chip on={false}>+ Add</Chip></div></div>)}
      </div>
    );
    case 4: return (
      <div>
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {d.invites.map((m) => (
            <div key={m.email} className="flex h-[52px] items-center gap-3 px-3.5 text-[13px]">
              <Avatar i={m.email.slice(0, 2).toUpperCase()} size={26} />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{m.email}</span>{m.why && <span className="block truncate text-[11.5px] text-zinc-500">{m.why}</span>}</span>
              {m.suggested && <span className="rounded-full bg-zinc-100 px-2 py-[1px] text-[11px] text-zinc-600">Suggested</span>}
              <span className="flex h-7 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-[12px] font-medium">{m.role}<span className="text-zinc-400">▾</span></span>
            </div>
          ))}
          <div className="flex h-[48px] items-center gap-2 px-3.5 text-[13px] text-zinc-400"><UserPlus className="size-4" />Add by email</div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-zinc-500"><Users className="size-3.5" />Roles: {d.roles.join(" · ")}. {d.firm.mode === "bank" ? "Every mandate gets its own wall." : "Change any time in Settings."}</div>
      </div>
    );
    case 5: return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Segmented<"slack" | "teams"> label="Channel" value={d.channel} onChange={set && ((c) => set({ channel: c }))} options={[{ id: "slack", label: "Slack" }, { id: "teams", label: "Microsoft Teams" }]} />
          <Btn onClick={() => p.onConnect?.(d.channel)} icon={<SlackIcon className="size-3.5" />}>Connect</Btn>
        </div>
        <AutonomyControl value={d.autonomy} holdMinutes={d.holdMinutes} onChange={set && ((a: Autonomy) => set({ autonomy: a }))} onHold={set && ((m) => set({ holdMinutes: m }))} />
        {p.slackPreview && <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4"><div className="eyebrow mb-2.5">An approval will look like this</div><SlackCard m={p.slackPreview} /></div>}
      </div>
    );
  }
}

const titles: Record<number, [string, string]> = {
  1: ["Tell us about the firm", "Two minutes. You can change all of it later."],
  2: ["Connect mail and calendar", "This is where the deals already are."],
  3: ["Your thesis", "We read your website. Fix anything that’s off."],
  4: ["Invite your team", "Suggested from who you email most."],
  5: ["Approvals", "How much the agent may do before asking you."],
};

export function OnboardingScreen(p: OnboardingScreenProps) {
  const d = p.data, [t, sub] = titles[d.step];
  const primary: ReactNode = d.step === 5
    ? <Btn variant="primary" disabled={p.busy} onClick={() => p.onFinish?.(d)}>{p.busy ? "Setting up…" : "Finish setup"}</Btn>
    : <Btn variant={d.step === 2 ? undefined : "primary"} disabled={p.busy} onClick={p.onNext}>Continue</Btn>;
  return (
    <Page active="today" mode={d.firm.mode} shell={p.shell} top={<TopBar crumbs={[{ label: "Today" }]} ask={false} bell={false} />}>
      <div className="mx-auto w-full max-w-[1120px] px-8 pt-12 pb-16">
        <Rise><div className="text-center"><div className="eyebrow">Welcome</div><h1 className="serif mt-2 text-[48px] leading-[1.05] tracking-[-0.02em]">Hi {p.shell.user.firstName}. Let’s set up your desk.</h1></div></Rise>
        <Rise i={1} className="mx-auto mt-8 max-w-[880px]"><Stepper steps={d.steps} step={d.step} onStep={p.onStep} /></Rise>
        <div className="mt-8 grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-start gap-5">
          <Rise i={2} className="card flex flex-col p-7">
            <div className="flex items-center gap-3"><span><span className="serif block text-[24px] leading-tight">{t}</span><span className="text-[12.5px] text-zinc-500">{sub}</span></span></div>
            <div className="mt-6 flex-1"><StepBody p={p} /></div>
            {p.error && <div role="alert" className="mt-4 rounded-lg bg-rust-50 px-3 py-2 text-[12.5px] text-rust">{p.error}</div>}
            <div className="mt-6 flex items-center gap-2 border-t border-zinc-100 pt-4">
              {d.step > 1 && <Btn variant="subtle" onClick={p.onBack}>Back</Btn>}
              <span title="Read-only. Drafts only. Nothing sent." aria-label="Read-only. Drafts only. Nothing sent." className="flex size-8 items-center justify-center text-zinc-400"><Lock className="size-3.5" /></span>
              <span className="ml-auto">{primary}</span>
            </div>
          </Rise>
          <Rise i={3} className="card p-7">
            <div className="flex items-center gap-2 text-[13px] font-medium"><Pulse />Already working</div>
            <div className="mt-4 space-y-3.5">
              {d.working.map((w) => <div key={w.id} className="flex items-center gap-3"><StepDot s={w.state} size={20} /><span className={cx("text-[14px]", w.state === "queued" && "text-zinc-400")}>{w.label}</span><span className="tnum ml-auto text-[13px] font-medium">{w.state === "done" && typeof w.value === "number" ? <Count to={w.value} /> : w.value}</span></div>)}
            </div>
            <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-5 text-center">
              <div className="serif text-[20px]">Nothing needs you yet</div>
              <div className="mt-1 text-[12.5px] text-zinc-500">Your first brief lands tomorrow at 08:00.</div>
            </div>
          </Rise>
        </div>
        {d.step === 1 && <Rise i={4} className="mx-auto mt-8 max-w-[720px]"><Composer placeholder="Or just ask, e.g. which fintech founders do I know?" chips={["Upload a deck", "Find SaaS deals like Ledgerly", "Who do I know at Stripe?"]} onAsk={() => p.onAsk?.()} onChip={(c) => p.onAsk?.(c)} /></Rise>}
      </div>
    </Page>
  );
}
