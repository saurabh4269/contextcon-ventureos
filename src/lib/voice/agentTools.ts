import { correctTranscript } from "./transcript";

// Client-tool routing for the Deal Desk voice agent (pure; safe in the client bundle).
/** Screens the agent's open_screen tool may open (keep in sync with scripts/voice-agent-setup.mjs). */
export const AGENT_SCREENS = ["today", "pipeline", "agent", "agents", "ask", "mandates", "portfolio", "brain", "settings"] as const;

/** Where a client tool call should navigate, or an error string for the agent. Pure, so it is unit-tested. */
export function toolRoute(tool: "run_sourcing" | "open_company" | "open_screen", params: Record<string, unknown>): { href: string } | { error: string } {
  const s = (k: string) => (typeof params[k] === "string" ? (params[k] as string).trim() : "");
  if (tool === "run_sourcing") {
    const q = correctTranscript(s("request"));
    return q ? { href: `/agent?q=${encodeURIComponent(q.slice(0, 500))}` } : { error: "request is required" };
  }
  if (tool === "open_company") {
    const d = s("domain").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? { href: `/deal?domain=${encodeURIComponent(d)}` } : { error: `"${s("domain")}" is not a website domain; ask the user for the company's website` };
  }
  const n = s("name").toLowerCase();
  return (AGENT_SCREENS as readonly string[]).includes(n) ? { href: `/${n}` } : { error: `unknown screen "${n}"; valid: ${AGENT_SCREENS.join(", ")}` };
}
