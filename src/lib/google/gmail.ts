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

/** "Ana Ruiz <ana@x.com>" → { name: "Ana Ruiz", address: "ana@x.com" }. Also bare, legacy "ana@x.com (Ana Ruiz)" and
 *  a display name that itself contains an address ("ana@x.com" <ana@x.com>). */
export function parseFrom(v: string): { name: string; address: string | null } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(v);
  if (m) { const address = m[2]!.trim(); return { name: m[1]!.trim() || address, address }; }
  const bare = /[^\s<>"(),;]+@[^\s<>"(),;]+/.exec(v);
  const paren = /\(([^)]*)\)/.exec(v);
  return { name: (paren?.[1]?.trim() || bare?.[0] || v.trim()), address: bare ? bare[0] : null };
}

/** null when the thread has no usable time (no internalDate, no valid Date header): it cannot be placed in a window, so
 *  it is dropped rather than shown as 1 Jan 1970. */
export function toInboxThread(t: Thread, snippet = ""): InboxThread | null {
  const msgs = t.messages ?? [];
  const last = msgs.at(-1);
  const h = (name: string) => last?.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  // the company is whoever wrote to us: skip the investor's own replies (SENT) when an earlier message is from the other side
  const theirs = [...msgs].reverse().find((x) => !x.labelIds?.includes("SENT") && !x.labelIds?.includes("DRAFT"));
  const fromHeader = (theirs ?? last)?.payload?.headers?.find((x) => x.name.toLowerCase() === "from")?.value ?? "";
  const from = parseFrom(fromHeader || h("From"));
  const subject = h("Subject") || msgs[0]?.payload?.headers?.find((x) => x.name.toLowerCase() === "subject")?.value || "(no subject)";
  const internal = Number(last?.internalDate);
  const dated = Number.isFinite(internal) && internal > 0 ? internal : Date.parse(h("Date"));
  if (!Number.isFinite(dated)) return null;
  return {
    id: t.id,
    from: from.name || "(unknown sender)",
    fromAddress: from.address,
    subject,
    snippet,
    companyDomain: companyDomainFromInbox({ fromAddress: from.address, subject, snippet }),
    lastMessageAt: new Date(dated).toISOString(),
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
  const threads = (await Promise.all(listed.map(async (row) => toInboxThread((await googleJson<Thread>(cfg, `${API}/threads/${encodeURIComponent(row.id)}?${meta}`, {}, f)).data, snippetOf[row.id] ?? "")))).filter((t): t is InboxThread => t !== null);
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

// ── Deal workflow (src/lib/workflow): read one message in full and search by query (read only).
// users.messages.list GET /gmail/v1/users/me/messages?q=…  ·  users.messages.get GET …/messages/{id}?format=full
// https://developers.google.com/gmail/api/reference/rest/v1/users.messages. A workflow send goes through sendMessage above.
export type GmailMessage = { id: string; threadId: string; from: string; fromAddress: string | null; to: string; subject: string; date: string; body: string; snippet: string };
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[]; headers?: { name: string; value: string }[] };
const b64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

/** text/plain parts first; text/html stripped to text as a fallback. */
export function messageText(p: Part | undefined): string {
  if (!p) return "";
  const plain: string[] = [], html: string[] = [];
  const walk = (x: Part) => {
    if (x.body?.data && x.mimeType === "text/plain") plain.push(b64url(x.body.data));
    else if (x.body?.data && x.mimeType === "text/html") html.push(b64url(x.body.data));
    x.parts?.forEach(walk);
  };
  walk(p);
  if (plain.length) return plain.join("\n").trim();
  return htmlToText(html.join("\n"));
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ndash: "–", mdash: "—", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: "…", euro: "€", pound: "£", rupee: "₹" };
/** HTML mail to plain text: block tags become line breaks (so "60</div><div>engineers" does not fuse), link targets are
 *  kept as "text (url)" (the company site is often only a link), entities are decoded. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) => (/^https?:/i.test(href) ? `${text} (${href})` : text))
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6]|table|ul|ol|blockquote)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") { const cp = e[1]!.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : m; }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function getMessage(cfg: GoogleConfig, id: string, f: typeof fetch = fetch): Promise<GmailMessage> {
  const { data } = await googleJson<{ id: string; threadId: string; snippet?: string; internalDate?: string; payload?: Part }>(cfg, `${API}/messages/${encodeURIComponent(id)}?format=full`, {}, f);
  const h = (n: string) => data.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
  const from = parseFrom(h("from"));
  return { id: data.id, threadId: data.threadId, from: from.name, fromAddress: from.address, to: h("to"), subject: h("subject") || "(no subject)", date: data.internalDate ? new Date(Number(data.internalDate)).toISOString() : "", body: messageText(data.payload).slice(0, 20_000), snippet: data.snippet ?? "" };
}

export async function searchMessages(cfg: GoogleConfig, q: string, max: number, f: typeof fetch = fetch): Promise<{ id: string; threadId: string }[]> {
  const qs = new URLSearchParams({ q, maxResults: String(max) });
  const { data } = await googleJson<{ messages?: { id: string; threadId: string }[] }>(cfg, `${API}/messages?${qs}`, {}, f);
  return data.messages ?? [];
}
