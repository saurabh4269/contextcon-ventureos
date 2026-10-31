"use client";
// Live IC memo on the port MemoScreen (same component and layout as the fixture memo). /memo?id=<domain> →
// GET /api/deals/:domain/decisions + GET /api/live/research (name, logo, round); see src/lib/adapters/memo.ts.
// Without an id: the most recent deal worked on this server (GET /api/exceptions), else the screen's empty state.
import { MemoScreen } from "@port/screens/memo";
import type { MemoData, ShellData } from "@port/types";
import { toLiveMemo } from "@/lib/adapters/memo";
import type { DecisionsResponse } from "@/lib/numbers/decisions";
import type { ResearchResult } from "@/lib/live/types";
import { useLiveCoverage } from "@/components/datamode";
import { failureMessage, useLiveJson } from "./useLiveJson";
import { useKnownDeals } from "./known";

type ResearchOk = Extract<ResearchResult, { status: "ok" }>;

export function LiveMemoScreen({ shell, id }: { shell: ShellData; id?: string }) {
  useLiveCoverage("Live · Crustdata");
  return id ? <MemoFor key={id} shell={shell} id={id} /> : <LatestMemo shell={shell} />;
}

function LatestMemo({ shell }: { shell: ShellData }) {
  const known = useKnownDeals({ withDeals: false });
  if (known.state === "ok" && known.data.deals[0]) return <MemoFor shell={shell} id={known.data.deals[0].domain} />;
  const data = shellMemo("", "your next deal");
  if (known.state === "failed") return <MemoScreen shell={shell} data={data} status="error" error={failureMessage(known, "Deals")} onRetry={known.reload} />;
  return <MemoScreen shell={shell} data={data} status={known.state === "loading" ? "loading" : "empty"} />;
}

function MemoFor({ shell, id }: { shell: ShellData; id: string }) {
  const enc = encodeURIComponent(id);
  const res = useLiveJson<DecisionsResponse>(`/api/deals/${enc}/decisions`);
  const research = useLiveJson<ResearchResult>(`/api/live/research?domain=${enc}`);
  if (res.state === "failed") return <MemoScreen shell={shell} data={shellMemo(id, id)} status={res.body?.status === "no_match" ? "empty" : "error"} error={failureMessage(res, `Couldn’t load the memo numbers for ${id}`)} onRetry={() => void res.reload()} />;
  if (res.state === "loading" || research.state === "loading") return <MemoScreen shell={shell} data={shellMemo(id, id)} status="loading" />;
  const r = research.state === "ok" && research.data.status === "ok" ? (research.data as ResearchOk) : null;
  return <MemoScreen shell={shell} data={toLiveMemo(id, res.data, r)} />;
}

/** Chrome-only data for the loading / error / empty states (the screen renders the state, not these values). */
const shellMemo = (id: string, name: string): MemoData => ({
  company: { id, name, initial: name[0]?.toUpperCase() ?? "—" },
  outline: [], meta: { draft: "", citations: 0, unsupported: 0 }, title: name,
  recommendation: { verdict: "", valuation: { basis: "pre-money", currency: "USD", unit: "M", low: NaN, high: NaN, cap: NaN, capRationale: "", source: { kind: "crust", label: "" }, axis: { min: 0, max: 1 } }, valuationCite: 0, verifiedArr: { value: "—", cite: 0 }, flags: [] },
  conditions: [], bridge: [], questions: [], sources: [], activity: [], exportNote: "",
});
