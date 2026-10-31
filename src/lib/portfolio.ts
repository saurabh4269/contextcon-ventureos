// Portfolio companies: deals that reached the Portfolio stage (an Invest decision in the deal workflow, or a stage
// record moved there). Facts are the cited ones the workflow already gathered (no new Crustdata call). There is no
// KPI source (ARR, burn, runway, cash) in this build, so none is returned.
import type { Fact } from "@/lib/workflow/types";
import type { Deal } from "@/lib/workflow/types";
import type { StageRecord } from "@/lib/deals/stage";

export type PortfolioCompanyRow = {
  domain: string;
  name: string;
  workflowId: string | null;
  /** when the Invest decision (or the move to Portfolio) was recorded, UTC ISO */
  investedAt: string;
  by: string;
  note: string | null;
  /** cited facts from the workflow's research step (headcount, growth, funding, founders) */
  facts: Fact[];
  /** claims Crustdata contradicted at research or in the meeting transcript */
  contradicted: string[];
  memo: { model: string | null; sources: number } | null;
};

const KEEP = /^(Headcount|Headcount growth|Total funding|Founder: .+)$/;

export function portfolioFrom(deals: Deal[], stages: StageRecord[]): PortfolioCompanyRow[] {
  const out = new Map<string, PortfolioCompanyRow>();
  for (const d of deals) {
    const domain = d.company.domain;
    if (d.stage !== "portfolio" || !domain) continue;
    const step = (id: string) => d.steps.find((s) => s.id === id);
    const moved = [...d.stageHistory].reverse().find((h) => h.stage === "portfolio");
    const contradicted = [...(step("research")?.facts ?? []), ...(step("transcript")?.facts ?? [])].filter((f) => f.status === "contradicted").map((f) => `${f.label.replace(/^Claim |^Said in meeting: /, "")} — ${f.value}`);
    const row: PortfolioCompanyRow = {
      domain,
      name: d.company.name ?? domain,
      workflowId: d.id,
      investedAt: d.decision?.at ?? moved?.at ?? d.updatedAt,
      by: d.decision?.by ?? moved?.by ?? "—",
      note: d.decision?.note ?? null,
      facts: (step("research")?.facts ?? []).filter((f) => KEEP.test(f.label) && f.citation),
      contradicted,
      memo: step("memo")?.memo ? { model: step("memo")!.memo!.model, sources: step("memo")!.memo!.sources.length } : null,
    };
    const prev = out.get(domain);
    if (!prev || row.investedAt > prev.investedAt) out.set(domain, row);
  }
  for (const s of stages) {
    if (s.stage !== "portfolio" || out.has(s.domain)) continue;
    const moved = [...s.history].reverse().find((h) => h.stage === "portfolio");
    out.set(s.domain, { domain: s.domain, name: s.name ?? s.domain, workflowId: s.workflowId ?? null, investedAt: moved?.at ?? s.updatedAt, by: moved?.by ?? "—", note: moved?.note ?? null, facts: [], contradicted: [], memo: null });
  }
  return [...out.values()].sort((a, b) => b.investedAt.localeCompare(a.investedAt));
}
