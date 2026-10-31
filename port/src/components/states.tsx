"use client";
// Shared loading / empty / error blocks. Every screen renders these when `status` is not "ready".
import { AlertTriangle, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Btn, cx } from "./ui";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("rounded-md bg-zinc-100 motion-safe:animate-pulse", className)} />;
}
/** Generic three-block skeleton that roughly matches every screen's layout. */
export function ScreenSkeleton({ cols = "grid-cols-[220px_1fr_360px]" }: { cols?: string }) {
  return (
    <div className={cx("grid min-h-[600px]", cols)} aria-busy="true" aria-live="polite">
      <div className="space-y-2 border-r border-zinc-200/70 px-3 pt-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-7" />)}</div>
      <div className="space-y-4 px-10 pt-7"><Skeleton className="h-9 w-1/2" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>
      <div className="space-y-3 border-l border-zinc-200/70 px-6 pt-6"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
    </div>
  );
}
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto my-16 max-w-[460px] rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center">
      <Inbox className="mx-auto size-5 text-zinc-400" />
      <div className="serif mt-2 text-[22px]">{title}</div>
      {body && <div className="mt-1 text-[13px] text-zinc-500">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function ErrorState({ message = "Couldn’t load this.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto my-16 max-w-[460px] rounded-xl border border-rust-100 bg-rust-50/60 p-8 text-center">
      <AlertTriangle className="mx-auto size-5 text-rust" />
      <div className="mt-2 text-[14px] font-medium">{message}</div>
      <div className="mt-1 text-[12.5px] text-zinc-500">Nothing was changed. Your drafts are safe.</div>
      {onRetry && <div className="mt-4"><Btn onClick={onRetry}>Try again</Btn></div>}
    </div>
  );
}
