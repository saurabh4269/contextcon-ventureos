// Landing page copy. Marketing text only: no sample companies, scores, meetings or agent runs (the product tour that
// used them was demo data and is gone); the "Watch the demo" frame opens the real app.
import type { LandingData } from "@port/types";

export const landingCopy: LandingData = {
  brand: "Deal Desk",
  nav: [
    { id: "value", label: "Who pays", href: "#value" },
    { id: "how", label: "How it works", href: "#how" },
    { id: "ask", label: "Try a request", href: "/ask" },
  ],
  signIn: { id: "signin", label: "Open the app", href: "/pipeline" },
  hero: {
    eyebrow: "For venture and banking deal teams",
    headline: [{ before: "Your firm’s ", accent: "AI" }, { before: "deal team", accent: "" }],
    sub: "Ask in plain English. Get back a finished, cited shortlist or IC memo. A person signs off only on the exceptions.",
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
