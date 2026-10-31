import type { ShellData } from "@port/types";
import { AGENT_EXAMPLES } from "@/lib/sourcing/examples";

/**
 * App chrome without invented counts: this is a single-operator build with no sign-in, and the operator is the founder
 * (Saurabh Gupta; photo is his public GitHub avatar, saved to /public/team). There is no firm profile, notification feed
 * or agent runtime, so the sidebar shows no badges, no "agents working" and no firm card, and the assistant dock says
 * it is not connected (no AI model is wired into the assistant in this build).
 */
export const liveShell: ShellData = {
  user: { id: "saurabh-gupta", name: "Saurabh Gupta", firstName: "Saurabh", initials: "SG", avatarUrl: "/team/saurabh-gupta.png", github: "saurabh4269", role: "Partner" },
  badges: {},
  unreadNotifications: false,
  // No AI model is wired into the dock in this build: a typed question (or a chip) runs the deterministic Sourcing
  // agent at /agent?q=… (AssistantDock's default onSend). The chips are the agent's own examples.
  assistant: {
    title: "Ask Deal Desk",
    context: "All deals",
    placeholder: "Ask for companies, e.g. Indian B2B SaaS growing fast",
    messages: [],
    suggestions: AGENT_EXAMPLES.slice(0, 3).map((ex, i) => ({ id: `sourcing-${i}`, title: ex.short, desc: ex.q, action: ex.q, icon: "search" as const })),
    greeting: { title: "Find companies. Get a cited list.", body: "The assistant model is not connected in this build. What you type here runs the Sourcing agent on Crustdata instead." },
  },
};
