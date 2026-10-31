import type { SettingsData } from "../types";
import { connectors } from "./connectors";

/** GET /api/firm/config + /api/firm/members + /api/firm/walls + /api/firm/access-log (@assumed paths for the last three) */
export const settings: SettingsData = {
  isAdmin: true,
  integrations: [
    { id: "gmail", name: "Gmail", initial: "G", scope: "Drafts only", status: "on" },
    { id: "gcal", name: "Calendar", initial: "C", scope: "Google · read", status: "on" },
    { id: "slack", name: "Slack", initial: "S", scope: "Briefs + approvals", status: "on" },
    { id: "affinity", name: "Affinity", initial: "A", scope: "Pipeline sync", status: "on" },
    { id: "crust", name: "Crustdata", initial: "C", scope: "People · read", status: "on" },
    { id: "datasite", name: "Datasite", initial: "D", scope: "3 data rooms", status: "on" },
    { id: "carta", name: "Carta", initial: "C", scope: "Reconnect", status: "fix" },
    { id: "office", name: "Office", initial: "O", scope: "Firm templates", status: "on" },
    { id: "notion", name: "Notion", initial: "N", scope: "Not connected", status: "off" },
  ],
  connectors,
  mcp: { url: "mcp.dealdesk.app/firm" },
  briefs: [
    { id: "b1", label: "Morning brief", time: "08:00", channels: ["email", "slack"], on: true },
    { id: "b2", label: "Evening brief", time: "18:30", channels: ["slack"], on: true },
  ],
  guardrails: [
    { id: "g1", label: "Emails stay as drafts", on: true },
    { id: "g2", label: "Never shares files", on: true },
    { id: "g3", label: "Never signs", on: true },
    { id: "g4", label: "Moves pipeline stages", on: true },
    { id: "g5", label: "Books meetings", on: false },
  ],
  config: {
    mode: "invest",
    thesis: { sectors: ["Fintech infra", "Vertical SaaS", "Finance ops"], stages: ["Seed", "Series A", "Series B"], geos: ["US", "UK"], checkSize: { min: 2, max: 8, unit: "M" }, ownershipTarget: 12 },
    stages: [
      { id: "sourced", label: "Sourced" }, { id: "review", label: "Initial review" }, { id: "partner", label: "Partner meeting" },
      { id: "dd", label: "Due diligence" }, { id: "ic", label: "IC" }, { id: "ts", label: "Term sheet" },
    ],
    passTemplates: [
      { id: "pt1", reason: "Market too small", preview: "Thanks for walking us through {company}. We don’t see a venture-scale market yet…", uses: 9 },
      { id: "pt2", reason: "Price", preview: "We like the team and product, but we can’t get to {ask} at this stage…", uses: 7 },
      { id: "pt3", reason: "Too early", preview: "This is earlier than we usually invest. Can we check back at {milestone}?", uses: 4 },
    ],
    autonomy: 1,
    holdMinutes: 5,
    ownerRule: "ask_first",
  },
  members: [
    { id: "u_sg", name: "Saurabh Gupta", initials: "SG", email: "saurabh@northbeam.vc", role: "admin", walls: ["Project Falcon", "Keel"], status: "active" },
    { id: "u_mk", name: "Maya Kapoor", initials: "MK", email: "maya@northbeam.vc", role: "partner", walls: ["Keel"], status: "active" },
    { id: "u_ps", name: "Priya Shah", initials: "PS", email: "priya@northbeam.vc", role: "principal", walls: ["Project Falcon"], status: "active" },
    { id: "u_ar", name: "Arjun Rao", initials: "AR", email: "arjun@northbeam.vc", role: "associate", walls: ["Project Falcon"], status: "active" },
    { id: "u_ma", name: "Mo Ali", initials: "MA", email: "mo@northbeam.vc", role: "associate", walls: [], status: "active" },
    { id: "u_dw", name: "Dana Whitfield", initials: "DW", email: "dana@northbeam.vc", role: "observer", walls: [], status: "invited" },
  ],
  wallGroups: [
    { id: "wg1", codename: "Project Falcon", members: 3, approver: "Saurabh Gupta", restricted: true },
    { id: "wg2", codename: "Keel", members: 2, approver: "Maya Kapoor", restricted: true },
  ],
  roles: [
    { id: "admin", label: "Admin", summary: "Everything, plus members, walls, keys and the access audit" },
    { id: "partner", label: "Partner", summary: "All deals outside walls · approves sends and IC" },
    { id: "principal", label: "Principal", summary: "Leads deals · claims inbound" },
    { id: "associate", label: "Associate", summary: "Works deals they’re on · drafts only" },
    { id: "observer", label: "Observer", summary: "Read-only · no walled deals" },
  ],
  audit: [
    { id: "ad1", at: "Today 11:38", who: "Mo Ali", target: "Project Falcon", surface: "slack", reason: "Not on wall" },
    { id: "ad2", at: "Today 11:36", who: "Mo Ali", target: "Project Falcon", surface: "ask", reason: "Not on wall" },
    { id: "ad3", at: "Yesterday 16:02", who: "Dana Whitfield", target: "Keel", surface: "cmdk", reason: "Observer role" },
    { id: "ad4", at: "Tue 09:14", who: "Mo Ali", target: "Project Falcon", surface: "mcp", reason: "Not on wall · via ChatGPT" },
    { id: "ad5", at: "Mon 18:40", who: "Mo Ali", target: "Project Falcon", surface: "web", reason: "Not on wall · asked to join" },
  ],
  export: {
    lastExport: "12 Sep",
    contents: ["1,284 firm-brain memories", "25 deals with claims and citations", "IC memos (Word + PDF)", "Pipeline history and audit log", "Pass reasons and outcomes", "Settings and thesis"],
    keys: [
      { id: "openai", provider: "OpenAI", masked: "sk-…4f2a", addedAt: "3 Oct" },
      { id: "anthropic", provider: "Anthropic", masked: null },
      { id: "azure", provider: "Azure OpenAI", masked: null },
    ],
  },
};
/** Non-admin: Access audit is hidden; members table is read-only. */
export const settingsMember: SettingsData = { ...settings, isAdmin: false, audit: [] };
