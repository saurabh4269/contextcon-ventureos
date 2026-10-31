"use client";
// Data mode on the client: provided by the root layout from DEALDESK_DATA_MODE (server env, per request).
// Live-wired screens call useLiveCoverage(...) so the badge says what is live on that page; every other page in live
// mode is badged as demo data, so fixtures are never passed off as live.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DataMode } from "@/lib/datamode";

type Coverage = { label: string; tone: "live" | "demo" } | null;
const Ctx = createContext<{ mode: DataMode; setCoverage: (c: Coverage) => void } | null>(null);
const CoverageCtx = createContext<Coverage>(null);

export function DataModeProvider({ mode, children }: { mode: DataMode; children: ReactNode }) {
  const [coverage, setCoverage] = useState<Coverage>(null);
  // stable value: a fresh object per render would re-run every useLiveCoverage effect after each setCoverage (update loop)
  const value = useMemo(() => ({ mode, setCoverage }), [mode]);
  return (
    <Ctx.Provider value={value}>
      <CoverageCtx.Provider value={coverage}>{children}<DataModeBadge /></CoverageCtx.Provider>
    </Ctx.Provider>
  );
}

export function useDataMode(): DataMode {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDataMode must be used inside <DataModeProvider>");
  return c.mode;
}

/** A live screen declares what on it is live (e.g. "Live · Crustdata"). Cleared on unmount. */
export function useLiveCoverage(label: string | null, tone: "live" | "demo" = "live") {
  const c = useContext(Ctx);
  useEffect(() => {
    if (!c || !label) return;
    c.setCoverage({ label, tone });
    return () => c.setCoverage(null);
  }, [c, label, tone]);
}

function DataModeBadge() {
  const ctx = useContext(Ctx)!;
  const cov = useContext(CoverageCtx);
  const live = cov?.tone === "live";
  // Live mode never says "Demo data": a screen without a source shows its own unavailable state, not fixtures.
  const text = live ? (cov?.label ?? "Live") : ctx.mode === "demo" ? "Demo data" : cov?.label ?? "Live · no data source for this screen";
  return (
    <div role="status" aria-live="polite" data-testid="data-mode-badge" data-mode={ctx.mode} data-live={live ? "1" : "0"}
      className="pointer-events-none fixed bottom-[72px] left-3 z-[60] flex max-w-[196px] items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-zinc-600 shadow-[0_1px_2px_rgba(9,9,11,.08)] ring-1 ring-zinc-200 backdrop-blur">
      <span className={live ? "size-1.5 shrink-0 rounded-full bg-[#2f9a5c]" : "size-1.5 shrink-0 rounded-full bg-[#d39a2c]"} />
      <span className="truncate" title={text}>{text}</span>
    </div>
  );
}
