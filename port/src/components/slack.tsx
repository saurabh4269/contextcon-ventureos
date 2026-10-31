"use client";
// Slack/Teams approval card, rendered as a faithful Block Kit preview (for onboarding step 5, docs and video frames).
// The real card is built server-side with Block Kit JSON; this component mirrors its layout so design and copy stay in sync.
import { EyeOff, Hash, Check, Clock, ArrowRight, ChevronDown, Search, Plus, Smile, AtSign, Send, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useReducedMotion } from "./motion";
import { cx } from "./ui";
import type { SlackMessage } from "../types";

const AV: Record<string, string> = { MK: "#7c5c3b", SG: "#3f4a5a", PS: "#6b4f7a", AR: "#4f6b5a", DK: "#5a4f3f" };
function Face({ i, size = 20 }: { i: string; size?: number }) {
  return <span className="inline-flex shrink-0 items-center justify-center rounded-[5px] font-sans font-bold text-white ring-2 ring-white" style={{ width: size, height: size, fontSize: size * 0.42, background: AV[i] ?? "#52525b" }}>{i}</span>;
}

function MetricImage({ m }: { m: NonNullable<SlackMessage["metric"]> }) {
  const w = 360, h = 96, pad = 6, max = Math.max(...m.series, ...(m.plan ?? [])) * 1.08, n = m.series.length;
  const X = (i: number) => Math.round((pad + (i / (n - 1)) * (w - pad * 2)) * 100) / 100;
  const Y = (v: number) => Math.round((h - 14 - (v / max) * (h - 26)) * 100) / 100;
  const line = (a: number[]) => a.map((v, i) => `${i ? "L" : "M"}${X(i)},${Y(v)}`).join(" ");
  const last = m.series[n - 1];
  return (
    <div className="mt-2 w-[392px] overflow-hidden rounded-lg border border-zinc-200 bg-[linear-gradient(180deg,#fff,#fafaf9)]">
      <div className="flex items-baseline gap-2 px-3 pt-2.5"><span className="text-[10.5px] font-semibold tracking-[.06em] text-zinc-500 uppercase">{m.label}</span><span className="ml-auto font-serif text-[20px] leading-none tabular-nums">{m.value}</span></div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mx-3 mt-1 mb-1 block h-auto w-[calc(100%-24px)]" role="img" aria-label={`${m.label} ${m.value}`}>
        <defs><linearGradient id="mg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3d6b4f" stopOpacity=".22" /><stop offset="1" stopColor="#3d6b4f" stopOpacity="0" /></linearGradient></defs>
        {[0.33, 0.66].map((t) => <line key={t} x1={0} x2={w} y1={Math.round(h * t)} y2={Math.round(h * t)} stroke="#ececec" strokeDasharray="2 3" />)}
        <path d={`${line(m.series)} L${X(n - 1)},${h - 14} L${X(0)},${h - 14} Z`} fill="url(#mg)" />
        {m.plan && <path d={line(m.plan)} fill="none" stroke="#a1a1aa" strokeWidth="1.25" strokeDasharray="4 3" />}
        <path d={line(m.series)} fill="none" stroke="#3d6b4f" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={X(n - 1)} cy={Y(last)} r="3.5" fill="#fff" stroke="#3d6b4f" strokeWidth="2" />
        <line x1={0} x2={w} y1={h - 14} y2={h - 14} stroke="#d4d4d8" />
        <text x={0} y={h - 2} fontSize="9.5" fill="#a1a1aa">Jul</text><text x={w} y={h - 2} fontSize="9.5" fill="#a1a1aa" textAnchor="end">Jan</text>
        {m.plan && <text x={X(n - 2) - 6} y={Y(m.plan[n - 2]) + 14} fontSize="9.5" fill="#a1a1aa" textAnchor="end">memo plan</text>}
      </svg>
      {m.note && <div className="border-t border-zinc-100 px-3 py-1.5 text-[11.5px] text-[#3d6b4f]">▲ {m.note}</div>}
    </div>
  );
}

export function SlackCard({ m, onAction, className }: { m: SlackMessage; onAction?: (messageId: string, buttonId: string) => void; className?: string }) {
  const red = useReducedMotion();
  const R = m.resolved, ResIcon = R?.icon === "clock" ? Clock : R?.icon === "arrow" ? ArrowRight : Check;
  return (
    <div className={cx("flex gap-2.5 font-[Lato,Inter,system-ui,sans-serif]", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(160deg,#27272a,#09090b)] font-serif text-[18px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12)]">D</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 text-[13.5px]"><b>Deal Desk</b><span className="rounded bg-zinc-200 px-1 text-[9.5px] font-bold text-zinc-600">APP</span><span className="text-[11.5px] text-zinc-500" title={m.footer}>{m.time}</span></div>
        {m.ephemeral && <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-zinc-500"><EyeOff className="size-3" />Only visible to you</div>}
        <div className={cx("mt-1", (m.votes || m.metric) && "border-l-4 border-zinc-200 pl-3")}>
          <div className="text-[14px] leading-[1.45]"><b>{m.title}</b></div>
          {m.lines.map((l, i) => <div key={i} className="text-[14px] leading-[1.45] text-zinc-800">{l}</div>)}
          {m.chips && <div className="mt-1.5 flex flex-wrap gap-1">{m.chips.map((c) => <span key={c.label} className={cx("rounded px-1.5 py-[1px] font-mono text-[11.5px]", c.ok === false ? "bg-rust-50 text-rust" : "bg-zinc-100 text-zinc-700")}>{c.label}</span>)}</div>}
          {m.metric && <MetricImage m={m.metric} />}
          {m.votes && (
            <div className="mt-2.5 flex items-center gap-2.5">
              <span className="flex -space-x-1">{Array.from({ length: m.votes.needed }, (_, i) => { const v = m.votes!.voters[i]; return v ? <motion.span key={v.initials} initial={red ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 26 }}><Face i={v.initials} /></motion.span> : <span key={i} className="inline-block size-5 rounded-[5px] border border-dashed border-zinc-300 bg-white ring-2 ring-white" />; })}</span>
              <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100">{Array.from({ length: m.votes.needed }, (_, i) => <span key={i} className={cx("h-full flex-1 border-r border-white last:border-0", i < m.votes!.voters.length ? "bg-[#007a5a]" : "")} />)}</span>
              <span className="text-[12px] text-zinc-600" title={m.votes.voters.map((v) => `${v.name.split(" ")[0]} ${v.at}`).join(" · ") || undefined}><b className="tabular-nums text-zinc-900">{m.votes.voters.length} of {m.votes.needed}</b> partners{m.votes.voters.length ? "" : " · waiting on votes"}</span>
            </div>
          )}
          {m.suggest && <div className="mt-1.5 border-l-4 border-zinc-300 pl-2.5 text-[13.5px] text-zinc-700">{m.suggest}</div>}
        </div>
        {R ? (
          <motion.div initial={red ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cx("mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px]", R.tone === "ok" ? "bg-[#007a5a]/[.08] text-[#05664b]" : "bg-zinc-100 text-zinc-700")}><ResIcon className="size-3.5" />{R.text}</motion.div>
        ) : m.buttons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {m.buttons.map((b) => <button key={b.id} type="button" onClick={() => onAction?.(m.id, b.id)} className={cx("h-8 rounded-md border px-3 text-[13px] font-bold", b.style === "primary" ? "border-[#007a5a] bg-[#007a5a] text-white" : b.style === "danger" ? "border-zinc-300 bg-white text-[#e01e5a]" : "border-zinc-300 bg-white text-zinc-800")}>{b.label}</button>)}
          </div>
        )}
        {m.reactions && <div className="mt-1.5 flex gap-1">{m.reactions.map((r) => <motion.span key={r.emoji} layout className={cx("inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px]", r.mine ? "border-[#1d9bd1]/60 bg-[#1d9bd1]/10 text-[#1264a3]" : "border-zinc-200 bg-zinc-50 text-zinc-700")}>{r.emoji}<motion.b key={r.count} initial={red ? false : { y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="tabular-nums">{r.count}</motion.b></motion.span>)}<span className="inline-flex h-6 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-400"><Smile className="size-3.5" /></span></div>}
        {m.thread && <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px]"><span className="flex -space-x-1"><Face i="MK" size={18} /><Face i="SG" size={18} /></span><b className="text-[#1264a3]">{m.thread.replies} replies</b><span className="truncate text-zinc-500">{m.thread.last}</span></div>}
        {/* v3.2: the context footer lives on the timestamp hover; Slack already says "Only visible to you". */}
      </div>
    </div>
  );
}

/** Channel frame around one or more cards (preview only). */
export function SlackFrame({ channel, children }: { channel: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex h-10 items-center gap-1 border-b border-zinc-200 px-4 text-[14px] font-bold"><Hash className="size-4 text-zinc-500" />{channel}</div>
      <div className="space-y-5 px-4 py-4">{children}</div>
    </div>
  );
}

/** v3 · Full Slack window (workspace sidebar + channel + composer) for state frames and video. */
export function SlackWindow({ channel, context, children, unread = [] }: { channel: string; context?: { who: string; time: string; text: string }[]; children: React.ReactNode; unread?: string[] }) {
  const chans = ["#dealflow", "#ic", "#portfolio", "#deal-nexaflow", "#general"];
  return (
    <div className="flex h-[640px] overflow-hidden rounded-2xl border border-black/10 bg-white font-[Lato,Inter,system-ui,sans-serif] shadow-[0_30px_80px_-30px_rgba(9,9,11,.45),0_2px_8px_rgba(9,9,11,.06)]">
      <aside className="flex w-[220px] shrink-0 flex-col bg-[#3f0e40] text-[14px] text-white/75">
        <div className="flex h-12 items-center gap-1 border-b border-white/10 px-4 font-bold text-white">Northbeam Capital<ChevronDown className="size-4" /></div>
        <div className="px-2 pt-3 text-[13px]">
          <div className="px-2 pb-1 text-white/55">Channels</div>
          {chans.map((c) => <div key={c} className={cx("flex h-7 items-center gap-1.5 rounded-md px-2", c === channel ? "bg-[#1164a3] text-white" : unread.includes(c) ? "font-bold text-white" : "")}><Hash className="size-3.5 opacity-70" />{c.slice(1)}</div>)}
          <div className="px-2 pt-4 pb-1 text-white/55">Apps</div>
          <div className="flex h-7 items-center gap-2 px-2"><span className="flex size-4 items-center justify-center rounded bg-white font-serif text-[11px] text-ink">D</span>Deal Desk</div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center gap-1 border-b border-zinc-200 px-5 text-[15px] font-bold"><Hash className="size-4 text-zinc-500" />{channel.slice(1)}<span className="ml-auto flex items-center gap-3 text-zinc-400"><Search className="size-4" /><Bell className="size-4" /></span></div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-5 overflow-hidden px-5 py-4">
          {context?.map((c, i) => (
            <div key={i} className="flex gap-2.5"><Face i={c.who.split(" ").map((x) => x[0]).join("")} size={36} /><div><div className="flex items-baseline gap-1.5 text-[13.5px]"><b>{c.who}</b><span className="text-[11.5px] text-zinc-500">{c.time}</span></div><div className="text-[14px] text-zinc-800">{c.text}</div></div></div>
          ))}
          {children}
        </div>
        <div className="mx-5 mb-4 rounded-lg border border-zinc-300">
          <div className="px-3 py-2.5 text-[14px] text-zinc-400">Message {channel}</div>
          <div className="flex items-center gap-3 px-3 pb-2 text-zinc-400"><Plus className="size-4" /><AtSign className="size-4" /><Smile className="size-4" /><span className="ml-auto flex size-7 items-center justify-center rounded bg-zinc-100"><Send className="size-3.5" /></span></div>
        </div>
      </div>
    </div>
  );
}
