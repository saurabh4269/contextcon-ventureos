// Single switch for everything that would contact another person: Gmail send, Calendar inserts with attendees.
// OUTBOUND_MODE=dry_run (default) builds and validates the request and returns it as `wouldSend`: nothing leaves the
// server. OUTBOUND_MODE=live (or OUTBOUND_LIVE=1) really sends, but only after two more gates:
//   1. Recipient allowlist: every recipient must be in DEMO_RECIPIENT_ALLOWLIST (comma-separated; default the team's
//      own addresses). Anyone else is blocked with a clear message. Hackathon rule: only the team may be contacted.
//   2. Explicit approval: a send needs an approval token minted by a preview of the exact same message (the UI's
//      "Approve & send" click). Tokens are single-use, bound to the message hash, and expire after 10 minutes.
import { createHash, randomBytes } from "node:crypto";

export type OutboundMode = "dry_run" | "live";
type Env = Record<string, string | undefined>;

export function outboundMode(env: Env = process.env): OutboundMode {
  const live = env.OUTBOUND_LIVE?.trim().toLowerCase();
  if (live === "1" || live === "true") return "live";
  const v = env.OUTBOUND_MODE?.trim().toLowerCase();
  if (!v || v === "dry_run") return "dry_run";
  if (v === "live") return "live";
  throw new Error(`OUTBOUND_MODE must be "dry_run" or "live" (got "${env.OUTBOUND_MODE}")`);
}

export const DRY_RUN_LABEL = "Dry run — not sent (event rules)";
export const dryRun = <T>(channel: string, wouldSend: T) => ({ status: "ok" as const, transport: "dry_run" as const, channel, label: DRY_RUN_LABEL, wouldSend });

// ---- recipient allowlist ----
/** No built-in recipients: the allowlist comes only from DEMO_RECIPIENT_ALLOWLIST. Unset or empty blocks every send. */
export const DEFAULT_ALLOWLIST: readonly string[] = [];
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export const isEmail = (s: unknown): s is string => typeof s === "string" && EMAIL.test(s.trim());
const norm = (s: string) => s.trim().toLowerCase();

export function recipientAllowlist(env: Env = process.env): string[] {
  const raw = env.DEMO_RECIPIENT_ALLOWLIST?.trim();
  const list = raw ? raw.split(/[,;\s]+/).filter(Boolean) : [...DEFAULT_ALLOWLIST];
  return [...new Set(list.map(norm).filter((e) => EMAIL.test(e)))];
}

export type RecipientCheck = { ok: true; recipients: string[] } | { ok: false; blocked: string[]; allowlist: string[]; message: string };

/** Every recipient must be on the allowlist; an empty recipient list is refused too. */
export function checkRecipients(recipients: string[], env: Env = process.env): RecipientCheck {
  const allow = recipientAllowlist(env);
  const list = recipients.map(norm);
  if (!list.length) return { ok: false, blocked: [], allowlist: allow, message: "No recipient." };
  const invalid = list.filter((r) => !EMAIL.test(r));
  if (invalid.length) return { ok: false, blocked: invalid, allowlist: allow, message: `Not an email address: ${invalid.join(", ")}.` };
  const blocked = list.filter((r) => !allow.includes(r));
  if (blocked.length)
    return { ok: false, blocked, allowlist: allow, message: `Blocked: ${blocked.join(", ")} is not on the demo allowlist (DEMO_RECIPIENT_ALLOWLIST: ${allow.join(", ") || "empty"}). During the event only the team may be contacted.` };
  return { ok: true, recipients: list };
}

// ---- explicit approval ----
export const APPROVAL_TTL_MS = 10 * 60 * 1000;
type Approval = { kind: string; hash: string; expiresAt: number };
const g = globalThis as unknown as { __dealdeskApprovals?: Map<string, Approval> };
const approvals = () => (g.__dealdeskApprovals ??= new Map());
export const clearApprovals = () => approvals().clear();

/** Stable hash of the exact payload (key order independent), so an approval covers one message and nothing else. */
export function payloadHash(payload: unknown): string {
  const canon = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v;
  return createHash("sha256").update(JSON.stringify(canon(payload))).digest("hex");
}

/** Called by a preview: returns the token the UI sends back with the "Approve & send" click. */
export function createApproval(kind: string, payload: unknown, now: () => number = Date.now): { token: string; expiresAt: string } {
  const token = randomBytes(18).toString("base64url");
  const expiresAt = now() + APPROVAL_TTL_MS;
  for (const [k, a] of approvals()) if (a.expiresAt <= now()) approvals().delete(k);
  approvals().set(token, { kind, hash: payloadHash(payload), expiresAt });
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

export type ApprovalCheck = { ok: true } | { ok: false; reason: "missing" | "unknown" | "expired" | "mismatch"; message: string };

/** Single use: a valid token is consumed; a token for a different payload or kind is refused (and also consumed). */
export function consumeApproval(token: unknown, kind: string, payload: unknown, now: () => number = Date.now): ApprovalCheck {
  if (typeof token !== "string" || !token) return { ok: false, reason: "missing", message: "Not approved: preview the message and click Approve & send." };
  const a = approvals().get(token);
  if (!a) return { ok: false, reason: "unknown", message: "Approval not recognised (already used, or the server restarted). Preview again and approve." };
  approvals().delete(token);
  if (a.expiresAt <= now()) return { ok: false, reason: "expired", message: "Approval expired (10 minutes). Preview again and approve." };
  if (a.kind !== kind || a.hash !== payloadHash(payload)) return { ok: false, reason: "mismatch", message: "The message changed after it was approved. Preview again and approve." };
  return { ok: true };
}

/** The recipients a live send would refuse (empty = all allowed). Used to label drafts before anyone approves them. */
export function blockedRecipients(to: string[], env: Env = process.env): string[] {
  const allow = recipientAllowlist(env);
  return to.map(norm).filter((r) => !allow.includes(r));
}
