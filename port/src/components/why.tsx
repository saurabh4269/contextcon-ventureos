"use client";
// Why a value is what it is: the reasoning, the method, the evidence (inputs, or a decision's criteria with pass/fail)
// and one clickable chip per source — upstream endpoint + JSON path (click copies "endpoint path"), or the external
// URL (click opens it), retrieval time in IST, cached flag and credits. `WhyChip` is the small "src" button next to a
// value; it opens the panel in a right-hand sheet so it is never clipped by the row it sits in.
import { useState } from "react";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { Sheet } from "./sheet";
import { cx } from "./ui";
import type { Why, WhyEvidence, WhySource } from "../types";

const STATUS: Record<Why["status"], { label: string; cls: string }> = {
  ok: { label: "Sourced", cls: "bg-ok-50 text-ok" },
  verified: { label: "Verified", cls: "bg-ok-50 text-ok" },
  corrected: { label: "Corrected", cls: "bg-warn-50 text-warn" },
  unavailable: { label: "Unavailable", cls: "bg-zinc-100 text-zinc-500" },
};

/** One source: endpoint + path (copy on click) or external link; retrieved (IST) · cached · credits underneath. */
export function SourceChip({ s }: { s: WhySource }) {
  const [copied, setCopied] = useState(false);
  const where = [s.endpoint, s.path].filter(Boolean).join(" · ");
  const meta = [s.ref, s.retrieved ? `retrieved ${s.retrieved}` : null, s.cached ? "cached" : s.cached === false ? "live call" : null, s.credits != null ? `${s.credits} credit${s.credits === "1" ? "" : "s"}` : null].filter(Boolean).join(" · ");
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
        <span className="rounded bg-zinc-100 px-1.5 py-px text-[10.5px] font-semibold tracking-wide text-zinc-600 uppercase">{s.label}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] font-normal text-zinc-700">{where || s.url}</span>
        {s.url ? <ExternalLink className="size-3 shrink-0 text-zinc-400" /> : copied ? <Check className="size-3 shrink-0 text-ok" /> : <Copy className="size-3 shrink-0 text-zinc-400" />}
      </span>
      {s.url && where && <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{s.url}</span>}
      {meta && <span data-testid="why-source-meta" className="mt-0.5 block text-[11px] text-zinc-500">{meta}</span>}
    </>
  );
  const cls = "block w-full rounded-lg px-2.5 py-2 text-left ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50";
  return s.url ? (
    <a data-testid="why-source" href={s.url} target="_blank" rel="noreferrer" title={`Open ${s.url}`} className={cls}>{body}</a>
  ) : (
    <button data-testid="why-source" type="button" title="Copy endpoint and JSON path" className={cls}
      onClick={() => { void navigator.clipboard?.writeText(`${s.endpoint ?? ""} ${s.path ?? ""}`.trim()).then(() => setCopied(true), () => undefined); }}>
      {body}
    </button>
  );
}

function Evidence({ e }: { e: WhyEvidence }) {
  const [open, setOpen] = useState(false);
  const nested = e.why && (e.why.sources.length > 0 || e.why.status === "unavailable");
  return (
    <li className="border-t border-zinc-100 py-2 first:border-t-0">
      <button type="button" disabled={!nested} onClick={() => setOpen((o) => !o)} aria-expanded={nested ? open : undefined} className="flex w-full items-start gap-2 text-left text-[12.5px] disabled:cursor-default">
        {e.verdict && (
          <span className={cx("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full", e.verdict === "pass" ? "bg-ok-50 text-ok" : e.verdict === "fail" ? "bg-rust-50 text-rust" : "bg-zinc-100 text-zinc-400")}>
            {e.verdict === "pass" ? <Check className="size-2.5" strokeWidth={3} /> : e.verdict === "fail" ? <X className="size-2.5" strokeWidth={3} /> : <span className="text-[9px]">?</span>}
          </span>
        )}
        <span className="text-zinc-500">{e.name}</span>
        <span className="tnum ml-auto max-w-[60%] text-right font-medium break-words text-ink">{e.value}</span>
        {nested && <span className="shrink-0 text-[11px] text-zinc-400">{open ? "hide" : "why"}</span>}
      </button>
      {open && e.why && <div className="mt-2 ml-3 border-l-2 border-zinc-100 pl-3"><WhyPanel why={e.why} nested /></div>}
    </li>
  );
}

/** The panel: status, reasoning, method, evidence/criteria, sources. Unavailable values say why instead. */
export function WhyPanel({ why, nested }: { why: Why; nested?: boolean }) {
  const st = STATUS[why.status];
  return (
    <div data-testid="why-panel" data-status={why.status} className="space-y-3 text-[12.5px] leading-relaxed text-zinc-600">
      <div className="flex items-start gap-2">
        <span className={cx("shrink-0 rounded-full px-2 py-px text-[11px] font-medium", st.cls)}>{st.label}</span>
        <p className="text-ink">{why.summary}</p>
      </div>
      {why.method && <p><span className="text-zinc-400">Method </span>{why.method}</p>}
      {why.evidence.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">{why.evidence.some((e) => e.verdict) ? "Criteria and evidence" : "Inputs"}</div>
          <ul>{why.evidence.map((e, i) => <Evidence key={`${e.name}-${i}`} e={e} />)}</ul>
        </div>
      )}
      {why.sources.length > 0 ? (
        <div>
          <div className="mb-1 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">Sources</div>
          <div className="space-y-1.5">{why.sources.map((s, i) => <SourceChip key={i} s={s} />)}</div>
        </div>
      ) : why.status !== "unavailable" && !nested ? (
        <p className="text-rust">No source recorded for this value.</p>
      ) : null}
    </div>
  );
}

/** Small "src" button beside a value; opens the Why panel in a sheet. Renders nothing without a Why. */
export function WhyChip({ why, label, value, className }: { why?: Why; label: string; value?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!why) return null;
  const n = why.sources.length;
  return (
    <>
      <button type="button" data-testid="why-chip" data-status={why.status} data-sources={n} aria-haspopup="dialog" aria-expanded={open}
        aria-label={`Why: ${label}${why.status === "unavailable" ? " (unavailable)" : `, ${n} source${n === 1 ? "" : "s"}`}`}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
        className={cx("inline-flex h-[18px] shrink-0 items-center rounded-full px-1.5 text-[10.5px] font-medium ring-1 transition-colors", why.status === "unavailable" ? "text-zinc-400 ring-zinc-200 hover:bg-zinc-50" : why.status === "corrected" ? "text-warn ring-warn/30 hover:bg-warn-50" : "text-zinc-500 ring-zinc-200 hover:bg-zinc-50 hover:text-ink", className)}>
        {why.status === "unavailable" ? "why?" : `src${n > 1 ? ` ${n}` : ""}`}
      </button>
      {open && (
        <Sheet title={label} sub={value ? <span className="tnum">{value}</span> : undefined} eyebrow={<span className="text-[11px] font-medium tracking-wide text-zinc-400 uppercase">Why this value</span>} onClose={() => setOpen(false)} w={460} label={`Why: ${label}`}>
          <WhyPanel why={why} />
        </Sheet>
      )}
    </>
  );
}
