"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
import { use, useState } from "react";
import { PortfolioScreen } from "@port/screens/portfolio";
import { shellInvest, portfolio, portfolioWithHelio } from "@port/fixtures";
import { useRouter } from "next/navigation";
import { toLivePortfolio } from "@/lib/adapters/portfolio";
import type { PortfolioCompanyRow } from "@/lib/portfolio";
import type { StorageInfo } from "@/lib/store/docs";
import { failureMessage, useLiveJson } from "@/live/useLiveJson";
import { useDataMode, useLiveCoverage } from "@/components/datamode";
import { liveShellFrom } from "@/live/shell";
export default function Portfolio({ searchParams }: { searchParams: Promise<{ state?: string; company?: string }> }) {
  const q = use(searchParams); useState(0);
  const mode = useDataMode();
  // Live mode: deals invested through the deal workflow (GET /api/portfolio); no KPI source, so ARR and runway are "—".
  if (mode === "live") return <LivePortfolio />;
  return <PortfolioScreen shell={shellInvest} data={q.company === "helio" ? portfolioWithHelio : portfolio} status={q.state === "loading" || q.state === "empty" || q.state === "error" ? q.state : "ready"} />;
}

function LivePortfolio() {
  const router = useRouter();
  const res = useLiveJson<{ companies: PortfolioCompanyRow[]; storage?: StorageInfo }>("/api/portfolio");
  useLiveCoverage(res.state === "ok" && res.data.storage && !res.data.storage.durable ? "Live · deal store (not durable)" : "Live · deal store");
  const shell = liveShellFrom(shellInvest);
  if (res.state === "loading") return <PortfolioScreen shell={shell} data={toLivePortfolio([])} status="loading" />;
  if (res.state === "failed") return <PortfolioScreen shell={shell} data={toLivePortfolio([])} status="error" error={failureMessage(res, "Portfolio")} onRetry={() => void res.reload()} />;
  // Deals invested through the workflow; none yet → the screen's own empty state.
  const data = toLivePortfolio(res.data.companies, res.data.storage);
  return <PortfolioScreen shell={shell} data={data} status={data.companies.length ? "ready" : "empty"}
    onAction={(id) => { const [kind, ref] = id.split(/:(.+)/); if (kind === "workflow") router.push(`/workflow?id=${encodeURIComponent(ref!)}`); else if (kind === "deal") router.push(`/deal?domain=${encodeURIComponent(ref!)}`); }} />;
}
