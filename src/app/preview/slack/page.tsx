"use client";
// Design reference for Slack/Teams cards — not app navigation. v3 adds the Helio claim, IC vote and milestone cards.
import { SlackPreviewScreen } from "@port/screens/slackpreview";
import { slackPreviewChannels, slackDealflow, slackClaimed, slackIcVoteFrame, slackMilestone } from "@port/fixtures";
const channels = [
  { channel: "#dealflow", note: "Inbound that fits the thesis, claimed in one tap", messages: [slackDealflow, ...slackClaimed.slice(-1)] },
  { channel: "#ic", note: "IC vote: the card fills in as partners vote", messages: slackIcVoteFrame(5) },
  { channel: "#portfolio", note: "Milestone against the memo plan", messages: [slackMilestone] },
  ...slackPreviewChannels,
];
export default function SlackPreview() { return <SlackPreviewScreen channels={channels} />; }
