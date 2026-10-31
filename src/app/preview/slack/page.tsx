"use client";
// Former design reference for Slack cards (it rendered sample messages). Same honest state as /slack.
import { UnavailablePage } from "@/live/unavailable";

export default function SlackPreview() {
  return <UnavailablePage screen="slack" active="settings" crumbs={[{ label: "Settings", href: "/settings" }, { label: "Slack" }]} />;
}
