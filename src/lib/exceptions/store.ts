// The exception queue store. Items and runs are kept in the durable store (src/lib/store/docs.ts): Postgres when
// DATABASE_URL / POSTGRES_URL is set, else JSON files (labelled "not durable" on Vercel). A request loads the queue
// (`loadExceptionStore`), works on it with the sync API below, then `flush()` writes only the items and runs it changed.
//
// Agent loops call `raiseException` (or `recordRun` with all of a run's items at once); the Review page calls
// `resolveException`. A run is finished when its last open item is resolved.
import fs from "node:fs";
import path from "node:path";
import { dryRun, outboundMode } from "@/lib/outbound";
import { docStore, type DocStore } from "@/lib/store/docs";
import type { ActionLabels, Artefact, ExceptionAction, ExceptionItem, ExceptionKind, RaiseInput, Resolution, RunRecord, RunSource, StorageInfo } from "./types";

type State = { version: 1; items: ExceptionItem[]; runs: RunRecord[] };

export const DEFAULT_ACTIONS: Record<ExceptionKind, ActionLabels> = {
  ambiguous_match: { approve: "Accept top match", reject: "Exclude", edit: "Pick another" },
  missing_data: { approve: "Accept as unavailable", reject: "Exclude row", edit: "Enter value" },
  conflicting_data: { approve: "Accept Crustdata value", reject: "Exclude row", edit: "Enter value" },
  credit_threshold: { approve: "Accept partial result", reject: "Discard result" },
  low_confidence: { approve: "Keep it", reject: "Exclude", edit: "Override" },
  incomplete_run: { approve: "Accept partial result", reject: "Discard result" },
  outbound_send: { approve: "Approve dry-run send", reject: "Don't send", edit: "Edit and approve" },
};

/** What a resolution does, in plain words (shown on the item and in the run's artefact notes). */
export function effectOf(item: ExceptionItem, action: ExceptionAction, value?: string): string {
  const v = value?.trim();
  const proposed = item.proposed ? String(typeof item.proposed.value === "object" ? item.proposed.label : item.proposed.value) : "";
  switch (item.kind) {
    case "outbound_send":
      return action === "reject" ? "Not sent." : `Approved${action === "edit" ? " with edits" : ""}: dry run only, nothing left the server (event rules).`;
    case "credit_threshold":
    case "incomplete_run":
      return action === "reject" ? "Result discarded." : "Partial result accepted as final; re-run the request to spend more credits.";
    case "ambiguous_match":
      return action === "reject" ? "Excluded from the final output." : action === "edit" ? `Person chose “${v}”.` : `Accepted ${proposed ? `“${proposed}”` : "the top match"}.`;
    case "conflicting_data":
      return action === "reject" ? "Excluded from the final output." : action === "edit" ? `Value set by person to “${v}” (not from Crustdata).` : `Accepted the Crustdata value${proposed ? ` “${proposed}”` : ""}.`;
    case "missing_data":
      return action === "reject" ? "Excluded from the final output." : action === "edit" ? `Value entered by person: “${v}” (not from Crustdata).` : "Accepted as unavailable in the final output.";
    case "low_confidence":
      return action === "reject" ? "Excluded from the final output." : action === "edit" ? `Overridden by person: “${v}”.` : "Kept as is, confirmed by a person.";
  }
}

/** Applies a resolution to the run's artefact: exclusions, person-entered values (labelled manual), notes. */
export function applyToArtefact(a: Artefact, item: ExceptionItem, r: Resolution): Artefact {
  const i = item.target?.row;
  if (i === undefined) return r.action === "reject" && item.kind !== "outbound_send" ? { ...a, discarded: { reason: `${item.title}. ${r.effect}`, by: r.by, at: r.at } } : a;
  if (!a.rows[i]) return a;
  const rows = a.rows.map((row, idx) => {
    if (idx !== i) return row;
    const next = { ...row, notes: [...row.notes, `${r.effect}${r.note ? ` Note: ${r.note}` : ""}`] };
    if (r.action === "reject" && item.kind !== "outbound_send") next.excluded = { reason: item.title, by: r.by, at: r.at };
    if (r.action === "edit" && r.value && item.target?.cell) {
      next.cells = row.cells.map((c) =>
        c.key === item.target!.cell ? { ...c, value: r.value!, status: "manual" as const, reason: undefined, citation: { source: "Person", note: `entered by ${r.by}`, retrievedAt: r.at } } : c,
      );
    }
    return next;
  });
  return { ...a, rows };
}

export type StoreOptions = { file?: string | null; now?: () => Date; id?: () => string; initial?: { items: ExceptionItem[]; runs: RunRecord[] }; info?: () => StorageInfo };

export function createExceptionStore(opts: StoreOptions = {}) {
  const file = opts.file === undefined ? null : opts.file;
  const now = () => (opts.now ? opts.now() : new Date());
  let seq = 0;
  const newId = opts.id ?? (() => `ex_${now().getTime().toString(36)}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  let state: State | null = null;
  let writeError: string | null = null;

  function load(): State {
    if (state) return state;
    state = { version: 1, items: opts.initial ? [...opts.initial.items] : [], runs: opts.initial ? [...opts.initial.runs] : [] };
    if (file && !opts.initial) {
      try {
        const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<State>;
        if (Array.isArray(raw.items) && Array.isArray(raw.runs)) state = { version: 1, items: raw.items, runs: raw.runs };
      } catch {
        /* no file yet, or unreadable: start empty */
      }
    }
    return state;
  }

  function save() {
    if (!file || !state) return;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(state));
      fs.renameSync(tmp, file);
      writeError = null;
    } catch (e) {
      writeError = e instanceof Error ? e.message : String(e);
    }
  }

  function storage(): StorageInfo {
    if (opts.info) return opts.info();
    if (file && !writeError) return { kind: "file", path: path.relative(process.cwd(), file) || file, note: `Stored in a JSON file on this server (${path.basename(file)}) because no database is configured (DATABASE_URL is unset). Single server only.` };
    return { kind: "memory", note: `Kept in server memory only${writeError ? ` (file write failed: ${writeError})` : ""}; no database is configured (DATABASE_URL is unset), so items are lost on restart.` };
  }

  function finishIfDone(s: State, runId: string | null) {
    if (!runId) return null;
    const run = s.runs.find((r) => r.id === runId);
    if (!run) return null;
    const open = s.items.some((x) => x.runId === runId && x.status === "open");
    if (!open && run.status !== "finished") {
      run.status = "finished";
      run.finishedAt = now().toISOString();
    }
    return run;
  }

  function semanticKey(x: { kind: string; key: string; subject?: { name: string; domain?: string } }): string {
    const rest = x.key.split(":").slice(1).join(":").replace(/^r\d+:/, "");
    return `${x.kind}|${(x.subject?.domain ?? x.subject?.name ?? "").toLowerCase()}|${rest}`;
  }

  function insert(s: State, input: RaiseInput): ExceptionItem {
    // Idempotent per open `key`, and across runs: re-running the same request must not raise the same issue again
    // (run ids and row order differ between runs, so compare kind + company + the key without run id / row index).
    const sem = semanticKey(input);
    const existing = s.items.find((x) => x.status === "open" && (x.key === input.key || semanticKey(x) === sem));
    if (existing) return existing;
    const item: ExceptionItem = {
      ...input,
      runId: input.runId ?? null,
      actions: input.actions ?? DEFAULT_ACTIONS[input.kind],
      id: newId(),
      status: "open",
      createdAt: now().toISOString(),
    };
    s.items.push(item);
    return item;
  }

  return {
    storage,

    /** Raise one item (idempotent per open `key`). Attaches it to its run if the run is known and reopens it. */
    raiseException(input: RaiseInput): ExceptionItem {
      const s = load();
      const item = insert(s, input);
      const run = item.runId ? s.runs.find((r) => r.id === item.runId) : undefined;
      if (run && !run.exceptionIds.includes(item.id)) {
        run.exceptionIds.push(item.id);
        run.status = "waiting_on_person";
        delete run.finishedAt;
      }
      save();
      return item;
    },

    /** Record a whole run: its artefact, how many items auto-completed, and the items that need a person. */
    recordRun(run: { id: string; source: RunSource; request: string; autoCompleted: number; summary?: string; credits?: RunRecord["credits"]; model?: string; artefact?: Artefact; clientSubmitted?: boolean }, raise: RaiseInput[]): { run: RunRecord; items: ExceptionItem[] } {
      const s = load();
      const items = raise.map((r) => insert(s, { ...r, runId: run.id }));
      const prev = s.runs.findIndex((r) => r.id === run.id);
      const rec: RunRecord = {
        ...run,
        createdAt: prev >= 0 ? s.runs[prev].createdAt : now().toISOString(),
        status: items.some((i) => i.status === "open") ? "waiting_on_person" : "finished",
        exceptionIds: items.map((i) => i.id),
        ...(items.some((i) => i.status === "open") ? {} : { finishedAt: now().toISOString() }),
      };
      if (prev >= 0) s.runs[prev] = rec;
      else s.runs.push(rec);
      save();
      return { run: rec, items };
    },

    /** Approve / reject / edit an open item. Outbound items run the dry-run transport on approve/edit — never a real send. */
    resolveException(id: string, action: ExceptionAction, opts: { note?: string; value?: string; by?: string } = {}): { item: ExceptionItem; run: RunRecord | null } {
      const s = load();
      const item = s.items.find((x) => x.id === id);
      if (!item) throw new ExceptionError(404, `No exception with id ${id}`);
      if (item.status !== "open") throw new ExceptionError(409, `Already ${item.status}`);
      if (action === "edit") {
        if (!item.actions.edit) throw new ExceptionError(400, `${item.kind} items cannot be edited`);
        if (!opts.value?.trim()) throw new ExceptionError(400, "edit needs a non-empty value");
      }
      const value = opts.value?.trim().slice(0, 2000);
      const note = opts.note?.trim().slice(0, 1000) || undefined;
      const r: Resolution = { action, by: opts.by ?? "you", at: now().toISOString(), ...(note ? { note } : {}), ...(value ? { value } : {}), effect: effectOf(item, action, value) };
      if (item.kind === "outbound_send" && action !== "reject") {
        // OUTBOUND_MODE=live is refused here too: the review queue only ever produces dry runs.
        const draft = action === "edit" ? { ...(item.proposed?.value as object | undefined), body: value } : item.proposed?.value;
        const channel = typeof (item.proposed?.value as { channel?: unknown } | undefined)?.channel === "string" ? String((item.proposed!.value as { channel: string }).channel) : "outbound";
        r.outbound = dryRun(channel, draft);
        if (safeMode() === "live") r.effect += " OUTBOUND_MODE=live is ignored by the review queue.";
      }
      item.status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "edited";
      item.resolution = r;
      const run = item.runId ? s.runs.find((x) => x.id === item.runId) ?? null : null;
      if (run?.artefact) run.artefact = applyToArtefact(run.artefact, item, r);
      finishIfDone(s, item.runId);
      save();
      return { item, run };
    },

    list(filter: { status?: "open" | "all"; runId?: string } = {}) {
      const s = load();
      let items = s.items;
      if (filter.status === "open") items = items.filter((x) => x.status === "open");
      if (filter.runId) items = items.filter((x) => x.runId === filter.runId);
      const runs = filter.runId ? s.runs.filter((r) => r.id === filter.runId) : s.runs;
      return { items: [...items].reverse(), runs: [...runs].reverse() };
    },

    get(id: string) {
      return load().items.find((x) => x.id === id) ?? null;
    },

    openCount(): number {
      return load().items.filter((x) => x.status === "open").length;
    },
  };
}

export type ExceptionStore = ReturnType<typeof createExceptionStore>;

export class ExceptionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function safeMode() {
  try {
    return outboundMode();
  } catch {
    return "dry_run";
  }
}

export const NS_ITEMS = "review_items";
export const NS_RUNS = "review_runs";

export type LoadedExceptionStore = ExceptionStore & {
  /** Write the items and runs this request changed (one document each). */
  flush(): Promise<void>;
};

/** The review queue as it is in the durable store now, for one request. Call flush() after changing it. */
export async function loadExceptionStore(docs: DocStore = docStore()): Promise<LoadedExceptionStore> {
  const [items, runs] = await Promise.all([docs.list<ExceptionItem>(NS_ITEMS), docs.list<RunRecord>(NS_RUNS)]);
  const seen = new Map<string, string>();
  for (const r of items) seen.set(`i:${r.id}`, JSON.stringify(r.doc));
  for (const r of runs) seen.set(`r:${r.id}`, JSON.stringify(r.doc));
  const store = createExceptionStore({ initial: { items: items.map((r) => r.doc), runs: runs.map((r) => r.doc) }, info: () => docs.info() });
  return {
    ...store,
    async flush() {
      const all = store.list({ status: "all" });
      const changed = <T extends { id: string }>(tag: string, xs: T[]) => xs.filter((x) => seen.get(`${tag}:${x.id}`) !== JSON.stringify(x));
      const ci = changed("i", all.items), cr = changed("r", all.runs);
      // items before runs: a run never points at an item that is not stored yet
      await docs.putMany(NS_ITEMS, [...ci].reverse().map((x) => ({ id: x.id, doc: x })));
      await docs.putMany(NS_RUNS, [...cr].reverse().map((x) => ({ id: x.id, doc: x })));
      for (const x of ci) seen.set(`i:${x.id}`, JSON.stringify(x));
      for (const x of cr) seen.set(`r:${x.id}`, JSON.stringify(x));
    },
  };
}

/** Seam for agent loops: raise one item and store it. */
export async function raiseException(input: RaiseInput): Promise<ExceptionItem> {
  const s = await loadExceptionStore();
  const item = s.raiseException(input);
  await s.flush();
  return item;
}
/** Seam for the Review page / API: resolve one item and store it. */
export async function resolveException(id: string, action: ExceptionAction, opts?: { note?: string; value?: string; by?: string }) {
  const s = await loadExceptionStore();
  const r = s.resolveException(id, action, opts);
  await s.flush();
  return r;
}
