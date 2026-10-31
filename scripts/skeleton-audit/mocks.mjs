// Mock API bodies for scripts/skeleton-audit.mjs: layout measurement only, never shown outside the audit.
// Crustdata-shaped bodies (research, decisions, person, agent run) come from the checked-in E2B captures through the
// real normalizers (gen-mocks.ts); the rest are small hand-written bodies in the shape each route returns.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const json = (n) => JSON.parse(fs.readFileSync(path.join(here, "mocks", n), "utf8"));
const research = json("research.json");
const decisions = json("decisions.json");
const person = json("person.json");
const agentRun = fs.readFileSync(path.join(here, "mocks", "agent-run.ndjson"), "utf8");

const ago = (h) => new Date(Date.now() - h * 3600_000).toISOString();
const storage = { kind: "file", durable: true, label: "Local files (.cache)", note: "Stored in JSON files in .cache on this server (no DATABASE_URL). Durable for this one server only." };
const DOMAINS = [["e2b.dev", "E2B", "inbound", "screening"], ["acme-cloud.example", "Acme Cloud", "researched", "sourced"], ["northwind-ai.example", "Northwind AI", "opened", "diligence"], ["beta-labs.example", "Beta Labs", "inbound", "ic"]];
const pipelineDeals = DOMAINS.map(([domain, name, source, stage], i) => ({ domain, name, href: `/deal?domain=${domain}`, source, at: ago(3 + i * 20), stage, owner: i % 2 ? null : "Saurabh Gupta" }));
const item = (i, domain, name, kind) => ({
  id: `item${i}`, key: `k${i}`, runId: `run${i}`, kind, title: `${name}: ${kind.replace("_", " ")}`, reason: "The value is missing on Crustdata, so a person has to confirm it.",
  subject: { name, domain, href: `/deal?domain=${domain}` }, evidence: [{ label: "Headcount", value: 52, citation: { source: "Crustdata", endpoint: "POST /company/enrich", path: "headcount.total", retrievedAt: ago(2) } }],
  actions: { approve: "Accept Crustdata value", reject: "Reject", edit: "Edit" }, status: "open", createdAt: ago(2 + i),
});
const exceptions = {
  storage, open: 3,
  items: [item(1, "e2b.dev", "E2B", "missing_data"), item(2, "acme-cloud.example", "Acme Cloud", "low_confidence"), item(3, "northwind-ai.example", "Northwind AI", "conflicting_data")],
  runs: [{ id: "run1", source: "sourcing-agent", request: "Indian B2B software companies founded after 2022", createdAt: ago(5), status: "waiting_on_person", autoCompleted: 7, exceptionIds: ["item1", "item2"], summary: "10 companies, 7 checked automatically", credits: { used: 6.4 }, model: "deterministic parser (no LLM)" },
    { id: "deal:e2b.dev", source: "deal", request: "Deal decisions for e2b.dev", createdAt: ago(8), status: "finished", finishedAt: ago(7), autoCompleted: 12, exceptionIds: [] }],
};
const emptyExceptions = { storage, open: 0, items: [], runs: [] };
const events = ["deal.opened", "research.run", "note.added", "review.resolved", "deal.opened", "research.run"].map((kind, i) => ({
  id: String(100 - i), at: ago(i * 7 + 1), kind, actor: { type: i % 2 ? "agent" : "user", name: i % 2 ? "Research agent" : "Saurabh Gupta" }, subject: { type: "company", id: DOMAINS[i % 4][0], label: DOMAINS[i % 4][1] },
  summary: `${kind} · ${DOMAINS[i % 4][1]}`, data: null, source: "ui:/deal",
}));
const mandate = { mandate: { sectors: ["Developer tools", "B2B software"], stages: ["seed", "series_a"], geos: ["US", "India"], checkSizeUsd: { min: 500000, max: 3000000 }, priors: {}, updatedAt: ago(30) }, unset: [], source: { kind: "saved", writable: true, storage, note: "Saved mandate." } };
const connectors = { checkedAt: ago(0), connectors: ["crustdata", "llm", "gmail", "calendar", "slack", "elevenlabs"].map((id, i) => ({ id, name: id, wired: i < 4, env: [`${id.toUpperCase()}_KEY`], docsUrl: "https://docs.crustdata.com", status: i < 4 ? "connected" : "not_configured", mode: "env", detail: i < 4 ? "Key valid" : "Not connected: set the key on the server.", lastCheckedAt: i < 4 ? ago(0) : null })) };
const fact = (label, value) => ({ label, value, status: "verified", citation: { source: "Crustdata", endpoint: "POST /company/enrich", path: "headcount.total", retrievedAt: ago(4) } });
const STEP_IDS = ["intake", "screen", "dataroom", "research", "schedule", "transcript", "valuation", "memo", "pipeline", "memory"];
const wfDeal = (stage, upto) => ({
  id: "wf000001", createdAt: ago(6), updatedAt: ago(1), trigger: { type: "ask", domain: "e2b.dev", name: "E2B" }, company: { name: "E2B", domain: "e2b.dev" }, stage,
  stageHistory: [{ stage: "sourced", at: ago(6), by: "Saurabh Gupta" }], running: false,
  steps: STEP_IDS.map((id, i) => ({ id, status: i < upto ? "done" : i === upto ? "waiting" : "pending", ...(i < upto ? { summary: `${id} finished`, transport: "local", facts: [fact("Headcount", "52")] } : {}) })), storage,
});
const screen = {
  status: "ok", query: "Find Indian B2B software companies", summary: "Two companies met every requirement.", columns: [{ key: "founded", label: "Founded" }, { key: "hq", label: "HQ" }],
  rows: [1, 2].map((rank) => ({ rank, name: { key: "name", label: "Company", value: `Company ${rank}`, status: "verified" }, cells: [{ key: "founded", label: "Founded", value: 2023, status: "verified" }, { key: "hq", label: "HQ", value: "Pune", status: "verified" }], people: [], why: "Founded 2023" })),
  filters: [{ requirement: "Based in India", applied: "server", field: "locations.country", detail: "= India" }], caveats: [], requested: 2, model: { provider: "openai", model: "model" }, calls: [], credits: { used: 1, cap: 10 }, timings: { totalMs: 4000, modelMs: 3000, toolMs: 1000 }, steps: 3, citationStats: { verified: 4, corrected: 0, unavailable: 0 },
};
const screenStream = [{ type: "start", query: screen.query, model: screen.model, at: ago(0) }, { type: "plan", step: 1, text: "Search Crustdata for matching companies." }, { type: "final", result: screen }].map((e) => JSON.stringify(e)).join("\n") + "\n";

const err = (message = "Upstream unavailable") => ({ status: 500, body: { status: "error", message } });
const ok = (body) => ({ status: 200, body });
const nd = (text) => ({ status: 200, body: text, type: "application/x-ndjson" });
const noMatch = { ...research, status: "no_match", message: "No match", suggestions: [], calls: { identify: { ...research.calls.identify, data: { matches: [] } } } };
const personNoMatch = { status: "no_match", linkedinUrl: "https://www.linkedin.com/in/mlejva", call: person.call };

/** key → { re, loaded, empty }  (error = 500 for every key a screen lists) */
export const API = {
  pipeline: { re: /\/api\/pipeline\/deals/, loaded: ok({ status: "ok", deals: pipelineDeals, sources: { stages: { status: "ok", storage } } }), empty: ok({ status: "ok", deals: [], sources: { stages: { status: "ok", storage } } }) },
  exceptions: { re: /\/api\/exceptions(\?|$)/, loaded: ok(exceptions), empty: ok(emptyExceptions) },
  gmail: { re: /\/api\/connectors\/gmail\/threads/, loaded: ok({ threads: [{ id: "t1", from: "Founder", fromAddress: null, subject: "Intro: E2B, seed round", snippet: "e2b.dev", companyDomain: "e2b.dev", lastMessageAt: ago(5), messages: 2, unread: true }] }), empty: ok({ threads: [] }) },
  calendar: { re: /\/api\/connectors\/calendar\/events(\?|$)/, loaded: ok({ events: [{ id: "e1", summary: "IC meeting", start: ago(-26), end: ago(-25), allDay: false, attendees: 4, link: null }] }), empty: ok({ events: [] }) },
  research: { re: /\/api\/live\/research/, loaded: ok(research), empty: ok(noMatch) },
  decisions: { re: /\/api\/deals\/[^/]+\/decisions/, loaded: ok(decisions), empty: ok(decisions) },
  person: { re: /\/api\/live\/person/, loaded: ok(person), empty: ok(personNoMatch) },
  portfolio: { re: /\/api\/portfolio/, loaded: ok({ status: "ok", storage, companies: [{ domain: "e2b.dev", name: "E2B", workflowId: "wf000001", investedAt: ago(48), by: "Saurabh Gupta", note: "Strong team", facts: [fact("Headcount", "52"), fact("Headcount growth", "73%")], contradicted: [], memo: { model: "model", sources: 6 } }] }), empty: ok({ status: "ok", companies: [], storage }) },
  memory: { re: /\/api\/memory\/events\?/, loaded: ok({ status: "ok", events, cursor: null, storage }), empty: ok({ status: "ok", events: [], cursor: null, storage }) },
  mandate: { re: /\/api\/settings\/mandate/, loaded: ok(mandate), empty: ok({ mandate: { sectors: [], stages: [], geos: [], checkSizeUsd: {}, priors: {}, updatedAt: null }, unset: ["sectors"], source: { kind: "unset", writable: true, storage, note: "No mandate yet." } }) },
  connectors: { re: /\/api\/integrations\/connectors/, loaded: ok(connectors), empty: ok({ checkedAt: ago(0), connectors: [] }) },
  workflowList: { re: /\/api\/workflow(\?|$)/, loaded: ok({ deals: [wfDeal("diligence", 4)], storage }), empty: ok({ deals: [], storage }) },
  workflowInbox: { re: /\/api\/workflow\/inbox/, loaded: ok({ status: "ok", query: "inbox", candidates: [{ id: "m1abcdef", subject: "E2B seed round", date: ago(9), domain: "e2b.dev" }], hidden: 0 }), empty: ok({ status: "ok", query: "inbox", candidates: [], hidden: 0 }) },
  workflowDeal: { re: /\/api\/workflow\/wf000001/, loaded: ok(wfDeal("diligence", 4)), empty: ok(wfDeal("sourced", 0)) },
  screen: { re: /\/api\/live\/screen/, loaded: nd(screenStream), empty: nd(screenStream) },
  sourcing: { re: /\/api\/sourcing\/run/, loaded: nd(agentRun), empty: nd(agentRun) },
};
export const errorResponse = err;
export const AMBIENT = [
  { re: /\/api\/memory\/events$/, res: { status: 201, body: { status: "ok" } } },
  { re: /\/api\/(voice|oauth)\//, res: { status: 404, body: { status: "error", message: "blocked in the audit" } } },
];
export const FALLBACK_EXCEPTIONS = emptyExceptions;
