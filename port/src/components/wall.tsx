"use client";
// Chinese-wall badge + code-name rendering. Shown wherever a restricted or walled deal appears.
import { Lock, ShieldCheck } from "lucide-react";
import { cx } from "./ui";

/** `inside` = you are on the wall (show real name + a quiet "Walled" tag). Outside = code name + lock. */
export function WallBadge({ inside = false, size = "sm", className, iconOnly = false }: { inside?: boolean; size?: "sm" | "xs"; className?: string; /** v3.2: just the lock, label on hover. */ iconOnly?: boolean }) {
  const tip = inside ? "Walled deal: only members of this wall can see it" : "Restricted: you are not on this wall";
  if (iconOnly) return <span title={tip} aria-label={inside ? "Walled" : "Restricted"} className={cx("inline-flex size-[18px] shrink-0 items-center justify-center rounded-full", inside ? "border border-zinc-300 bg-white text-zinc-600" : "bg-ink text-white", className)}>{inside ? <ShieldCheck className="size-2.5" /> : <Lock className="size-2.5" />}</span>;
  return (
    <span
      title={inside ? "Walled deal: only members of this wall can see it" : "Restricted: you are not on this wall"}
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-medium",
        size === "sm" ? "px-2 py-[1px] text-[11px] leading-[17px]" : "px-1.5 text-[10px] leading-[15px]",
        inside ? "border-zinc-300 bg-white text-zinc-600" : "border-ink bg-ink text-white",
        className,
      )}
    >
      {inside ? <ShieldCheck className="size-3" /> : <Lock className="size-3" />}{inside ? "Walled" : "Restricted"}
    </span>
  );
}
/** Masked value for fields outside the wall. */
export function Masked({ w = 56 }: { w?: number }) {
  return <span aria-label="hidden" className="inline-block h-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,#e4e4e7_0_4px,#f4f4f5_4px_8px)]" style={{ width: w }} />;
}
