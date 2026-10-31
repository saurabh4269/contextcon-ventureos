"use client";
// Deal page: /deal?domain=e2b.dev (or ?company=) → GET /api/live/research, then GET /api/deals/:domain/decisions (fit score, verdicts,
// valuation, comps, return multiples — each cited or unavailable with the reason).
// States: loading → skeleton · not connected / upstream error → error state with the server's message · unknown domain →
// the Signals section's "No Crustdata match for <domain>" · ok → header, Signals, Overview, Team, Market, Valuation.
// No domain → a prompt for one. Opening a researched deal and acting on a signal are appended to organizational memory.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DealScreen } from "@port/screens/deal";
import { Page, TopBar } from "@port/components/shell";
import { Btn } from "@port/components/ui";
import type { LoadStatus, ShellData } from "@port/types";
import { noMatchSignals, placeholderDeal, toLiveDeal, toValuationSection, withDecisionFit } from "@/lib/adapters/deal";
import type { ResearchResult } from "@/lib/live/types";
import type { DecisionsResponse } from "@/lib/numbers/decisions";
import type { DealSection } from "@port/types";
import { useLiveCoverage } from "@/components/datamode";
import { failureMessage, useLiveJson } from "./useLiveJson";
import { useLiveCoverage } from "@/components/datamode";
import { recordEvent } from "./memory";

/** Unavailable decisions wait in the review queue; say so where the "—" is shown. */
const withReviewNote = (s: DealSection, open: number): DealSection =>
  open && s.kind === "valuation" ? { ...s, unavailable: `${s.unavailable ?? "Some decisions are unavailable."} ${open === 1 ? "One decision is" : `${open} decisions are`} waiting for you in Review (/review).` } : s;

type Ok = Extract<ResearchResult, { status: "ok" }>;
type NoMatch = Extract<ResearchResult, { status: "no_match" }>;

export function LiveDeal({ shell, domain, tab }: { shell: ShellData; domain: string | undefined; tab?: string }) {
  useLiveCoverage("Live · Crustdata");
  if (!domain) return <DomainPrompt shell={shell} />;
  return <LiveDealFor key={domain} shell={shell} domain={domain} tab={tab} />;
}

function LiveDealFor({ shell, domain, tab }: { shell: ShellData; domain: string; tab?: string }) {
  useLiveCoverage("Live · Crustdata");
  const router = useRouter();
  const res = useLiveJson<Ok | NoMatch>(`/api/live/research?domain=${encodeURIComponent(domain)}`);
  const ok = res.state === "ok" && res.data.status === "ok" ? res.data : null;
  const noMatch = res.state === "ok" && res.data.status === "no_match" ? res.data : null;
  const val = useLiveJson<DecisionsResponse>(ok ? `/api/deals/${encodeURIComponent(ok.domain)}/decisions` : null);
  const opened = useRef(false);
  useEffect(() => {
    if (!ok || opened.current) return;
    opened.current = true;
    void recordEvent({ kind: "deal.opened", subject: { type: "company", id: ok.domain, label: ok.company.name }, summary: `Opened ${ok.company.name} (${ok.domain})` });
  }, [ok]);

  const research = ok ? toLiveDeal(ok) : null;
  const base = research ? (val.state === "ok" ? withDecisionFit(research, val.data.fields) : research) : noMatch ? { ...placeholderDeal(domain), signals: noMatchSignals(domain, noMatch.calls.identify, noMatch.requestedAt) } : placeholderDeal(domain);
  const data = ok && val.state === "ok"
    ? { ...base, sections: { ...base.sections, valuation: withReviewNote(toValuationSection(val.data.fields), val.data.review?.open.length ?? 0) }, outline: [...base.outline, { id: "valuation", label: "Valuation", state: "warn" as const }] }
    : base;
  const valid = (v?: string) => (v && (v === "signals" || data.sections?.[v]) ? v : "signals");
  const [view, setView] = useState(valid(tab));
  // once data (and the valuation section) arrive, honour the ?tab= the page was opened with
  const asked = useRef(tab);
  useEffect(() => { if (ok) setView((v) => valid(asked.current && (asked.current !== "valuation" || val.state === "ok") ? asked.current : v)); }, [ok, val.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const onOutline = (id: string) => {
    asked.current = undefined;
    setView(valid(id));
    const u = new URL(window.location.href); u.searchParams.set("tab", id); window.history.replaceState(null, "", u);
  };
  const status: LoadStatus | undefined = res.state === "loading" ? "loading" : res.state === "failed" ? "error" : undefined;
  return (
    <DealScreen shell={shell} data={data} status={status}
      error={res.state === "failed" ? failureMessage(res, `Couldn’t research ${domain}`) : undefined}
      onRetry={() => void res.reload()} view={noMatch ? "signals" : view} onOutline={onOutline}
      signalsStatus={noMatch ? "empty" : undefined}
      onSignalAction={(id) => {
        if (ok) void recordEvent({ kind: "signal.action", subject: { type: "company", id: ok.domain, label: ok.company.name }, summary: `Chose “${id === "team" ? "Review team" : "Open overview"}” on ${ok.company.name}'s signals`, data: { action: id } });
        onOutline(id === "team" ? "team" : "overview");
      }}
      onOpenRoom={() => router.push(`/deal/room?id=${encodeURIComponent(domain)}`)} onOpenMemo={() => router.push(`/memo?id=${encodeURIComponent(domain)}`)} />
  );
}

function DomainPrompt({ shell }: { shell: ShellData }) {
  return (
    <Page active="pipeline" shell={shell} top={<TopBar crumbs={[{ label: "Pipeline", href: "/pipeline" }, { label: "Research a company" }]} ctx="All deals" />}>
      <div className="px-4"><ResearchForm className="mx-auto my-16 max-w-[460px] @max-[720px]/main:my-6" /></div>
    </Page>
  );
}

/** Enter a domain → the live deal page for it. */
export function ResearchForm({ className }: { className?: string }) {
  const router = useRouter();
  const [v, setV] = useState("");
  const go = (e: FormEvent) => { e.preventDefault(); const d = v.trim(); if (d) router.push(`/deal?domain=${encodeURIComponent(d)}`); };
  return (
    <form onSubmit={go} data-testid="research-form" className={`rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center @max-[720px]/main:p-5 ${className ?? ""}`}>
      <div className="serif text-[22px]">Research a company</div>
      <p className="mt-1 text-[13px] text-zinc-500">Enter a company domain. Deal Desk resolves it on Crustdata and pulls headcount, funding, founders, hiring and news.</p>
      <div className="mt-4 flex gap-2">
        <input aria-label="Company domain" value={v} onChange={(e) => setV(e.target.value)} placeholder="company.com" className="h-9 min-w-0 flex-1 rounded-full @max-[720px]/main:h-10 bg-white px-4 text-[13px] ring-1 ring-zinc-200 outline-none focus:ring-zinc-400" />
        <Btn variant="primary" type="submit">Research</Btn>
      </div>
    </form>
  );
}
