// Turn a live inbox thread into a company domain when the mail itself names one.
// Consumer mailboxes (Gmail, Outlook, …) are never treated as a company. No hard-coded companies.

/** Hosts that are personal / shared mail, not a company's website. */
export const CONSUMER_MAIL_HOSTS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "zoho.com",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "qq.com",
  "163.com",
  "rediffmail.com",
]);

const DOMAIN_RE = /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)\b/gi;
const FILE_SUFFIX = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "csv", "txt", "mp4", "mov"]);

/** Lowercase host without a leading www. Empty when the token is not a usable website domain. */
export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";
  d = d.replace(/[)>.,;:]+$/, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return null;
  const last = d.split(".").pop() ?? "";
  if (FILE_SUFFIX.has(last)) return null;
  if (CONSUMER_MAIL_HOSTS.has(d)) return null;
  return d;
}

function firstDomainIn(text: string): string | null {
  if (!text) return null;
  DOMAIN_RE.lastIndex = 0;
  for (let m = DOMAIN_RE.exec(text); m; m = DOMAIN_RE.exec(text)) {
    const d = normalizeDomain(m[1]);
    if (d) return d;
  }
  return null;
}

/** Company website from the sender's host, then any domain written in the subject or snippet. */
export function companyDomainFromInbox(input: { fromAddress?: string | null; subject?: string | null; snippet?: string | null }): string | null {
  const host = input.fromAddress?.split("@")[1];
  return normalizeDomain(host) ?? firstDomainIn(input.subject ?? "") ?? firstDomainIn(input.snippet ?? "");
}

/** Display name for a pipeline row: leftover subject words, else the domain. Never invents a company. */
export function dealNameFromInbox(input: { subject: string; domain: string }): string {
  const raw = input.subject.trim();
  if (!raw || /^\(?no subject\)?$/i.test(raw)) return input.domain;
  const stripped = raw
    .replace(/https?:\/\/(www\.)?/gi, "")
    .replace(new RegExp(input.domain.replace(/\./g, "\\."), "ig"), " ")
    .replace(/[()[\]<>|–—_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped && !/^\(?no subject\)?$/i.test(stripped) && stripped.length >= 2 && stripped.length <= 80) return stripped;
  return input.domain;
}
