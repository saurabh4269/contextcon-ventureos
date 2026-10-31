// Organizational memory: an append-only log of user and agent actions (research runs, connector checks, deals opened,
// notes, approvals …). Contract in docs/API.md ("Memory"). This repo only stores and lists events; deriving firm
// knowledge from them is the builder backend's job.

export type ActorType = "user" | "agent" | "system";
export type MemoryActor = { type: ActorType; id?: string | null; name?: string | null };
export type MemorySubject = { type: string; id: string; label?: string | null };

export type MemoryEventInput = {
  /** dotted verb, e.g. "research.run", "deal.opened", "connector.check", "note.added" */
  kind: string;
  actor: MemoryActor;
  subject?: MemorySubject | null;
  /** one human-readable line */
  summary: string;
  /** small structured payload (≤ 8 KB JSON) */
  data?: Record<string, unknown> | null;
  /** where the event was recorded, e.g. "ui:/deal" or "api:/api/live/research" */
  source: string;
};

export type MemoryEvent = MemoryEventInput & {
  /** monotonically increasing id (string; use as the `since` cursor) */
  id: string;
  /** UTC ISO timestamp assigned by the store */
  at: string;
};

export type MemoryUnavailable = { status: "unavailable"; reason: string };

const KIND = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
const MAX_DATA = 8 * 1024;
const MAX_SUMMARY = 500;
const MAX_TEXT = 300;

const text = (v: unknown, max = MAX_TEXT): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Validate an untrusted POST body. Returns the normalized input or a message. */
export function parseMemoryEventInput(body: unknown): { ok: true; input: MemoryEventInput } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "body must be a JSON object" };
  const b = body as Record<string, unknown>;
  const kind = typeof b.kind === "string" ? b.kind.trim() : "";
  if (!KIND.test(kind) || kind.length > 64) return { ok: false, message: 'kind must be a dotted lowercase verb like "deal.opened"' };
  const actor = b.actor as Record<string, unknown> | undefined;
  if (!actor || !["user", "agent", "system"].includes(actor.type as string)) return { ok: false, message: 'actor.type must be "user", "agent" or "system"' };
  const summary = text(b.summary, MAX_SUMMARY);
  if (!summary) return { ok: false, message: "summary is required" };
  const source = text(b.source);
  if (!source) return { ok: false, message: "source is required" };
  let subject: MemorySubject | null = null;
  if (b.subject != null) {
    const s = b.subject as Record<string, unknown>;
    const type = text(s.type), id = text(s.id);
    if (!type || !id) return { ok: false, message: "subject needs type and id" };
    subject = { type, id, label: text(s.label) };
  }
  let data: Record<string, unknown> | null = null;
  if (b.data != null) {
    if (typeof b.data !== "object" || Array.isArray(b.data)) return { ok: false, message: "data must be an object" };
    if (JSON.stringify(b.data).length > MAX_DATA) return { ok: false, message: `data must be at most ${MAX_DATA} bytes of JSON` };
    data = b.data as Record<string, unknown>;
  }
  return {
    ok: true,
    input: { kind, actor: { type: actor.type as ActorType, id: text(actor.id), name: text(actor.name) }, subject, summary, data, source },
  };
}

/** `since` cursor: an event id (bigint in Postgres), so at most 18 digits; longer would overflow into a store error (502). */
export const isEventId = (v: string) => /^\d{1,18}$/.test(v);
