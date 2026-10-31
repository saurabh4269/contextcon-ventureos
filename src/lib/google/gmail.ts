// Gmail API v1. Read paths feed Today; sendMessage/createDraft are only called by /api/outbound/email, behind
// lib/outbound.ts (dry-run default, recipient allowlist, explicit approval token).
//   users.threads.list   GET /gmail/v1/users/me/threads?labelIds=INBOX&q=after:<unix>&maxResults=N
//   users.threads.get    GET /gmail/v1/users/me/threads/{id}?format=metadata&metadataHeaders=From&…Subject&…Date
//   users.getProfile     GET /gmail/v1/users/me/profile (health check)
import { companyDomainFromInbox } from "@/lib/inbox/company";
import { googleJson, type GoogleConfig } from "./oauth";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export type InboxThread = {
  id: string;
  /** display name of the last sender (address kept separately; UIs may show either) */
  from: string;
  fromAddress: string | null;
  subject: string;
  /** Gmail list snippet (plain text); used only to find a company domain */
  snippet: string;
  /** Company website when the sender host, subject or snippet names one; null for personal mail with no domain */
  companyDomain: string | null;
  /** UTC ISO of the thread's last message (internalDate) */
  lastMessageAt: string;
  messages: number;
  unread: boolean;
};

type ThreadList = { threads?: { id: string; snippet?: string }[]; resultSizeEstimate?: number };
type Thread = { id: string; messages?: { internalDate?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } }[] };

/** "Ana Ruiz <ana@x.com>" → { name: "Ana Ruiz", address: "ana@x.com" } */
export function parseFrom(v: string): { name: string; address: string | null } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(v);
  if (m) return { name: m[1]!.trim() || m[2]!, address: m[2]! };
  return { name: v.trim(), address: v.includes("@") ? v.trim() : null };
}

export function toInboxThread(t: Thread, snippet = ""): InboxThread {
  const msgs = t.messages ?? [];
  const last = msgs.at(-1);
  const h = (name: string) => last?.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  const from = parseFrom(h("From"));
  const subject = h("Subject") || msgs[0]?.payload?.headers?.find((x) => x.name.toLowerCase() === "subject")?.value || "(no subject)";
  return {
    id: t.id,
    from: from.name || "(unknown sender)",
    fromAddress: from.address,
    subject,
    snippet,
    companyDomain: companyDomainFromInbox({ fromAddress: from.address, subject, snippet }),
    lastMessageAt: new Date(Number(last?.internalDate ?? 0)).toISOString(),
    messages: msgs.length,
    unread: msgs.some((m) => m.labelIds?.includes("UNREAD")),
  };
}

export async function listInboxThreads(cfg: GoogleConfig, opts: { after?: Date | null; max: number }, f: typeof fetch = fetch): Promise<{ threads: InboxThread[]; estimate: number }> {
  const qs = new URLSearchParams({ labelIds: "INBOX", maxResults: String(opts.max) });
  if (opts.after) qs.set("q", `after:${Math.floor(opts.after.getTime() / 1000)}`);
  const { data } = await googleJson<ThreadList>(cfg, `${API}/threads?${qs}`, {}, f);
  const listed = data.threads ?? [];
  const snippetOf = Object.fromEntries(listed.map((t) => [t.id, t.snippet ?? ""]));
  const meta = "format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date";
  const threads = await Promise.all(listed.map(async (row) => toInboxThread((await googleJson<Thread>(cfg, `${API}/threads/${encodeURIComponent(row.id)}?${meta}`, {}, f)).data, snippetOf[row.id] ?? "")));
  threads.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  return { threads, estimate: data.resultSizeEstimate ?? threads.length };
}

export async function gmailProfile(cfg: GoogleConfig, f: typeof fetch = fetch) {
  return (await googleJson<{ emailAddress?: string; messagesTotal?: number; threadsTotal?: number }>(cfg, `${API}/profile`, {}, f)).data;
}

/** RFC 2822 message, base64url (users.messages.send / drafts.create `raw`). Subject is RFC 2047-encoded for non-ASCII. */
export function buildRawMessage(m: { to: string[]; subject: string; body: string; from?: string }): string {
  const subject = /^[\x20-\x7e]*$/.test(m.subject) ? m.subject : `=?UTF-8?B?${Buffer.from(m.subject, "utf8").toString("base64")}?=`;
  const headers = [
    ...(m.from ? [`From: ${m.from}`] : []),
    `To: ${m.to.join(", ")}`,
    `Subject: ${subject.replace(/[\r\n]+/g, " ")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
  ];
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${m.body}`, "utf8").toString("base64url");
}

export type SentMessage = { id: string; threadId: string | null };
export async function sendMessage(cfg: GoogleConfig, m: { to: string[]; subject: string; body: string }, f: typeof fetch = fetch): Promise<SentMessage> {
  const { data } = await googleJson<{ id: string; threadId?: string }>(cfg, `${API}/messages/send`, { method: "POST", body: JSON.stringify({ raw: buildRawMessage(m) }) }, f);
  return { id: data.id, threadId: data.threadId ?? null };
}
export async function createDraft(cfg: GoogleConfig, m: { to: string[]; subject: string; body: string }, f: typeof fetch = fetch): Promise<{ id: string; messageId: string | null }> {
  const { data } = await googleJson<{ id: string; message?: { id?: string } }>(cfg, `${API}/drafts`, { method: "POST", body: JSON.stringify({ message: { raw: buildRawMessage(m) } }) }, f);
  return { id: data.id, messageId: data.message?.id ?? null };
}
