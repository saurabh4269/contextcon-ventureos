/** Every href the UI emits. Edit this one file to match the real app's routes. */
export const ROUTES = {
  today: (mode: "invest" | "bank" = "invest") => (mode === "bank" ? "/today?mode=bank" : "/today"),
  pipeline: "/pipeline",
  pipelineBoard: "/pipeline?board=1",
  watchlist: "/pipeline?view=watchlist",
  portfolio: "/portfolio",
  mandates: "/mandates",
  brain: "/brain",
  agents: "/agents",
  runs: "/agents?tab=runs",
  agent: (id: string, view?: "steps" | "flow") => `/agent?id=${id}${view === "flow" ? "&view=flow" : ""}`,
  /** v4 · "How this agent works" canvas for a flow fixture (agentFlows key). */
  agentFlow: (flow: string) => `/agent?view=flow&agent=${flow}`,
  /** v4 · the agents list with one agent opened (Connectors "Used by" chips). */
  agentInList: (id: string) => `/agents?agent=${id}`,
  settings: (section?: string) => (section ? `/settings?section=${section}` : "/settings"),
  deal: (id: string) => `/deal?id=${id}`,
  dataRoom: (id: string) => `/deal/room?id=${id}`,
  memo: (id: string) => `/memo?id=${id}`,
  /** v3.2 · the assistant as a full page (dock → expand). */
  ask: (from?: string) => (from ? `/ask?from=${from}` : "/ask"),
  person: (id: string) => `/person?id=${id}`,
  connectors: "/settings?section=connectors",
} as const;
