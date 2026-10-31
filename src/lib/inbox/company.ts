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
  "rocketmail.com",
  "fastmail.com",
  "hey.com",
  "tutanota.com",
  "zohomail.in",
  "outlook.in",
  "hotmail.in",
  "live.in",
  "yahoo.in",
  "yahoo.co.in",
  "yahoo.co.uk",
  "hotmail.co.uk",
]);

/** Consumer mail with a country variant (yahoo.fr, hotmail.de, outlook.com.au, gmx.net, live.co.uk ...). */
const CONSUMER_MAIL_FAMILY = /^(?:yahoo|ymail|hotmail|outlook|live|msn|gmx|aol|icloud|rediffmail|protonmail|zohomail)\.[a-z]{2,3}(?:\.[a-z]{2})?$/;

/** Hosts that are never "the company": mail and calendar providers, video-call links, social networks, doc sharing,
 *  link shorteners and click-tracking redirectors, bulk-mail senders, and shared hosting platforms (a `x.vercel.app`
 *  site is not vercel.app). Subdomains are included. */
const NON_COMPANY_HOST =
  /(^|\.)(google\.com|googleusercontent\.com|gstatic\.com|goo\.gl|gmail\.com|googlemail\.com|youtube\.com|youtu\.be|microsoft\.com|office\.com|office365\.com|outlook\.com|live\.com|sharepoint\.com|onedrive\.com|apple\.com|icloud\.com|zoom\.us|zoom\.com|zoomgov\.com|webex\.com|whereby\.com|gotomeeting\.com|bluejeans\.com|loom\.com|calendly\.com|cal\.com|savvycal\.com|chilipiper\.com|docsend\.com|dropbox\.com|box\.com|notion\.so|notion\.site|docusign\.net|docusign\.com|typeform\.com|airtable\.com|figma\.com|canva\.com|slack\.com|linkedin\.com|lnkd\.in|twitter\.com|x\.com|t\.co|facebook\.com|instagram\.com|github\.com|medium\.com|substack\.com|beehiiv\.com|bit\.ly|tinyurl\.com|ow\.ly|buff\.ly|crustdata\.com|mailchimp\.com|mailchi\.mp|list-manage\.com|sendgrid\.net|sendgrid\.com|mandrillapp\.com|mailgun\.org|mailgun\.com|amazonses\.com|sparkpostmail\.com|hubspotemail\.net|hs-sites\.com|hubspot\.com|intercom-mail\.com|customeriomail\.com|sendinblue\.com|brevo\.com|mktomail\.com|constantcontact\.com|ctctcloud\.com|campaign-archive\.com|rs6\.net|postmarkapp\.com|sailthru\.com|vercel\.app|netlify\.app|github\.io|herokuapp\.com|webflow\.io|carrd\.co|framer\.website|framer\.app|pages\.dev|web\.app|firebaseapp\.com|wixsite\.com|squarespace\.com|blogspot\.com|wordpress\.com)$/i;

/** Public-suffix second levels under a two-letter country code (acme.co.in, acme.com.au, acme.org.uk). */
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "ac", "gov", "edu", "ltd", "plc", "nic", "ne", "or", "go", "sch"]);
const GENERIC_TLD = new Set("com net org io ai co app dev tech so xyz info biz vc fund capital ventures health bio cloud tv me site online store shop studio labs systems software finance money pay global network digital tools agency design media group solutions center works space life world live team company fm gg to sh".split(" "));
const CC_TLD = new Set("ac ad ae af ag ai al am ao ar as at au aw ax az ba bb bd be bf bg bh bi bj bm bn bo br bs bt bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg er es et eu fi fj fk fm fo fr ga gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sk sl sm sn so sr ss st su sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug uk us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw".split(" "));

/** ASCII (punycode) lower-case host, or null when it is not a plausible host with a real top-level domain. */
export function asciiHost(raw: string): string | null {
  let h = raw.trim().toLowerCase().replace(/\.+$/, "");
  if (!h || h.length > 253) return null;
  try { h = new URL(`http://${h}`).hostname; } catch { return null; }
  const labels = h.split(".");
  if (labels.length < 2) return null;
  const tld = labels[labels.length - 1]!;
  if (!(GENERIC_TLD.has(tld) || CC_TLD.has(tld) || /^xn--[a-z0-9-]+$/.test(tld))) return null;
  return h;
}

/** acme.co.in for mail.acme.co.in / em.acme.co.in; acme.com for mail.acme.com. */
export function registrableDomain(host: string): string {
  const labels = host.replace(/^www\./, "").split(".");
  if (labels.length <= 2) return labels.join(".");
  const tld = labels[labels.length - 1]!;
  const sld = labels[labels.length - 2]!;
  const keep = tld.length === 2 && SECOND_LEVEL.has(sld) ? 3 : 2;
  return labels.slice(-keep).join(".");
}

/** True for a host that can be a company's own website (not mail, calendar, video, social, tracking or hosting). */
export function isCompanyHost(host: string): boolean {
  const h = host.toLowerCase();
  return !CONSUMER_MAIL_HOSTS.has(h) && !CONSUMER_MAIL_FAMILY.test(registrableDomain(h)) && !CONSUMER_MAIL_HOSTS.has(registrableDomain(h)) && !NON_COMPANY_HOST.test(h);
}

const HOST_IN_TEXT = /(?<![@\p{L}\p{N}._-])(?:https?:\/\/)?(?:www\.)?((?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+[\p{L}\p{N}-]{2,24})(?::\d{1,5})?(?![\p{L}\p{N}@-])/giu;

/** Company website for a mail: the sender's registrable domain unless it is consumer mail or infrastructure, else the
 *  first company-looking host written in `texts` (URLs, bare domains; email addresses and tracking hosts skipped). */
export function pickCompanyDomain(fromAddress: string | null | undefined, texts: string[]): string | null {
  const fromHost = fromAddress ? asciiHost((fromAddress.split("@").pop() ?? "").replace(/[^\p{L}\p{N}.-]/gu, "")) : null;
  if (fromHost && isCompanyHost(registrableDomain(fromHost)) && isCompanyHost(fromHost)) return registrableDomain(fromHost);
  for (const t of texts) {
    for (const m of (t ?? "").matchAll(HOST_IN_TEXT)) {
      const h = asciiHost(m[1]!);
      if (h && isCompanyHost(h) && isCompanyHost(registrableDomain(h))) return registrableDomain(h);
    }
  }
  return null;
}


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

/** Company website from the sender's host, then any domain written in the subject or snippet. */
export function companyDomainFromInbox(input: { fromAddress?: string | null; subject?: string | null; snippet?: string | null }): string | null {
  return pickCompanyDomain(input.fromAddress, [input.subject ?? "", input.snippet ?? ""]);
}

/** Reply / forward markers and "Intro:" style labels at the start of a subject (any order, repeated). */
const SUBJECT_PREFIX = /^\s*(?:(?:re|fwd?|aw|wg|sv|vs|tr|rv|enc|\[?ext(?:ernal)?\]?)\s*(?:\[\d+\])?\s*:|(?:intro(?:duction)?|warm intro|quick intro|referral)\s*:)\s*/i;
/** Invisible and bidi-control characters that can reorder or hide text in a subject line. */
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;

/** Display name for a pipeline row: leftover subject words, else the domain. Never invents a company. */
export function dealNameFromInbox(input: { subject: string; domain: string }): string {
  let raw = input.subject.replace(INVISIBLE, " ").trim();
  for (let i = 0; i < 8 && SUBJECT_PREFIX.test(raw); i++) raw = raw.replace(SUBJECT_PREFIX, "");
  if (!raw || /^\(?no subject\)?$/i.test(raw)) return input.domain;
  const stripped = raw
    .replace(/https?:\/\/(www\.)?/gi, "")
    .replace(new RegExp(input.domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ")
    .replace(/[()[\]<>|–—_]+/g, " ")
    .replace(/(^|\s)-+(?=\s|$)/g, " ") // a spaced dash is a separator; the hyphen in "Stack-AI" stays
    .replace(/\s+/g, " ")
    .trim();
  if (stripped && !/^\(?no subject\)?$/i.test(stripped) && stripped.length >= 2 && stripped.length <= 80) return stripped;
  return input.domain;
}
