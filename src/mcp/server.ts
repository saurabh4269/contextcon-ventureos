// Deal Desk MCP server (stdio). `npm run mcp`. Thin: every tool calls an existing Deal Desk route over HTTP
// (DEALDESK_URL, default http://localhost:3240) via the handlers in ./tools. Every result carries `sources`.
// Docs: docs/context/12-modes-of-interaction.md. MCP SDK: https://modelcontextprotocol.io/docs/sdk
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DealDeskHttp } from "./http";
import { actOnDealWorkflow, approveReviewItem, DEAL_ACTIONS, getDealWorkflow, getDecisions, listDealWorkflows, listReviewQueue, researchCompany, runDealWorkflow, screenCompanies, startDealWorkflow, WORKFLOW_STEPS, type ToolResult } from "./tools";

const asContent = (r: ToolResult) => ({
  content: [{ type: "text" as const, text: JSON.stringify(r, null, 2) }],
  structuredContent: r as unknown as Record<string, unknown>,
  isError: !r.ok,
});

export function createServer(http = new DealDeskHttp()): McpServer {
  const server = new McpServer({ name: "dealdesk", version: "0.1.0" });
  const domain = z.string().describe("Company domain, e.g. e2b.dev");

  server.registerTool("screen_companies", {
    description: "Research agent (/ask): a plain-English request becomes a cited shortlist of companies from Crustdata. Every cell carries a citation or is unavailable with a reason.",
    inputSchema: { request: z.string().min(1).max(2000).describe("Plain-English screening request") },
  }, async ({ request }) => asContent(await screenCompanies(http, request)));

  server.registerTool("research_company", {
    description: "Cited company profile for a domain (identify, enrich, founders, jobs, news, comparables).",
    inputSchema: { domain },
  }, async (a) => asContent(await researchCompany(http, a.domain)));

  server.registerTool("get_decisions", {
    description: "Fit score, screener verdict, valuation range, return multiples and IC memo fields for a domain. Each is ok with sources, or unavailable with a reason.",
    inputSchema: { domain, review: z.boolean().optional().describe("false: read without raising review items (default true)") },
  }, async (a) => asContent(await getDecisions(http, a.domain, { review: a.review })));

  server.registerTool("run_deal_workflow", {
    description: "Run a four-step read of a domain: research → decisions → open review items → outreach preview. Stateless: it does not start the ten-step workflow (use deal_workflow_start). Decisions may raise review items. Outreach only previews a draft that needs a person's approval; nothing is ever sent.",
    inputSchema: {
      domain,
      until: z.enum(WORKFLOW_STEPS as [string, ...string[]]).optional().describe("Stop after this step (default review, or outreach when a draft is given)"),
      outreach: z.object({ to: z.array(z.string()).min(1), subject: z.string().min(1), body: z.string().min(1) }).optional().describe("Draft to preview (never sent)"),
    },
  }, async (a) => asContent(await runDealWorkflow(http, a.domain, { until: a.until as never, outreach: a.outreach })));

  server.registerTool("list_review_queue", {
    description: "Items waiting for a person in /review (missing data, low confidence, outbound sends …) with their evidence.",
    inputSchema: { status: z.enum(["open", "all"]).optional(), run: z.string().optional().describe("Filter by run id, e.g. deal:e2b.dev:decisions") },
  }, async (a) => asContent(await listReviewQueue(http, a)));

  server.registerTool("approve_review_item", {
    description: "Approve a review item. Dry run by default; approves only with confirm=true and DEALDESK_ALLOW_APPROVE=1. Outbound sends stay dry-run on the server.",
    inputSchema: { id: z.string(), confirm: z.boolean().optional(), note: z.string().max(500).optional() },
  }, async (a) => asContent(await approveReviewItem(http, a.id, { confirm: a.confirm, note: a.note })));

  server.registerTool("deal_workflow_start", {
    description: "Start the ten-step deal workflow for a company domain (intake, thesis screen, data-room draft, Crustdata claim checks, partner meeting draft, transcript, valuation, IC memo, IC decision, firm memory). Runs on the server; poll deal_workflow_get.",
    inputSchema: { domain, name: z.string().max(120).optional().describe("Company name, if known") },
  }, async (a) => asContent(await startDealWorkflow(http, a.domain, a.name)));

  server.registerTool("deal_workflow_list", {
    description: "Deals in the workflow, with stage and the step that waits for a person.",
    inputSchema: {},
  }, async () => asContent(await listDealWorkflows(http)));

  server.registerTool("deal_workflow_get", {
    description: "One deal's ten steps with facts and their citations (Crustdata, Gmail, Calendar, transcript, firm memory). Addresses are masked.",
    inputSchema: { id: z.string().describe("Deal id from deal_workflow_list") },
  }, async (a) => asContent(await getDealWorkflow(http, a.id)));

  server.registerTool("deal_workflow_act", {
    description: "A person's action on a deal: transcript (text), skip_transcript, override_screen, decide (invest|pass), regenerate_memo, resume. approve (dataroom|schedule) is a dry run unless confirm=true and DEALDESK_ALLOW_APPROVE=1; the server still sends nothing unless OUTBOUND_MODE=live and the recipient is allowlisted.",
    inputSchema: {
      id: z.string(),
      action: z.enum(DEAL_ACTIONS as unknown as [string, ...string[]]),
      step: z.enum(["dataroom", "schedule"]).optional(),
      text: z.string().max(200_000).optional().describe("Transcript text (action transcript)"),
      verdict: z.enum(["invest", "pass"]).optional(),
      note: z.string().max(1000).optional(),
      confirm: z.boolean().optional(),
    },
  }, async (a) => asContent(await actOnDealWorkflow(http, a.id, { action: a.action as never, step: a.step as never, text: a.text, verdict: a.verdict as never, note: a.note, confirm: a.confirm })));

  return server;
}

async function main() {
  await createServer().connect(new StdioServerTransport());
  // stdout is the MCP channel; status goes to stderr.
  console.error(`dealdesk MCP server on stdio → ${new DealDeskHttp().base}`);
}

if (process.argv[1] && /server\.(ts|js|mjs)$/.test(process.argv[1])) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
