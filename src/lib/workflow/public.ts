// What the workflow API returns to a browser. The deploy has no sign-in, so a deal as stored (founder email body,
// sender and recipient addresses) is never sent as is: addresses are masked to their domain and the email body stays
// on the server (its claims are already facts with Gmail citations).
import type { Deal, OutboundDraft } from "./types";

/** "ana.ruiz@acme.example" → "a•••@acme.example" (null stays null). */
export const maskEmail = (a: string | null | undefined): string | null => {
  if (!a) return null;
  const at = a.lastIndexOf("@");
  return at > 0 ? `${a[0]}•••${a.slice(at)}` : "•••";
};
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const maskText = (s: string) => s.replace(EMAIL, (m) => maskEmail(m)!);
const maskDraft = (d: OutboundDraft): OutboundDraft => ({ ...d, to: d.to.map((x) => maskEmail(x)!), body: maskText(d.body), ...(d.blocked ? { blocked: d.blocked.map((x) => maskEmail(x)!) } : {}) });

export function toPublicDeal(d: Deal): Omit<Deal, "email"> & { email?: Omit<NonNullable<Deal["email"]>, "body"> } {
  const { email, ...rest } = d;
  return {
    ...rest,
    ...(email ? { email: { messageId: email.messageId, threadId: email.threadId, from: email.from, fromAddress: maskEmail(email.fromAddress), subject: email.subject, date: email.date } } : {}),
    steps: d.steps.map((s) => ({
      ...s,
      ...(s.summary ? { summary: maskText(s.summary) } : {}),
      ...(s.facts ? { facts: s.facts.map((f) => ({ ...f, value: maskText(f.value) })) } : {}),
      ...(s.draft ? { draft: maskDraft(s.draft) } : {}),
    })),
  };
}
