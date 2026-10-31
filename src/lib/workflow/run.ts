// The orchestrator: advance(deal, deps) runs the ten steps in order, persisting after every step. A step that needs a
// person stops the run ("waiting"); calling advance() again after the person acted resumes from there. Every outside
// call is injected (deps) so tests run on fakes; serverDeps() wires the real Gmail / Crustdata / Calendar / model.
import type { Citation, ComputedField } from "@/lib/fields";
import type { GmailMessage } from "@/lib/google/gmail";
import type { Meeting } from "@/lib/google/calendar";
import type { LiveCompany, LivePerson, ResearchResult } from "@/lib/live/types";
import type { DecisionsResponse } from "@/lib/numbers/decisions";
import type { ModelClient } from "@/lib/agent/model";
import type { MemoryEvent, MemoryEventInput } from "@/lib/memory/types";
import { blockedRecipients } from "@/lib/outbound";
import { fmtDateTime, fmtMoney, isMoney } from "@/lib/format";
import { firmMandate, unsetMandateFields, type Mandate } from "@/lib/settings/mandate";
import { companyDomainFrom, extractClaims, type Claim } from "./extract";
import { criterionCheckSize, criterionGeo, criterionSector, criterionStage } from "@/lib/numbers/local";
import { STEPS, stepOf, type Deal, type Fact, type Stage, type Step, type StepId } from "./types";

export const NO_MANDATE = "unavailable: no fund mandate configured (Settings → Firm mandate, /settings/mandate, or MANDATE_JSON)";
/** True when at least one screening field (sectors, stages, geographies, check size) is set. */
export const mandateConfigured = (m: Mandate): boolean => unsetMandateFields(m).length < 4;

export type WorkflowDeps = {
  getMessage?: (id: string) => Promise<GmailMessage>;
  research: (domain: string) => Promise<ResearchResult>;
  decisions: (domain: string) => Promise<DecisionsResponse | { error: string }>;
  listUpcoming?: (from: Date) => Promise<Meeting[]>;
  model: ModelClient | null;
  memory: { label: string; append(e: MemoryEventInput): Promise<MemoryEvent>; list(limit: number): Promise<MemoryEvent[]> };
  /** the firm mandate (default: the one mandate store, which honors MANDATE_JSON) */
  mandate?: Mandate;
  /** mirror a stage move into the deal-stage store (Pipeline, Today, Portfolio read it) */
  onStage?: (deal: Deal, stage: Stage, by: string, actor: "user" | "agent") => Promise<void>;
  /** the person acting (DEALDESK_USER_NAME, else "Partner (you)") */
  person?: string;
  /** where an /ask-started deal's data-room draft goes (first DEMO_RECIPIENT_ALLOWLIST address); no founder address exists */
  demoRecipient?: string | null;
  now: () => Date;
  save: (d: Deal) => Promise<void>;
};

type Ctx = { deal: Deal; deps: WorkflowDeps; m: Mandate; research?: ResearchResult };
type Outcome = Partial<Step> & { status: Step["status"] };

const iso = (d: WorkflowDeps) => d.now().toISOString();

async function setStage(c: Ctx, stage: Stage, by: string, at: string, actor: "user" | "agent" = "agent") {
  const { deal } = c;
  if (deal.stage === stage) return;
  deal.stage = stage;
  deal.stageHistory.push({ stage, at, by });
  await c.deps.onStage?.(deal, stage, by, actor).catch(() => undefined);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Credits the research calls billed now: cached calls cost nothing (their stored creditsUsed is the original cost). */
export function billedCredits(r: Extract<ResearchResult, { status: "ok" }>): { credits: number; cached: boolean } {
  const calls = Object.values(r.calls);
  const billed = calls.filter((x) => !x.cached).reduce((a, x) => a + (Number(x.creditsUsed ?? 0) || 0), 0);
  return { credits: round2(billed), cached: calls.every((x) => x.cached || x.status === "skipped") };
}

// ---------- citations ----------
function crustCite(r: ResearchResult | undefined, path: string, call: "enrich" | "founders" = "enrich"): Citation | undefined {
  if (!r || r.status !== "ok") return undefined;
  const c = r.calls[call];
  return { source: "Crustdata", endpoint: `${c.method} ${c.path}`, path, retrievedAt: c.retrievedAt ?? undefined };
}
const gmailCite = (deal: Deal): Citation | undefined =>
  deal.email ? { source: "Gmail", endpoint: "GET gmail/v1/users/me/messages/{id}", path: `messages/${deal.email.messageId}`, url: `https://mail.google.com/mail/u/0/#all/${deal.email.messageId}`, retrievedAt: deal.updatedAt } : undefined;

const pct = (v: number | undefined) => (v === undefined ? "unknown" : `${Math.round(v * 10) / 10}%`);
const usd = (v: number | undefined) => (v === undefined ? "unknown" : v === 0 ? "$0 (none reported)" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`);

const companyOf = (c: Ctx): LiveCompany | undefined => (c.research?.status === "ok" ? c.research.company : undefined);

async function ensureResearch(c: Ctx): Promise<ResearchResult | undefined> {
  if (c.research) return c.research;
  const domain = c.deal.company.domain;
  if (!domain) return undefined;
  c.research = await c.deps.research(domain);
  return c.research;
}

// ---------- step 1: intake ----------
async function intake(c: Ctx): Promise<Outcome> {
  const { deal, deps } = c;
  if (deal.trigger.type === "ask") {
    deal.company = { ...deal.company, domain: deal.trigger.domain, name: deal.company.name ?? deal.trigger.name };
    return { status: "done", transport: "person", summary: `Started from /ask for ${deal.trigger.domain} (no founder email — data-room request goes to the demo recipient).`, facts: [{ label: "Company domain", value: deal.trigger.domain, status: "info", note: "Entered on /ask" }] };
  }
  if (!deps.getMessage) return { status: "unavailable", transport: "read_only", summary: "Gmail is not connected (GOOGLE_* not set)." };
  const msg = await deps.getMessage(deal.trigger.messageId);
  deal.email = { messageId: msg.id, threadId: msg.threadId, from: msg.from, fromAddress: msg.fromAddress, subject: msg.subject, date: msg.date, body: msg.body.slice(0, 20_000) };
  const domain = companyDomainFrom(msg);
  if (domain) deal.company = { ...deal.company, domain };
  const claims = extractClaims(`${msg.subject}\n${msg.body}`);
  const cite = gmailCite(deal);
  const facts: Fact[] = [
    { label: "From", value: msg.from, status: "info", citation: cite },
    { label: "Subject", value: msg.subject, status: "info", citation: cite },
    { label: "Company domain", value: domain ?? "not found in the email", status: domain ? "info" : "unknown", citation: cite },
    ...claims.map((cl): Fact => ({ label: `Claim: ${cl.key}`, value: cl.text, status: "info", citation: cite })),
  ];
  if (!domain) return { status: "error", transport: "read_only", summary: "Could not tell which company the email is about.", facts, error: "no company domain in sender or body" };
  return { status: "done", transport: "read_only", summary: `Read "${msg.subject}" from ${msg.from}; ${claims.length} checkable claim(s).`, facts };
}

// ---------- step 2: screen ----------
type Gate = { label: string; result: "pass" | "fail" | "unknown"; value: string; citation?: Citation; note?: string };
/** The mandate criteria deal decisions score (sector, stage, geography, check size), as pass/fail/unknown gates. */
export function gates(r: ResearchResult | undefined, m: Mandate): Gate[] {
  if (!r || r.status !== "ok") return [{ label: "Company found in Crustdata", result: "unknown", value: "no data" }];
  const crits: [string, ComputedField<unknown>][] = [["Sector", criterionSector(r, m)], ["Stage", criterionStage(r, m)], ["Geography", criterionGeo(r, m)], ["Check size", criterionCheckSize(r, m)]];
  return crits.map(([label, f]) => f.status === "ok"
    ? { label, result: f.value === "met" ? "pass" : "fail", value: `${f.value} — ${f.reasoning}`, citation: f.citations[0], note: f.method }
    : { label, result: "unknown", value: "unavailable", note: f.reason });
}

async function screen(c: Ctx): Promise<Outcome> {
  const { deal, deps, m } = c;
  await setStage(c, "screening", "Screener", iso(deps));
  const r = await ensureResearch(c);
  if (!r || r.status !== "ok") return { status: "unavailable", transport: "live", summary: r ? (r.status === "no_match" ? `No Crustdata match for ${deal.company.domain}.` : `Crustdata failed: ${"message" in r ? r.message : "unknown error"}`) : "No company domain." };
  const co = r.company;
  deal.company = { ...deal.company, name: deal.company.name ?? co.name };
  if (!mandateConfigured(m)) return { status: "unavailable", transport: "live", summary: `Screening ${NO_MANDATE}.`, facts: [{ label: "Firm mandate", value: "not configured", status: "unknown", note: NO_MANDATE }] };
  const gs = gates(r, m);
  const facts: Fact[] = gs.map((g) => ({ label: g.label, value: g.value, status: g.result, citation: g.citation, note: g.note }));
  const past = (await deps.memory.list(200)).filter((e) => e.kind === "workflow.decision" && e.subject?.id !== deal.company.domain);
  for (const e of past.slice(-3).reverse()) facts.push({ label: `Precedent: ${e.subject?.label ?? e.subject?.id}`, value: e.summary, status: "info", citation: { source: `Firm memory (${deps.memory.label})`, path: `events/${e.id}`, retrievedAt: e.at } });
  if (!past.length) facts.push({ label: "Precedents", value: "none yet in firm memory", status: "info", note: deps.memory.label });
  const { credits, cached } = billedCredits(r);
  const failed = gs.filter((g) => g.result === "fail");
  const summary = `${co.name} vs the firm mandate: ${gs.filter((g) => g.result === "pass").length} pass, ${failed.length} fail, ${gs.filter((g) => g.result === "unknown").length} unknown.`;
  if (failed.length && !deal.screenOverride) return { status: "waiting", needs: "approve_screen", transport: "live", summary: `${summary} Failed: ${failed.map((g) => g.label).join("; ")}. A partner can override and continue.`, facts, credits, creditsCached: cached };
  return { status: "done", transport: "live", summary: deal.screenOverride && failed.length ? `${summary} Overridden by ${deal.screenOverride.by}.` : summary, facts, credits, creditsCached: cached };
}

// ---------- step 3: data room ----------
async function dataroom(c: Ctx): Promise<Outcome> {
  const { deal } = c;
  const prev = stepOf(deal, "dataroom").draft;
  if (prev?.approved) return { status: "done", transport: prev.approved.transport, summary: `Data-room request ${prev.approved.transport === "live" ? "sent" : "recorded as a dry run (not sent)"}.`, draft: prev };
  const founder = deal.email?.fromAddress ?? null;
  const fallback = c.deps.demoRecipient ?? null;
  const to = founder ? [founder] : fallback ? [fallback] : [];
  const name = deal.company.name ?? deal.company.domain ?? "your company";
  const co = companyOf(c);
  const first = co?.description?.split(/(?<=[a-z)])\.\s/)[0]?.replace(/\.$/, "").slice(0, 220);
  const hook = first ? ` Your public profile says: "${first}." That fits our investment focus.` : "";
  const body = [
    `Hi${deal.email?.from ? ` ${deal.email.from.split(/[<@]/)[0]!.trim().split(" ")[0]}` : ""},`,
    "",
    `${deal.email ? `Thanks for reaching out about ${name}.` : `We came across ${name} and would like to learn more.`}${hook} We'd like to take a closer look before a partner meeting. Could you share:`,
    "",
    "1. Your latest pitch deck",
    "2. Monthly financials for the last 12 months (revenue, burn, runway)",
    "3. Current cap table",
    "4. Two or three customer references we may speak with",
    "",
    "A data-room link works fine.",
    "",
    "Best,",
    "Deal Desk",
  ].join("\n");
  const draft = { channel: "gmail.send" as const, to, subject: `${name} — data room request`, body, blocked: blockedRecipients(to) };
  const who = founder ?? (fallback ? `${fallback} (demo recipient — the deal started from /ask, no founder address)` : "nobody yet (no founder address; DEMO_RECIPIENT_ALLOWLIST is empty)");
  return { status: "done", transport: "dry_run", summary: `Drafted the data-room request to ${who}; waiting for an approve click. The flow continues meanwhile.`, draft, facts: founder ? undefined : [{ label: "Recipient", value: fallback ? `${fallback} (demo recipient)` : "none configured", status: fallback ? "info" : "unknown", note: "first address in DEMO_RECIPIENT_ALLOWLIST" }] };
}

// ---------- step 4: research ----------
/** How far a claim may be from Crustdata and still count as verified (share of the claimed value). */
export const CLAIM_TOLERANCE = { headcount: 0.1, raised: 0.1, growth: 0.25 } as const;
type Check = { claim: Claim; actual?: number; path: string; status: "verified" | "contradicted" | "unverifiable"; shown: string };
export function checkClaims(claims: Claim[], co: LiveCompany | undefined): Check[] {
  return claims.map((cl) => {
    const map: Record<Claim["key"], [number | undefined, string, number, (v: number) => string]> = {
      // relative tolerance (Crustdata's index lags a little); a claim outside it is contradicted, e.g. "team of 60" vs 46
      growth_mom: [co?.headcount.growth.mom, "headcount.growth_percent.mom", CLAIM_TOLERANCE.growth, pct],
      growth_6m: [co?.headcount.growth.six_months, "headcount.growth_percent.six_months", CLAIM_TOLERANCE.growth, pct],
      growth_yoy: [co?.headcount.growth.yoy, "headcount.growth_percent.yoy", CLAIM_TOLERANCE.growth, pct],
      headcount: [co?.headcount.total, "headcount.total", CLAIM_TOLERANCE.headcount, (v) => String(v)],
      founded: [co?.yearFounded, "basic_info.year_founded", 0, (v) => String(v)],
      raised: [co?.funding.totalUsd, "funding.total_investment_usd", CLAIM_TOLERANCE.raised, usd],
    };
    const [actual, path, tol, fmt] = map[cl.key];
    if (actual === undefined || !co) return { claim: cl, path, status: "unverifiable", shown: "Crustdata has no value" };
    const okv = tol === 0 ? actual === cl.value : Math.abs(actual - cl.value) <= Math.max(Math.abs(cl.value) * tol, cl.key.startsWith("growth") ? 2 : 1);
    return { claim: cl, actual, path, status: okv ? "verified" : "contradicted", shown: `Crustdata ${path}: ${fmt(actual)}${cl.key.startsWith("growth") ? " (headcount growth — proxy for the claimed growth)" : ""}` };
  });
}

const claimSource = (deal: Deal) => [deal.email ? `${deal.email.subject}\n${deal.email.body}` : "", deal.transcript?.text ?? ""].join("\n");

async function research(c: Ctx): Promise<Outcome> {
  const { deal, deps } = c;
  await setStage(c, "diligence", "Research agent", iso(deps));
  const r = await ensureResearch(c);
  if (!r || r.status !== "ok") return { status: "unavailable", transport: "live", summary: "Crustdata research is unavailable for this company." };
  const co = r.company;
  const claims = deal.email ? extractClaims(`${deal.email.subject}\n${deal.email.body}`) : [];
  const checks = checkClaims(claims, co);
  const facts: Fact[] = checks.map((k) => ({ label: `Claim "${k.claim.text}"`, value: k.shown, status: k.status, citation: crustCite(r, k.path) }));
  if (!claims.length) facts.push({ label: "Founder claims", value: deal.email ? "no checkable numbers in the email" : "no founder email (started from /ask)", status: "unverifiable" });
  facts.push({ label: "Headcount", value: co.headcount.total !== undefined ? String(co.headcount.total) : "unknown", status: co.headcount.total !== undefined ? "info" : "unknown", citation: crustCite(r, "headcount.total"), note: "Crustdata index; \"verified\" is used only for a founder claim checked against it" });
  facts.push({ label: "Headcount growth", value: `MoM ${pct(co.headcount.growth.mom)} · 6m ${pct(co.headcount.growth.six_months)} · YoY ${pct(co.headcount.growth.yoy)}`, status: "info", citation: crustCite(r, "headcount.growth_percent") });
  if (co.headcount.monthly.length) facts.push({ label: "Headcount by month", value: co.headcount.monthly.map((p) => `${p.date.slice(0, 7)}: ${p.v}`).join(" · "), status: "info", citation: crustCite(r, "headcount.timeseries") });
  facts.push({ label: "Total funding", value: usd(co.funding.totalUsd), status: co.funding.totalUsd !== undefined ? "info" : "unknown", citation: crustCite(r, "funding.total_investment_usd") });
  const people: LivePerson[] = r.calls.founders.status === "ok" ? (r.calls.founders.data?.people ?? []) : [];
  for (const p of people.slice(0, 4)) facts.push({ label: `Founder: ${p.name}`, value: [p.title, p.past.length ? `prior: ${p.past.slice(0, 3).map((e) => e.company).join(", ")}` : "no prior employers listed"].filter(Boolean).join(" — "), status: "info", citation: crustCite(r, "profiles[].experience.employment_details", "founders") });
  if (!people.length) facts.push({ label: "Founders", value: r.calls.founders.status === "ok" ? "none found" : `founder search ${r.calls.founders.status}`, status: "unknown" });
  const n = (s: Check["status"]) => checks.filter((k) => k.status === s).length;
  return { status: "done", transport: "live", summary: `${co.name}: ${n("verified")} claim(s) verified, ${n("contradicted")} contradicted, ${n("unverifiable")} unverifiable; ${people.length} founder(s).`, facts };
}

// ---------- step 5: schedule ----------
const IST_MS = 330 * 60_000;
export function nextFreeSlot(now: Date, busy: { start: string; end: string | null }[]): { start: Date; end: Date } {
  // walk 30-minute slots from 11:00 to 16:30 IST, weekdays, starting tomorrow (IST)
  const ist = new Date(now.getTime() + IST_MS);
  const day0 = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_MS; // IST midnight in UTC ms
  for (let d = 1; d <= 21; d++) {
    const midnight = day0 + d * 86_400_000;
    const wd = new Date(midnight + IST_MS).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    for (let mins = 11 * 60; mins + 30 <= 17 * 60; mins += 30) {
      const s = midnight + mins * 60_000, e = s + 30 * 60_000;
      const clash = busy.some((b) => { const bs = Date.parse(b.start), be = b.end ? Date.parse(b.end) : bs + 30 * 60_000; return bs < e && be > s; });
      if (!clash) return { start: new Date(s), end: new Date(e) };
    }
  }
  const s = day0 + 86_400_000 + 11 * 3_600_000;
  return { start: new Date(s), end: new Date(s + 1_800_000) };
}
const fmtIst = (d: Date) => fmtDateTime(d.toISOString());

async function schedule(c: Ctx): Promise<Outcome> {
  const { deal, deps, m } = c;
  const prev = stepOf(deal, "schedule").draft;
  if (prev?.approved) return { status: "done", transport: prev.approved.transport, summary: `Partner meeting ${prev.approved.transport === "live" ? "created on your calendar" : "recorded as a dry run (no event created)"}.`, draft: prev, facts: stepOf(deal, "schedule").facts };
  const co = companyOf(c);
  const text = [co?.description, ...(co?.industries ?? []), ...(co?.categories ?? [])].join(" ").toLowerCase();
  const ps = m.partners ?? [];
  const partner = ps.find((p) => p.focus.some((f) => text.includes(f))) ?? ps[0] ?? null;
  const who = partner?.name ?? "a partner (none configured in the firm mandate)";
  let busy: Meeting[] = [];
  let calNote = "Calendar not connected — slot not checked against existing events.";
  if (deps.listUpcoming) {
    try { busy = await deps.listUpcoming(deps.now()); calNote = `Checked ${busy.length} upcoming event(s) on your primary calendar.`; } catch (e) { calNote = `Calendar read failed: ${e instanceof Error ? e.message : String(e)}`; }
  }
  const slot = nextFreeSlot(deps.now(), busy);
  const founder = deal.email?.fromAddress ?? null;
  const name = deal.company.name ?? deal.company.domain ?? "company";
  const draft = {
    channel: "calendar.insert" as const,
    to: [] as string[],
    subject: `Partner meeting: ${name} (${partner?.name ?? "partner"})`,
    body: `Partner meeting with ${name} founders.\nPartner: ${who}\nFounder contact: ${founder ?? "not known (deal started from /ask)"}\nDeal: /workflow?id=${deal.id}\nCreated on your own primary calendar only; no attendees are invited.`,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    blocked: [] as string[],
  };
  return { status: "done", transport: "dry_run", summary: `Proposed ${fmtIst(slot.start)} with ${who}. ${calNote} Waiting for an approve click; the flow continues.`, draft, facts: [partner ? { label: "Partner", value: `${partner.name} (focus: ${partner.focus.join(", ") || "any"})`, status: "info", note: "From the firm mandate (partners)" } : { label: "Partner", value: "not configured", status: "unknown", note: "Add partners to the firm mandate (MANDATE_JSON or PUT /api/settings/mandate) to pick one by sector" }, { label: "Slot", value: fmtIst(slot.start), status: "info", citation: deps.listUpcoming ? { source: "Google Calendar", endpoint: "GET calendar/v3/calendars/primary/events", retrievedAt: iso(deps) } : undefined }] };
}

// ---------- step 6: transcript ----------
async function transcript(c: Ctx): Promise<Outcome> {
  const { deal } = c;
  const t = deal.transcript;
  const prev = stepOf(deal, "transcript");
  if (!t) {
    if (prev.status === "unavailable") return { status: "unavailable", transport: "person", summary: prev.summary ?? "Skipped — continued without a transcript." };
    return { status: "waiting", needs: "transcript", transport: "person", summary: "No note-taker is connected — paste or upload the transcript (or continue without it)." };
  }
  const claims = extractClaims(t.text);
  const checks = checkClaims(claims, companyOf(c));
  const cite: Citation = { source: t.source === "upload" ? `Transcript upload${t.name ? ` (${t.name})` : ""}` : "Transcript (pasted)", retrievedAt: t.at };
  const words = t.text.trim().split(/\s+/).length;
  const facts: Fact[] = [
    { label: "Transcript", value: `${words} words, ${t.source}${t.name ? ` ${t.name}` : ""}`, status: "info", citation: cite },
    { label: "Excerpt", value: t.text.trim().slice(0, 280) + (t.text.length > 280 ? "…" : ""), status: "info", citation: cite },
    ...checks.map((k): Fact => ({ label: `Said in meeting: "${k.claim.text}"`, value: k.shown, status: k.status, citation: crustCite(c.research, k.path) })),
  ];
  return { status: "done", transport: "person", summary: `Transcript received (${words} words); ${claims.length} checkable claim(s), ${checks.filter((k) => k.status === "contradicted").length} contradicted by Crustdata.`, facts };
}

// ---------- step 7: valuation ----------
const VAL_KEYS = ["fitScore", "screenerVerdict", "valuationRange", "returnMultipleLow", "returnMultipleHigh", "compsMedianMultiple"] as const;
const VAL_LABEL: Record<(typeof VAL_KEYS)[number], string> = { fitScore: "Fit score", screenerVerdict: "Screener verdict", valuationRange: "Valuation range", returnMultipleLow: "Return multiple (low)", returnMultipleHigh: "Return multiple (high)", compsMedianMultiple: "Comps median multiple" };
const valueText = (v: unknown) => (isMoney(v) ? fmtMoney(v) : typeof v === "number" && !Number.isInteger(v) ? String(Math.round(v * 100) / 100) : String(v));
async function valuation(c: Ctx): Promise<Outcome> {
  const { deal, deps } = c;
  const domain = deal.company.domain;
  if (!domain) return { status: "unavailable", transport: "local", summary: "No company domain." };
  const d = await deps.decisions(domain);
  if ("error" in d) return { status: "unavailable", transport: "local", summary: `Decisions unavailable: ${d.error}` };
  const facts: Fact[] = VAL_KEYS.map((k) => {
    const f = d.decisions[k] as ComputedField<unknown> | undefined;
    if (!f) return { label: VAL_LABEL[k], value: "not computed", status: "unknown" };
    return f.status === "ok" ? { label: VAL_LABEL[k], value: `${valueText(f.value)}${/Multiple/.test(k) && typeof f.value === "number" ? "×" : ""}`, status: "info", citation: f.citations[0], note: f.method } : { label: VAL_LABEL[k], value: "unavailable", status: "unknown", note: f.reason };
  });
  const okN = facts.filter((f) => f.status === "info").length;
  return { status: okN ? "done" : "unavailable", transport: d.source === "crustdata+builder" ? "live" : "local", summary: `${okN}/${VAL_KEYS.length} valuation decisions computed (${d.source}${d.builder ? `, builder ${d.builder.status}` : ""}).`, facts };
}

// ---------- step 8: memo ----------
type Src = { n: number; text: string; citation?: Citation };
export function memoSources(deal: Deal): Src[] {
  const out: Src[] = [];
  for (const id of ["screen", "research", "transcript", "valuation"] as StepId[])
    for (const f of stepOf(deal, id).facts ?? []) if (f.citation && f.value && f.value !== "unknown" && f.value !== "unavailable") out.push({ n: out.length + 1, text: `${f.label}: ${f.value}${f.status && f.status !== "info" ? ` [${f.status}]` : ""}`, citation: f.citation });
  return out.slice(0, 40);
}
/** Keep [n] citations that exist; drop the rest; flag sentences with a digit and no citation. */
export function validateMemo(md: string, n: number): { markdown: string; flagged: number } {
  let flagged = 0;
  const cleaned = md.replace(/\[(\d+)\]/g, (all, k) => (Number(k) >= 1 && Number(k) <= n ? all : ""));
  const lines = cleaned.split("\n").map((line) => {
    if (/^\s*#/.test(line) || !/\d/.test(line)) return line;
    // a sentence runs to . ! ? (not a decimal point) and keeps the citations that follow it ("… 46 people. [3]")
    return line.replace(/(?:\d[.,]\d|[^.!?\n])+[.!?]*(?:\s*\[\d+\])*/g, (s) => {
      const bare = s.replace(/\[\d+\]/g, "");
      if (/\d/.test(bare) && !/\[\d+\]/.test(s) && s.trim()) { flagged++; return `${s.trimEnd()} ⚠uncited `; }
      return s;
    });
  });
  return { markdown: lines.join("\n"), flagged };
}
export function fallbackMemo(deal: Deal, srcs: Src[]): string {
  const sec = (title: string, pred: (s: Src) => boolean) => { const xs = srcs.filter(pred); return xs.length ? `## ${title}\n${xs.map((s) => `- ${s.text} [${s.n}]`).join("\n")}\n` : ""; };
  return [
    `# IC memo — ${deal.company.name ?? deal.company.domain}`,
    "_Deterministic memo (no model available): every line is a cited fact from the workflow._\n",
    sec("Thesis fit", (s) => /^(Sector|Stage|Geography|Check size|Precedent)/.test(s.text)),
    sec("Claims and research", (s) => /Claim|Headcount|Founder|funding|Said in meeting/i.test(s.text)),
    sec("Valuation", (s) => /Fit score|Screener verdict|Valuation|Return multiple|Comps/i.test(s.text)),
    sec("Meeting", (s) => /Transcript|Excerpt/.test(s.text)),
    "## Recommendation\nFor the IC to decide; see contradicted claims above.",
  ].filter(Boolean).join("\n");
}
async function memo(c: Ctx): Promise<Outcome> {
  const out = await writeMemo(c);
  const { deal, deps } = c;
  // the memo is firm knowledge too: one memory entry per memo written (Firm brain lists it)
  await deps.memory.append({
    kind: "memo.drafted",
    actor: { type: "agent", name: "Memo writer" },
    subject: { type: "company", id: deal.company.domain ?? deal.id, label: deal.company.name ?? deal.company.domain },
    summary: `IC memo for ${deal.company.name ?? deal.company.domain}: ${out.memo?.sources.length ?? 0} cited sources${out.memo?.model ? `, written by ${out.memo.model}` : ", deterministic (no model)"}`,
    data: { dealId: deal.id, model: out.memo?.model ?? null, sources: out.memo?.sources.length ?? 0 },
    source: "workflow:/workflow",
  }).catch(() => undefined);
  return out;
}
async function writeMemo(c: Ctx): Promise<Outcome> {
  const { deal, deps } = c;
  const srcs = memoSources(deal);
  const sources = srcs.map((s) => s.citation!).filter(Boolean);
  if (!deps.model) return { status: "done", transport: "local", summary: `Deterministic memo from ${srcs.length} cited facts (no model configured).`, memo: { markdown: fallbackMemo(deal, srcs), sources, model: null } };
  try {
    const turn = await deps.model.complete({
      system: "You write venture-capital investment committee memos. Use ONLY the numbered facts given. Every sentence that states a number or a factual claim must end with its citation like [3]. Never invent numbers. Markdown, sections: Summary, Thesis fit, Team, Traction & claims (call out contradicted claims), Valuation, Risks, Recommendation (leave the decision to the IC). Under 450 words.",
      messages: [{ role: "user", text: `Company: ${deal.company.name ?? deal.company.domain} (${deal.company.domain})\nFacts:\n${srcs.map((s) => `[${s.n}] ${s.text}`).join("\n")}` }],
      tools: [],
      maxTokens: 2500,
    });
    if (!turn.text.trim()) throw new Error("empty model output");
    const v = validateMemo(turn.text, srcs.length);
    return { status: "done", transport: "live", summary: `Memo by ${deps.model.provider}/${deps.model.model} from ${srcs.length} cited facts; ${v.flagged} uncited numeric sentence(s) flagged.`, memo: { markdown: v.markdown, sources, model: `${deps.model.provider}/${deps.model.model}` } };
  } catch (e) {
    return { status: "done", transport: "local", summary: `Model failed (${e instanceof Error ? e.message.slice(0, 160) : String(e)}); deterministic memo from ${srcs.length} cited facts.`, memo: { markdown: fallbackMemo(deal, srcs), sources, model: null } };
  }
}

// ---------- step 9: pipeline ----------
async function pipeline(c: Ctx): Promise<Outcome> {
  const { deal, deps } = c;
  await setStage(c, "ic", "Pipeline", iso(deps));
  if (!deal.decision) return { status: "waiting", needs: "ic_decision", transport: "person", summary: "At IC. Waiting for Invest or Pass." };
  await setStage(c, deal.decision.verdict === "invest" ? "portfolio" : "passed", deal.decision.by, deal.decision.at, "user");
  return { status: "done", transport: "person", summary: `${deal.decision.verdict === "invest" ? "Invested → Portfolio" : "Passed"} by ${deal.decision.by}.${deal.decision.note ? ` Note: ${deal.decision.note}` : ""}`, facts: deal.stageHistory.map((h) => ({ label: h.stage, value: `${h.at} by ${h.by}`, status: "info" })) };
}

// ---------- step 10: memory ----------
async function memory(c: Ctx): Promise<Outcome> {
  const { deal, deps } = c;
  const contradicted = [...(stepOf(deal, "research").facts ?? []), ...(stepOf(deal, "transcript").facts ?? [])].filter((f) => f.status === "contradicted").map((f) => f.label);
  const features = Object.fromEntries((stepOf(deal, "screen").facts ?? []).filter((f) => f.status === "pass" || f.status === "fail" || f.status === "unknown").map((f) => [f.label, `${f.status}: ${f.value}`]));
  const ev = await deps.memory.append({
    kind: "workflow.decision",
    actor: { type: "user", name: deal.decision?.by ?? deps.person ?? "partner" },
    subject: { type: "company", id: deal.company.domain ?? deal.id, label: deal.company.name ?? deal.company.domain },
    summary: `${deal.decision?.verdict === "invest" ? "Invested in" : "Passed on"} ${deal.company.name ?? deal.company.domain}${contradicted.length ? `; ${contradicted.length} contradicted claim(s)` : ""}`,
    data: { dealId: deal.id, verdict: deal.decision?.verdict, note: deal.decision?.note ?? null, features, contradicted, screenOverridden: !!deal.screenOverride },
    source: "workflow:/workflow",
  });
  return { status: "done", transport: deps.memory.label.startsWith("Postgres") ? "live" : "local", summary: `Recorded the decision in firm memory (${deps.memory.label}); later screenings show it as a precedent.`, facts: [{ label: "Memory event", value: `${ev.kind} #${ev.id}`, status: "info", citation: { source: `Firm memory (${deps.memory.label})`, path: `events/${ev.id}`, retrievedAt: ev.at } }] };
}

const RUNNERS: Record<StepId, (c: Ctx) => Promise<Outcome>> = { intake, screen, dataroom, research, schedule, transcript, valuation, memo, pipeline, memory };

/** Run steps from the first not-done one until a step waits, errors, or all are done. Persists after every step. */
export async function advance(deal: Deal, deps: WorkflowDeps): Promise<Deal> {
  const c: Ctx = { deal, deps, m: deps.mandate ?? (await firmMandate()) };
  deal.running = true;
  try {
    for (const def of STEPS) {
      const step = stepOf(deal, def.id);
      if (step.status === "done" || step.status === "unavailable") continue;
      // research results are reused by later steps (the Crustdata client caches, so a resume costs no credits)
      if (def.id !== "intake") await ensureResearch(c).catch(() => undefined);
      step.status = "running";
      step.startedAt = iso(deps);
      step.finishedAt = undefined;
      deal.updatedAt = iso(deps);
      await deps.save(deal);
      let out: Outcome;
      try {
        out = await RUNNERS[def.id](c);
      } catch (e) {
        out = { status: "error", error: e instanceof Error ? e.message : String(e), summary: `Failed: ${e instanceof Error ? e.message : String(e)}` };
      }
      Object.assign(step, { needs: undefined, error: undefined }, out);
      step.finishedAt = iso(deps);
      deal.updatedAt = iso(deps);
      await deps.save(deal);
      if ((step.status as Step["status"]) === "waiting" || (step.status as Step["status"]) === "error") break;
    }
  } finally {
    deal.running = false;
    deal.updatedAt = iso(deps);
    await deps.save(deal);
  }
  return deal;
}
