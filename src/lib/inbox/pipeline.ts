import { dealNameFromInbox, normalizeDomain } from "./company";

export type PipelineDealSource = "inbound" | "opened" | "researched";

export type PipelineDealRow = {
  domain: string;
  name: string;
  href: string;
  source: PipelineDealSource;
  at: string;
};

export type InboxDealInput = {
  companyDomain: string | null;
  subject: string;
  lastMessageAt: string;
};

export type MemoryDealInput = {
  kind: string;
  at: string;
  subject?: { type: string; id: string; label?: string | null } | null;
};

const MEMORY_SOURCE: Record<string, PipelineDealSource> = {
  "deal.opened": "opened",
  "research.run": "researched",
};

function href(domain: string) {
  return `/deal?domain=${encodeURIComponent(domain)}`;
}

/** Unique companies from live inbox threads and memory events, newest first. Inbox wins on a clash. */
export function mergePipelineDeals(inbox: InboxDealInput[], memory: MemoryDealInput[]): PipelineDealRow[] {
  const map = new Map<string, PipelineDealRow>();
  for (const e of memory) {
    const source = MEMORY_SOURCE[e.kind];
    if (!source || e.subject?.type !== "company") continue;
    const domain = normalizeDomain(e.subject.id);
    if (!domain) continue;
    const prev = map.get(domain);
    if (prev && prev.at >= e.at) continue;
    map.set(domain, { domain, name: e.subject.label?.trim() || domain, href: href(domain), source, at: e.at });
  }
  for (const t of inbox) {
    const domain = normalizeDomain(t.companyDomain);
    if (!domain) continue;
    const prev = map.get(domain);
    const name = dealNameFromInbox({ subject: t.subject, domain });
    map.set(domain, {
      domain,
      name: name !== domain ? name : (prev?.name ?? name),
      href: href(domain),
      source: "inbound",
      at: !prev || t.lastMessageAt >= prev.at ? t.lastMessageAt : prev.at,
    });
  }
  return [...map.values()].sort((a, b) => b.at.localeCompare(a.at));
}
