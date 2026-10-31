import "server-only";
import { NextResponse } from "next/server";
import { normalizeDomainInput } from "@/lib/live/normalize";
import { researchCompany, searchPeers } from "@/lib/live/research";
import { firmMandate } from "@/lib/settings/mandate";
import { loadExceptionStore } from "@/lib/exceptions/store";
import type { ExceptionItem } from "@/lib/exceptions/types";
import { unavailable, type ComputedField } from "@/lib/fields";
import { computeLocalDeal } from "./local";
import { failureFrom, failureResponse, liveCrustdataClient } from "@/lib/live/server";
import { safeDecode } from "./decode";
import { enforceCited } from "@/lib/provenance";
import { companyFields } from "./company-fields";
import { liveDealNumbers, liveDealValuation, type DealNumbers, type DealValuation } from "./deal-numbers";

/**
 * Deal id → numbers. In this build a deal id is the company's domain (e.g. "e2b.dev"); numbers come from the cached
 * Crustdata research run. The builder backend uses its own deal ids — swapping means replacing this resolver.
 */
export async function resolveDealNumbers(
  rawId: string,
  opts: { history?: ExceptionItem[] } = {},
): Promise<{ ok: true; id: string; source: "crustdata"; fields: DealNumbers; explainable: DealValuation; screenerVerdict: ComputedField<unknown> } | { ok: false; response: Response }> {
  const id = safeDecode(rawId);
  const domain = normalizeDomainInput(id);
  if (!domain) {
    const shown = id.length > 80 ? `${id.slice(0, 80)}…` : id;
    return { ok: false, response: NextResponse.json({ status: "error", message: `A deal id is the company domain (e.g. e2b.dev); ${JSON.stringify(shown)} is not one.` }, { status: 404 }) };
  }
  try {
    const client = liveCrustdataClient();
    const r = await researchCompany(client, domain);
    if (r.status === "no_match") return { ok: false, response: NextResponse.json({ status: "no_match", domain, message: `No Crustdata match for ${domain}.` }, { status: 404 }) };
    if (r.status !== "ok") return { ok: false, response: failureResponse(r) };
    // every ok decision/number must carry a source; anything that does not is withheld (unavailable), never shown bare
    // local decisions: firm mandate (Settings) × this research × live peers × firm memory (review queue)
    const peers = await searchPeers(client, r.company);
    const history = opts.history ?? (await loadExceptionStore()).list({ status: "all" }).items;
    const local = computeLocalDeal(r, await firmMandate(), peers, history, `deal:${domain}:decisions`);
    const fields = { ...liveDealNumbers(companyFields(r)), ...local.numbers };
    const explainable = { ...liveDealValuation(), ...local.valuation };
    return { ok: true, id: domain, source: "crustdata", fields: enforceCited(fields), explainable: enforceCited(explainable), screenerVerdict: enforceCited({ s: local.screenerVerdict }).s ?? unavailable("Screener verdict withheld") };
  } catch (e) {
    return { ok: false, response: failureResponse(failureFrom(e)) };
  }
}
