// Pure transcript post-correction (shared by the STT route and the agent's client tools; safe in the client bundle).
/* ── post-correction for domain words Scribe still mangles (keyterms make these rare; this is the safety net) ── */
const FIXES: [RegExp, string][] = [
  [/\bcrust[\s-]?data\b/gi, "Crustdata"],
  [/\bcrust\s+(?:that|dad|date|dater)\b/gi, "Crustdata"],
  [/\bdeal[\s-]?desk\b/gi, "Deal Desk"],
  [/\bb\s*(?:2|to|two)\s*b\b/gi, "B2B"],
  [/\bb\s*(?:2|to|two)\s*c\b/gi, "B2C"],
  [/\b(?:saas|sass|sas)\b/gi, "SaaS"],
  [/\bseries\s+(a|b|c|d)\b/gi, "Series $1"],
  [/\ba\s*r\s*r\b/gi, "ARR"],
  [/\by\s*combinator\b/gi, "Y Combinator"],
  [/\blinked\s*in\b/gi, "LinkedIn"],
];

export function correctTranscript(text: string): string {
  let out = text;
  for (const [re, to] of FIXES) out = out.replace(re, (...m) => to.replace("$1", String(m[1] ?? "").toUpperCase()));
  return out.replace(/\s+/g, " ").trim();
}

