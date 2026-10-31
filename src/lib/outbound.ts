// Single switch for everything that would contact another person: email send, calendar invites/inserts, Slack posts,
// AgentMail sends. OUTBOUND_MODE=dry_run (default, and the only mode allowed during the event) builds and validates the
// request and returns it as `wouldSend` — nothing leaves the server. OUTBOUND_MODE=live is required to really send.
// This build has exactly one outbound path (Calendar events.insert from Book a call); Gmail send, Slack post and
// AgentMail send are not implemented at all.
export type OutboundMode = "dry_run" | "live";

export function outboundMode(env: Record<string, string | undefined> = process.env): OutboundMode {
  const v = env.OUTBOUND_MODE?.trim().toLowerCase();
  if (!v || v === "dry_run") return "dry_run";
  if (v === "live") return "live";
  throw new Error(`OUTBOUND_MODE must be "dry_run" or "live" (got "${env.OUTBOUND_MODE}")`);
}

export const DRY_RUN_LABEL = "Dry run — not sent (event rules)";
export const dryRun = <T>(channel: string, wouldSend: T) => ({ status: "ok" as const, transport: "dry_run" as const, channel, label: DRY_RUN_LABEL, wouldSend });
