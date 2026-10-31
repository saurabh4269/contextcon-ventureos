import type { ShellData } from "@port/types";

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
  assistant: {
    title: "Ask Deal Desk",
    context: "All deals",
    placeholder: "Assistant not connected in this build",
    messages: [],
    suggestions: [],
    greeting: { title: "Assistant not connected", body: "No AI model is wired into the assistant in this build. See Settings › Connectors for the AI model status." },
  },
};
