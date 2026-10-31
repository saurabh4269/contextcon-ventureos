"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { initialScreen, reduceScreen, runScreen, type ScreenState } from "./state";

/** Run an ask against POST /api/live/screen and expose the live state. A new ask aborts the one in flight. */
export function useScreen() {
  const [state, setState] = useState<ScreenState>(() => initialScreen());
  const ctl = useRef<AbortController | null>(null);
  const ask = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    ctl.current?.abort();
    const c = (ctl.current = new AbortController());
    setState(initialScreen(q));
    void runScreen(q, (e) => { if (ctl.current === c) setState((s) => reduceScreen(s, e)); }, { signal: c.signal });
  }, []);
  const stop = useCallback(() => ctl.current?.abort(), []);
  useEffect(() => () => ctl.current?.abort(), []);
  return { state, ask, stop };
}
