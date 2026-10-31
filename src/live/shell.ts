import type { ShellData } from "@port/types";

/**
 * App chrome without invented identity or counts: this build has no sign-in, firm profile, notification feed or
 * agent runtime, so the sidebar shows no badges, no "agents working" and no firm card, and the assistant dock says it
 * is not connected (no AI model is wired into the assistant in this build).
 */
export const liveShell: ShellData = {
  user: { id: "anonymous", name: "Not signed in (no auth in this build)", firstName: "Not signed in", initials: "–" },
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
