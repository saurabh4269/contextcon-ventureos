"use client";
// Citation chip for one cited value: hover (or tap) shows where the value came from — endpoint, record, JSON path,
// URL and the fetch time in IST. Unavailable values render "not reported" with the reason in the same popover style.
import { useRef, useState, type ReactNode } from "react";
import { cx } from "@port/components/ui";
import type { Citation, ComputedField } from "@/lib/fields";
import { fmtDateTime } from "@/lib/format";

export function CitePop({ cites, reasoning, method, children, label = "Source" }: { cites: Citation[]; reasoning?: string; method?: string; children?: ReactNode; label?: string }) {
  const [pinned, setPinned] = useState(false);
  // Anchor the popover so it stays on screen: centred, or flush to the chip near either viewport edge.
  const [side, setSide] = useState<"center" | "left" | "right">("center");
  const ref = useRef<HTMLSpanElement>(null);
  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || typeof window === "undefined") return;
    const half = 150;
    setSide(r.left + r.width / 2 < half + 8 ? "left" : window.innerWidth - (r.left + r.width / 2) < half + 8 ? "right" : "center");
  };
  return (
    <span ref={ref} className="group/cite relative inline-flex align-middle" onMouseEnter={place} onFocus={place} onMouseLeave={() => setPinned(false)}>
      <button type="button" aria-label={`${label}: ${cites[0]?.endpoint ?? "source"}`} aria-expanded={pinned} onClick={(e) => { e.stopPropagation(); place(); setPinned((p) => !p); }}
        className="relative ml-1 inline-grid size-[15px] shrink-0 after:absolute after:-inset-2 after:content-[''] place-items-center rounded-full bg-[#f3ede6] text-[8.5px] leading-none font-semibold text-[#8a4a1c] ring-1 ring-[#e7d8c8] transition-colors hover:bg-rust hover:text-white hover:ring-rust focus-visible:ring-2 focus-visible:ring-rust/50 focus-visible:outline-none">
        {children ?? "C"}
      </button>
      <span role="tooltip" className={cx("absolute top-[calc(100%+6px)] z-40 w-[290px] max-w-[calc(100vw-24px)] rounded-xl bg-ink p-3 text-left text-[11.5px] leading-snug font-normal text-zinc-200 shadow-[0_16px_40px_-12px_rgba(9,9,11,.55)] transition-opacity duration-150",
        side === "left" ? "-left-1" : side === "right" ? "-right-1" : "left-1/2 -translate-x-1/2",
        // display:none while closed so hidden popovers never widen the page (horizontal scroll on phones)
        pinned ? "block" : "hidden group-hover/cite:block group-focus-within/cite:block")}>
        {reasoning && <span className="mb-2 block text-white">{reasoning}</span>}
        {method && <span className="mb-2 block text-zinc-400">Method: {method}</span>}
        {cites.map((c, i) => (
          <span key={i} className={cx("block", i > 0 && "mt-2 border-t border-white/10 pt-2")}>
            <span className="block font-medium text-white">{c.source} · <span className="font-mono text-[10.5px]">{c.endpoint}</span></span>
            {typeof c.record === "string" && <span className="block text-zinc-400">record: <span className="font-mono text-[10.5px] text-zinc-300">{c.record}</span></span>}
            {c.path && <span className="block break-all text-zinc-400">path: <span className="font-mono text-[10.5px] text-zinc-300">{c.path}</span></span>}
            {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="block truncate text-[#f0b48a] underline-offset-2 hover:underline">{c.url}</a>}
            {c.retrievedAt && <span className="block text-zinc-400">fetched {fmtDateTime(String(c.retrievedAt))}{c.cached ? " · from cache" : ""}</span>}
          </span>
        ))}
      </span>
    </span>
  );
}

/** A value with its citation chip, or "not reported" with the reason. */
export function Cited<T>({ f, render, className, align = "start" }: { f: ComputedField<T> | { status: "pending" }; render: (v: T) => ReactNode; className?: string; align?: "start" | "end" }) {
  if (f.status === "pending") return <span className="inline-block h-3 w-14 animate-pulse rounded bg-zinc-100" aria-label="loading" />;
  if (f.status !== "ok") {
    const reason = f.reason.replace(/^not reported:\s*/i, "");
    return (
      <span className={cx("inline-flex items-center text-[12px] text-zinc-400 italic", align === "end" && "justify-end", className)}>
        not reported
        <CitePop cites={[]} reasoning={reason} label="Why">?</CitePop>
      </span>
    );
  }
  return (
    <span className={cx("inline-flex items-center", align === "end" && "justify-end", className)}>
      {render(f.value)}
      <CitePop cites={f.citations} reasoning={f.reasoning} method={f.method} />
    </span>
  );
}
