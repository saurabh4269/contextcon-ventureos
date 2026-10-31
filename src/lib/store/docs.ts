// The durable server store: JSON documents by (namespace, id). One abstraction for the review queue, deal stages,
// deal workflows, the firm mandate and (without a database) organizational memory.
//   · Postgres when DATABASE_URL (or POSTGRES_URL) is set: table dealdesk_docs, created on first use. Durable and
//     shared by every server instance.
//   · Otherwise JSON files, one per namespace: DEALDESK_DATA_DIR, else .cache/ in the project, else (on Vercel) /tmp.
//     Locally that is durable for the one dev server. On Vercel each instance has its own /tmp and loses it on a cold
//     start, so StorageInfo says "not durable on this deploy" and the UI shows that note.
//   · DEALDESK_STORE=memory keeps everything in this process only (tests).
// Nothing here logs or returns the database URL; StorageInfo names the env var only.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";

type Env = Record<string, string | undefined>;

/** Env var names that carry a Postgres URL, in order of preference (Neon via the Vercel Marketplace sets both). */
export const DATABASE_ENV = ["DATABASE_URL", "POSTGRES_URL"] as const;
export const DOCS_TABLE = "dealdesk_docs";

export function databaseUrl(env: Env = process.env): { name: (typeof DATABASE_ENV)[number]; url: string } | null {
  for (const name of DATABASE_ENV) {
    const url = env[name]?.trim();
    if (url) return { name, url };
  }
  return null;
}

export type StorageInfo = {
  kind: "postgres" | "file" | "memory";
  /** true when every server instance sees the same data and it survives restarts */
  durable: boolean;
  /** short label for the UI, e.g. "Postgres (DATABASE_URL)" */
  label: string;
  /** one honest sentence for the UI */
  note: string;
  /** file backend: the directory (relative to the project when inside it) */
  path?: string;
};

export type DocRow<T> = { id: string; doc: T; createdAt: string; updatedAt: string };

export interface DocStore {
  info(): StorageInfo;
  /** All documents of a namespace, oldest first (creation order). */
  list<T>(ns: string): Promise<DocRow<T>[]>;
  get<T>(ns: string, id: string): Promise<T | null>;
  put<T>(ns: string, id: string, doc: T): Promise<void>;
  putMany<T>(ns: string, rows: { id: string; doc: T }[]): Promise<void>;
  remove(ns: string, id: string): Promise<void>;
}

const NS = /^[a-z][a-z0-9_]{0,40}$/;
const checkNs = (ns: string) => {
  if (!NS.test(ns)) throw new Error(`bad store namespace "${ns}"`);
  return ns;
};
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/* ───────── memory (tests, DEALDESK_STORE=memory) ───────── */
export function createMemoryDocStore(label = "process memory (DEALDESK_STORE=memory)"): DocStore & { clear(): void } {
  const data = new Map<string, DocRow<unknown>[]>();
  const rows = (ns: string) => data.get(checkNs(ns)) ?? data.set(ns, []).get(ns)!;
  const upsert = (ns: string, id: string, doc: unknown, at: string) => {
    const xs = rows(ns), i = xs.findIndex((r) => r.id === id);
    if (i >= 0) xs[i] = { ...xs[i]!, doc: copy(doc), updatedAt: at };
    else xs.push({ id, doc: copy(doc), createdAt: at, updatedAt: at });
  };
  return {
    info: () => ({ kind: "memory", durable: false, label, note: `Kept in this server process only (${label}); lost on restart.` }),
    async list<T>(ns: string) { return copy(rows(ns)) as DocRow<T>[]; },
    async get<T>(ns: string, id: string) { const r = rows(ns).find((x) => x.id === id); return r ? (copy(r.doc) as T) : null; },
    async put(ns, id, doc) { upsert(ns, id, doc, new Date().toISOString()); },
    async putMany(ns, list) { const at = new Date().toISOString(); for (const r of list) upsert(ns, r.id, r.doc, at); },
    async remove(ns, id) { const xs = rows(ns), i = xs.findIndex((r) => r.id === id); if (i >= 0) xs.splice(i, 1); },
    clear: () => data.clear(),
  };
}

/* ───────── JSON files ───────── */
export function dataDir(env: Env = process.env, cwd = process.cwd()): string {
  const o = env.DEALDESK_DATA_DIR?.trim();
  if (o) return o;
  return env.VERCEL ? path.join(os.tmpdir(), "dealdesk") : path.join(cwd, ".cache");
}

export function createFileDocStore(dir: string, opts: { serverless?: boolean } = {}): DocStore {
  // Files are re-read on every call (another route bundle or process may have written them). If a write fails (a
  // read-only filesystem), the namespace keeps working from this process's copy and the note says so.
  const overlay = new Map<string, DocRow<unknown>[]>();
  let writeError: string | null = null;
  const file = (ns: string) => path.join(dir, `${checkNs(ns)}.json`);
  const read = (ns: string): DocRow<unknown>[] => {
    checkNs(ns);
    if (overlay.has(ns)) return overlay.get(ns)!;
    try {
      const raw = JSON.parse(fs.readFileSync(file(ns), "utf8")) as unknown;
      return Array.isArray(raw) ? (raw as DocRow<unknown>[]).filter((r) => r && typeof r.id === "string") : [];
    } catch {
      return [];
    }
  };
  const write = (ns: string, rows: DocRow<unknown>[]) => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const tmp = `${file(ns)}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(rows));
      fs.renameSync(tmp, file(ns));
      overlay.delete(ns);
    } catch (e) {
      writeError = e instanceof Error ? e.message : String(e);
      overlay.set(ns, rows);
    }
  };
  const upsert = (ns: string, list: { id: string; doc: unknown }[]) => {
    const rows = [...read(ns)], at = new Date().toISOString();
    for (const r of list) {
      const i = rows.findIndex((x) => x.id === r.id);
      if (i >= 0) rows[i] = { ...rows[i]!, doc: copy(r.doc), updatedAt: at };
      else rows.push({ id: r.id, doc: copy(r.doc), createdAt: at, updatedAt: at });
    }
    write(ns, rows);
  };
  const shown = path.relative(process.cwd(), dir);
  const where = shown && !shown.startsWith("..") ? shown : dir;
  return {
    info(): StorageInfo {
      if (writeError) return { kind: "memory", durable: false, label: "Server memory (file write failed)", path: where, note: `Not durable: the data files in ${where} could not be written (${writeError}), so changes live in this server process only. Set DATABASE_URL (Postgres) for durable storage.` };
      if (opts.serverless) return { kind: "file", durable: false, label: "Instance /tmp files (not durable)", path: where, note: `Not durable on this deploy: no DATABASE_URL is set, so data is kept in JSON files in this serverless instance's ${where}. Other instances do not see it and a cold start loses it.` };
      return { kind: "file", durable: true, label: `Local files (${where})`, path: where, note: `Stored in JSON files in ${where} on this server (no DATABASE_URL). Durable for this one server only.` };
    },
    async list<T>(ns: string) { return copy(read(ns)) as DocRow<T>[]; },
    async get<T>(ns: string, id: string) { const r = read(ns).find((x) => x.id === id); return r ? (copy(r.doc) as T) : null; },
    async put(ns, id, doc) { upsert(ns, [{ id, doc }]); },
    async putMany(ns, list) { if (list.length) upsert(ns, list); },
    async remove(ns, id) { const rows = read(ns).filter((r) => r.id !== id); write(ns, rows); },
  };
}

/* ───────── Postgres ───────── */
type PgRow = { id: string; doc: unknown; created_at: Date; updated_at: Date };

export function createPostgresDocStore(url: string, envName: string, opts: { max?: number } = {}): DocStore & { end(): Promise<void> } {
  const sql = postgres(url, { max: opts.max ?? 2, idle_timeout: 30, connect_timeout: 10, onnotice: () => {} });
  let ready: Promise<unknown> | null = null;
  const ensure = () =>
    (ready ??= sql
      .unsafe(
        `create table if not exists ${DOCS_TABLE} (
           ns text not null,
           id text not null,
           doc jsonb not null,
           created_at timestamptz not null default now(),
           updated_at timestamptz not null default now(),
           primary key (ns, id)
         );
         create index if not exists ${DOCS_TABLE}_ns_created_idx on ${DOCS_TABLE} (ns, created_at);`,
      )
      .catch((e) => {
        ready = null; // retry on the next call
        throw e;
      }));
  const toRow = <T>(r: PgRow): DocRow<T> => ({ id: r.id, doc: r.doc as T, createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString() });
  const upsert = async (ns: string, list: { id: string; doc: unknown }[]) => {
    if (!list.length) return;
    await ensure();
    await sql.begin(async (tx) => {
      for (const r of list)
        await tx`insert into ${tx(DOCS_TABLE)} (ns, id, doc) values (${checkNs(ns)}, ${r.id}, ${tx.json(copy(r.doc) as postgres.JSONValue)})
                 on conflict (ns, id) do update set doc = excluded.doc, updated_at = now()`;
    });
  };
  return {
    info: () => ({ kind: "postgres", durable: true, label: `Postgres (${envName})`, note: `Stored in Postgres (${envName}); every server instance sees the same data.` }),
    async list<T>(ns: string) {
      await ensure();
      const rows = await sql<PgRow[]>`select id, doc, created_at, updated_at from ${sql(DOCS_TABLE)} where ns = ${checkNs(ns)} order by created_at asc, id asc`;
      return rows.map((r) => toRow<T>(r));
    },
    async get<T>(ns: string, id: string) {
      await ensure();
      const [r] = await sql<PgRow[]>`select id, doc, created_at, updated_at from ${sql(DOCS_TABLE)} where ns = ${checkNs(ns)} and id = ${id}`;
      return r ? (r.doc as T) : null;
    },
    put: (ns, id, doc) => upsert(ns, [{ id, doc }]),
    putMany: (ns, list) => upsert(ns, list),
    async remove(ns, id) { await ensure(); await sql`delete from ${sql(DOCS_TABLE)} where ns = ${checkNs(ns)} and id = ${id}`; },
    end: () => sql.end({ timeout: 5 }),
  };
}

/* ───────── selection ───────── */
const g = globalThis as unknown as { __dealdeskDocs?: { key: string; store: DocStore } };

/** The process-wide store for this env (survives dev hot reloads). */
export function docStore(env: Env = process.env): DocStore {
  const db = databaseUrl(env);
  const mode = env.DEALDESK_STORE?.trim().toLowerCase();
  const key = mode === "memory" ? "memory" : db ? `pg:${db.name}:${db.url}` : `file:${dataDir(env)}:${env.VERCEL ? "1" : "0"}`;
  if (g.__dealdeskDocs?.key !== key) {
    const store = mode === "memory" ? createMemoryDocStore() : db ? createPostgresDocStore(db.url, db.name) : createFileDocStore(dataDir(env), { serverless: !!env.VERCEL });
    g.__dealdeskDocs = { key, store };
  }
  return g.__dealdeskDocs.store;
}

/** Tests: drop the cached store so the next docStore() call reads the env again. */
export function resetDocStore() {
  delete g.__dealdeskDocs;
}

/** What the UI and STATE.md say about storage, without touching the store. */
export function storageInfo(env: Env = process.env): StorageInfo {
  return docStore(env).info();
}
