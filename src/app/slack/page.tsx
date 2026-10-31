"use client";
// v3 state frames for Slack (video/docs): /slack?state=claim|vote|milestone&frame=n
import { use } from "react";
import { SlackStateScreen } from "@port/screens/slackpreview";
import { useDataMode } from "@/components/datamode";
import { UnavailablePage } from "@/live/unavailable";
import { slackDealflow, slackClaimed, slackIcVoteFrame, slackMilestone } from "@port/fixtures";
export default function Slack({ searchParams }: { searchParams: Promise<{ state?: string; frame?: string }> }) {
  const mode = useDataMode();
  const q = use(searchParams), n = Math.max(1, Number(q.frame ?? 1));
  if (mode === "live") return <UnavailablePage screen="slack" active="settings" crumbs={[{ label: "Settings", href: "/settings" }, { label: "Slack" }]} />;
  if (q.state === "vote") return <SlackStateScreen key={n} channel="#ic" caption={["IC vote posted", "First vote in", "Two of three", "3 of 3 · term sheet on hold", "Stage moves to Term sheet"][Math.min(n, 5) - 1]} frame={{ n: Math.min(n, 5), of: 5 }} context={[{ who: "Maya Kapoor", time: "16:38", text: "Memo for Helio is up, vote when you’ve read it." }]} messages={slackIcVoteFrame(n)} />;
  if (q.state === "milestone") return <SlackStateScreen channel="#portfolio" caption="Milestone, ahead of plan" messages={[slackMilestone]} context={[{ who: "Priya Shah", time: "08:51", text: "Helio board pack is in the data room." }]} />;
  const claimed = q.state === "claim" && n >= 2;
  return <SlackStateScreen key={n} channel="#dealflow" caption={claimed ? "Claimed · confirmation" : "New inbound, suggested owner"} frame={q.state === "claim" ? { n: Math.min(n, 2), of: 2 } : undefined} messages={claimed ? slackClaimed : [slackDealflow]} />;
}
