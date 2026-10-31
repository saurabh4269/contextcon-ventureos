// Gmail API v1 (read only in this build — there is deliberately no send path).
//   users.threads.list   GET /gmail/v1/users/me/threads?labelIds=INBOX&q=after:<unix>&maxResults=N
//   users.threads.get    GET /gmail/v1/users/me/threads/{id}?format=metadata&metadataHeaders=From&…Subject&…Date
//   users.getProfile     GET /gmail/v1/users/me/profile (health check)
import { googleJson, type GoogleConfig } from "./oauth";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export type InboxThread = {
  id: string;
  /** display name of the last sender (address kept separately; UIs may show either) */
  from: string;
  fromAddress: string | null;
  subject: string;
  /** UTC ISO of the thread's last message (internalDate) */
  lastMessageAt: string;
  messages: number;
  unread: boolean;
};

type ThreadList = { threads?: { id: string }[]; resultSizeEstimate?: number };
type Thread = { id: string; messages?: { internalDate?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } }[] };

/** "Ana Ruiz <ana@x.com>" → { name: "Ana Ruiz", address: "ana@x.com" } */
export function parseFrom(v: string): { name: string; address: string | null } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(v);
  if (m) return { name: m[1]!.trim() || m[2]!, address: m[2]! };
  return { name: v.trim(), address: v.includes("@") ? v.trim() : null };
}

export function toInboxThread(t: Thread): InboxThread {
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
    lastMessageAt: new Date(Number(last?.internalDate ?? 0)).toISOString(),
    messages: msgs.length,
    unread: msgs.some((m) => m.labelIds?.includes("UNREAD")),
  };
}

export async function listInboxThreads(cfg: GoogleConfig, opts: { after?: Date | null; max: number }, f: typeof fetch = fetch): Promise<{ threads: InboxThread[]; estimate: number }> {
  const qs = new URLSearchParams({ labelIds: "INBOX", maxResults: String(opts.max) });
  if (opts.after) qs.set("q", `after:${Math.floor(opts.after.getTime() / 1000)}`);
  const { data } = await googleJson<ThreadList>(cfg, `${API}/threads?${qs}`, {}, f);
  const ids = (data.threads ?? []).map((t) => t.id);
  const meta = "format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date";
  const threads = await Promise.all(ids.map(async (id) => toInboxThread((await googleJson<Thread>(cfg, `${API}/threads/${encodeURIComponent(id)}?${meta}`, {}, f)).data)));
  threads.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  return { threads, estimate: data.resultSizeEstimate ?? threads.length };
}

export async function gmailProfile(cfg: GoogleConfig, f: typeof fetch = fetch) {
  return (await googleJson<{ messagesTotal?: number; threadsTotal?: number }>(cfg, `${API}/profile`, {}, f)).data;
}
