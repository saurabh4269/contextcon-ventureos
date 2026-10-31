"use client";
// Slack: this build posts nothing to Slack → unavailable state with Slack's real connector status.
import { UnavailablePage } from "@/live/unavailable";

export default function Slack() {
  return <UnavailablePage screen="slack" active="settings" crumbs={[{ label: "Settings", href: "/settings" }, { label: "Slack" }]} />;
}
