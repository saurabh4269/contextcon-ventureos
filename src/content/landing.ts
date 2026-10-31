// Landing page copy. Marketing text only: no sample companies, scores, meetings or agent runs (the product tour that
// used them was demo data and is gone); the "Watch the demo" frame opens the real app.
import type { LandingData } from "@port/types";

export const landingCopy: LandingData = {
  brand: "Deal Desk",
  nav: [
    { id: "triage", label: "Triage", href: "#triage" },
    { id: "diligence", label: "Diligence", href: "#diligence" },
    { id: "meetings", label: "Meetings", href: "#meetings" },
    { id: "agents", label: "Agents", href: "#agents" },
  ],
  signIn: { id: "signin", label: "Open the app", href: "/pipeline" },
  hero: {
    eyebrow: "For venture and banking deal teams",
    headline: [{ before: "Your firm’s ", accent: "AI" }, { before: "deal team", accent: "" }],
    sub: "Triage inbound, run diligence, book founders and prep IC, with every step visible and every call yours.",
    demo: "Open the live app",
    access: "Request access",
  },
  assistant: { title: "Ask Deal Desk", sub: "", expand: "/ask", placeholder: "Ask about any deal…", questions: [] },
  demo: { title: "Deal Desk", src: "/pipeline", caption: "The live app: research any company on Crustdata." },
  features: { eyebrow: "What the agents do", title: { before: "Every step visible, every call ", accent: "yours" }, sub: "", items: [] },
  closing: {
    title: { before: "Every deal, ", accent: "decided", after: " faster" },
    sub: "Bring your inbound, your thesis and your calendar.",
    placeholder: "Work email",
    cta: "Request access",
    done: "Thanks. Your request for {email} is recorded.",
  },
  footer: "Deal Desk by VentureOS",
};
