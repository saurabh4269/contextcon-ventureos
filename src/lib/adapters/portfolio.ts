// Live Portfolio (port PortfolioScreen) from GET /api/portfolio: the deals invested through the deal workflow. Every
// fact shown is one the workflow cited (Crustdata, transcript); there is no KPI source in this build, so ARR, burn,
// cash and runway are "—" with the reason, never a number. No companies → the screen's own empty state.
import type { PortfolioCompany, PortfolioData, PortfolioPanel, SourceRef } from "@port/types";
import type { Citation } from "@/lib/fields";
import { fmtDate } from "@/lib/format";
import type { PortfolioCompanyRow } from "@/lib/portfolio";
import type { StorageInfo } from "@/lib/store/docs";

export const NO_KPIS = "No KPI source connected (ARR, burn, runway)";

const src = (c?: Citation): SourceRef => (c ? { kind: /crustdata/i.test(c.source) ? "crust" : /transcript/i.test(c.source) ? "call" : "db", label: c.source.replace(/\s*\(.*\)\s*$/, "") } : { kind: "db", label: "Deal workflow" });
const initial = (name: string) => name[0]?.toUpperCase() ?? "—";

function panelFor(r: PortfolioCompanyRow): PortfolioPanel {
  const facts = r.facts.filter((f) => !f.label.startsWith("Founder: ")).slice(0, 3).map((f) => ({ label: f.label === "Headcount growth" ? "Growth" : f.label === "Total funding" ? "Raised" : f.label, value: f.value, source: src(f.citation) }));
  return {
    company: { id: r.domain, name: r.name, initial: initial(r.name), domain: r.domain },
    alert: { label: "Invested", tone: "ok" },
    runwayMonths: NaN,
    history: [],
    projection: NaN,
    facts: [...facts, { label: "Decided", value: `${fmtDate(r.investedAt)} · ${r.by}`, source: { kind: "db", label: "Deal workflow" } }],
    pattern: r.contradicted.length ? `Contradicted at diligence: ${r.contradicted.join("; ")}` : "No claim was contradicted by Crustdata at diligence.",
    action: { id: r.workflowId ? `workflow:${r.workflowId}` : `deal:${r.domain}`, label: r.workflowId ? "Open the deal workflow" : "Open the deal" },
    onboarded: { label: "Invested", from: [r.memo ? "IC memo" : null, r.facts.length ? "Crustdata research" : null, r.contradicted.length ? "Claim checks" : null].filter((x): x is string => !!x), at: fmtDate(r.investedAt) },
  };
}

export function toLivePortfolio(rows: PortfolioCompanyRow[], storage?: StorageInfo | null): PortfolioData {
  const companies: PortfolioCompany[] = rows.map((r, i) => ({
    id: r.domain,
    company: { id: r.domain, name: r.name, initial: initial(r.name), domain: r.domain },
    line: r.domain,
    arr: "—",
    arrTrend: [],
    burn: "—",
    runwayMonths: NaN,
    lastUpdate: { label: `Invested ${fmtDate(r.investedAt)}` },
    alert: { label: "Invested", tone: "ok" },
    ...(i === 0 ? { selected: true } : {}),
  }));
  const panels = Object.fromEntries(rows.map((r) => [r.domain, panelFor(r)]));
  const first = rows[0];
  return {
    fundLabel: "Invested through the deal workflow",
    companyCount: companies.length,
    view: "",
    alertLineMonths: NaN,
    runwayAxisMax: NaN,
    companies,
    hiddenOnTrack: 0,
    reports: [],
    panel: first ? panels[first.domain]! : { company: { id: "", name: "", initial: "" }, alert: { label: "", tone: "neutral" }, runwayMonths: NaN, history: [], projection: NaN, facts: [], pattern: "", action: { id: "", label: "" } },
    panels,
    unknownKpis: NO_KPIS,
    filters: [{ id: "all", label: "All" }],
    exportName: "portfolio",
    ...(storage && !storage.durable ? { sub: storage.label.toLowerCase() } : {}),
  };
}
