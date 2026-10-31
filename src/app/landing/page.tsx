"use client";
// Landing: marketing copy only (src/content/landing.ts, src/content/landing-story.ts). "Request access" is recorded in
// organizational memory; if the memory store is unavailable the request is not confirmed.
import { LandingScreen } from "@port/screens/landing";
import { landingCopy } from "@/content/landing";
import { landingStory } from "@/content/landing-story";
import { recordEvent } from "@/live/memory";
import { LandingStorySections } from "./story";

export default function Landing() {
  return <LandingScreen data={landingCopy} story={<LandingStorySections d={landingStory} />} onRequestAccess={async (email) => {
    const r = await recordEvent({ kind: "access.requested", subject: { type: "email", id: email }, summary: `Access requested for ${email}` });
    if (r.status !== "ok") throw new Error(r.reason);
  }} />;
}
