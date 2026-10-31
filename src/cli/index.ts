#!/usr/bin/env -S npx tsx
// `dealdesk` CLI. Thin: the same handlers as the MCP server (src/mcp/tools.ts), which call existing Deal Desk routes.
// Pretty output with citations, or --json. Reads only DEALDESK_URL (and DEALDESK_ALLOW_APPROVE) from process.env.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DealDeskHttp } from "../mcp/http";
import { actOnDealWorkflow, approveReviewItem, getDealWorkflow, getDecisions, listDealWorkflows, listReviewQueue, researchCompany, runDealWorkflow, screenCompanies, startDealWorkflow, type DealAction, type Source, type ToolResult, type WorkflowStep } from "../mcp/tools";
import { parseArgs, USAGE, type Command } from "./args";

const show = (v: unknown): string => v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
const cite = (s: Source, i: number) => `  [${i + 1}] ${s.endpoint}${s.path ? ` · ${s.path}` : ""}${s.source ? ` · ${s.source}` : ""}${s.url ? ` · ${s.url}` : ""}${s.retrievedAt ? ` · ${s.retrievedAt}` : ""}`;

export function render(r: ToolResult): string {
  const out: string[] = [];
  const d = r.data as Record<string, unknown> | null;
  if (!r.ok) out.push(`✗ ${r.tool} failed (HTTP ${r.status}): ${show((d as { message?: unknown })?.message ?? d)}`);
  else if (r.tool === "screen_companies") {
    const rows = (d?.rows as { name?: unknown; cells?: { label?: string; key?: string; value?: unknown; status?: string; reason?: string; citation?: { ref?: string } }[] }[]) ?? [];
    out.push(`Shortlist: ${rows.length} compan${rows.length === 1 ? "y" : "ies"}`);
    rows.forEach((row, i) => {
      const name = row.name && typeof row.name === "object" ? (row.name as { value?: unknown }).value : row.name;
      out.push(`${i + 1}. ${show(name)}`);
      for (const c of row.cells ?? []) out.push(`     ${c.label ?? c.key ?? "?"}: ${c.status === "unavailable" ? `unavailable (${c.reason ?? "no reason"})` : show(c.value)}${c.citation?.ref ? ` [${c.citation.ref}]` : ""}`);
    });
    for (const c of (d?.caveats as string[]) ?? []) out.push(`  ! ${c}`);
  } else if (r.tool === "get_decisions") {
    out.push(`Decisions for ${show(d?.companyDomain ?? d?.dealId)}`);
    for (const [k, f] of Object.entries((d?.summary as Record<string, { status: string; value?: unknown; reason?: string; sources?: Source[] }>) ?? {}))
      out.push(f.status === "ok" ? `  ✓ ${k.padEnd(20)} ${show(f.value)}  (${f.sources?.length ?? 0} source${f.sources?.length === 1 ? "" : "s"})` : `  – ${k.padEnd(20)} unavailable: ${f.reason}`);
  } else if (r.tool === "run_deal_workflow") {
    out.push(`Deal workflow for ${show(d?.domain)}`);
    const icon = { done: "✓", failed: "✗", needs_approval: "⏸", pending: "·" } as const;
    for (const s of (d?.steps as WorkflowStep[]) ?? []) out.push(`  ${icon[s.status]} ${s.id.padEnd(10)} ${s.status.padEnd(15)} ${s.detail}`);
    if (d?.next) out.push(`  next: --until ${d.next}`);
  } else if (r.tool === "list_review_queue") {
    const items = (d?.items as { id: string; kind: string; title: string; reason: string; status: string }[]) ?? [];
    out.push(`Review queue: ${items.length} item(s)`);
    for (const i of items) out.push(`  ${i.id}  [${i.kind}] ${i.title} — ${i.reason}${i.status !== "open" ? ` (${i.status})` : ""}`);
  } else if (r.tool === "approve_review_item") {
    if (d?.dryRun) out.push(`Dry run — nothing changed: ${show(d.reason)}\n  would: ${show(d.wouldDo)}\n  proposed: ${show((d.proposed as { value?: unknown })?.value ?? d.proposed)}`);
    else out.push(`✓ approved: ${show((d?.item as { resolution?: { effect?: string } })?.resolution?.effect ?? "done")}`);
  } else if (r.tool === "deal_workflow_start") {
    out.push(`✓ started deal ${show(d?.id)}`);
  } else if (r.tool === "deal_workflow_list") {
    const deals = (d?.deals as { id: string; company?: string; stage: string; waiting: { id: string; status: string } | null }[]) ?? [];
    out.push(`Deals: ${deals.length}`);
    for (const x of deals) out.push(`  ${x.id}  ${show(x.company).padEnd(24)} ${x.stage.padEnd(10)} ${x.waiting ? `${x.waiting.id}: ${x.waiting.status}` : "—"}`);
  } else if (r.tool === "deal_workflow_get") {
    const steps = (d?.steps as { id: string; status: string; summary?: string; facts?: { label: string; value: string; status?: string }[] }[]) ?? [];
    out.push(`${show((d?.company as { name?: string; domain?: string } | undefined)?.name ?? (d?.company as { domain?: string } | undefined)?.domain)} · stage ${show(d?.stage)}${d?.running ? " · running" : ""}`);
    for (const s of steps) {
      out.push(`  ${s.id.padEnd(11)} ${s.status.padEnd(12)} ${s.summary ?? ""}`);
      for (const f of s.facts ?? []) out.push(`      ${f.label}: ${f.value}${f.status && f.status !== "info" ? ` [${f.status}]` : ""}`);
    }
  } else if (r.tool === "deal_workflow_act") {
    if (d?.dryRun) out.push(`Dry run — nothing changed: ${show(d.reason)}`);
    else out.push(`✓ done; stage ${show(d?.stage)}`);
  } else if (r.tool === "research_company") {
    const c = (d?.company ?? {}) as Record<string, unknown>;
    out.push(`${show(c.name ?? d?.domain)} (${show(d?.domain)})`);
    for (const [k, f] of Object.entries((d?.fields as Record<string, { status: string; value?: unknown; reason?: string }>) ?? {}))
      out.push(f.status === "ok" ? `  ${k.padEnd(22)} ${show(f.value)}` : `  ${k.padEnd(22)} unavailable: ${f.reason}`);
  }
  if (r.note) out.push(`note: ${r.note}`);
  out.push(r.sources.length ? `Sources (${r.sources.length}):\n${r.sources.slice(0, 40).map(cite).join("\n")}${r.sources.length > 40 ? `\n  … ${r.sources.length - 40} more (--json)` : ""}` : "Sources: none returned");
  return out.join("\n");
}

export async function execute(c: Command, http: DealDeskHttp): Promise<ToolResult | null> {
  switch (c.cmd) {
    case "ask": return screenCompanies(http, c.request, (e) => { if (e.type === "plan" && typeof e.text === "string") process.stderr.write(`· ${e.text}\n`); });
    case "research": return researchCompany(http, c.domain);
    case "decisions": return getDecisions(http, c.domain, { review: c.review });
    case "workflow": return runDealWorkflow(http, c.domain, { until: c.until as WorkflowStep["id"] | undefined });
    case "review-list": return listReviewQueue(http, { status: c.status, run: c.run });
    case "review-approve": return approveReviewItem(http, c.id, { confirm: c.confirm, note: c.note });
    case "deal-start": return startDealWorkflow(http, c.domain, c.name);
    case "deal-list": return listDealWorkflows(http);
    case "deal-show": return getDealWorkflow(http, c.id);
    case "deal-act": return actOnDealWorkflow(http, c.id, { action: c.action as DealAction, step: c.step as "dataroom" | "schedule" | undefined, text: c.text, verdict: c.verdict as "invest" | "pass" | undefined, note: c.note, confirm: c.confirm });
    default: return null;
  }
}

async function main(argv: string[]): Promise<number> {
  const p = parseArgs(argv);
  if (!p.ok) { console.error(p.message); return 2; }
  if (p.command.cmd === "help") { console.log(USAGE); return 0; }
  if (p.command.cmd === "doctor") {
    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts/doctor.mjs");
    return spawnSync(process.execPath, [script], { stdio: "inherit" }).status ?? 1;
  }
  const r = await execute(p.command, new DealDeskHttp());
  if (!r) return 2;
  console.log(p.json ? JSON.stringify(r, null, 2) : render(r));
  return r.ok ? 0 : 1;
}

if (process.argv[1] && /cli[\\/]index\.(ts|js)$|dealdesk$/.test(process.argv[1])) main(process.argv.slice(2)).then((code) => process.exit(code));
