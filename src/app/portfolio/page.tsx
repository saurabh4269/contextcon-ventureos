"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
import { use, useState } from "react";
import { PortfolioScreen } from "@port/screens/portfolio";
import { shellInvest, portfolio, portfolioWithHelio } from "@port/fixtures";
export default function Portfolio({ searchParams }: { searchParams: Promise<{ state?: string; company?: string }> }) {
  const q = use(searchParams); useState(0);
  return <PortfolioScreen shell={shellInvest} data={q.company === "helio" ? portfolioWithHelio : portfolio} status={q.state === "loading" || q.state === "empty" || q.state === "error" ? q.state : "ready"} />;
}
