// Pure helpers: which company an inbound email is about, and which checkable claims it makes.
const FREEMAIL = new Set(["gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me", "protonmail.com", "live.com", "aol.com", "yahoo.co.in", "rediffmail.com"]);
const NOT_COMPANY = /(^|\.)(google\.com|gmail\.com|linkedin\.com|calendly\.com|docsend\.com|notion\.so|drive\.google\.com|youtube\.com|twitter\.com|x\.com|zoom\.us|loom\.com|crustdata\.com|github\.com|medium\.com|bit\.ly|facebook\.com|instagram\.com)$/i;

export function companyDomainFrom(email: { fromAddress: string | null; subject: string; body: string }): string | null {
  const sender = email.fromAddress?.split("@")[1]?.toLowerCase();
  if (sender && !FREEMAIL.has(sender) && !NOT_COMPANY.test(sender)) return sender.replace(/^mail\./, "");
  const text = `${email.subject}\n${email.body}`;
  const re = /\b(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9-]+\.)+(?:ai|com|io|in|co|app|dev|tech|so|xyz|org|net))\b/gi;
  for (const m of text.matchAll(re)) {
    const d = m[1]!.toLowerCase();
    if (FREEMAIL.has(d) || NOT_COMPANY.test(d) || /@/.test(text.slice(Math.max(0, m.index! - 1), m.index!))) continue;
    return d;
  }
  return null;
}

export type Claim = { key: "growth_mom" | "growth_6m" | "growth_yoy" | "headcount" | "founded" | "raised"; text: string; value: number };

const num = (s: string) => Number(s.replace(/,/g, ""));
export function extractClaims(text: string): Claim[] {
  const out: Claim[] = [];
  const push = (key: Claim["key"], m: RegExpMatchArray | null, value: number) => { if (m && Number.isFinite(value) && !out.some((c) => c.key === key)) out.push({ key, text: m[0].trim(), value }); };
  let m = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:mom|m-o-m|month[- ]over[- ]month|monthly|per month|a month)(?:\s+growth)?/i) ?? text.match(/(?:growing|grew|growth of)\s*(\d+(?:\.\d+)?)\s*%\s*(?:mom|monthly|per month|a month|month on month)/i);
  push("growth_mom", m, m ? num(m[1]!) : NaN);
  m = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:growth\s*)?(?:in|over)\s*(?:the\s*)?(?:last|past)\s*(?:6|six)\s*months/i);
  push("growth_6m", m, m ? num(m[1]!) : NaN);
  m = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:yoy|y-o-y|year[- ]over[- ]year|annual)/i);
  push("growth_yoy", m, m ? num(m[1]!) : NaN);
  m = text.match(/team of\s*(\d[\d,]*)/i) ?? text.match(/(\d[\d,]*)\s*(?:\+\s*)?(?:employees|people|team members|engineers|member team|person team)/i);
  push("headcount", m, m ? num(m[1]!) : NaN);
  m = text.match(/(?:founded|started|incorporated|launched)\s*(?:in\s*)?((?:19|20)\d{2})/i);
  push("founded", m, m ? num(m[1]!) : NaN);
  m = text.match(/raised\s*(?:a\s*)?(?:us)?\$\s*(\d+(?:\.\d+)?)\s*(m|mn|million|k|thousand|b|bn|billion)?/i);
  if (m) {
    const u = (m[2] ?? "").toLowerCase();
    const mult = u.startsWith("b") ? 1e9 : u.startsWith("m") ? 1e6 : u.startsWith("k") || u.startsWith("t") ? 1e3 : 1;
    push("raised", m, num(m[1]!) * mult);
  }
  return out;
}
