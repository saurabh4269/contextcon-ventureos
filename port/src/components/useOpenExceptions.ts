"use client";
// Live count of open exception items for the sidebar "Review" badge. Fetches GET /api/exceptions?count=1 on mount,
// every 30 s and whenever the UI resolves/raises an item. Errors are swallowed (null = no badge, never a made-up count).
import { useEffect, useState } from "react";

// Must match EXCEPTIONS_CHANGED_EVENT in src/lib/exceptions/types.ts (hard-coded so port/ stays independent of src/).
const EXCEPTIONS_CHANGED = "dealdesk:exceptions-changed";
const POLL_MS = 30_000;

export function useOpenExceptions(): number | null {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/exceptions?count=1", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const body = (await r.json()) as { open?: unknown };
        if (alive) setOpen(typeof body.open === "number" ? body.open : null);
      } catch {
        if (alive) setOpen(null);
      }
    };
    void load();
    const t = window.setInterval(load, POLL_MS);
    window.addEventListener(EXCEPTIONS_CHANGED, load);
    return () => {
      alive = false;
      window.clearInterval(t);
      window.removeEventListener(EXCEPTIONS_CHANGED, load);
    };
  }, []);
  return open;
}
