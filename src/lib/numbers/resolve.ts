import "server-only";
import { NextResponse } from "next/server";
import { normalizeDomainInput } from "@/lib/live/normalize";
import { researchCompany } from "@/lib/live/research";
import { failureFrom, failureResponse, liveCrustdataClient } from "@/lib/live/server";
import { companyFields } from "./company-fields";
import { liveDealNumbers, liveDealValuation, type DealNumbers, type DealValuation } from "./deal-numbers";

/**
 * Deal id → numbers. In this build a deal id is the company's domain (e.g. "e2b.dev"); numbers come from the cached
 * Crustdata research run. The builder backend uses its own deal ids — swapping means replacing this resolver.
 */
export async function resolveDealNumbers(
  rawId: string,
): Promise<{ ok: true; id: string; source: "crustdata"; fields: DealNumbers; explainable: DealValuation } | { ok: false; response: Response }> {
  const id = decodeURIComponent(rawId);
  const domain = normalizeDomainInput(id);
  if (!domain) return { ok: false, response: NextResponse.json({ status: "error", message: `A deal id is the company domain (e.g. e2b.dev); "${id}" is not one.` }, { status: 404 }) };
  try {
    const r = await researchCompany(liveCrustdataClient(), domain);
    if (r.status === "no_match") return { ok: false, response: NextResponse.json({ status: "no_match", domain, message: `No Crustdata match for ${domain}.` }, { status: 404 }) };
    if (r.status !== "ok") return { ok: false, response: failureResponse(r) };
    return { ok: true, id: domain, source: "crustdata", fields: liveDealNumbers(companyFields(r)), explainable: liveDealValuation() };
  } catch (e) {
    return { ok: false, response: failureResponse(failureFrom(e)) };
  }
}
