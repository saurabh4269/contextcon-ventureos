import "server-only";
// Real dependencies for the workflow (Gmail read, Crustdata, decisions, Calendar read, model, firm memory, the durable
// store) and the runner the API uses. Nothing here sends anything; applyAction("approve") in actions.ts is the only
// send path.
//
// Serverless: a run is scheduled with next/server `after()`, so it keeps running after the response on Vercel (up to
// the route's maxDuration); a run that dies with its instance goes stale (RUN_STALE_MS) and can be resumed.
import { after } from "next/server";
import { googleConfig } from "@/lib/google/oauth";
import { getMessage } from "@/lib/google/gmail";
import { listUpcoming } from "@/lib/google/calendar";
import { researchCompany } from "@/lib/live/research";
import { liveCrustdataClient } from "@/lib/live/server";
import { resolveDealNumbers } from "@/lib/numbers/resolve";
import { localDecisions, withBuilder } from "@/lib/numbers/decisions";
import { withReview } from "@/lib/exceptions/decisions";
import { loadExceptionStore } from "@/lib/exceptions/store";
import { modelFromEnv } from "@/lib/agent/model";
import { recipientAllowlist } from "@/lib/outbound";
import { memoryStore } from "@/lib/memory/store";
import { moveStage } from "@/lib/deals/stages";
import { personName } from "./actions";
import { workflowStore } from "./store";
import { advance, type WorkflowDeps } from "./run";
import type { Deal } from "./types";

/** Firm memory for the workflow: the one memory store (Postgres, or the durable store's documents), with its label. */
function firmMemory(): WorkflowDeps["memory"] {
  const m = memoryStore();
  // not configured: every use fails with the reason (the steps that need memory show it) instead of the whole run dying
  if (m.status !== "ok") { const fail = () => Promise.reject(new Error(m.reason)); return { label: "unavailable", append: fail, list: fail }; }
  return { label: m.storage.label, append: (e) => m.store.append(e), list: (limit) => m.store.list({ limit }) };
}

export function serverDeps(): WorkflowDeps {
  const g = googleConfig();
  return {
    getMessage: g ? (id) => getMessage(g, id) : undefined,
    research: (domain) => researchCompany(liveCrustdataClient(), domain),
    // the same decisions as GET /api/deals/:id/decisions (mandate from the one store, review-entered values), read
    // without raising new review items
    async decisions(domain) {
      const store = await loadExceptionStore();
      const r = await resolveDealNumbers(domain, { history: store.list({ status: "all" }).items });
      if (!r.ok) return { error: `${r.response.status} ${((await r.response.json().catch(() => ({}))) as { message?: string }).message ?? ""}`.trim() };
      return withReview(await withBuilder(localDecisions(r.id, r.fields, r.explainable, r.screenerVerdict)), store, { raise: false });
    },
    listUpcoming: g ? (from) => listUpcoming(g, { from, max: 25 }) : undefined,
    model: modelFromEnv(),
    demoRecipient: recipientAllowlist()[0] ?? null,
    memory: firmMemory(),
    onStage: async (deal, stage, by, actor) => {
      if (deal.company.domain) await moveStage({ domain: deal.company.domain, name: deal.company.name, stage, by, actor, workflowId: deal.id, forwardOnly: true });
    },
    person: personName(),
    now: () => new Date(),
    save: (d) => workflowStore.saveGuarded(d), // a copy that another writer superseded stops instead of overwriting
  };
}

// one Set per process (route bundles are separate modules in dev, so it lives on globalThis)
const gl = globalThis as typeof globalThis & { __workflowInFlight?: Set<string> };
const inFlight = (gl.__workflowInFlight ??= new Set<string>());

/** Advance after the response is sent (one run per deal per process). */
export function runInBackground(deal: Deal) {
  if (inFlight.has(deal.id)) return;
  inFlight.add(deal.id);
  const task = () =>
    Promise.resolve()
      .then(() => advance(deal, serverDeps()))
      .catch((e) => console.error(`[workflow] ${deal.id} advance failed: ${e instanceof Error ? e.message : String(e)}`))
      .finally(() => inFlight.delete(deal.id));
  try {
    after(task);
  } catch {
    void task(); // outside a request (scripts): run now
  }
}
export const isRunningHere = (id: string) => inFlight.has(id);
