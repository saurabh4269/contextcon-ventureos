import { dealNameFromInbox, normalizeDomain } from "./company";
import type { DealStage, StageRecord } from "@/lib/deals/stage";

export type PipelineDealSource = "inbound" | "opened" | "researched" | "tracked";

export type PipelineDealRow = {
  domain: string;
  name: string;
  href: string;
  source: PipelineDealSource;
  at: string;
  /** from the deal-stage store; absent = never moved (shown as Sourced) */
  stage?: DealStage;
  /** DEALDESK_USER_NAME once a person acted; null/absent = Unassigned */
  owner?: string | null;
  /** the deal workflow for this company, when one exists */
  workflowId?: string;
  /** earliest sign of this company (first memory event, inbox thread or stage move): "new this week" counts this, not `at` */
  firstAt?: string;
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

/** Unique companies from live inbox threads, memory events and the deal-stage store, newest first. Inbox wins on a
 *  name clash; a stage record adds its stage, owner and workflow to the row (or makes a row of its own). */
export function mergePipelineDeals(inbox: InboxDealInput[], memory: MemoryDealInput[], stages: StageRecord[] = []): PipelineDealRow[] {
  const map = new Map<string, PipelineDealRow>();
  const first = new Map<string, string>();
  const seen = (domain: string, at: string | undefined) => { if (at && (!first.has(domain) || at < first.get(domain)!)) first.set(domain, at); };
  for (const e of memory) {
    const source = MEMORY_SOURCE[e.kind];
    if (!source || e.subject?.type !== "company") continue;
    const domain = normalizeDomain(e.subject.id);
    if (!domain) continue;
    seen(domain, e.at);
    const prev = map.get(domain);
    if (prev && prev.at >= e.at) continue;
    map.set(domain, { domain, name: e.subject.label?.trim() || domain, href: href(domain), source, at: e.at });
  }
  for (const t of inbox) {
    const domain = normalizeDomain(t.companyDomain);
    if (!domain) continue;
    seen(domain, t.lastMessageAt);
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
  for (const s of stages) {
    const domain = normalizeDomain(s.domain);
    if (!domain) continue;
    seen(domain, s.history?.[0]?.at ?? s.updatedAt);
    const prev = map.get(domain);
    const at = !prev || s.updatedAt >= prev.at ? s.updatedAt : prev.at;
    map.set(domain, {
      ...(prev ?? { domain, name: s.name?.trim() || domain, href: href(domain), source: "tracked" as const, at }),
      at,
      stage: s.stage,
      owner: s.owner,
      ...(s.workflowId ? { workflowId: s.workflowId, href: `/workflow?id=${encodeURIComponent(s.workflowId)}` } : {}),
    });
  }
  return [...map.values()].map((r) => ({ ...r, firstAt: first.get(r.domain) ?? r.at })).sort((a, b) => b.at.localeCompare(a.at));
}
