"use client";
// Assistant (/ask): one input box → POST /api/live/screen (the screening agent, src/lib/agent). The plan and every
// Crustdata call stream in live; the answer is a ranked, cited table (cards on mobile). No sample data: before the
// first ask the page is just the input; a missing model or a failed run says so.
import { ArrowUp, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { Page, TopBar } from "@port/components/shell";
import { Orb } from "@port/components/assistant";
import { cx } from "@port/components/ui";
import type { ShellData } from "@port/types";
import { ScreenRun } from "./screen/views";
import { useScreen } from "./screen/useScreen";
import type { ScreenState } from "./screen/state";

export function AskInput({ running, onAsk, onStop, hero, initial = "" }: { running: boolean; onAsk: (q: string) => void; onStop: () => void; hero?: boolean; initial?: string }) {
  const [q, setQ] = useState(initial);
  // Stop replaces Run in the same spot: ignore it briefly so a double-click / quick re-tap on Run doesn't cancel.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    setArmed(false);
    if (!running) return;
    const t = setTimeout(() => setArmed(true), 400);
    return () => clearTimeout(t);
  }, [running]);
  const submit = () => { if (q.trim() && !running) onAsk(q.trim()); };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} data-testid="ask-input"
      className={cx("border border-zinc-200/90 bg-white transition-shadow focus-within:border-zinc-300", hero ? "rounded-[22px] p-3.5 shadow-[0_1px_2px_rgba(9,9,11,.04),0_0_0_5px_rgba(244,240,235,.9),0_24px_48px_-28px_rgba(120,60,20,.35)]" : "rounded-[20px] p-3 shadow-[0_1px_2px_rgba(9,9,11,.04),0_18px_40px_-26px_rgba(9,9,11,.3)]")}>
      <textarea name="q" rows={hero ? 3 : 2} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Ask Deal Desk"
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
        placeholder="Describe the companies or people you want — filters, counts, what to report"
        className={cx("block w-full resize-none bg-transparent px-1.5 leading-relaxed outline-none placeholder:text-zinc-400", hero ? "text-[15px]" : "text-[13.5px]")} />
      <div className="mt-1.5 flex justify-end">
        {running
          ? <button type="button" onClick={() => armed && onStop()} aria-label="Stop" title="Stop" className="relative grid size-9 place-items-center rounded-full bg-ink text-white hover:bg-zinc-800"><span className="absolute -inset-[3px] rounded-full border-2 border-rust/25 border-t-rust motion-safe:animate-spin" /><Square className="size-3 fill-current" /></button>
          : <button type="submit" aria-label="Run" title="Run" disabled={!q.trim()} className="grid size-9 place-items-center rounded-full bg-ink text-white transition-colors hover:bg-zinc-800 disabled:opacity-40"><ArrowUp className="size-4" /></button>}
      </div>
    </form>
  );
}

/** Presentational body (state in, callbacks out) so tests can render any stream state. */
export function AskBody({ state, onAsk, onStop }: { state: ScreenState; onAsk: (q: string) => void; onStop: () => void }) {
  const running = state.phase === "running";
  if (state.phase === "idle") return (
    <div className="relative isolate mx-auto flex min-h-[calc(100vh-52px)] w-full max-w-[700px] flex-col items-center justify-center px-4 pb-12 text-center sm:px-6">
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[560px] -translate-x-1/2 -translate-y-[64%] rounded-full bg-[radial-gradient(circle,rgba(232,150,90,.16),rgba(240,190,140,.07)_38%,transparent_66%)]" />
      <Orb size={84} />
      <h1 className="serif mt-7 text-[28px] leading-tight tracking-[-0.02em] sm:text-[32px]">What should we find?</h1>
      <p className="mt-1.5 text-[13px] text-zinc-500">Live on Crustdata. Every number cited.</p>
      <div className="mt-7 w-full text-left"><AskInput hero running={false} onAsk={onAsk} onStop={onStop} /></div>
    </div>
  );
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 pb-16 sm:px-6">
      <div className="mx-auto max-w-[760px]">
        <div className="mb-5 rounded-2xl bg-zinc-100/70 px-4 py-3 text-[14px] leading-[20px] text-ink" data-testid="query">{state.query}</div>
      </div>
      <div className={cx(state.phase === "done" ? "" : "mx-auto max-w-[760px]")}>
        <ScreenRun state={state} onRetry={() => onAsk(state.query)} />
      </div>
      <div className="sticky bottom-0 mx-auto mt-8 max-w-[760px] bg-gradient-to-t from-[#f8f8f7] from-60% to-transparent pt-6 pb-4">
        <AskInput key={state.query} running={running} onAsk={onAsk} onStop={onStop} />
      </div>
    </div>
  );
}

export function LiveAsk({ shell }: { shell: ShellData }) {
  const { state, ask, stop } = useScreen();
  const lead = (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="text-[13px] font-medium text-ink">Assistant</span><span className="text-zinc-300">/</span>
      <span className="truncate">{state.query || "New research"}</span>
    </span>
  );
  return (
    <Page active="assistant" shell={shell} responsive top={<TopBar crumbs={[{ label: "Assistant" }]} pill={false} ask={false} lead={lead} />}>
      <AskBody state={state} onAsk={ask} onStop={stop} />
    </Page>
  );
}
