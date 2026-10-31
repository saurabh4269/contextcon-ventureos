"use client";
// Review: the exceptions inbox. Agents auto-complete everything they can verify on Crustdata and raise an item only
// when a person is needed (ambiguous match, missing/conflicting data, credit threshold, low confidence, incomplete run,
// any outbound send). Everything here comes from GET /api/exceptions; resolving an item POSTs /api/exceptions/<id>.
// No counts or values are invented: what the API does not return is not shown (or shows "not reported").
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Page, TopBar } from "@port/components/shell";
import { cx } from "@port/components/ui";
import { fmtAgo, fmtDateTime } from "@/lib/format";
import {
  EXCEPTIONS_CHANGED_EVENT,
  KIND_LABEL,
  type ArtefactCell,
  type ArtefactRow,
  type Evidence,
  type ExceptionAction,
  type ExceptionItem,
  type ExceptionsResponse,
  type ResolveRequest,
  type ResolveResponse,
  type RunRecord,
  type RunSource,
} from "@/lib/exceptions/types";
import { CitePop } from "./agent/Cite";
import { liveShell } from "./shell";
import { failureMessage, useLiveJson } from "./useLiveJson";

const GREEN = "#2f9a5c";
const SOURCE_LABEL: Record<RunSource, string> = { "screen-agent": "Assistant", "sourcing-agent": "Sourcing agent", deal: "Deal page", manual: "Manual" };
const ACTION_LABEL: Record<ExceptionAction, string> = { approve: "Approved", reject: "Rejected", edit: "Edited" };

const newestFirst = <T extends { createdAt: string }>(a: T, b: T) => Date.parse(b.createdAt) - Date.parse(a.createdAt);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function fmtValue(v: string | number | boolean | null | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

function NotReported({ reason }: { reason?: string }) {
  return (
    <span className="inline-flex items-center text-zinc-400 italic">
      not reported
      {reason && <CitePop cites={[]} reasoning={reason} label="Why">?</CitePop>}
    </span>
  );
}

function Tag({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "rust" | "green" }) {
  return (
    <span className={cx("ml-1.5 inline-flex h-[18px] shrink-0 items-center rounded-full px-1.5 text-[10.5px] font-medium ring-1",
      tone === "rust" ? "bg-[#fbf3ee] text-rust ring-[#ecd6c8]" : tone === "green" ? "bg-[#eef7f1] text-[#2f9a5c] ring-[#cfe7d8]" : "bg-zinc-50 text-zinc-500 ring-zinc-200")}>
      {children}
    </span>
  );
}

function When({ iso }: { iso: string }) {
  return <time dateTime={iso} title={fmtDateTime(iso)} className="tnum">{fmtAgo(iso)}</time>;
}

/* ───────────── one exception item ───────────── */

function EvidenceTable({ rows }: { rows: Evidence[] }) {
  if (rows.length === 0) return null;
  return (
    <table className="mt-3 w-full text-left text-[12.5px]" data-testid="exception-evidence">
      <tbody className="divide-y divide-zinc-100">
        {rows.map((e, i) => {
          const v = fmtValue(e.value);
          return (
            <tr key={i} className="align-top">
              <th scope="row" className="w-[38%] py-1.5 pr-3 font-normal text-zinc-500">{e.label}</th>
              <td className="py-1.5 text-ink">
                <span className="inline-flex flex-wrap items-center">
                  {v === null ? <NotReported reason={e.note} /> : <span className="break-words">{v}</span>}
                  {e.citation && <CitePop cites={[e.citation]} />}
                </span>
                {e.note && v !== null && <span className="block text-[11.5px] text-zinc-400">{e.note}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Proposed({ item }: { item: ExceptionItem }) {
  const p = item.proposed;
  if (!p) return null;
  const outbound = item.kind === "outbound_send";
  const v = p.value;
  const scalar = v === null || v === undefined || typeof v !== "object";
  return (
    <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200/70" data-testid="exception-proposed">
      <div className="flex flex-wrap items-center gap-1 text-[11.5px] text-zinc-500">
        <span className="font-medium text-zinc-600">{p.label}</span>
        {outbound && <Tag tone="rust">Dry run — will not be sent</Tag>}
      </div>
      {scalar
        ? <div className="mt-1 text-[12.5px] break-words text-ink">{fmtValue(v as string | number | boolean | null | undefined) ?? <NotReported />}</div>
        : <pre className="mt-1 max-h-56 overflow-auto rounded-md bg-white p-2 font-mono text-[11px] leading-snug whitespace-pre-wrap text-zinc-700 ring-1 ring-zinc-200/70">{JSON.stringify(v, null, 2)}</pre>}
    </div>
  );
}

function ResolutionLine({ item }: { item: ExceptionItem }) {
  const r = item.resolution;
  if (!r) return null;
  return (
    <div className="mt-3 rounded-lg bg-[#eef7f1] px-3 py-2 text-[12.5px] text-zinc-700 ring-1 ring-[#cfe7d8]" data-testid="exception-resolution">
      <span className="font-medium" style={{ color: GREEN }}>{ACTION_LABEL[r.action]}</span>
      <span className="text-zinc-500"> · by {r.by} · <time dateTime={r.at}>{fmtDateTime(r.at)}</time></span>
      <span className="block">{r.effect}</span>
      {r.value && <span className="block text-zinc-500">Value: {r.value}</span>}
      {r.note && <span className="block text-zinc-500">Note: {r.note}</span>}
      {r.outbound && <span className="block text-zinc-500">{r.outbound.label}</span>}
    </div>
  );
}

/** One exception with its evidence, proposal and Approve / Reject / Edit. Reusable on other screens. */
export function ExceptionCard({ item, onResolved, showRun = false }: { item: ExceptionItem; onResolved?: (res: Extract<ResolveResponse, { status: "ok" }>) => void; showRun?: boolean }) {
  const [busy, setBusy] = useState<ExceptionAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const open = item.status === "open";
  const subjectHref = item.subject?.href ?? (item.subject?.domain ? `/deal?domain=${encodeURIComponent(item.subject.domain)}` : undefined);

  async function resolve(action: ExceptionAction) {
    if (action === "edit" && !value.trim()) { setError("Enter a value to save."); return; }
    setBusy(action);
    setError(null);
    const body: ResolveRequest = { action, ...(note.trim() ? { note: note.trim() } : {}), ...(action === "edit" ? { value: value.trim() } : {}) };
    try {
      const r = await fetch(`/api/exceptions/${encodeURIComponent(item.id)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const res = (await r.json().catch(() => null)) as ResolveResponse | null;
      if (!r.ok || !res || res.status !== "ok") {
        setError(res && res.status === "error" ? res.message : `Could not save (HTTP ${r.status}).`);
        return;
      }
      setEditing(false);
      setNote("");
      setValue("");
      window.dispatchEvent(new Event(EXCEPTIONS_CHANGED_EVENT));
      onResolved?.(res);
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  const btn = "inline-flex h-8 items-center rounded-full px-3.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 @max-[720px]/main:h-10";
  const input = "h-8 w-full rounded-lg bg-white px-2.5 text-[12.5px] text-ink ring-1 ring-zinc-200 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-rust/30";
  return (
    <article data-testid="exception-card" data-kind={item.kind} data-status={item.status} className="rounded-xl bg-white p-4 ring-1 ring-zinc-200/80">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-zinc-500">
        <span className={cx("inline-flex h-[20px] items-center rounded-full px-2 font-medium ring-1", item.kind === "outbound_send" ? "bg-[#fbf3ee] text-rust ring-[#ecd6c8]" : "bg-zinc-50 text-zinc-600 ring-zinc-200")}>{KIND_LABEL[item.kind]}</span>
        {showRun && item.runId && <Link href={`/review?run=${encodeURIComponent(item.runId)}`} scroll={false} className="hover:text-ink hover:underline">run</Link>}
        <span className="ml-auto"><When iso={item.createdAt} /></span>
      </div>
      <h3 className="mt-2 text-[13.5px] font-semibold text-ink">{item.title}</h3>
      {item.subject && (
        <div className="mt-0.5 text-[12.5px]">
          {subjectHref ? <Link href={subjectHref} className="text-zinc-700 underline-offset-2 hover:text-ink hover:underline">{item.subject.name}</Link> : <span className="text-zinc-700">{item.subject.name}</span>}
          {item.subject.domain && <span className="text-zinc-400"> · {item.subject.domain}</span>}
        </div>
      )}
      <p className="mt-2 text-[12.5px] text-zinc-600">{item.reason}</p>
      <EvidenceTable rows={item.evidence} />
      <Proposed item={item} />
      {open ? (
        <div className="mt-3">
          {editing && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`edit-${item.id}`}>{item.actions.edit}</label>
              <input id={`edit-${item.id}`} autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Corrected value" className={cx(input, "min-w-[200px] flex-1")}
                onKeyDown={(e) => { if (e.key === "Enter") void resolve("edit"); if (e.key === "Escape") setEditing(false); }} />
              <button type="button" disabled={!!busy || !value.trim()} onClick={() => void resolve("edit")} className={cx(btn, "bg-ink text-white hover:bg-zinc-800")}>{busy === "edit" ? "Saving…" : "Save"}</button>
              <button type="button" disabled={!!busy} onClick={() => setEditing(false)} className={cx(btn, "text-zinc-500 hover:text-ink")}>Cancel</button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!!busy} onClick={() => void resolve("approve")} className={cx(btn, "bg-ink text-white hover:bg-zinc-800")}>{busy === "approve" ? "Saving…" : item.actions.approve}</button>
            <button type="button" disabled={!!busy} onClick={() => void resolve("reject")} className={cx(btn, "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:text-ink")}>{busy === "reject" ? "Saving…" : item.actions.reject}</button>
            {item.actions.edit && !editing && <button type="button" disabled={!!busy} onClick={() => setEditing(true)} className={cx(btn, "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:text-ink")}>{item.actions.edit}</button>}
          </div>
          <label className="sr-only" htmlFor={`note-${item.id}`}>Note (optional)</label>
          <input id={`note-${item.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={cx(input, "mt-2")} />
          {error && <p role="alert" className="mt-2 text-[12px] text-rust">{error}</p>}
        </div>
      ) : (
        <ResolutionLine item={item} />
      )}
    </article>
  );
}

/* ───────────── runs and the shortlist ───────────── */

function RunCard({ run, open, focused }: { run: RunRecord; open: number; focused: boolean }) {
  const waiting = run.status === "waiting_on_person";
  return (
    <Link href={focused ? "/review" : `/review?run=${encodeURIComponent(run.id)}`} scroll={false} data-testid="run-card" data-run={run.id} aria-current={focused ? "true" : undefined}
      className={cx("block rounded-xl bg-white p-3.5 text-[12.5px] ring-1 transition-colors", focused ? "ring-2 ring-rust/40" : "ring-zinc-200/80 hover:ring-zinc-300")}>
      <div className="flex flex-wrap items-start gap-2">
        <q className="min-w-0 flex-1 text-[13px] text-ink">{run.request}</q>
        {waiting
          ? <span className="inline-flex h-[20px] shrink-0 items-center gap-1 rounded-full bg-[#fbf3ee] px-2 text-[11px] font-medium text-rust ring-1 ring-[#ecd6c8]"><span className="size-1.5 rounded-full bg-rust" />Waiting on you · {open}</span>
          : <span className="inline-flex h-[20px] shrink-0 items-center rounded-full bg-[#eef7f1] px-2 text-[11px] font-medium ring-1 ring-[#cfe7d8]" style={{ color: GREEN }}>Finished</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-zinc-500">
        <span>{SOURCE_LABEL[run.source] ?? run.source}{run.model ? ` · ${run.model}` : ""}</span>
        <span>{run.autoCompleted} auto-completed</span>
        <span>{plural(run.exceptionIds.length, "exception")}</span>
        {run.credits && <span>Crustdata credits {run.credits.used}{typeof run.credits.cap === "number" ? ` / ${run.credits.cap}` : ""}</span>}
        <time dateTime={run.createdAt}>{fmtDateTime(run.createdAt)}</time>
      </div>
      {run.summary && <p className="mt-1.5 text-[12px] text-zinc-600">{run.summary}</p>}
    </Link>
  );
}

function CellView({ cell }: { cell: ArtefactCell | undefined }) {
  if (!cell) return <span className="text-zinc-300">—</span>;
  const v = fmtValue(cell.value);
  if (cell.status === "unavailable" || v === null) return <NotReported reason={cell.reason} />;
  return (
    <span className="inline-flex flex-wrap items-center">
      <span>{v}</span>
      {cell.citation && <CitePop cites={[cell.citation]} reasoning={cell.reason} />}
      {cell.status === "corrected" && <Tag>corrected</Tag>}
      {cell.status === "manual" && <Tag>entered by person</Tag>}
    </span>
  );
}

function ShortlistRow({ row, columns }: { row: ArtefactRow; columns: { key: string; label: string }[] }) {
  const out = !!row.excluded;
  const span = columns.length + 3;
  const extra = row.why || row.excluded || row.notes.length > 0;
  return (
    <>
      <tr className={cx("align-top", out && "text-zinc-400 line-through", extra ? "" : "border-b border-zinc-100")} data-testid="shortlist-row" data-excluded={out ? "" : undefined}>
        <td className="py-2 pr-3 tnum">{row.rank}</td>
        <td className="py-2 pr-3">
          <span className={cx("block font-medium", out ? "" : "text-ink")}>{row.name}</span>
          {row.domain && <Link href={`/deal?domain=${encodeURIComponent(row.domain)}`} className="text-[11.5px] text-zinc-400 hover:text-ink hover:underline">{row.domain}</Link>}
        </td>
        {columns.map((c) => <td key={c.key} className="py-2 pr-3"><CellView cell={row.cells.find((x) => x.key === c.key)} /></td>)}
        <td className="py-2">
          {row.founders.length === 0
            ? (row.foundersNote ? <NotReported reason={row.foundersNote} /> : <span className="text-zinc-300">—</span>)
            : <ul className="space-y-1">{row.founders.map((f, i) => (
                <li key={i}>
                  <span className="inline-flex items-center">{f.name}{f.citation && <CitePop cites={[f.citation]} />}</span>
                  {f.title && <span className="block text-[11.5px] text-zinc-500">{f.title}</span>}
                  {f.prior.length > 0 && <span className="block text-[11.5px] text-zinc-400">{f.prior.join(" · ")}</span>}
                </li>))}</ul>}
          {row.founders.length > 0 && row.foundersNote && <span className="mt-1 block text-[11.5px] text-zinc-400">{row.foundersNote}</span>}
        </td>
      </tr>
      {extra && (
        <tr className="border-b border-zinc-100">
          <td />
          <td colSpan={span - 1} className="pb-2 text-[11.5px] text-zinc-500">
            {row.excluded && <span className="block text-rust">Excluded: {row.excluded.reason} · {row.excluded.by} · {fmtDateTime(row.excluded.at)}</span>}
            {row.why && <span className="block">{row.why}</span>}
            {row.notes.map((n, i) => <span key={i} className="block">· {n}</span>)}
          </td>
        </tr>
      )}
    </>
  );
}

function FocusedRun({ run, open }: { run: RunRecord; open: number }) {
  const a = run.artefact;
  return (
    <section data-testid="focused-run" className="rounded-xl bg-white p-4 ring-1 ring-zinc-200/80">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="serif text-[20px] leading-tight">Shortlist</h2>
        <span className="text-[12px] text-zinc-500">
          {run.status === "waiting_on_person" ? `Final once ${plural(open, "open item is", "open items are")} resolved` : `Finished · ${fmtDateTime(run.finishedAt)}`}
        </span>
        <Link href="/review" scroll={false} className="ml-auto text-[12px] text-zinc-500 hover:text-ink">Close</Link>
      </div>
      <q className="mt-1 block text-[12.5px] text-zinc-600">{run.request}</q>
      {!a ? (
        <p className="mt-3 text-[12.5px] text-zinc-500">This run has no shortlist (decision or outbound item only).</p>
      ) : a.rows.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-zinc-500">The shortlist has no rows.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12.5px]" data-testid="shortlist">
            <thead className="border-b border-zinc-200 text-[11px] text-zinc-500">
              <tr>
                <th className="py-1.5 pr-3 font-medium">#</th>
                <th className="py-1.5 pr-3 font-medium">Company</th>
                {a.columns.map((c) => <th key={c.key} className="py-1.5 pr-3 font-medium">{c.label}</th>)}
                <th className="py-1.5 font-medium">Founders</th>
              </tr>
            </thead>
            <tbody>{a.rows.map((r) => <ShortlistRow key={`${r.rank}-${r.name}`} row={r} columns={a.columns} />)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ───────────── the page ───────────── */

export function ReviewScreen({ runId }: { runId: string | null }) {
  const res = useLiveJson<ExceptionsResponse>("/api/exceptions?status=all");
  const { reload } = res;
  // keep showing the last good payload while a refetch is in flight (cards keep their place)
  const last = useRef<ExceptionsResponse | null>(null);
  if (res.state === "ok") last.current = res.data;
  const data = res.state === "ok" ? res.data : last.current;
  // items resolved in this session stay in the list (showing their effect) until the page is left
  const [justResolved, setJustResolved] = useState<string[]>([]);

  useEffect(() => {
    const on = () => void reload();
    window.addEventListener(EXCEPTIONS_CHANGED_EVENT, on);
    return () => window.removeEventListener(EXCEPTIONS_CHANGED_EVENT, on);
  }, [reload]);

  const view = useMemo(() => {
    if (!data) return null;
    const items = [...data.items].sort(newestFirst);
    const openByRun = new Map<string, number>();
    for (const it of items) if (it.status === "open" && it.runId) openByRun.set(it.runId, (openByRun.get(it.runId) ?? 0) + 1);
    const focused = runId ? data.runs.find((r) => r.id === runId) ?? null : null;
    const inScope = (it: ExceptionItem) => !focused || it.runId === focused.id;
    const active = items.filter((it) => inScope(it) && (it.status === "open" || justResolved.includes(it.id)));
    const resolved = items.filter((it) => inScope(it) && it.status !== "open");
    return { items, openByRun, focused, active, resolved, runs: [...data.runs].sort(newestFirst) };
  }, [data, runId, justResolved]);

  return (
    <Page active="review" shell={liveShell} top={<TopBar crumbs={[{ label: "Review" }]} ctx="Review" />}>
      <div className="mx-auto w-full max-w-[980px] px-8 pt-8 pb-16 @max-[720px]/main:px-4 @max-[720px]/main:pt-5" data-testid="review">
        <div>
          <h1 className="serif flex items-baseline gap-3 text-[34px] leading-none tracking-[-0.02em]">
            Needs you
            {data && <span className={cx("text-[20px] tnum", data.open > 0 ? "text-rust" : "text-zinc-400")} data-testid="review-open">{data.open}</span>}
          </h1>
          <p className="mt-2 max-w-[680px] text-[13px] text-zinc-500">Agents finish everything they can verify on Crustdata; only these items need a person. Approve, reject or edit — the run finishes when its last item is resolved.</p>
          {data && <p className="mt-1 text-[11.5px] text-zinc-400" data-testid="review-storage">{data.storage.note}</p>}
        </div>

        {!data || !view ? (
          res.state === "failed"
            ? <p role="alert" className="mt-8 text-[12.5px] text-zinc-600">{failureMessage(res, "Review queue")}</p>
            : <p className="mt-8 text-[12.5px] text-zinc-400">Loading review queue…</p>
        ) : view.items.length === 0 && view.runs.length === 0 ? (
          <div data-testid="review-empty" className="mx-auto mt-14 max-w-[560px] rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-7 text-center">
            <p className="text-[13px] text-zinc-600">Nothing needs you. Exceptions appear here when an agent run (Assistant / Sourcing agent) hits something it cannot verify, or before anything is sent.</p>
            <Link href="/ask" className="mt-4 inline-flex h-8 items-center rounded-full bg-white px-3.5 text-[12.5px] font-medium text-zinc-700 ring-1 ring-zinc-200 hover:text-ink">Open the Assistant</Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6">
            {res.state === "failed" && <p role="alert" className="text-[12px] text-rust">{failureMessage(res, "Refresh")}</p>}
            {runId && !view.focused && <p className="text-[12.5px] text-zinc-500">Run {runId} was not found. <Link href="/review" className="underline underline-offset-2 hover:text-ink">Show all</Link></p>}
            {view.focused && <FocusedRun run={view.focused} open={view.openByRun.get(view.focused.id) ?? 0} />}

            <section data-testid="review-open-items">
              <div className="flex items-baseline gap-2">
                <h2 className="text-[13.5px] font-semibold">Open items</h2>
                {view.focused && <span className="text-[11.5px] text-zinc-400">for this run · <Link href="/review" scroll={false} className="hover:text-ink hover:underline">show all</Link></span>}
              </div>
              {view.active.length === 0
                ? <p className="mt-2 text-[12.5px] text-zinc-500">{view.focused ? "No open items for this run." : "No open items."}</p>
                : <div className="mt-2 grid grid-cols-1 gap-3">{view.active.map((it) => (
                    <ExceptionCard key={it.id} item={it} showRun={!view.focused} onResolved={() => setJustResolved((s) => (s.includes(it.id) ? s : [...s, it.id]))} />
                  ))}</div>}
            </section>

            {view.runs.length > 0 && (
              <section data-testid="review-runs">
                <h2 className="text-[13.5px] font-semibold">Runs</h2>
                <div className="mt-2 grid grid-cols-1 gap-2 @min-[900px]/main:grid-cols-2">
                  {view.runs.map((r) => <RunCard key={r.id} run={r} open={view.openByRun.get(r.id) ?? 0} focused={view.focused?.id === r.id} />)}
                </div>
              </section>
            )}

            {view.resolved.length > 0 && (
              <details data-testid="review-resolved" className="rounded-xl bg-white px-4 py-3 ring-1 ring-zinc-200/80">
                <summary className="cursor-pointer text-[13px] font-medium text-zinc-700">Resolved · {view.resolved.length}</summary>
                <ul className="mt-2 divide-y divide-zinc-100">
                  {view.resolved.map((it) => (
                    <li key={it.id} className="py-2 text-[12.5px]">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[11px] text-zinc-500">{KIND_LABEL[it.kind]}</span>
                        <span className="font-medium text-ink">{it.title}</span>
                        {it.subject && <span className="text-zinc-500">· {it.subject.name}</span>}
                      </div>
                      {it.resolution && (
                        <div className="text-zinc-500">
                          <span style={{ color: GREEN }}>{ACTION_LABEL[it.resolution.action]}</span> by {it.resolution.by} · <time dateTime={it.resolution.at}>{fmtDateTime(it.resolution.at)}</time>
                          <span className="block text-zinc-600">{it.resolution.effect}</span>
                          {it.resolution.value && <span className="block">Value: {it.resolution.value}</span>}
                          {it.resolution.note && <span className="block">Note: {it.resolution.note}</span>}
                          {it.resolution.outbound && <span className="block">{it.resolution.outbound.label}</span>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
