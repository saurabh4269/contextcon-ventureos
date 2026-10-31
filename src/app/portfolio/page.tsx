"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
import { use, useState } from "react";
import { PortfolioScreen } from "@port/screens/portfolio";
import { shellInvest, portfolio, portfolioWithHelio } from "@port/fixtures";
import type { PortfolioData } from "@port/types";
import { useDataMode, useLiveCoverage } from "@/components/datamode";
import { liveShellFrom } from "@/live/shell";
export default function Portfolio({ searchParams }: { searchParams: Promise<{ state?: string; company?: string }> }) {
  const q = use(searchParams); useState(0);
  const mode = useDataMode();
  // Live mode: no source records closed deals or portfolio KPIs in this build, so the screen shows its own empty state.
  if (mode === "live" && !q.state && !q.company) return <LivePortfolio />;
  return <PortfolioScreen shell={shellInvest} data={q.company === "helio" ? portfolioWithHelio : portfolio} status={q.state === "loading" || q.state === "empty" || q.state === "error" ? q.state : "ready"} />;
}

/** Chrome-only data for the empty state (no companies, so the table, cards and panel do not render). */
const NO_PORTFOLIO: PortfolioData = {
  fundLabel: "No fund connected", companyCount: 0, view: "", alertLineMonths: 0, runwayAxisMax: 0, companies: [], hiddenOnTrack: 0, reports: [],
  panel: { company: { id: "", name: "", initial: "" }, alert: { label: "", tone: "neutral" }, runwayMonths: 0, history: [], projection: 0, facts: [], pattern: "", action: { id: "", label: "" } },
};

function LivePortfolio() {
  useLiveCoverage("Live · no portfolio source yet");
  return <PortfolioScreen shell={liveShellFrom(shellInvest)} data={NO_PORTFOLIO} status="empty" />;
}
