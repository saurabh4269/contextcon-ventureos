// What each screen needs and why it has no data in this build. One place, so the UI, the click-through test and
// verify_shots/REPORT.md agree. `needs` are connector ids from GET /api/integrations/connectors, or "backend" for the
// builder's Deal Desk backend (deal store, pipeline, agents, firm config) which this repo does not include.
export type ScreenId = "today" | "pipeline" | "portfolio" | "mandates" | "brain" | "agents" | "agent" | "ask" | "slack" | "memo" | "room" | "settings";

export const SOURCES: Record<ScreenId, { label: string; title: string; reason: string; needs: string[] }> = {
  today: {
    label: "Today",
    title: "Inbound and meetings",
    reason: "Today reads your Gmail inbox and Google Calendar directly. Deal triage and approvals need the Deal Desk backend, which this build does not include.",
    needs: ["gmail", "calendar", "backend"],
  },
  pipeline: {
    label: "Pipeline",
    title: "Inbound and researched companies",
    reason: "This build lists companies from Gmail inbound (when the thread names a website) and from companies you have already researched. Stages, owners and a kanban board live in the Deal Desk backend, which this build does not include.",
    needs: ["gmail"],
  },
  portfolio: {
    label: "Portfolio",
    title: "No portfolio data connected",
    reason: "Portfolio KPIs, marks and board packs need the deal store and a cap-table source (e.g. Carta); neither is connected in this build.",
    needs: ["backend"],
  },
  mandates: {
    label: "Mandates",
    title: "No mandates connected",
    reason: "Sell-side mandates, buyer lists and data-room activity come from the Deal Desk backend, which this build does not include.",
    needs: ["backend"],
  },
  brain: {
    label: "Firm brain",
    title: "Firm knowledge is not derived in this build",
    reason: "The builder backend turns firm activity into memories and thesis proposals. What this build does keep is the raw organizational memory: every action, live, below.",
    needs: ["backend"],
  },
  agents: {
    label: "Agents",
    title: "No agents running",
    reason: "Agents and their runs are executed by the Deal Desk backend's job queue, which this build does not include, so there is nothing to list.",
    needs: ["backend", "llm"],
  },
  agent: {
    label: "Agent",
    title: "No agent to show",
    reason: "Agent flows and runs come from the Deal Desk backend's job queue, which this build does not include.",
    needs: ["backend", "llm"],
  },
  ask: {
    label: "Assistant",
    title: "Assistant not connected",
    reason: "The assistant answers from your deals and documents with an AI model through the Deal Desk backend. No AI model is wired into the assistant in this build.",
    needs: ["llm", "backend"],
  },
  slack: {
    label: "Slack",
    title: "No Slack messages to show",
    reason: "Deal Desk posts dealflow, IC votes and milestones to Slack from the backend. This build posts nothing, so there are no messages to preview.",
    needs: ["slack", "backend"],
  },
  memo: {
    label: "IC memo",
    title: "No IC memo",
    reason: "IC memos are drafted by the Deal Desk pipeline from verified data-room financials and the pricing model.",
    needs: ["backend", "llm"],
  },
  room: {
    label: "Data room",
    title: "No data room connected",
    reason: "This build has no data-room source (Drive, Dropbox, DocSend or uploads), so there are no files or deck claims to show.",
    needs: ["backend"],
  },
  settings: {
    label: "Settings",
    title: "Not available in this build",
    reason: "Firm workflow, members, access audit and exports are stored by the Deal Desk backend, which this build does not include.",
    needs: ["backend"],
  },
};
