"use client";
/** v4 · Right-hand sheet (Callora panel): header with serif title + status, scrollable body, sticky footer. Esc and the scrim close it; focus moves in on open and is trapped. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useReducedMotion } from "./motion";
import { Kbd, cx } from "./ui";

export function Sheet({ title, sub, eyebrow, children, foot, onClose, w = 520, label }: { title: ReactNode; sub?: ReactNode; eyebrow?: ReactNode; children: ReactNode; foot?: ReactNode; onClose: () => void; w?: number; label?: string }) {
  const ref = useRef<HTMLElement>(null), red = useReducedMotion();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const f = ref.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input, textarea, [tabindex]:not([tabindex='-1'])");
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <>
      <motion.div initial={red ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-40 bg-zinc-900/15 backdrop-blur-[2px]" onClick={onClose} />
      <motion.aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label ?? (typeof title === "string" ? title : undefined)} style={{ width: w }}
        initial={red ? false : { x: 32, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="fixed top-3 right-3 bottom-3 z-50 flex flex-col overflow-hidden rounded-[20px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.04),0_32px_64px_-24px_rgba(9,9,11,.35)] outline-none">
        <div className="flex items-start gap-3 border-b border-zinc-100 px-6 pt-5 pb-4">
          <div className="min-w-0 flex-1">{eyebrow && <div className="mb-1.5">{eyebrow}</div>}<div className="serif text-[24px] leading-tight tracking-[-0.01em]">{title}</div>{sub && <div className="mt-1 text-[12.5px] text-zinc-500">{sub}</div>}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 items-center gap-1.5 rounded-full pr-2 pl-2.5 text-zinc-400 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 hover:text-ink"><Kbd>Esc</Kbd><X className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {foot && <div className="flex items-center gap-2 border-t border-zinc-100 bg-zinc-50/60 px-6 py-3.5">{foot}</div>}
      </motion.aside>
    </>
  );
}

/** v4 · Today's pill button: ink (primary) or white with a hairline ring. Renders a Link with `href`. */
export function PillBtn({ children, primary, icon, onClick, href, className, size = "md", disabled, ...rest }: { children?: ReactNode; primary?: boolean; icon?: ReactNode; onClick?: () => void; href?: string; className?: string; size?: "sm" | "md"; disabled?: boolean; "aria-label"?: string; "aria-expanded"?: boolean; "aria-haspopup"?: "dialog" | "menu"; "aria-pressed"?: boolean }) {
  const cls = cx("inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&_svg]:size-3.5",
    size === "sm" ? "h-8 px-3 text-[12.5px]" : "h-9 px-4 text-[13px]",
    primary ? "bg-ink text-white shadow-[0_1px_2px_rgba(9,9,11,.2),inset_0_1px_0_rgba(255,255,255,.12)] hover:-translate-y-px hover:bg-zinc-800 hover:shadow-[0_6px_14px_-6px_rgba(9,9,11,.45)]"
      : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:text-ink hover:ring-zinc-300 hover:shadow-[0_4px_12px_-6px_rgba(9,9,11,.22)]", className);
  if (href) return <Link href={href} className={cls} aria-label={rest["aria-label"]}>{icon}{children}</Link>;
  return <button type="button" onClick={onClick} disabled={disabled} className={cls} {...rest}>{icon}{children}</button>;
}

/** v4 · Round icon trigger (Today's 36px ring button) that opens a small popover card. */
export function Popover({ icon, label, children, w = 260, badge }: { icon: ReactNode; label: string; children: (close: () => void) => ReactNode; w?: number; badge?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex">
      <button type="button" aria-label={label} title={label} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}
        className={cx("relative grid size-9 place-items-center rounded-full transition-colors [&_svg]:size-4", open ? "bg-ink text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-ink hover:ring-zinc-300")}>
        {icon}{badge ? <span className="tnum absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-rust text-[9.5px] font-semibold text-white ring-2 ring-white">{badge}</span> : null}
      </button>
      {open && (
        <span role="dialog" aria-label={label} style={{ width: w }} className="absolute top-full right-0 z-40 mt-2 block rounded-[16px] border border-zinc-200/80 bg-white p-2 text-left shadow-[0_1px_2px_rgba(9,9,11,.04),0_18px_40px_-14px_rgba(9,9,11,.28)]">
          {children(() => setOpen(false))}
        </span>
      )}
    </span>
  );
}

/** v4 · Save text as a file via a Blob URL (CSV / Markdown / JSON exports). No network. */
export function downloadText(name: string, text: string, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** CSV-escape one row. */
export const csvRow = (cells: (string | number)[]) => cells.map((c) => { const s = String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",");
