import type { ShellData } from "@port/types";
import { AGENT_EXAMPLES } from "@/lib/sourcing/examples";

/**
 * App chrome without invented counts: this is a single-operator build with no sign-in, and the operator is the founder
 * (Saurabh Gupta; photo is his public GitHub avatar, saved to /public/team). There is no firm profile, notification feed
 * or agent runtime, so the sidebar shows no badges, no "agents working" and no firm card. The assistant dock routes a
 * request to the agents: /ask (LLM research agent, when a model key is set) or /agent (deterministic Sourcing agent).
 */
export const liveShell: ShellData = {
  user: { id: "saurabh-gupta", name: "Saurabh Gupta", firstName: "Saurabh", initials: "SG", avatarUrl: "/team/saurabh-gupta.png", github: "saurabh4269", role: "Partner" },
  badges: {},
  unreadNotifications: false,
  // A typed question (or a chip) opens the research agent at /ask?q=… (AssistantDock's default onSend), which runs it
  // live. Without a model key /ask says so and offers the deterministic Sourcing agent (/agent?q=…) for the same text.
  assistant: {
    title: "Ask Deal Desk",
    context: "All deals",
    placeholder: "Ask for companies, e.g. Indian B2B SaaS growing fast",
    messages: [],
    suggestions: AGENT_EXAMPLES.slice(0, 3).map((ex, i) => ({ id: `sourcing-${i}`, title: ex.short, desc: ex.q, action: ex.q, icon: "search" as const })),
    greeting: { title: "Find companies. Get a cited list.", body: "Your question runs the research agent live on Crustdata; every value is cited." },
  },
};

/**
 * The port shell for live-wired screens: same user and dock, without the fixture firm card, nav badge counts,
 * "agents working" dot or notification dot (nothing reports them in this build). The footer falls back to
 * "Deal Desk" on the same line, so the layout does not change.
 */
export const liveShellFrom = (base: ShellData): ShellData => ({ ...base, firm: undefined, badges: {}, agentsWorking: undefined, unreadNotifications: false });
