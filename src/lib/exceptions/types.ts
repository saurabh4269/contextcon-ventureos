// Exception queue: the only places a person is asked to step in. An agent run auto-completes everything it can verify
// and raises an ExceptionItem for the rest (ambiguous company match, missing or conflicting data, a credit threshold,
// a low-confidence decision, any outbound send). A person approves, rejects or edits the item; when a run has no open
// items left it is finished. Shared by the store (server), the API routes and the Review page (client).
import type { Citation } from "@/lib/fields";

export type ExceptionKind =
  | "ambiguous_match" // the company/person could not be matched to one Crustdata record
  | "missing_data" // a requested value is unavailable on Crustdata
  | "conflicting_data" // two sources (or the model and Crustdata) disagree
  | "credit_threshold" // the run hit (or would exceed) the Crustdata credit budget
  | "low_confidence" // a match or decision rests on relaxed criteria or partial inputs
  | "incomplete_run" // the run stopped before a final answer
  | "outbound_send"; // anything that would contact another person (always dry-run in this build)

export const EXCEPTION_KINDS: readonly ExceptionKind[] = ["ambiguous_match", "missing_data", "conflicting_data", "credit_threshold", "low_confidence", "incomplete_run", "outbound_send"];

export const KIND_LABEL: Record<ExceptionKind, string> = {
  ambiguous_match: "Ambiguous match",
  missing_data: "Missing data",
  conflicting_data: "Conflicting data",
  credit_threshold: "Credit threshold",
  low_confidence: "Low confidence",
  incomplete_run: "Incomplete run",
  outbound_send: "Outbound send",
};

export type ExceptionAction = "approve" | "reject" | "edit";
export type ExceptionStatus = "open" | "approved" | "rejected" | "edited";

/** One fact shown to the person, with where it came from (Crustdata endpoint + JSON path + fetch time) when known. */
export type Evidence = { label: string; value: string | number | boolean | null; citation?: Citation; note?: string };

/** What each button means for this item (labels differ by kind: "Accept Crustdata value", "Approve dry-run send" …). */
export type ActionLabels = { approve: string; reject: string; edit?: string };

/** Where in the run's artefact the item points (row index, optional cell key). */
export type ExceptionTarget = { row?: number; cell?: string };

export type Resolution = {
  action: ExceptionAction;
  by: string; // "you" in this build (no sign-in)
  at: string; // ISO
  note?: string;
  value?: string; // the person's edit
  effect: string; // what the resolution did, in plain words
  outbound?: { transport: "dry_run"; channel: string; label: string; wouldSend: unknown };
};

export type ExceptionItem = {
  id: string;
  /** dedupe key: raising the same key again while it is open returns the existing item */
  key: string;
  runId: string | null;
  kind: ExceptionKind;
  title: string;
  reason: string; // why a person is needed
  subject?: { name: string; domain?: string; href?: string };
  evidence: Evidence[];
  actions: ActionLabels;
  /** what Approve accepts (e.g. the Crustdata value, the top candidate, the outbound draft) */
  proposed?: { label: string; value: unknown };
  target?: ExceptionTarget;
  status: ExceptionStatus;
  createdAt: string;
  resolution?: Resolution;
};

/** Input to raiseException: everything but the store-managed fields. `actions` defaults by kind. */
export type RaiseInput = Omit<ExceptionItem, "id" | "status" | "createdAt" | "resolution" | "actions" | "runId"> & { runId?: string | null; actions?: ActionLabels };

/* ───────────── runs and their finished artefact ───────────── */

export type ArtefactCellStatus = "verified" | "corrected" | "unavailable" | "manual";
export type ArtefactCell = {
  key: string;
  label: string;
  value: string | number | boolean | null;
  status: ArtefactCellStatus;
  citation?: Citation;
  reason?: string;
};
export type ArtefactFounder = { name: string; title?: string; prior: string[]; citation?: Citation };
export type ArtefactRow = {
  rank: number;
  name: string;
  domain?: string;
  cells: ArtefactCell[];
  founders: ArtefactFounder[];
  foundersNote?: string;
  why?: string;
  excluded?: { reason: string; by: string; at: string };
  notes: string[]; // person resolutions applied to this row
};
/** The run's finished work in one normalized shape, whichever agent produced it. */
export type Artefact = { kind: "shortlist"; columns: { key: string; label: string }[]; rows: ArtefactRow[]; discarded?: { reason: string; by: string; at: string } };

export type RunSource = "screen-agent" | "sourcing-agent" | "deal" | "manual";
export type RunStatus = "waiting_on_person" | "finished";
export type RunRecord = {
  id: string;
  source: RunSource;
  request: string;
  createdAt: string;
  status: RunStatus;
  finishedAt?: string;
  /** items that passed every check and needed nobody */
  autoCompleted: number;
  exceptionIds: string[];
  summary?: string;
  credits?: { used: number; cap?: number };
  model?: string; // "deterministic parser (no LLM)" or provider/model
  artefact?: Artefact;
  /** set when the run's input came from the browser rather than the server-side agent */
  clientSubmitted?: boolean;
};

export type StorageInfo = { kind: "file" | "memory"; path?: string; note: string };

export type ExceptionsResponse = {
  storage: StorageInfo;
  open: number;
  items: ExceptionItem[];
  runs: RunRecord[];
};

export type ResolveRequest = { action: ExceptionAction; note?: string; value?: string };
export type ResolveResponse = { status: "ok"; item: ExceptionItem; run: RunRecord | null; open: number } | { status: "error"; message: string };

/** Fired on window after any resolve/raise from the UI so the nav badge refreshes immediately. */
export const EXCEPTIONS_CHANGED_EVENT = "dealdesk:exceptions-changed";
