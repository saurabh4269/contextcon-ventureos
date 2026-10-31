// The exception queue store. DATABASE_URL is not set in this build, so items and runs live in one JSON file on the
// server (.cache/exceptions.json, or EXCEPTIONS_FILE); if the file cannot be written (read-only filesystem) the store
// keeps working in memory and says so. Single-process only — fine for one desk, not for a fleet.
//
// Agent loops call `raiseException` (or `recordRun` with all of a run's items at once); the Review page calls
// `resolveException`. A run is finished when its last open item is resolved.
import fs from "node:fs";
import path from "node:path";
import { dryRun, outboundMode } from "@/lib/outbound";
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

export type StoreOptions = { file?: string | null; now?: () => Date; id?: () => string };

export function createExceptionStore(opts: StoreOptions = {}) {
  const file = opts.file === undefined ? defaultFile() : opts.file;
  const now = () => (opts.now ? opts.now() : new Date());
  let seq = 0;
  const newId = opts.id ?? (() => `ex_${now().getTime().toString(36)}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  let state: State | null = null;
  let writeError: string | null = null;

  function load(): State {
    if (state) return state;
    state = { version: 1, items: [], runs: [] };
    if (file) {
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

  function insert(s: State, input: RaiseInput): ExceptionItem {
    const existing = s.items.find((x) => x.key === input.key && x.status === "open");
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

function defaultFile(): string | null {
  const env = process.env.EXCEPTIONS_FILE?.trim();
  if (env === "memory") return null;
  return env || path.join(process.cwd(), ".cache", "exceptions.json");
}

const g = globalThis as unknown as { __dealdeskExceptions?: ExceptionStore };

/** The process-wide store (survives dev hot reloads). */
export function exceptionStore(): ExceptionStore {
  return (g.__dealdeskExceptions ??= createExceptionStore());
}

/** Seam for agent loops: raise one item on the process-wide store. */
export const raiseException = (input: RaiseInput) => exceptionStore().raiseException(input);
/** Seam for the Review page / API: resolve one item on the process-wide store. */
export const resolveException = (id: string, action: ExceptionAction, opts?: { note?: string; value?: string; by?: string }) => exceptionStore().resolveException(id, action, opts);
