// Postgres memory store (the `postgres` driver). The table is created on first use. Timestamps are timestamptz,
// serialized as UTC ISO strings.
import postgres from "postgres";
import type { MemoryEvent, MemoryEventInput } from "./types";
import type { MemoryStore } from "./store";

export const MEMORY_TABLE = "dealdesk_memory_events";

type Row = {
  id: string;
  at: Date;
  kind: string;
  actor_type: MemoryEvent["actor"]["type"];
  actor_id: string | null;
  actor_name: string | null;
  subject_type: string | null;
  subject_id: string | null;
  subject_label: string | null;
  summary: string;
  data: Record<string, unknown> | null;
  source: string;
};

export const toEvent = (r: Row): MemoryEvent => ({
  id: String(r.id),
  at: new Date(r.at).toISOString(),
  kind: r.kind,
  actor: { type: r.actor_type, id: r.actor_id, name: r.actor_name },
  subject: r.subject_type && r.subject_id ? { type: r.subject_type, id: r.subject_id, label: r.subject_label } : null,
  summary: r.summary,
  data: r.data,
  source: r.source,
});

export function createPostgresMemoryStore(url: string, opts: { max?: number } = {}): MemoryStore & { end(): Promise<void> } {
  const sql = postgres(url, { max: opts.max ?? 5, idle_timeout: 30, connect_timeout: 10, onnotice: () => {} });
  let ready: Promise<unknown> | null = null;
  const ensure = () =>
    (ready ??= sql
      .unsafe(
        `create table if not exists ${MEMORY_TABLE} (
           id bigserial primary key,
           at timestamptz not null default now(),
           kind text not null,
           actor_type text not null check (actor_type in ('user','agent','system')),
           actor_id text,
           actor_name text,
           subject_type text,
           subject_id text,
           subject_label text,
           summary text not null,
           data jsonb,
           source text not null
         );
         create index if not exists ${MEMORY_TABLE}_subject_idx on ${MEMORY_TABLE} (subject_type, subject_id, id);`,
      )
      .catch((e) => {
        ready = null; // retry on the next call instead of caching the failure
        throw e;
      }));

  return {
    async append(e: MemoryEventInput) {
      await ensure();
      const [row] = await sql<Row[]>`
        insert into ${sql(MEMORY_TABLE)} (kind, actor_type, actor_id, actor_name, subject_type, subject_id, subject_label, summary, data, source)
        values (${e.kind}, ${e.actor.type}, ${e.actor.id ?? null}, ${e.actor.name ?? null}, ${e.subject?.type ?? null}, ${e.subject?.id ?? null},
                ${e.subject?.label ?? null}, ${e.summary}, ${e.data ? sql.json(e.data as postgres.JSONValue) : null}, ${e.source})
        returning *`;
      return toEvent(row!);
    },
    async list({ sinceId, limit }) {
      await ensure();
      const rows = sinceId
        ? await sql<Row[]>`select * from ${sql(MEMORY_TABLE)} where id > ${sinceId} order by id asc limit ${limit}`
        : await sql<Row[]>`select * from (select * from ${sql(MEMORY_TABLE)} order by id desc limit ${limit}) t order by id asc`;
      return rows.map(toEvent);
    },
    end: () => sql.end({ timeout: 5 }),
  };
}
