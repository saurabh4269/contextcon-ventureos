import type { SlackMessage } from "../../src/types";

/** Outbound hold approval — the same card goes to Teams as an Adaptive Card. */
export const slackHoldApproval: SlackMessage = {
  id: "s1", channel: "#deal-nexaflow", time: "08:14",
  title: "Ready to send: ARR bridge request to Maya Chen",
  lines: ["Asks Maya to bridge $18.2M deck ARR to $14.6M verified before IC on Mon 2 Nov.", "Holds 5 min after you approve. Undo any time before it leaves."],
  chips: [{ label: "model.xlsx · row 18", ok: true }, { label: "CIM p.42", ok: true }],
  buttons: [{ id: "approve", label: "Approve & send", style: "primary" }, { id: "edit", label: "Edit in Gmail" }, { id: "discard", label: "Don’t send", style: "danger" }],
  footer: "Deal Desk · L1 approvals · nothing leaves without you",
};
export const slackHolding: SlackMessage = {
  id: "s1b", channel: "#deal-nexaflow", time: "08:15",
  title: "Sending to Maya Chen in 4:12",
  lines: ["Approved by you. It leaves at 08:20 unless you undo."],
  buttons: [{ id: "undo", label: "Undo" }, { id: "send_now", label: "Send now", style: "primary" }],
  footer: "Hold window set in Settings › Workflow",
};
export const slackOwnerSuggestion: SlackMessage = {
  id: "s2", channel: "DM · Deal Desk", time: "07:02",
  title: "Harbor AI came in from inbound. Want to lead it?",
  lines: ["Port logistics · Seed · $1.2M ARR est.", "Owner rule is ask first, so nobody is assigned yet."],
  suggest: "Suggested: you. You led 3 logistics deals and know the CEO from Flexport.",
  buttons: [{ id: "claim", label: "Claim it", style: "primary" }, { id: "suggest_other", label: "Suggest Arjun" }, { id: "skip", label: "Not now" }],
  footer: "Sourced by Priya Shah · credit stays with her",
};
export const slackWallRequest: SlackMessage = {
  id: "s3", channel: "DM · Deal Desk", time: "11:40",
  title: "Mo Ali asked to join the Project Falcon wall",
  lines: ["Reason given: “Covering diligence calls while Arjun is out.”", "You approve Falcon. Mo currently sees only the codename."],
  buttons: [{ id: "approve_wall", label: "Approve", style: "primary" }, { id: "deny_wall", label: "Deny", style: "danger" }],
  footer: "Logged to the access audit either way",
};
export const slackDenied: SlackMessage = {
  id: "s4", channel: "#deals", time: "11:38", ephemeral: true,
  title: "Project Falcon is behind a wall",
  lines: ["You’re not on its team, so Deal Desk can’t share anything about it here."],
  buttons: [{ id: "request", label: "Request access", style: "primary" }],
  footer: "Only you can see this · the request goes to the wall’s approver",
};
export const slackPreviewChannels: { channel: string; note: string; messages: SlackMessage[] }[] = [
  { channel: "#deal-nexaflow", note: "Outbound hold: approve, then a countdown with Undo", messages: [slackHoldApproval, slackHolding] },
  { channel: "DM · Deal Desk", note: "Owner suggestion when the owner rule is ask_first", messages: [slackOwnerSuggestion] },
  { channel: "DM · Deal Desk", note: "Wall access request, sent to the approver only", messages: [slackWallRequest] },
  { channel: "#deals", note: "Ephemeral denial, shown only to the asker", messages: [slackDenied] },
];
