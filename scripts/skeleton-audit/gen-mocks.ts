// Builds the Crustdata-shaped mock bodies for scripts/skeleton-audit.mjs from the checked-in E2B captures
// (docs/crustdata/fixtures) through the real normalizers: no network, 0 credits. Run: npx tsx scripts/skeleton-audit/gen-mocks.ts
import fs from "node:fs";
import path from "node:path";
import { fixtureClient } from "@/test/crustdata";
import { researchCompany, searchPeers, enrichPerson } from "@/lib/live/research";
import { computeLocalDeal } from "@/lib/numbers/local";
import { companyFields } from "@/lib/numbers/company-fields";
import { liveDealNumbers, liveDealValuation } from "@/lib/numbers/deal-numbers";
import { localDecisions } from "@/lib/numbers/decisions";
import { parseRequest } from "@/lib/sourcing/parse";
import { ok } from "@/lib/fields";

const out = path.join(process.cwd(), "scripts/skeleton-audit/mocks");
const write = (name: string, v: unknown) => fs.writeFileSync(path.join(out, name), JSON.stringify(v, null, 1));

async function main() {
const client = fixtureClient();
const r = await researchCompany(client, "e2b.dev");
if (r.status !== "ok") throw new Error("research capture did not resolve");
write("research.json", r);
const peers = await searchPeers(client, r.company);
const local = computeLocalDeal(r, { sectors: [], stages: [], geos: [], checkSizeUsd: {}, priors: {}, updatedAt: null } as never, peers, [], "deal:e2b.dev:decisions");
const fields = { ...liveDealNumbers(companyFields(r)), ...local.numbers };
write("decisions.json", localDecisions("e2b.dev", fields as never, { ...liveDealValuation(), ...local.valuation } as never, local.screenerVerdict));
const p = await enrichPerson(client, "https://www.linkedin.com/in/mlejva");
write("person.json", p);
// Sourcing agent NDJSON (/agent?q=): a real parse of the request, three rows built from the E2B capture's cited values
// (layout measurement only: the same company three times), steps and a summary.
const q = "Indian B2B software companies founded after 2022 growing fast";
const parse = parseRequest(q);
const cite = { source: "Crustdata", endpoint: "POST /company/search", path: "companies[0].headcount.total", retrievedAt: r.requestedAt };
const row = (i: number) => ({
  id: 1000 + i, rank: i + 1, name: i === 0 ? r.company.name : `${r.company.name} ${i + 1}`, domain: r.domain, relaxed: [],
  founded: ok(r.company.yearFounded, "Crustdata basic_info.year_founded", "as returned", [cite]),
  hq: ok("Prague, Czech Republic", "Crustdata locations.hq", "as returned", [cite]),
  headcountNow: ok(r.company.headcount.total, "Crustdata headcount.total", "as returned", [cite]),
  headcountThen: ok({ value: 30, date: "2026-04-30" }, "Crustdata headcount timeseries", "point 6 months back", [cite]),
  growth: ok(0.73, "headcount now / headcount 6 months back - 1", "from two cited points", [cite]),
  growthWindow: { months: 6, source: "computed" },
  series: r.company.headcount.monthly.map((m) => ({ date: m.date, v: (m as { value?: number; v?: number }).value ?? (m as { v?: number }).v ?? 0 })),
  funding: ok({ total: { amount: 35000000, currency: "USD" }, lastRound: "series_a", lastDate: null, lastAmount: null }, "Crustdata funding", "as returned", [cite]),
  founders: { status: "pending" }, checks: [{ label: "Founded after 2022", ok: true, detail: "year_founded 2023" }], errors: [], sourceCitation: cite,
});
const steps = [{ id: "parse", label: "Read the request", tool: "parser", endpoint: "local", status: "done", startedAt: r.requestedAt, ms: 2 }, { id: "search", label: "Search Crustdata", tool: "crustdata", endpoint: "POST /company/search", status: "done", startedAt: r.requestedAt, ms: 900, credits: 0.55, calls: 1, count: 3 }];
const events = [{ type: "plan", runId: "audit", startedAt: r.requestedAt, parse }, ...steps.map((step) => ({ type: "step", step })), ...[0, 1, 2].map((i) => ({ type: "row", row: row(i) })),
  { type: "done", summary: { runId: "audit", request: q, sentence: q, requested: 3, returned: 3, dropped: 0, relaxed: [], rankingReason: "by headcount growth", credits: 0.55, liveCalls: 1, cachedCalls: 0, failedCalls: 0, startedAt: r.requestedAt, finishedAt: r.requestedAt, ms: 1200, rowOrder: [1000, 1001, 1002] } }];
fs.writeFileSync(path.join(out, "agent-run.ndjson"), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
console.log("ok", Object.keys(r.calls));
}
main().catch((e) => { console.error(e); process.exit(1); });
