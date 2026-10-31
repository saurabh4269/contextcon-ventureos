"use client";
// /agent — the Sourcing agent. A free-text request → what was understood (chips, with the phrase each came from) →
// a live step trace (endpoint, time, credits) → verified, cited rows → memo / CSV. Everything shown comes from the
// NDJSON stream of POST /api/sourcing/run; nothing here is sample data.
import { PlaySummary } from "@/live/voice/PlaySummary";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Check, CircleAlert, CircleDashed, Copy, Download, Loader2, Square, Volume2, X, ArrowUpRight } from "lucide-react";
import { Page, TopBar } from "@port/components/shell";
import { CompanyLogo, cx } from "@port/components/ui";
import { Mascot, type MascotMood } from "@port/components/brand/mascot";
import { AGENT_EXAMPLES } from "@/lib/sourcing/examples";
import { toCsv, toMarkdown, fmtFunding } from "@/lib/sourcing/export";
import { WINDOW_MONTHS, type Interpretation } from "@/lib/sourcing/parse";
import type { AgentRow, AgentStep, Founder } from "@/lib/sourcing/run";
import { fmtMoney } from "@/lib/format";
import { useLiveCoverage } from "@/components/datamode";
import { liveShell } from "../shell";
import { MicButton } from "../voice/MicButton";
import { speak } from "../voice/speak";
import { Cited, CitePop } from "./Cite";
import { useAgentRun, type RunState } from "./useAgentRun";

const KIND_STYLE: Record<Interpretation["kind"], string> = {
  filter: "bg-white text-ink ring-zinc-300/80",
  query: "bg-[#faf3ec] text-[#7a3a10] ring-[#ecd9c6]",
  output: "bg-zinc-50 text-zinc-700 ring-zinc-200",
  default: "bg-zinc-50 text-zinc-500 ring-zinc-200 border-dashed",
  assumption: "bg-[#fbf7ee] text-[#7d5a12] ring-[#eadfbf]",
  correction: "bg-sky-50 text-sky-800 ring-sky-200",
};
const KIND_LABEL: Record<Interpretation["kind"], string> = { filter: "filter", query: "ranked on", output: "return", default: "default", assumption: "assumed", correction: "typo" };

export function AgentScreen() {
  useLiveCoverage("Live · Crustdata");
  const params = useSearchParams();
  const router = useRouter();
  const initialQ = params.get("q") ?? "";
  const [q, setQ] = useState(initialQ);
  const gesture = useRef(false);
  const onFinish = useCallback((s: RunState) => {
    if (s.status === "done" && s.summary && gesture.current) void speak(s.summary.sentence).catch(() => undefined);
  }, []);
  const { state, run, stop } = useAgentRun(onFinish);
  const ran = useRef(false);

  const go = useCallback((text: string, byUser = true) => {
    const t = text.trim();
    if (!t) return;
    if (byUser) gesture.current = true;
    setQ(t);
    const url = `/agent?q=${encodeURIComponent(t)}`;
    if (typeof window !== "undefined" && window.location.search !== url.slice(6)) window.history.replaceState(null, "", url);
    void run(t);
  }, [run]);

  // ?q= auto-runs once (no user gesture → no speech)
  useEffect(() => {
    if (ran.current || !initialQ.trim()) return;
    ran.current = true;
    go(initialQ, false);
  }, [initialQ, go]);

  // a single company → its research page
  useEffect(() => {
    if (state.status !== "redirect" || !state.redirect) return;
    const t = setTimeout(() => router.push(state.redirect!.href), 1200);
    return () => clearTimeout(t);
  }, [state.status, state.redirect, router]);

  const running = state.status === "running";
  const plan = state.parse?.kind === "search" ? state.parse.plan : undefined;

  return (
    <Page active="agents" shell={liveShell} top={<TopBar crumbs={[{ label: "Agents", href: "/agents" }, { label: "Sourcing agent" }]} ctx="Sourcing agent" />}>
      <div className="mx-auto w-full max-w-[1180px] px-4 pt-7 pb-24 sm:px-6">
        <header className="max-w-[720px]">
          <div className="text-[11.5px] font-medium tracking-[0.08em] text-rust uppercase">Sourcing agent</div>
          <h1 className="serif mt-1 text-[28px] leading-tight tracking-[-0.01em] sm:text-[32px]">Ask for companies. Get a cited list.</h1>
          <p className="mt-1.5 text-[13.5px] text-zinc-500">Searches Crustdata, verifies every company, finds the founders and their past employers. Every number links to its source.</p>
        </header>

        {/* request box */}
        <form onSubmit={(e) => { e.preventDefault(); go(q); }} className="mt-5 rounded-[20px] border border-zinc-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(9,9,11,.04),0_0_0_5px_rgba(244,240,235,.9),0_24px_48px_-30px_rgba(120,60,20,.35)] focus-within:border-zinc-300">
          <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3} aria-label="Request" data-testid="agent-input"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(q); } }}
            placeholder={AGENT_EXAMPLES[0]!.q}
            className="block w-full resize-none bg-transparent px-1.5 pt-0.5 text-[15px] leading-relaxed outline-none placeholder:text-zinc-400" />
          <div className="mt-2 flex items-center gap-2">
            <MicButton disabled={running} onTranscript={(t) => go(t)} />
            <span className="min-w-0 flex-1 truncate text-[11.5px] text-zinc-400">{running ? "Working…" : "Enter to run · Shift+Enter for a new line"}</span>
            {running
              ? <button type="button" onClick={stop} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13px] font-medium text-white"><Square className="size-3 fill-current" />Stop</button>
              : <button type="submit" disabled={!q.trim()} data-testid="agent-run" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rust px-4 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(9,9,11,.2)] transition-colors hover:bg-[#87390b] disabled:opacity-40">Run<ArrowUp className="size-3.5" /></button>}
          </div>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {AGENT_EXAMPLES.map((ex, i) => (
            <button key={ex.q} type="button" disabled={running} onClick={() => go(ex.q)} title={ex.q}
              className={cx("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] whitespace-nowrap ring-1 transition-all hover:-translate-y-px disabled:opacity-50", i === 0 ? "bg-[#faf3ec] text-[#7a3a10] ring-[#ecd9c6]" : "bg-white text-zinc-600 ring-zinc-200 hover:text-ink")}>
              {ex.short}
            </button>
          ))}
        </div>

        {state.status === "idle" && <Intro />}

        {state.status !== "idle" && (
          <div className="mt-7">
            {plan && <Understood items={plan.interpretation} ignored={plan.ignored} />}
            {state.status === "refused" && <Notice tone="warn" mood="sorry" title="Nothing to search on" body={state.message ?? ""} />}
            {state.status === "redirect" && state.redirect && <Notice tone="ok" mood="happy" title={`Opening ${state.redirect.label}`} body={state.redirect.reason} action={<Link className="font-medium text-rust underline-offset-2 hover:underline" href={state.redirect.href}>Open now</Link>} />}
            {state.status === "error" && <Notice tone="err" mood="sorry" title={state.errorKind === "not_connected" ? "Crustdata not connected" : "The run failed"} body={state.message ?? ""} action={state.errorKind === "not_connected" ? <Link className="font-medium text-rust" href="/settings?section=connectors">Connectors</Link> : <button type="button" className="font-medium text-rust" onClick={() => go(state.q)}>Try again</button>} />}
            {state.status === "stopped" && <Notice tone="warn" mood="sorry" title="Stopped" body="The run was stopped before it finished. Rows shown so far are real, but incomplete." />}

            {(plan || state.steps.length > 1) && (
              <div className="mt-5 grid gap-5 lg:grid-cols-[264px_minmax(0,1fr)]">
                <div className="order-2 lg:order-1"><Trace steps={state.steps} running={running} /></div>
                <div className="order-1 min-w-0 lg:order-2">
                  {state.summary && <Summary state={state} />}
                  {state.rows.length > 0 ? <Results rows={state.rows} running={running} /> : running ? <Skeleton /> : state.status === "done" ? <Notice tone="warn" mood="sorry" title="No companies matched" body={state.summary?.sentence ?? ""} /> : null}
                  {state.dropped.length > 0 && <DroppedList items={state.dropped} />}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}

/* ───────────── understood ───────────── */
function Understood({ items, ignored }: { items: Interpretation[]; ignored: string[] }) {
  return (
    <section aria-label="What the agent understood">
      <div className="mb-2 text-[11.5px] font-medium tracking-[0.06em] text-zinc-400 uppercase">Understood</div>
      <div className="flex flex-wrap gap-1.5" data-testid="interpretation">
        {items.map((it, i) => (
          <span key={i} title={it.phrase ? `from “${it.phrase}”` : "not in the request"} className={cx("inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] ring-1", KIND_STYLE[it.kind])}>
            <span className="text-[10px] tracking-wide uppercase opacity-60">{KIND_LABEL[it.kind]}</span>
            <span className="truncate font-medium">{it.label}</span>
            {it.phrase && it.kind !== "correction" && <span className="hidden truncate text-[11px] opacity-60 sm:inline">← “{it.phrase}”</span>}
          </span>
        ))}
        {ignored.map((w) => (
          <span key={w} title="Not used for the search" className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2.5 py-1 text-[12px] text-zinc-400 line-through decoration-zinc-300">{w}</span>
        ))}
      </div>
    </section>
  );
}

/* ───────────── step trace ───────────── */
function StepIcon({ s }: { s: AgentStep["status"] }) {
  if (s === "running") return <Loader2 className="size-3.5 animate-spin text-rust" />;
  if (s === "done") return <span className="grid size-3.5 place-items-center rounded-full bg-[#2f9a5c] text-white"><Check className="size-2.5" strokeWidth={3} /></span>;
  if (s === "failed") return <span className="grid size-3.5 place-items-center rounded-full bg-[#c0392b] text-white"><X className="size-2.5" strokeWidth={3} /></span>;
  return <CircleDashed className="size-3.5 text-zinc-300" />;
}
function Trace({ steps, running }: { steps: AgentStep[]; running: boolean }) {
  const credits = steps.reduce((a, s) => a + (s.credits ?? 0), 0);
  return (
    <aside className="h-fit rounded-2xl border border-zinc-200/80 bg-white p-3.5 lg:sticky lg:top-16" data-testid="trace">
      <div className="flex items-center justify-between text-[11.5px] font-medium tracking-[0.06em] text-zinc-400 uppercase">
        <span>Steps</span>
        <span className="tnum normal-case tracking-normal text-zinc-500">{Math.round(credits * 100) / 100} credits</span>
      </div>
      <ol className="mt-2.5 space-y-0.5">
        {steps.map((s) => (
          <li key={s.id} className="relative flex gap-2.5 rounded-lg px-1 py-1.5" data-status={s.status}>
            <span className="mt-[2px]"><StepIcon s={s.status} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] leading-snug font-medium text-ink">{s.label}</span>
              <span className="block font-mono text-[10.5px] text-zinc-400">{s.endpoint}</span>
              <span className="tnum mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-zinc-500">
                {s.ms != null && <span>{s.ms < 1000 ? `${s.ms} ms` : `${(s.ms / 1000).toFixed(1)} s`}</span>}
                {!!s.credits && <span>{s.credits} cr</span>}
                {!!s.cachedCalls && <span>{s.cachedCalls} cached</span>}
              </span>
              {s.detail && <span className={cx("mt-0.5 block text-[11px] leading-snug", s.status === "failed" ? "text-[#b03a2e]" : "text-zinc-500")}>{s.detail}</span>}
            </span>
          </li>
        ))}
        {running && <li className="flex items-center gap-2.5 px-1 py-1.5 text-[12px] text-zinc-400"><Loader2 className="size-3.5 animate-spin" />working…</li>}
      </ol>
    </aside>
  );
}

/* ───────────── summary + deliverables ───────────── */
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function Summary({ state }: { state: RunState }) {
  const s = state.summary!;
  const [copied, setCopied] = useState(false);
  const slug = s.runId.replace(/[^a-z0-9_]/gi, "");
  return (
    <section className="mb-4 rounded-2xl border border-zinc-200/80 bg-white p-4" data-testid="summary">
      <p className="serif text-[19px] leading-snug text-ink">{s.sentence}</p>
      <p className="mt-1 text-[12px] text-zinc-500">{s.rankingReason}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" data-testid="copy-memo" onClick={async () => { await navigator.clipboard.writeText(toMarkdown(state.rows, s, state.q)).catch(() => download(`sourcing-${slug}.md`, toMarkdown(state.rows, s, state.q), "text/markdown")); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[12.5px] font-medium text-white hover:bg-zinc-800">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy memo (markdown)"}</button>
        <button type="button" data-testid="download-csv" onClick={() => download(`sourcing-${slug}.csv`, toCsv(state.rows), "text/csv")}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[12.5px] font-medium text-zinc-700 ring-1 ring-zinc-200 hover:text-ink"><Download className="size-3.5" />CSV</button>
        <PlaySummary text={s.sentence} />
        <span className="tnum ml-auto text-[11.5px] text-zinc-400">{s.credits} credits · {s.liveCalls} live / {s.cachedCalls} cached calls · {(s.ms / 1000).toFixed(1)} s</span>
      </div>
    </section>
  );
}

/* ───────────── results ───────────── */
function Spark({ series, then }: { series: AgentRow["series"]; then?: string }) {
  if (series.length < 2) return null;
  const w = 72, h = 22, vs = series.map((p) => p.v), min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1;
  const x = (i: number) => (i / (series.length - 1)) * (w - 4) + 2, y = (v: number) => h - 3 - ((v - min) / span) * (h - 6);
  const d = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const ti = then ? series.findIndex((p) => p.date === then) : -1;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" role="img" aria-label={`headcount ${series[0]!.v} to ${series.at(-1)!.v}`}>
      <path d={d} fill="none" stroke="#9c440f" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {ti >= 0 && <circle cx={x(ti)} cy={y(series[ti]!.v)} r={2} fill="white" stroke="#9c440f" strokeWidth={1.2} />}
      <circle cx={x(series.length - 1)} cy={y(series.at(-1)!.v)} r={2.2} fill="#9c440f" />
    </svg>
  );
}
/** Crustdata's headquarters is often a full street address: show region + country, keep the full text in the title. */
const shortHq = (v: string) => { const p = v.split(",").map((x) => x.trim()).filter(Boolean); return p.length > 2 ? p.slice(-2).join(", ") : v; };
const pct = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v)}%`;

function Growth({ r }: { r: AgentRow }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <Cited f={r.growth} render={(v) => <span className={cx("tnum text-[13px] font-semibold", v >= 0 ? "text-[#2f7a4c]" : "text-[#b03a2e]")}>{pct(v)}</span>} />
      <Spark series={r.series} then={r.headcountThen.status === "ok" ? r.headcountThen.value.date : undefined} />
    </span>
  );
}
function Headcount({ r }: { r: AgentRow }) {
  return (
    <span className="tnum flex items-center gap-1 text-[12.5px] whitespace-nowrap">
      {r.headcountThen.status === "ok" && <><Cited f={r.headcountThen} render={(v) => <span className="text-zinc-500">{v.value}</span>} /><span className="text-zinc-300">→</span></>}
      <Cited f={r.headcountNow} render={(v) => <span className="font-medium text-ink">{v}</span>} />
    </span>
  );
}
function Funding({ r }: { r: AgentRow }) {
  return <Cited f={r.funding} render={(v) => <span className="text-[12px] leading-snug text-zinc-700">{v.total ? fmtMoney(v.total, { compact: true }) : null}{v.total && v.lastRound ? " · " : ""}{v.lastRound ? v.lastRound.replace(/_/g, " ") : v.total ? null : fmtFunding(v)}</span>} />;
}
function FounderLine({ f, domain }: { f: Founder; domain?: string }) {
  return (
    <li className="text-[12px] leading-snug">
      {f.linkedinUrl
        ? <Link href={`/person?linkedin=${encodeURIComponent(f.linkedinUrl)}${domain ? `&domain=${encodeURIComponent(domain)}` : ""}`} className="font-medium text-ink underline-offset-2 hover:text-rust hover:underline">{f.name}</Link>
        : <span className="font-medium text-ink">{f.name}</span>}
      <CitePop cites={f.citations} reasoning={f.title ? `${f.name}: ${f.title}` : f.name} />
      {f.prior.length > 0
        ? <span className="block text-zinc-500">ex-{f.prior.slice(0, 3).map((p) => p.company).join(", ")}</span>
        : <span className="block text-zinc-400 italic">no prior employers reported</span>}
    </li>
  );
}
function Founders({ r }: { r: AgentRow }) {
  if (r.founders.status === "pending") return <span className="inline-block h-3 w-24 animate-pulse rounded bg-zinc-100" />;
  if (r.founders.status !== "ok") return <Cited f={r.founders} render={() => null} />;
  return <ul className="space-y-1">{r.founders.value.map((f, i) => <FounderLine key={i} f={f} domain={r.domain} />)}</ul>;
}
function CompanyCell({ r }: { r: AgentRow }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <CompanyLogo c={{ name: r.name, logoUrl: r.logoUrl || undefined, domain: r.domain }} size={30} />
      <div className="min-w-0">
        <Link href={r.domain ? `/deal?domain=${encodeURIComponent(r.domain)}` : "#"} className="block truncate text-[13.5px] font-medium text-ink hover:text-rust">{r.name}</Link>
        <span className="flex items-center gap-1 text-[11.5px] text-zinc-500">
          {r.domain}<CitePop cites={[r.sourceCitation]} reasoning="Returned by the company search for this request." />
        </span>
        {r.relaxed.length > 0 && <span className="mt-0.5 block text-[10.5px] text-[#7d5a12]">after: {r.relaxed.join("; ")}</span>}
        {r.errors.length > 0 && <span className="mt-0.5 flex items-center gap-1 text-[10.5px] text-[#b03a2e]"><CircleAlert className="size-3" />{r.errors[0]}</span>}
      </div>
    </div>
  );
}

function Results({ rows, running }: { rows: AgentRow[]; running: boolean }) {
  const win = rows[0] ? WINDOW_MONTHS[rows[0].growthWindow] : 0;
  return (
    <section data-testid="results" aria-busy={running}>
      {/* desktop table */}
      <div className="hidden overflow-visible rounded-2xl border border-zinc-200/80 bg-white md:block">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="border-b border-zinc-100 text-[11px] tracking-[0.04em] text-zinc-400 uppercase">
              <th className="w-8 py-2.5 pl-3 font-medium">#</th>
              <th className="w-[23%] py-2.5 font-medium">Company</th>
              <th className="w-[14%] py-2.5 font-medium">Founded · HQ</th>
              <th className="w-[11%] py-2.5 font-medium">Team</th>
              <th className="w-[12%] py-2.5 font-medium">Growth · {win} mo</th>
              <th className="w-[13%] py-2.5 font-medium">Funding</th>
              <th className="py-2.5 pr-3 font-medium">Founders · before</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 align-top last:border-0" data-testid="agent-row">
                <td className="tnum py-3 pl-3 text-[12px] text-zinc-400">{r.rank || "·"}</td>
                <td className="py-3 pr-3"><CompanyCell r={r} /></td>
                <td className="py-3 pr-2 text-[12.5px]">
                  <Cited f={r.founded} render={(v) => <span className="tnum">{v}</span>} />
                  <div className="truncate text-[11.5px] text-zinc-500"><Cited f={r.hq} render={(v) => <span className="truncate" title={v}>{shortHq(v)}</span>} /></div>
                </td>
                <td className="py-3 pr-2"><Headcount r={r} /></td>
                <td className="py-3 pr-2"><Growth r={r} /></td>
                <td className="py-3 pr-2"><Funding r={r} /></td>
                <td className="py-3 pr-3"><Founders r={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* phone cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <article key={r.id} className="rounded-2xl border border-zinc-200/80 bg-white p-3.5" data-testid="agent-card">
            <div className="flex items-start gap-2">
              <span className="tnum mt-1.5 w-4 text-[11.5px] text-zinc-400">{r.rank || "·"}</span>
              <div className="min-w-0 flex-1"><CompanyCell r={r} /></div>
              {r.domain && <Link href={`/deal?domain=${encodeURIComponent(r.domain)}`} aria-label={`Research ${r.name}`} className="grid size-7 place-items-center rounded-full text-zinc-400 ring-1 ring-zinc-200"><ArrowUpRight className="size-3.5" /></Link>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 pl-6">
              <Field k={`Growth · ${win} mo`}><Growth r={r} /></Field>
              <Field k="Team"><Headcount r={r} /></Field>
              <Field k="Founded"><Cited f={r.founded} render={(v) => <span className="tnum text-[12.5px]">{v}</span>} /></Field>
              <Field k="HQ"><Cited f={r.hq} render={(v) => <span className="text-[12px]" title={v}>{shortHq(v)}</span>} /></Field>
              <Field k="Funding" wide><Funding r={r} /></Field>
              <Field k="Founders · before" wide><Founders r={r} /></Field>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function Field({ k, children, wide }: { k: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={cx("min-w-0", wide && "col-span-2")}><div className="text-[10.5px] tracking-[0.04em] text-zinc-400 uppercase">{k}</div><div className="mt-0.5">{children}</div></div>;
}
function Skeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      <div className="flex items-center gap-3 px-1 pb-1 text-[13px] text-zinc-500"><Mascot size={48} mood="thinking" />Searching and verifying on Crustdata…</div>
      {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-zinc-100/80" />)}
    </div>
  );
}
function DroppedList({ items }: { items: { name: string; domain?: string; reason: string }[] }) {
  return (
    <details className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-3.5 text-[12.5px]">
      <summary className="cursor-pointer font-medium text-zinc-600">{items.length} dropped on verification</summary>
      <ul className="mt-2 space-y-1 text-zinc-500">{items.map((d, i) => <li key={i}><span className="font-medium text-zinc-700">{d.name}</span>{d.domain ? ` (${d.domain})` : ""}: {d.reason}</li>)}</ul>
    </details>
  );
}
function Notice({ tone, title, body, action, mood }: { tone: "ok" | "warn" | "err"; title: string; body: string; action?: React.ReactNode; mood?: MascotMood }) {
  return (
    <div data-testid="agent-notice" data-tone={tone} className={cx("mt-4 flex items-start gap-3 rounded-2xl border p-4", tone === "err" ? "border-[#e8c4bf] bg-[#fdf5f4]" : tone === "warn" ? "border-[#eadfbf] bg-[#fbf8ef]" : "border-zinc-200 bg-white")}>
      {mood && <Mascot size={48} mood={mood} className="-mt-1 shrink-0" />}
      <div className="min-w-0">
        <div className="serif text-[18px]">{title}</div>
        <p className="mt-1 text-[13px] text-zinc-600">{body}</p>
        {action && <div className="mt-2 text-[13px]">{action}</div>}
      </div>
    </div>
  );
}
/** Before the first run: what the agent does, in order, and which Crustdata endpoint each step calls. */
function Intro() {
  const steps: [string, string][] = [
    ["Read the request", "deterministic parser, no LLM: every filter shows the words it came from"],
    ["Search", "POST /company/search, relaxing one constraint at a time if too few match (never padded)"],
    ["Verify", "POST /company/enrich: headcount growth recomputed from the monthly series"],
    ["Founders", "POST /person/search (work history included); /person/enrich only if a profile came back with none"],
    ["Rank and cite", "every value carries its endpoint, record and fetch time"],
  ];
  return (
    <section className="mt-8 flex flex-col gap-5 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 p-5 sm:flex-row sm:items-start" data-testid="agent-intro">
      <Mascot size={72} mood="idle" title="Dex" className="shrink-0 self-center sm:self-start" />
      <ol className="grid min-w-0 flex-1 gap-2.5 sm:grid-cols-2">
        {steps.map(([t, d], i) => (
          <li key={t} className="flex gap-2.5 text-[12.5px]">
            <span className="tnum grid size-5 shrink-0 place-items-center rounded-full bg-white text-[10.5px] font-semibold text-rust ring-1 ring-[#ecd9c6]">{i + 1}</span>
            <span className="min-w-0"><span className="block font-medium text-ink">{t}</span><span className="block text-zinc-500">{d}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}
