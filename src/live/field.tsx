"use client";
// One explainable number: the formatted value (or "—"), with reasoning, method, inputs and citations on hover/focus
// and on click (expand). Unavailable fields show "—" and the reason.
import { useState } from "react";
import { cx } from "@port/components/ui";
import { isOk, type ComputedField } from "@/lib/fields";
import { fmtDateTime } from "@/lib/format";

export function FieldDetail({ f }: { f: ComputedField<unknown> | undefined }) {
  if (!f) return <p className="text-[12px] text-zinc-500">Unavailable: not provided by the API.</p>;
  if (!isOk(f)) return <p className="text-[12px] leading-relaxed text-zinc-500"><b className="font-medium text-ink">Unavailable.</b> {f.reason}</p>;
  return (
    <div className="space-y-1.5 text-[12px] leading-relaxed text-zinc-600">
      <p className="text-ink">{f.reasoning}</p>
      <p><span className="text-zinc-400">Method</span> {f.method}</p>
      {f.inputs.length > 0 && <p><span className="text-zinc-400">Inputs</span> {f.inputs.map((i) => `${i.name} = ${typeof i.value === "object" ? JSON.stringify(i.value) : String(i.value)}`).join(" · ")}</p>}
      {f.citations.map((c, i) => (
        <p key={i} className="font-mono text-[11px] text-zinc-500">
          {[c.source, c.endpoint, c.path].filter(Boolean).join(" · ")}{c.retrievedAt ? ` · retrieved ${fmtDateTime(String(c.retrievedAt))}` : ""}
          {c.stale ? <span className="text-amber-700"> · {String(c.note ?? `cached at ${fmtDateTime(String(c.retrievedAt))}`)}</span> : null}
          {c.url && <> · <a href={c.url} target="_blank" rel="noreferrer" className="underline">source</a></>}
        </p>
      ))}
    </div>
  );
}

/** Label + value row; click toggles the explanation. `testId` lets the verify script compare DOM ↔ API. */
export function FieldRow({ label, f, fmt, testId }: { label: string; f: ComputedField<unknown> | undefined; fmt: (v: unknown) => string; testId?: string }) {
  const [open, setOpen] = useState(false);
  const ok = isOk(f);
  return (
    <div className="border-t border-zinc-100 py-2.5 first:border-t-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="-my-2.5 flex w-full items-baseline gap-3 py-2.5 text-left">
        <span className="text-[12.5px] text-zinc-500">{label}</span>
        <span data-testid={testId} data-status={f?.status ?? "missing"} className={cx("ml-auto text-[13.5px] tnum", ok ? "font-medium text-ink" : "text-zinc-400")}>{ok ? fmt(f.value) : "—"}</span>
        <span className="w-[72px] text-right text-[11px] text-zinc-400">{ok ? "why?" : "unavailable"}</span>
      </button>
      {open && <div className="mt-2 rounded-lg bg-zinc-50 px-3 py-2"><FieldDetail f={f} /></div>}
    </div>
  );
}
