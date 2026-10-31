import type { OnboardingData } from "../../src/types";

/** POST /api/firm/onboarding — body is the final OnboardingData (minus `working`). */
export function onboarding(step: 1 | 2 | 3 | 4 | 5 = 1): OnboardingData {
  return {
    step,
    steps: ["Firm", "Mail & calendar", "Thesis", "Team", "Approvals"],
    firm: { name: "Northbeam Ventures", website: "northbeam.vc", mode: "invest", checkSize: { min: 2, max: 8, unit: "M" } },
    prefill: { source: "northbeam.vc", sectors: ["Fintech infra", "Vertical SaaS", "Finance ops"], stages: ["Seed", "Series A", "Series B"], geos: ["US", "UK"] },
    invites: [
      { email: "maya@northbeam.vc", role: "Partner", suggested: true, why: "212 emails this year" },
      { email: "priya@northbeam.vc", role: "Principal", suggested: true, why: "On 9 of your deals" },
      { email: "arjun@northbeam.vc", role: "Associate", suggested: true, why: "Shares your calendar" },
    ],
    roles: ["Admin", "Partner", "Principal", "Associate", "Observer"],
    channel: "slack",
    autonomy: 1,
    holdMinutes: 5,
    working: [
      { id: "w1", label: "Found companies in your inbox", state: step > 1 ? "done" : "running", value: 214 },
      { id: "w2", label: "Matched to Crustdata", state: step > 2 ? "done" : step > 1 ? "running" : "queued", value: 188 },
      { id: "w3", label: "Finding warm intros", state: step > 3 ? "running" : "queued", value: "61%" },
      { id: "w4", label: "First brief", state: "queued", value: "Sat 08:00" },
    ],
  };
}
export const onboardingBank: OnboardingData = { ...onboarding(1), firm: { name: "Harbor Lane Partners", website: "harborlane.com", mode: "bank", checkSize: { min: 1, max: 5, unit: "B" } } };
