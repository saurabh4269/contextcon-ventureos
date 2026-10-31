"use client";
// Landing: marketing copy only (src/content/landing.ts). "Request access" is recorded in organizational memory; if the
// memory store is unavailable the request is not confirmed.
import { LandingScreen } from "@port/screens/landing";
import { landingCopy } from "@/content/landing";
import { recordEvent } from "@/live/memory";

export default function Landing() {
  return <LandingScreen data={landingCopy} onRequestAccess={async (email) => {
    const r = await recordEvent({ kind: "access.requested", subject: { type: "email", id: email }, summary: `Access requested for ${email}` });
    if (r.status !== "ok") throw new Error(r.reason);
  }} />;
}
