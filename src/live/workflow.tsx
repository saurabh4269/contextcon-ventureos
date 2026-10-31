"use client";
// The deal workflow: a list of deals + "Start from inbox" (read-only Gmail candidates) + a domain input, and with ?id=
// one deal's ten steps as a vertical timeline. Everything comes from /api/workflow; drafts are only sent by the
// Approve button (dry run unless the server is in live mode and the recipient is allowlisted). Same port shell and
// type scale as the other live screens; addresses arrive masked (src/lib/workflow/public.ts).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Page, TopBar } from "@port/components/shell";
import { Skeleton } from "@port/components/states";
import { cx } from "@port/components/ui";
import { shellInvest } from "@port/fixtures";
import type { Citation } from "@/lib/fields";
import { fmtDateTime } from "@/lib/format";
import type { StorageInfo } from "@/lib/store/docs";
import { STAGE_LABEL, STEPS, type Deal, type Fact, type Stage, type Step } from "@/lib/workflow/types";
import { useDataMode, useLiveCoverage } from "@/components/datamode";
import { CitePop } from "./agent/Cite";
import { liveShellFrom } from "./shell";

type Candidate = { id: string; subject: string; date: string; domain: string | null };
type WithStorage = { storage?: StorageInfo };

const STATUS_TONE: Record<Step["status"], string> = {
  pending: "bg-zinc-50 text-zinc-500 ring-zinc-200",
  running: "bg-sky-50 text-sky-700 ring-sky-200",
  done: "bg-[#eef7f1] text-[#2f9a5c] ring-[#cfe7d8]",
  waiting: "bg-amber-50 text-amber-700 ring-amber-200",
  unavailable: "bg-zinc-100 text-zinc-600 ring-zinc-300",
  error: "bg-red-50 text-red-700 ring-red-200",
};
const FACT_TONE: Record<string, string> = { pass: "text-[#2f9a5c]", verified: "text-[#2f9a5c]", fail: "text-red-600", contradicted: "text-red-600", unknown: "text-zinc-400", unverifiable: "text-zinc-400", info: "text-zinc-400" };
const TRANSPORT: Record<string, string> = { live: "Live", read_only: "Read-only", dry_run: "Dry run", local: "Local", person: "Person" };
const fmtIst = (iso?: string) => (iso ? fmtDateTime(iso) : "");
/** Billed credits (rounded server-side); a step served from the response cache says so instead of a number. */
const creditsLabel = (s: Step) => (s.credits ? `${s.credits} Crustdata credits` : s.creditsCached ? "Crustdata cache · 0 credits" : null);

/** Where deals are kept, when that is not durable (the honest note from the server). */
function StorageNote({ storage }: { storage?: StorageInfo }) {
  if (!storage || storage.durable) return null;
  return <p data-testid="storage-note" className="text-[11.5px] text-amber-700">{storage.note}</p>;
}

function Chip({ status }: { status: Step["status"] }) {
  return (
    <span data-testid="step-status" className={cx("inline-flex h-[20px] items-center gap-1 rounded-full px-2 text-[11px] font-medium ring-1", STATUS_TONE[status])}>
      {status === "running" && <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" />}
      {status}
    </span>
  );
}

function Source({ c }: { c?: Citation }) {
  if (!c) return null;
  return <CitePop cites={[c]}>{c.source}</CitePop>;
}

function FactRow({ f }: { f: Fact }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 border-t border-zinc-100 py-1.5 text-[12.5px]">
      <span className="min-w-[180px] text-zinc-500">{f.label}</span>
      <span className="flex-1 text-ink">{f.value}{f.note && <span className="ml-1.5 text-[11.5px] text-zinc-400">({f.note})</span>}</span>
      {f.status && f.status !== "info" && <span className={cx("text-[11px] font-medium uppercase", FACT_TONE[f.status])}>{f.status}</span>}
      <Source c={f.citation} />
    </li>
  );
}

function Btn({ children, onClick, tone = "dark", disabled }: { children: ReactNode; onClick: () => void; tone?: "dark" | "light" | "red"; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cx("h-8 rounded-md px-3 text-[12.5px] font-medium disabled:opacity-50", tone === "dark" ? "bg-ink text-white hover:bg-zinc-800" : tone === "red" ? "bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50" : "bg-white text-ink ring-1 ring-zinc-200 hover:bg-zinc-50")}>
      {children}
    </button>
  );
}

function Draft({ step, act, busy }: { step: Step; act: (b: object) => void; busy: boolean }) {
  const d = step.draft!;
  return (
    <div data-testid="draft" className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-2 text-zinc-500">
        <span className="font-medium text-ink">{d.channel === "gmail.send" ? "Email draft" : "Calendar event draft"}</span>
        {d.channel === "gmail.send" && <span>to {d.to.join(", ")}</span>}
        {d.start && <span>{fmtIst(d.start)} – {fmtIst(d.end)}</span>}
        {d.channel === "calendar.insert" && <span>· your primary calendar · no attendees · sendUpdates=none</span>}
      </div>
      {!!d.blocked?.length && <div className="mt-1 text-[12px] text-red-700">Blocked for live send (not on the allowlist): {d.blocked.join(", ")}</div>}
      <div className="mt-2 font-medium text-ink">{d.subject}</div>
      <pre className="mt-1 whitespace-pre-wrap font-sans text-[12.5px] text-zinc-700">{d.body}</pre>
      <div className="mt-2 flex items-center gap-2">
        {d.approved ? (
          <span className={cx("text-[12px] font-medium", d.approved.transport === "live" ? "text-[#2f9a5c]" : "text-amber-700")}>
            {d.approved.transport === "live" ? `Sent · ${d.approved.result}` : (d.approved.result.startsWith("Dry run") ? d.approved.result : `Dry run — not sent · ${d.approved.result}`)} · {fmtIst(d.approved.at)}
          </span>
        ) : (
          <>
            <Btn disabled={busy} onClick={() => act({ action: "approve", step: step.id })}>Approve</Btn>
            <span className="text-[11.5px] text-zinc-500">Dry run unless the server is in live mode and every recipient is allowlisted.</span>
          </>
        )}
      </div>
    </div>
  );
}

function Transcript({ act, busy }: { act: (b: object) => void; busy: boolean }) {
  const [text, setText] = useState("");
  const [name, setName] = useState<string | undefined>();
  const [source, setSource] = useState<"paste" | "upload">("paste");
  return (
    <div className="mt-2 space-y-2">
      <textarea data-testid="transcript-input" value={text} onChange={(e) => { setText(e.target.value); setSource("paste"); }} rows={5} placeholder="Paste the meeting transcript…"
        className="w-full rounded-md border border-zinc-200 bg-white p-2 text-[12.5px] outline-none focus:ring-2 focus:ring-rust/30" />
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-md bg-white px-3 py-1.5 text-[12.5px] ring-1 ring-zinc-200 hover:bg-zinc-50">
          Upload .txt / .vtt / .md
          <input type="file" accept=".txt,.vtt,.md,text/plain,text/markdown,text/vtt" className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setText(await f.text()); setName(f.name); setSource("upload"); }} />
        </label>
        {name && <span className="text-[12px] text-zinc-500">{name}</span>}
        <Btn disabled={busy || !text.trim()} onClick={() => act({ action: "transcript", text, source, name })}>Add transcript</Btn>
        <Btn tone="light" disabled={busy} onClick={() => act({ action: "skip_transcript" })}>Continue without transcript</Btn>
      </div>
    </div>
  );
}

function Memo({ memo }: { memo: NonNullable<Step["memo"]> }) {
  return (
    <div data-testid="memo" className="mt-2 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-2 text-[11.5px] text-zinc-500">{memo.model ? `Written by ${memo.model}` : "Deterministic memo (no model)"} · {memo.sources.length} sources · numbers without a [n] citation are marked ⚠uncited</div>
      <div className="space-y-1 text-[13px] leading-relaxed text-ink">
        {memo.markdown.split("\n").map((l, i) => {
          const body = l.replace(/^\s*#+\s+/, "").replace(/^\s*[-*]\s+/, "");
          const parts = body.split(/(\[\d+\]|\*\*[^*]+\*\*)/g).map((p, j) => {
            const m = p.match(/^\[(\d+)\]$/);
            const c = m ? memo.sources[Number(m[1]) - 1] : undefined;
            if (c) return <CitePop key={j} cites={[c]}>{m![1]}</CitePop>;
            if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={j} className="font-semibold">{p.slice(2, -2)}</strong>;
            return <span key={j}>{p}</span>;
          });
          if (/^#\s/.test(l)) return <h2 key={i} className="pt-1 text-[16px] font-semibold">{parts}</h2>;
          if (/^##+\s/.test(l)) return <h3 key={i} className="pt-2 text-[14px] font-semibold">{parts}</h3>;
          if (/^\s*[-*]\s/.test(l)) return <div key={i} className="pl-4">• {parts}</div>;
          return l.trim() ? <p key={i}>{parts}</p> : null;
        })}
      </div>
    </div>
  );
}

const STAGES: Stage[] = ["sourced", "screening", "diligence", "ic", "portfolio"];
function StageBar({ deal }: { deal: Deal }) {
  const idx = deal.stage === "passed" ? STAGES.indexOf("ic") : STAGES.indexOf(deal.stage);
  return (
    <div data-testid="stage-bar" className="flex flex-wrap items-center gap-1.5 text-[12px]">
      {STAGES.map((s, i) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={cx("rounded-full px-2.5 py-0.5 ring-1", i < idx ? "bg-zinc-100 text-zinc-600 ring-zinc-200" : i === idx ? "bg-ink text-white ring-ink" : "bg-white text-zinc-400 ring-zinc-200")}>{STAGE_LABEL[s]}</span>
          {i < STAGES.length - 1 && <span className="text-zinc-300">→</span>}
        </span>
      ))}
      {deal.stage === "passed" && <span className="ml-2 rounded-full bg-red-50 px-2.5 py-0.5 text-red-700 ring-1 ring-red-200">Passed</span>}
    </div>
  );
}

function Timeline({ id }: { id: string }) {
  const [deal, setDeal] = useState<(Deal & WithStorage) | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/workflow/${encodeURIComponent(id)}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) { setErr(j.message ?? `HTTP ${r.status}`); return; }
    setDeal(j as Deal);
    if (timer.current) clearTimeout(timer.current);
    if ((j as Deal).running) timer.current = setTimeout(load, 1500);
  }, [id]);
  useEffect(() => { void load(); return () => { if (timer.current) clearTimeout(timer.current); }; }, [load]);
  const act = async (body: object) => {
    setBusy(true); setErr(null);
    const r = await fetch(`/api/workflow/${encodeURIComponent(id)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setErr(j.message ?? `HTTP ${r.status}`);
    void load();
  };
  if (err && !deal) return <p className="text-[13px] text-red-700">{err}</p>;
  if (!deal) return <TimelineSkeleton />;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-[20px] font-semibold text-ink">{deal.company.name ?? deal.company.domain ?? "New deal"}</h1>
          {deal.company.domain && <span className="text-[13px] text-zinc-500">{deal.company.domain}</span>}
          <span className="text-[12px] text-zinc-400">deal {deal.id} · started {fmtIst(deal.createdAt)} from {deal.trigger.type === "gmail" ? "Gmail" : "/ask"}</span>
          {deal.running && <span className="text-[12px] text-sky-700">running…</span>}
        </div>
        <StageBar deal={deal} />
        <StorageNote storage={deal.storage} />
        {err && <p className="text-[12.5px] text-red-700">{err}</p>}
      </div>
      <ol className="relative space-y-3 border-l border-zinc-200 pl-6">
        {STEPS.map((def, i) => {
          const s = deal.steps.find((x) => x.id === def.id)!;
          return (
            <li key={def.id} id={`step-${def.id}`} data-testid={`step-${def.id}`} className="relative scroll-mt-16 rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              <span className="absolute -left-[33px] top-4 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-zinc-500 ring-1 ring-zinc-300">{i + 1}</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">{def.title}</span>
                <span className="text-[12px] text-zinc-500">{def.agent}</span>
                <Chip status={s.status} />
                {s.transport && <span className="rounded bg-zinc-50 px-1.5 text-[11px] text-zinc-500 ring-1 ring-zinc-200">{TRANSPORT[s.transport]}</span>}
                {creditsLabel(s) && <span className="text-[11px] text-zinc-400">{creditsLabel(s)}</span>}
                <span className="ml-auto text-[11px] text-zinc-400">{fmtIst(s.finishedAt ?? s.startedAt)}</span>
              </div>
              {s.summary && <p className="mt-1.5 text-[13px] text-zinc-700">{s.summary}</p>}
              {s.error && <p className="mt-1 text-[12.5px] text-red-700">{s.error}</p>}
              {!!s.facts?.length && <ul className="mt-2">{s.facts.map((f, j) => <FactRow key={j} f={f} />)}</ul>}
              {s.draft && <Draft step={s} act={act} busy={busy || !!deal.running} />}
              {s.status === "waiting" && s.needs === "approve_screen" && <div className="mt-2"><Btn disabled={busy || deal.running} onClick={() => act({ action: "override_screen" })}>Override &amp; continue</Btn></div>}
              {s.status === "waiting" && s.needs === "transcript" && <Transcript act={act} busy={busy || !!deal.running} />}
              {s.memo && <Memo memo={s.memo} />}
              {s.memo && s.status === "done" && deal.steps.find((x) => x.id === "pipeline")!.status !== "done" && <div className="mt-2"><Btn tone="light" disabled={busy || deal.running} onClick={() => act({ action: "regenerate_memo" })}>Regenerate memo</Btn></div>}
              {s.status === "waiting" && s.needs === "ic_decision" && (
                <div className="mt-2 flex gap-2"><Btn disabled={busy || deal.running} onClick={() => act({ action: "decide", verdict: "invest" })}>Invest</Btn><Btn tone="red" disabled={busy || deal.running} onClick={() => act({ action: "decide", verdict: "pass" })}>Pass</Btn></div>
              )}
              {(s.status === "error" || (s.status === "running" && !deal.running)) && <div className="mt-2"><Btn tone="light" disabled={busy || deal.running} onClick={() => act({ action: "resume" })}>Retry</Btn></div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Same blocks as the loaded timeline: header row, stage bar, then the ten step cards. */
function TimelineSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="h-[60px] space-y-2"><Skeleton className="h-[30px] w-1/2" /><Skeleton className="h-[22px]" /></div>
      <ol className="relative space-y-3 border-l border-zinc-200 pl-6">{STEPS.map((s, i) => <li key={s.id} className={cx("rounded-xl border border-zinc-200 bg-white p-4", i < 4 ? "h-[120px]" : "h-[55px]")}><Skeleton className="h-5 w-1/2" />{i < 4 && <Skeleton className="mt-2 h-4 w-3/4" />}</li>)}</ol>
    </div>
  );
}

function Start({ start, name }: { start?: string; name?: string }) {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [storage, setStorage] = useState<StorageInfo | undefined>();
  const [inbox, setInbox] = useState<{ candidates?: Candidate[]; query?: string; message?: string; hidden?: number } | null>(null);
  const [dealsErr, setDealsErr] = useState<string | null>(null);
  const [domain, setDomain] = useState(start ?? "");
  const [err, setErr] = useState<string | null>(null);
  const begun = useRef(false);
  const begin = useCallback(async (body: object) => {
    setErr(null);
    const r = await fetch("/api/workflow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.message ?? `HTTP ${r.status}`); return; }
    router.push(`/workflow?id=${j.id}`);
  }, [router]);
  useEffect(() => {
    if (start && !begun.current) { begun.current = true; void begin({ from: "ask", domain: start, name }); return; }
    // a failing list is an error, not "No deals yet"
    void fetch("/api/workflow", { cache: "no-store" }).then(async (r) => {
      const j = await r.json().catch(() => null);
      if (!r.ok || !Array.isArray(j?.deals)) { setDealsErr(j?.message ?? `Could not load deals (HTTP ${r.status}).`); setDeals([]); return; }
      setDeals(j.deals); setStorage(j.storage);
    }, (e) => { setDealsErr(`Could not load deals: ${e instanceof Error ? e.message : String(e)}`); setDeals([]); });
    void fetch("/api/workflow/inbox", { cache: "no-store" }).then(async (r) => {
      const j = await r.json().catch(() => null);
      setInbox(r.ok && j ? j : { message: j?.message ?? `Inbox unavailable (HTTP ${r.status}).` });
    }).catch(() => setInbox({ message: "Inbox unavailable" }));
  }, [start, name, begin]);
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-[14px] font-semibold text-ink">Start a deal</h2>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (domain.trim()) void begin({ from: "ask", domain: domain.trim() }); }}>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="company domain, e.g. example.ai" className="h-8 flex-1 rounded-md border border-zinc-200 px-2 text-[13px] outline-none focus:ring-2 focus:ring-rust/30" />
          <button type="submit" className="h-8 rounded-md bg-ink px-3 text-[12.5px] font-medium text-white">Start deal</button>
        </form>
        {err && <p className="mt-2 text-[12.5px] text-red-700">{err}</p>}
      </section>
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-[14px] font-semibold text-ink">Start from inbox</h2>
        <p className="text-[12px] text-zinc-500">Read-only Gmail search{inbox?.query ? `: ${inbox.query}` : ""}</p>
        {!inbox ? <div aria-busy="true" className="mt-2 divide-y divide-zinc-100">{[0].map((i) => <div key={i} className="flex items-center gap-3 py-2"><div className="min-w-0 flex-1 space-y-1.5"><Skeleton className="h-[14px] w-2/3" /><Skeleton className="h-[14px] w-1/3" /></div><Skeleton className="h-7 w-[84px]" /></div>)}</div> : inbox.candidates ? (
          inbox.candidates.length ? (
            <ul className="mt-2 divide-y divide-zinc-100">
              {inbox.candidates.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2 text-[12.5px]">
                  <div className="min-w-0 flex-1"><div className="truncate font-medium text-ink">{c.subject}</div><div className="truncate text-zinc-500">{c.domain ?? "no company domain"} · {fmtIst(c.date)}</div></div>
                  <button type="button" disabled={!c.domain} onClick={() => begin({ from: "gmail", messageId: c.id })} className="h-7 rounded-md bg-white px-2.5 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-40">Start deal</button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[12.5px] text-zinc-500">No pitch-like founder emails match this search{inbox.hidden ? ` (${inbox.hidden} other matching emails are not shown: their subject does not read like a pitch)` : ""}.</p>
        ) : <p className="mt-2 text-[12.5px] text-zinc-500">{inbox.message ?? "Gmail not connected."}</p>}
      </section>
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-[14px] font-semibold text-ink">Deals</h2>
        <StorageNote storage={storage} />
        {!deals ? <div aria-busy="true" className="mt-2 divide-y divide-zinc-100">{[0].map((i) => <div key={i} className="py-2"><Skeleton className="h-[18px] w-1/2" /></div>)}</div> : dealsErr ? <p role="alert" className="mt-2 text-[12.5px] text-red-700">{dealsErr}</p> : deals.length ? (
          <ul className="mt-2 divide-y divide-zinc-100">
            {deals.map((d) => {
              const w = d.steps.find((s) => s.status === "waiting" || s.status === "running" || s.status === "error");
              return (
                <li key={d.id} className="py-2 text-[12.5px]">
                  <Link href={`/workflow?id=${d.id}`} className="flex items-center gap-3 hover:underline">
                    <span className="font-medium text-ink">{d.company.name ?? d.company.domain}</span>
                    <span className="text-zinc-500">{STAGE_LABEL[d.stage]}</span>
                    {w && <span className="text-zinc-500">· {STEPS.find((x) => x.id === w.id)!.title}: {w.status}</span>}
                    <span className="ml-auto text-zinc-400">{fmtIst(d.updatedAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-2 text-[12.5px] text-zinc-500">No deals yet.</p>}
      </section>
    </div>
  );
}

export function WorkflowScreen({ id, start, name }: { id?: string; start?: string; name?: string }) {
  const mode = useDataMode();
  useLiveCoverage("Live · Crustdata · Gmail · Calendar");
  return (
    <Page active="pipeline" shell={mode === "live" ? liveShellFrom(shellInvest) : shellInvest} top={<TopBar crumbs={id ? [{ label: "Workflow", href: "/workflow" }, { label: id }] : [{ label: "Workflow" }]} ctx="Workflow" />}>
      <div className="mx-auto w-full max-w-[920px] px-4 py-6 sm:px-6">{id ? <Timeline id={id} /> : <Start start={start} name={name} />}</div>
    </Page>
  );
}
