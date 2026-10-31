import "server-only";
import { NextResponse } from "next/server";
import { resolveDataMode } from "@/lib/datamode";
import { normalizeDomainInput } from "@/lib/live/normalize";
import { researchCompany } from "@/lib/live/research";
import { failureFrom, failureResponse, liveCrustdataClient } from "@/lib/live/server";
import { companyFields } from "./company-fields";
import { liveDealNumbers, liveDealValuation, type DealNumbers, type DealValuation } from "./deal-numbers";
import { DEMO_DEAL_IDS, demoDeal } from "./demo";

/**
 * Deal id → numbers, per data mode:
 * - live: the id is the company's domain (e.g. "e2b.dev"); numbers come from the cached Crustdata research run.
 * - demo: the id is a demo fixture deal ("helio"); numbers come from src/lib/numbers/demo.ts.
 * Anything else is a 404 — a live deal is never answered with demo numbers or vice versa.
 */
export async function resolveDealNumbers(
  rawId: string,
): Promise<{ ok: true; id: string; source: "live" | "demo"; dataMode: "demo" | "live"; fields: DealNumbers; explainable: DealValuation } | { ok: false; response: Response }> {
  const dataMode = resolveDataMode();
  const id = decodeURIComponent(rawId);
  if (dataMode === "demo") {
    const d = demoDeal(id);
    if (!d) return { ok: false, response: NextResponse.json({ status: "error", message: `No demo deal "${id}" (demo deals: ${DEMO_DEAL_IDS.join(", ")}). Live deals need DEALDESK_DATA_MODE=live.` }, { status: 404 }) };
    return { ok: true, id, source: "demo", dataMode, ...d };
  }
  const domain = normalizeDomainInput(id);
  if (!domain) return { ok: false, response: NextResponse.json({ status: "error", message: `In live mode a deal id is the company domain (e.g. e2b.dev); "${id}" is not one.` }, { status: 404 }) };
  try {
    const r = await researchCompany(liveCrustdataClient(), domain);
    if (r.status === "no_match") return { ok: false, response: NextResponse.json({ status: "no_match", domain, message: `No Crustdata match for ${domain}.` }, { status: 404 }) };
    if (r.status !== "ok") return { ok: false, response: failureResponse(r) };
    return { ok: true, id: domain, source: "live", dataMode, fields: liveDealNumbers(companyFields(r)), explainable: liveDealValuation() };
  } catch (e) {
    return { ok: false, response: failureResponse(failureFrom(e)) };
  }
}
