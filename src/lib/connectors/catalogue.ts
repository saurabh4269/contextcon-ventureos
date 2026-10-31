
// Connector catalogue: product content for Settings › Connectors (names, categories, what Deal Desk does with each tool,
// the access it asks for). It carries NO status, activity, usage counts or sync times: the real connectors
// (Crustdata, AI model, Gmail, Google Calendar/Meet, Slack, Fireflies, AgentMail) get their status from
// GET /api/integrations/connectors via src/lib/adapters/connectors.ts; every other tile is catalogue-only ("available"),
// with no login, test or status wiring.
import type { ConnectorsData } from "@port/types";
import { CRUSTDATA_API_VERSION } from "@/lib/crustdata/http";

export const connectorCatalogue: ConnectorsData = {
  categories: [
    { id: "data", label: "Data and research" },
    { id: "email", label: "Email and calendar" },
    { id: "meetings", label: "Meetings and notes" },
    { id: "crm", label: "CRM" },
    { id: "docs", label: "Documents" },
    { id: "finance", label: "Portfolio and finance" },
    { id: "messaging", label: "Messaging" },
  ],
  // No agents run in this build, so no "Used by" chips.
  agents: [],
  featured: {
    id: "crustdata",
    headline: "Every inbound company and founder, enriched on arrival.",
    mark: "crustdata-mark.svg",
    uses: [
      { id: "company", label: "Company enrich", detail: "Headcount, funding, web traffic", stat: "" },
      { id: "person", label: "Person enrich", detail: "Founder history and prior exits", stat: "" },
      { id: "jobs", label: "Job search", detail: "Hiring velocity by function", stat: "" },
      { id: "web", label: "Live web search", detail: "Press, filings, launches", stat: "" },
          ],
  },
  items: [
    /* ── tier (a): core ── */
    { id: "crustdata", tool: "crustdata", category: "data", tier: "core", status: "available",
      does: "Enriches every inbound company and founder, and runs job and live web searches in diligence.", scope: "Company, person, jobs and web search · read",
      scopes: [
        { id: "company", label: "Company data", detail: "Identify and enrich companies from a domain or name", access: "read", on: true },
        { id: "person", label: "People data", detail: "Founder and team profiles, work history", access: "read", on: true },
        { id: "search", label: "Job and web search", detail: "Open roles and live web results", access: "read", on: true },
        { id: "watch", label: "Watches", detail: "Create and update alerts on portfolio companies (not used by this build)", access: "write", on: false },
      ],
      api: {
        version: CRUSTDATA_API_VERSION, header: "x-api-version",
        endpoints: [
          { id: "identify", method: "POST", path: "/company/identify", label: "Match a pitch to a company", calls: "" },
          { id: "cenrich", method: "POST", path: "/company/enrich", label: "Headcount, funding, traffic", calls: "" },
          { id: "penrich", method: "POST", path: "/person/enrich", label: "Founder history", calls: "" },
          { id: "jobs", method: "POST", path: "/job/search", label: "Hiring by function", calls: "" },
          { id: "web", method: "POST", path: "/web/search/live", label: "Press, filings, launches", calls: "" },
          { id: "watch", method: "POST", path: "/watch/company", label: "Portfolio alerts", calls: "" },
        ],
      },
      },
    { id: "model", tool: "anthropic", title: "AI model", detail: "Anthropic or OpenAI", category: "data", tier: "core", status: "available",
      does: "Reads decks, checks claims against sources and drafts every memo. Runs on the key configured on the server.", scope: "Firm API key · zero retention",
      scopes: [
        { id: "key", label: "Firm API key", detail: "Calls are billed to your Anthropic account", access: "read", on: true },
        { id: "retention", label: "Zero data retention", detail: "Prompts and files are not stored by the provider", access: "read", on: true },
      ],
      },
    { id: "gmail", tool: "gmail", category: "email", tier: "core", status: "available",
      does: "Reads inbound pitches into triage and drafts founder replies. Nothing sends without you.", scope: "Read mail · create drafts",
      scopes: [
        { id: "read", label: "Read mail", detail: "Pitch emails and founder threads", access: "read", on: true },
        { id: "drafts", label: "Create drafts", detail: "Replies wait in Drafts for you to send", access: "write", on: true },
        { id: "send", label: "Send on approve", detail: "Send after you approve, past the hold", access: "write", on: false },
      ],
      },
    { id: "calendar", tool: "calendar", category: "email", tier: "core", status: "available",
      does: "Finds open slots, books founder calls and attaches a prep brief to every meeting.", scope: "Read availability · create events",
      scopes: [
        { id: "free", label: "Read availability", detail: "Free and busy only, not event details", access: "read", on: true },
        { id: "events", label: "Create events", detail: "Founder calls you approved", access: "write", on: true },
      ],
      },
    { id: "agentmail", tool: "agentmail", category: "email", tier: "core", status: "available",
      does: "Gives agents their own inbox for data-room requests and founder follow-ups.", scope: "Dedicated agent inbox",
      },
    { id: "googlemeet", tool: "googlemeet", category: "meetings", tier: "core", status: "available",
      does: "Joins partner calls on request so notes and next steps land on the right deal.", scope: "Join meetings you invite it to",
      },
    { id: "fireflies", tool: "fireflies", category: "meetings", tier: "core", status: "available",
      does: "Files call transcripts to the deal and pulls founder claims into diligence.", scope: "Read transcripts" },
    { id: "slack", tool: "slack", category: "messaging", tier: "core", status: "available",
      does: "Posts deal claims, morning briefs and approvals where the partnership already talks.", scope: "Post to chosen channels · read replies",
      scopes: [
        { id: "post", label: "Post to #deals and #ic", detail: "Claims, briefs and approvals", access: "write", on: true },
        { id: "replies", label: "Read replies", detail: "Thread replies to its own posts only", access: "read", on: true },
        { id: "dm", label: "Direct messages", detail: "Nudge an owner when a deal waits on them", access: "write", on: false },
      ],
      },

    /* ── tier (b): available ── */
    { id: "affinity", tool: "affinity", category: "crm", tier: "available", status: "available", does: "Keeps pipeline stages, owners and notes in step with your Affinity lists.", scope: "Read and write lists" },
    { id: "attio", tool: "attio", category: "crm", tier: "available", status: "available", does: "Syncs deals and founder records both ways so triage starts from your CRM.", scope: "Read and write records" },
    { id: "hubspot", tool: "hubspot", category: "crm", tier: "available", status: "available", does: "Logs founder threads and meetings against HubSpot companies and deals.", scope: "Read and write CRM objects" },
    { id: "salesforce", tool: "salesforce", category: "crm", tier: "available", status: "available", does: "Mirrors mandates and buyer lists for coverage teams on Salesforce.", scope: "Read and write opportunities" },
    { id: "dealcloud", tool: "dealcloud", category: "crm", tier: "available", status: "available", does: "Pushes screened deals and IC outcomes into DealCloud pipelines.", scope: "Read and write deals" },
    { id: "pitchbook", tool: "pitchbook", category: "data", tier: "available", status: "available", does: "Adds comps, cap tables and prior rounds to diligence and memos.", scope: "Company and deal data · read" },
    { id: "crunchbase", tool: "crunchbase", category: "data", tier: "available", status: "available", does: "Cross-checks funding history and investors on every inbound.", scope: "Organizations and rounds · read" },
    { id: "harmonic", tool: "harmonic", category: "data", tier: "available", status: "available", does: "Surfaces stealth companies and team moves that match your thesis.", scope: "Saved searches · read" },
    { id: "linkedin", tool: "linkedin", category: "data", tier: "available", status: "available", does: "Maps warm paths to founders through your partners’ networks.", scope: "Profile and connections · read" },
    { id: "clay", tool: "clay", category: "data", tier: "available", status: "available", does: "Runs your enrichment tables on sourced lists before outreach.", scope: "Tables · read" },
    { id: "outlook", tool: "outlook", category: "email", tier: "available", status: "available", does: "Reads pitches and drafts replies for partners on Microsoft 365.", scope: "Read mail · create drafts" },
    { id: "zoom", tool: "zoom", category: "meetings", tier: "available", status: "available", does: "Pulls recordings and transcripts from founder calls into the deal.", scope: "Recordings · read" },
    { id: "otter", tool: "otter", category: "meetings", tier: "available", status: "available", does: "Files Otter notes to the right deal and flags unanswered questions.", scope: "Conversations · read" },
    { id: "granola", tool: "granola", category: "meetings", tier: "available", status: "available", does: "Brings your Granola notes into prep briefs and follow-ups.", scope: "Notes · read" },
    { id: "gong", tool: "gong", category: "meetings", tier: "available", status: "available", does: "Reads portfolio sales calls to spot churn risk before the board.", scope: "Calls · read" },
    { id: "docsend", tool: "docsend", category: "docs", tier: "available", status: "available", does: "Opens shared decks, saves a copy to the deal and logs who viewed.", scope: "Shared links · read" },
    { id: "notion", tool: "notion", category: "docs", tier: "available", status: "available", does: "Reads your thesis pages and files IC memos into the team wiki.", scope: "Selected pages · read and write" },
    { id: "drive", tool: "drive", category: "docs", tier: "available", status: "available", does: "Indexes data rooms and memo drafts kept in shared drives.", scope: "Selected folders · read" },
    { id: "dropbox", tool: "dropbox", category: "docs", tier: "available", status: "available", does: "Reads founder data rooms shared as Dropbox folders.", scope: "Shared folders · read" },
    { id: "docusign", tool: "docusign", category: "docs", tier: "available", status: "available", does: "Tracks term sheet and SAFE signatures on each deal.", scope: "Envelope status · read" },
    { id: "airtable", tool: "airtable", category: "docs", tier: "available", status: "available", does: "Syncs sourcing bases and scout lists into the pipeline.", scope: "Selected bases · read" },
    { id: "excel", tool: "excel", category: "docs", tier: "available", status: "available", does: "Reads founder models and fills your returns template.", scope: "Selected workbooks · read" },
    { id: "carta", tool: "carta", category: "finance", tier: "available", status: "available", does: "Keeps cap tables, ownership and fund marks current for portfolio watch.", scope: "Fund and cap table data · read" },
    { id: "angellist", tool: "angellist", category: "finance", tier: "available", status: "available", does: "Brings syndicate deals and SPV positions into the portfolio.", scope: "Investments · read" },
    { id: "visible", tool: "visible", category: "finance", tier: "available", status: "available", does: "Reads monthly KPI updates and flags runway and burn changes.", scope: "Company updates · read" },
    { id: "plaid", tool: "plaid", category: "finance", tier: "available", status: "available", does: "Verifies cash balances founders report, with their consent.", scope: "Balances · read, per founder" },
    { id: "quickbooks", tool: "quickbooks", category: "finance", tier: "available", status: "available", does: "Checks reported revenue against the books in diligence.", scope: "Reports · read, per founder" },
    { id: "teams", tool: "teams", category: "messaging", tier: "available", status: "available", does: "Posts briefs and approvals for firms that work in Teams.", scope: "Post to chosen channels" },
  ],
};
