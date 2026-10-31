"use client";
// Views for the screening agent (POST /api/live/screen): the live plan/tool timeline, the filter summary and the
// ranked result (table on desktop, cards on mobile). Every value carries its status and a tappable citation to the
// Crustdata call (ref), endpoint and JSON path it was checked against; missing data reads "unavailable", never a guess.
import { PlaySummary } from "@/live/voice/PlaySummary";
import { AlertTriangle, Ban, Check, CheckCheck, CircleSlash, Cpu, Database, Loader2, Pencil, Search, Sparkles, Wrench } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AppliedFilter, Citation, LedgerCall, ScreenCell, ScreenPerson, ScreenResult, ScreenRow } from "@/lib/agent/contract";
import { Pill, cx, CARD } from "@port/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { ScreenState, TimelineItem } from "./state";

const ms = (n: number) => (n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(1)} s`);
const num = (n: number) => n.toLocaleString("en-US");

/* ───────────── citation + status ───────────── */

const STATUS_ICON = { verified: Check, corrected: Pencil, unavailable: CircleSlash } as const;
const STATUS_TONE = { verified: "text-ok", corrected: "text-warn", unavailable: "text-zinc-400" } as const;
const POP_W = 260;

/**
 * Tap/click popover on a native <details> (works on touch and keyboard). The panel is position:fixed, placed under the
 * trigger and clamped to the viewport, so table scroll containers don't clip it and it never runs off a phone screen.
 */
function Pop({ trigger, label, children, testid, dataRef }: { trigger: ReactNode; label: string; children: ReactNode; testid?: string; dataRef?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const place = () => {
    const d = ref.current;
    if (!d?.open) return setPos(null);
    const r = d.querySelector("summary")!.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - POP_W - 8)) });
  };
  useEffect(() => {
    if (!pos) return;
    const close = () => { if (ref.current) ref.current.open = false; setPos(null); };
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("mousedown", onDoc);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); document.removeEventListener("mousedown", onDoc); };
  }, [pos]);
  return (
    <details ref={ref} onToggle={place} onKeyDown={(e) => { if (e.key === "Escape" && ref.current) { ref.current.open = false; setPos(null); } }} className="group inline-block align-middle" data-testid={testid} data-ref={dataRef}>
      <summary aria-label={label} className="inline-flex cursor-pointer list-none items-center gap-0.5 rounded-[5px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink [&::-webkit-details-marker]:hidden">{trigger}</summary>
      <span style={pos ? { top: pos.top, left: pos.left, width: POP_W } : { width: POP_W }} className={cx("z-50 block max-w-[calc(100vw-16px)] rounded-xl border border-zinc-200 bg-white p-2.5 text-left text-[11px] leading-[16px] font-normal not-italic shadow-[0_12px_32px_-8px_rgba(9,9,11,.22),0_2px_6px_rgba(9,9,11,.06)]", pos ? "fixed" : "absolute")}>
        {children}
      </span>
    </details>
  );
}

/** What a citation points at: call ref, method + endpoint, JSON path, retrieval time. */
function CiteBody({ c }: { c: Citation }) {
  return (
    <>
      <span className="flex items-center gap-1.5"><span className="rounded bg-ink px-1 font-mono text-[9.5px] text-white">{c.method}</span><span className="truncate font-mono text-ink">{c.endpoint}</span></span>
      <span className="mt-1 block font-mono break-all text-zinc-600">{c.path}</span>
      <span className="mt-1 flex justify-between gap-2 text-zinc-400"><span>Crustdata · call {c.ref}</span>{c.retrievedAt && <span>{fmtDateTime(c.retrievedAt)}</span>}</span>
    </>
  );
}

const refChip = (ref: string) => <span className="inline-flex h-[18px] items-center rounded-[5px] border border-zinc-200 bg-zinc-50 px-1 font-mono text-[10px] text-zinc-500 group-open:border-ink/30 group-open:bg-white group-open:text-ink hover:border-zinc-300 hover:text-ink">{ref}</span>;

/** Tappable citation chip on its own. */
export function Cite({ c }: { c: Citation }) {
  return <Pop testid="cite" dataRef={c.ref} label={`Source ${c.ref}: ${c.method} ${c.endpoint} ${c.path}`} trigger={refChip(c.ref)}><CiteBody c={c} /></Pop>;
}

const statusText = (cell: ScreenCell) =>
  cell.status === "corrected" ? `Corrected to the Crustdata value${cell.claimed !== undefined ? ` (model said ${JSON.stringify(cell.claimed)})` : ""}`
    : cell.status === "unavailable" ? `Unavailable${cell.reason ? `: ${cell.reason}` : ""}`
    : "Verified against the cited field";

/** Status chip for one value: icon-only when verified, labelled when corrected / unavailable. */
export function StatusChip({ cell }: { cell: ScreenCell }) {
  const Icon = STATUS_ICON[cell.status];
  if (cell.status === "verified") return <span data-status="verified" className="inline-flex"><Icon aria-label="verified" className={cx("size-3 shrink-0", STATUS_TONE.verified)} /></span>;
  return <Pill tone={cell.status === "corrected" ? "warn" : "neutral"} dot={false} className="!px-1.5 !text-[10px]"><span data-status={cell.status} className="inline-flex items-center gap-1"><Icon className="size-2.5" />{cell.status}</span></Pill>;
}

const fmtValue = (v: ScreenCell["value"]) => (v === null ? null : typeof v === "number" ? num(v) : typeof v === "boolean" ? (v ? "Yes" : "No") : v);

/** One value; tap its status/ref chip to see why (correction, missing-data reason) and the cited call + path. */
export function CellView({ cell, strong }: { cell: ScreenCell; strong?: boolean }) {
  const v = cell.status === "unavailable" ? null : fmtValue(cell.value);
  const c = cell.citation;
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1" data-cell={cell.key} data-status={cell.status}>
      {v === null || v === "" ? <span className="text-zinc-400 italic">unavailable</span> : <span className={cx("min-w-0 break-words", strong ? "font-medium text-ink" : "text-zinc-800")}>{v}</span>}
      <Pop testid={c ? "cite" : "why"} dataRef={c?.ref} label={`${cell.label}: ${statusText(cell)}${c ? `. Source ${c.ref}: ${c.method} ${c.endpoint} ${c.path}` : ""}`}
        trigger={<><StatusChip cell={cell} />{c && refChip(c.ref)}</>}>
        <span className={cx("mb-1.5 block", STATUS_TONE[cell.status])} data-testid="status-text">{statusText(cell)}</span>
        {c ? <CiteBody c={c} /> : <span className="block text-zinc-400">No Crustdata citation.</span>}
      </Pop>
    </span>
  );
}

/* ───────────── people ───────────── */

export function PeopleList({ row }: { row: ScreenRow }) {
  if (row.people.length === 0) return <span className="text-[12px] text-zinc-400 italic" data-testid="no-people">{row.peopleNote ?? "No people found"}</span>;
  return (
    <ul className="space-y-2" data-testid="people">
      {row.people.map((p, i) => <Person key={i} p={p} />)}
      {row.peopleNote && <li className="text-[11.5px] text-zinc-400">{row.peopleNote}</li>}
    </ul>
  );
}

function Person({ p }: { p: ScreenPerson }) {
  return (
    <li className="text-[12.5px]" data-testid="person">
      <div className="flex flex-wrap items-center gap-x-1.5"><CellView cell={p.name} strong /><span className="text-zinc-300">·</span><CellView cell={p.title} />{p.linkedin && p.linkedin.status !== "unavailable" && typeof p.linkedin.value === "string" && /^https?:\/\//i.test(p.linkedin.value) && <a href={p.linkedin.value} target="_blank" rel="noreferrer" className="text-[11px] text-zinc-400 hover:text-ink">in ↗</a>}</div>
      {p.prior.length > 0 ? (
        <ul className="mt-1 space-y-0.5 border-l border-zinc-200 pl-2.5 text-[11.5px] text-zinc-600" data-testid="prior">
          {p.prior.map((r, j) => (
            <li key={j} className="flex flex-wrap items-center gap-x-1"><CellView cell={r.title} /><span className="text-zinc-400">@</span><CellView cell={r.company} />{r.period && <span className="text-zinc-400">· {r.period}</span>}</li>
          ))}
        </ul>
      ) : <div className="mt-0.5 border-l border-zinc-200 pl-2.5 text-[11.5px] text-zinc-400 italic" data-testid="no-prior">prior roles unavailable</div>}
    </li>
  );
}

/* ───────────── filters ───────────── */

const APPLIED = {
  server: { label: "Applied in search", Icon: Database, tone: "text-ink" },
  client: { label: "Verified per result", Icon: CheckCheck, tone: "text-ok" },
  unavailable: { label: "Couldn’t apply", Icon: Ban, tone: "text-zinc-400" },
} as const;

export function FilterSummary({ filters }: { filters: AppliedFilter[] }) {
  if (filters.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-3" data-testid="filters">
      {(["server", "client", "unavailable"] as const).map((k) => {
        const fs = filters.filter((f) => f.applied === k);
        const { label, Icon, tone } = APPLIED[k];
        return (
          <div key={k} data-applied={k} className={cx("rounded-xl border border-zinc-200/80 bg-white px-3 py-2", fs.length === 0 && "opacity-50")}>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500"><Icon className={cx("size-3.5", tone)} />{label}<span className="ml-auto font-mono text-zinc-400">{fs.length}</span></div>
            <ul className="mt-1 space-y-1">
              {fs.map((f, i) => (
                <li key={i} className="text-[12px] leading-[17px]">
                  <details>
                    <summary className="cursor-pointer list-none text-ink [&::-webkit-details-marker]:hidden">{f.requirement}{f.relaxed && <span className="ml-1 rounded bg-warn-50 px-1 text-[10px] text-warn" title={f.relaxed}>relaxed</span>}</summary>
                    <div className="mt-0.5 text-[11px] text-zinc-500">{f.field && <span className="font-mono">{f.field} · </span>}{f.detail}{f.relaxed && <div className="text-warn">{f.relaxed}</div>}</div>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── timeline ───────────── */

function TimelineRow({ t }: { t: TimelineItem }) {
  if (t.kind === "plan") return (
    <li className="flex gap-2.5" data-kind="plan"><Sparkles className="mt-0.5 size-3.5 shrink-0 text-rust/70" /><span className="text-[12.5px] leading-[18px] whitespace-pre-line text-zinc-700">{t.text}</span></li>
  );
  if (t.kind === "verify") return (
    <li className="flex gap-2.5" data-kind="verify"><CheckCheck className="mt-0.5 size-3.5 shrink-0 text-ok" /><span className="text-[12.5px] leading-[18px] text-zinc-700">{t.text} <Stats s={t.stats} /></span></li>
  );
  const r = t.result;
  const ok = r?.status === "ok";
  return (
    <li className="flex gap-2.5" data-kind="tool" data-ref={t.call.ref} data-status={r?.status ?? "running"}>
      {!r ? <Loader2 className="mt-0.5 size-3.5 shrink-0 text-zinc-400 motion-safe:animate-spin" /> : ok ? <Wrench className="mt-0.5 size-3.5 shrink-0 text-zinc-500" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-rust" />}
      <span className="min-w-0 flex-1 text-[12px] leading-[18px]">
        <span className="flex flex-wrap items-center gap-x-1.5">
          <span className="rounded border border-zinc-200 bg-zinc-50 px-1 font-mono text-[10px] text-zinc-500">{t.call.ref}</span>
          <span className="font-medium text-ink">{t.call.tool}</span>
          {t.call.endpoint && <span className="truncate font-mono text-[11px] text-zinc-400">{t.call.endpoint}</span>}
          {r && <span className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] text-zinc-400">
            {r.rows !== undefined && <span data-testid="rows">{num(r.rows)}{r.totalCount != null ? ` / ${num(r.totalCount)}` : ""} rows</span>}
            {r.creditsUsed != null && <span>{r.creditsUsed} cr</span>}
            <span>{ms(r.ms)}</span>
          </span>}
        </span>
        {Object.keys(t.call.input).length > 0 && <details className="mt-0.5"><summary className="cursor-pointer list-none text-[11px] text-zinc-400 hover:text-ink [&::-webkit-details-marker]:hidden">input</summary><pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-zinc-50 p-2 font-mono text-[10.5px] text-zinc-600">{JSON.stringify(t.call.input, null, 2)}</pre></details>}
        {r?.error && <span className="block text-[11.5px] text-rust">{r.status === "refused" ? "Refused: " : ""}{r.error}</span>}
      </span>
    </li>
  );
}

export function Timeline({ state, collapsed }: { state: ScreenState; collapsed?: boolean }) {
  const items = state.timeline;
  const running = state.phase === "running";
  const body = (
    <ol className="space-y-2.5" data-testid="timeline" aria-live="polite">
      {items.map((t, i) => <TimelineRow key={i} t={t} />)}
      {running && (
        <li className="flex items-center gap-2.5 text-[12px] text-zinc-500" data-kind="thinking">
          <span className="relative grid size-3.5 place-items-center"><span className="absolute inset-0 rounded-full border-2 border-rust/25 border-t-rust motion-safe:animate-spin" /></span>
          {state.thinking != null ? "Thinking" : items.length === 0 ? "Starting" : "Working"}…
        </li>
      )}
    </ol>
  );
  if (!collapsed) return body;
  const tools = items.filter((t) => t.kind === "tool").length;
  return (
    <details className="group" data-testid="timeline-collapsed">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] text-zinc-500 hover:text-ink [&::-webkit-details-marker]:hidden"><Search className="size-3.5" />How this was found<span className="font-mono text-zinc-400">{tools} calls</span></summary>
      <div className="mt-3">{body}</div>
    </details>
  );
}

/* ───────────── result ───────────── */

function Stats({ s }: { s: ScreenResult["citationStats"] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle" data-testid="stats">
      <Pill tone="ok" className="!text-[10.5px]">{s.verified} verified</Pill>
      {s.corrected > 0 && <Pill tone="warn" className="!text-[10.5px]">{s.corrected} corrected</Pill>}
      {s.unavailable > 0 && <Pill tone="neutral" className="!text-[10.5px]">{s.unavailable} unavailable</Pill>}
    </span>
  );
}

function Ledger({ calls }: { calls: LedgerCall[] }) {
  if (calls.length === 0) return null;
  return (
    <details className="text-[11.5px]" data-testid="ledger">
      <summary className="cursor-pointer list-none text-zinc-500 hover:text-ink [&::-webkit-details-marker]:hidden">Crustdata calls <span className="font-mono text-zinc-400">{calls.length}</span></summary>
      <ul className="mt-2 divide-y divide-zinc-100 rounded-xl bg-white ring-1 ring-zinc-200/80">
        {calls.map((c) => (
          <li key={c.ref} id={`call-${c.ref}`} className="flex flex-wrap items-center gap-x-2 px-3 py-1.5 font-mono text-[10.5px] text-zinc-500" data-status={c.status}>
            <span className="text-ink">{c.ref}</span><span>{c.method}</span><span className="truncate text-zinc-700">{c.path}</span>
            <span className={cx(c.status === "ok" ? "text-ok" : "text-rust")}>{c.status}</span>
            <span className="ml-auto">{c.creditsUsed ?? "?"} cr{c.cached ? " · cached" : ""} · {ms(c.ms)}</span>
            {c.error && <span className="basis-full text-rust">{c.error}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ResultView({ result }: { result: ScreenResult }) {
  const { rows, columns } = result;
  const short = result.requested != null && rows.length < result.requested;
  return (
    <section className="space-y-4" data-testid="result" data-status={result.status}>
      <div className="flex flex-wrap items-center gap-2">
        {result.status === "incomplete" && <Pill tone="warn">Incomplete</Pill>}
        <span className="font-mono text-[12px] text-zinc-500" data-testid="count">{rows.length}{result.requested != null ? ` / ${result.requested}` : ""} results</span>
        <Stats s={result.citationStats} />
        <span className="ml-auto flex items-center gap-2 font-mono text-[10.5px] text-zinc-400"><span title="Crustdata credits used / cap">{result.credits.used} / {result.credits.cap} cr</span><span>{result.steps} steps</span><span>{ms(result.timings.totalMs)}</span><span className="inline-flex items-center gap-1"><Cpu className="size-3" />{result.model.model}</span></span>
      </div>
      {result.summary && (
        <div className="space-y-2">
          <p className="text-[13.5px] leading-[20px] text-zinc-700">{result.summary}</p>
          <PlaySummary text={result.summary} />
        </div>
      )}
      <FilterSummary filters={result.filters} />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center" data-testid="no-results">
          <CircleSlash className="mx-auto size-5 text-zinc-400" />
          <div className="serif mt-2 text-[20px]">No matches</div>
          <div className="mt-1 text-[12.5px] text-zinc-500">Nothing on Crustdata met every requirement above.</div>
        </div>
      ) : (
        <>
          {/* desktop: table */}
          <div className={cx(CARD, "hidden overflow-x-auto !rounded-xl md:block")}>
            <table className="w-full text-left text-[12.5px]" data-testid="result-table">
              <thead className="border-b border-zinc-200/80 text-[11px] text-zinc-500">
                <tr><th className="w-8 px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">Name</th>{columns.map((c) => <th key={c.key} className="px-3 py-2 font-medium">{c.label}</th>)}<th className="min-w-[260px] px-3 py-2 font-medium">People</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 align-top">
                {rows.map((r) => (
                  <tr key={r.rank} data-testid="row">
                    <td className="px-3 py-2.5 font-mono text-zinc-400">{r.rank}</td>
                    <td className="px-3 py-2.5"><CellView cell={r.name} strong />{r.why && <div className="mt-0.5 max-w-[240px] text-[11.5px] text-zinc-500">{r.why}</div>}</td>
                    {columns.map((c) => { const cell = r.cells.find((x) => x.key === c.key); return <td key={c.key} className="px-3 py-2.5">{cell ? <CellView cell={cell} /> : <span className="text-zinc-400 italic">unavailable</span>}</td>; })}
                    <td className="px-3 py-2.5"><PeopleList row={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* mobile: cards */}
          <ol className="space-y-3 md:hidden" data-testid="result-cards">
            {rows.map((r) => (
              <li key={r.rank} className={cx(CARD, "!rounded-xl p-3.5")} data-testid="card">
                <div className="flex items-start gap-2"><span className="font-mono text-[12px] text-zinc-400">{r.rank}</span><div className="min-w-0 flex-1"><CellView cell={r.name} strong />{r.why && <div className="mt-0.5 text-[11.5px] text-zinc-500">{r.why}</div>}</div></div>
                <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                  {columns.map((c) => { const cell = r.cells.find((x) => x.key === c.key); return <div key={c.key} className="min-w-0"><dt className="text-[10.5px] text-zinc-400">{c.label}</dt><dd>{cell ? <CellView cell={cell} /> : <span className="text-zinc-400 italic">unavailable</span>}</dd></div>; })}
                </dl>
                <div className="mt-3 border-t border-zinc-100 pt-2.5"><PeopleList row={r} /></div>
              </li>
            ))}
          </ol>
        </>
      )}
      {short && rows.length > 0 && <p className="text-[12px] text-warn" data-testid="short">Fewer results than asked for — only these met the requirements on Crustdata.</p>}
      {result.caveats.length > 0 && (
        <ul className="space-y-1 text-[12px] text-zinc-500" data-testid="caveats">{result.caveats.map((c, i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="mt-0.5 size-3 shrink-0 text-warn" />{c}</li>)}</ul>
      )}
      <Ledger calls={result.calls} />
    </section>
  );
}

/* ───────────── whole run ───────────── */

/** Everything below the input for one ask: timeline while running, then the result or an honest failure. */
export function ScreenRun({ state, onRetry }: { state: ScreenState; onRetry?: () => void }) {
  if (state.phase === "idle") return null;
  return (
    <div className="space-y-5" data-testid="run" data-phase={state.phase}>
      {state.model && state.phase === "running" && <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-zinc-400"><Cpu className="size-3" />{state.model.model}</div>}
      {state.phase === "model_unavailable" && (
        <div role="alert" data-testid="model-unavailable" className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-6 text-center">
          <Cpu className="mx-auto size-5 text-zinc-400" />
          <div className="serif mt-2 text-[20px]">Model unavailable</div>
          <p className="mt-1 text-[12.5px] text-zinc-500">{state.message}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {/* Fallback: the deterministic (no-LLM) Sourcing agent runs the same text at /agent?q=… */}
            {state.query && <a href={`/agent?q=${encodeURIComponent(state.query)}`} data-testid="sourcing-fallback" className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-[12.5px] font-medium text-white hover:bg-ink/90 sm:h-8">Run rules-based Sourcing agent</a>}
            <a href="/settings?section=connectors" className="inline-flex h-10 items-center rounded-full bg-white px-3.5 text-[12.5px] font-medium text-zinc-700 ring-1 ring-zinc-200 hover:text-ink sm:h-8">Connectors</a>
          </div>
        </div>
      )}
      {state.phase === "error" && (
        <div role="alert" data-testid="error" className="rounded-xl border border-rust-100 bg-rust-50/60 p-5">
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink"><AlertTriangle className="size-4 text-rust" />Run stopped</div>
          <p className="mt-1 text-[12.5px] text-zinc-600">{state.message}</p>
          {onRetry && <button type="button" onClick={onRetry} className="mt-3 inline-flex h-8 items-center rounded-full bg-white px-3.5 text-[12.5px] font-medium text-zinc-700 ring-1 ring-zinc-200 hover:text-ink">Try again</button>}
          {state.calls && state.calls.length > 0 && <div className="mt-3"><Ledger calls={state.calls} /></div>}
        </div>
      )}
      {(state.timeline.length > 0 || state.phase === "running") && <Timeline state={state} collapsed={state.phase === "done"} />}
      {state.phase === "done" && state.result && <ResultView result={state.result} />}
    </div>
  );
}
