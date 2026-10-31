// Shared contract for the screening agent: tool definitions (registry entries), the call ledger, the verified result
// and the NDJSON event stream of POST /api/live/screen. UI and tool modules import types from here only.
import type { CrustdataClient } from "@/lib/crustdata";
import type { ToolSpec, ToolCall } from "./model";

export type { ToolSpec, ToolCall };

// ── Tools ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** What a tool's executor returns: the Crustdata request it made and the raw response (kept for citation checks). */
export type ToolExecution = {
  method: "GET" | "POST";
  path: string; // Crustdata endpoint, e.g. "/company/search"
  body: Record<string, unknown>;
  data: unknown; // raw Crustdata response
  meta: { creditsUsed: string | null; retrievedAt: string; cached: boolean };
};

/**
 * One registry entry. `spec` is shown to the model; `estimateCredits` is a worst-case estimate used for the credit cap
 * before the call runs; `execute` validates/clamps the model's input, calls Crustdata and returns the raw response.
 * Throw for invalid input or API errors — the registry turns throws into tool errors the model can react to.
 */
export type ToolDef = {
  spec: ToolSpec;
  estimateCredits: (input: Record<string, unknown>) => number;
  execute: (input: Record<string, unknown>, client: CrustdataClient) => Promise<ToolExecution>;
};

/** The final-answer tool the loop expects the model to call exactly once. Not in the registry (handled by the loop). */
export const SUBMIT_TOOL = "submit_answer";

/** One executed (or refused) tool call. `ref` ("c1", "c2" …) is what citations point at. */
export type LedgerCall = {
  ref: string;
  tool: string;
  method: "GET" | "POST";
  path: string;
  body: Record<string, unknown>;
  status: "ok" | "error" | "refused";
  creditsUsed: number | null; // from X-Credits-Used (0 on cache hits); null when unknown
  creditsEstimated: number;
  retrievedAt: string | null;
  cached: boolean;
  ms: number;
  rows?: number;
  totalCount?: number | null;
  error?: string;
  upstreamStatus?: number;
};

// ── Result ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Where a value came from: tool call `ref`, its Crustdata endpoint, and the JSON path in that call's raw response. */
export type Citation = { ref: string; method: "GET" | "POST"; endpoint: string; path: string; retrievedAt: string | null };

/**
 * verified    the cited path holds this value
 * corrected   the model's value did not match the cited path; `value` is the Crustdata value, `claimed` the model's
 * unavailable no value (missing data, or no resolvable citation) — `reason` says which
 */
export type CellStatus = "verified" | "corrected" | "unavailable";
export type ScreenCell = {
  key: string;
  label: string;
  value: string | number | boolean | null;
  status: CellStatus;
  citation?: Citation;
  claimed?: unknown;
  reason?: string;
};

export type PriorRole = { company: ScreenCell; title: ScreenCell; period?: string };
export type ScreenPerson = { name: ScreenCell; title: ScreenCell; linkedin?: ScreenCell; prior: PriorRole[] };

export type ScreenRow = {
  rank: number;
  name: ScreenCell; // the entity (usually the company)
  cells: ScreenCell[]; // one per column, same order as `columns`
  people: ScreenPerson[]; // founders / requested people, each with cited prior roles
  peopleNote?: string; // e.g. "No founders found on Crustdata for this company"
  why?: string; // one line: why it matches the ask
};

/** How each requirement of the ask was applied. */
export type AppliedFilter = {
  requirement: string; // in the user's terms, e.g. "Founded 2023 or later"
  applied: "server" | "client" | "unavailable";
  field?: string; // Crustdata field, e.g. "basic_info.year_founded"
  detail: string; // operator/value, or how it was checked client-side, or why unavailable
  relaxed?: string; // set when the requirement was relaxed: what changed and why
};

export type ScreenResult = {
  status: "ok" | "incomplete"; // incomplete: step/credit cap or model stopped without a final answer
  query: string;
  summary: string;
  columns: { key: string; label: string }[];
  rows: ScreenRow[];
  filters: AppliedFilter[];
  caveats: string[];
  requested?: number; // how many results the ask wanted, when stated
  model: { provider: string; model: string };
  calls: LedgerCall[];
  credits: { used: number; cap: number };
  timings: { totalMs: number; modelMs: number; toolMs: number };
  steps: number;
  citationStats: { verified: number; corrected: number; unavailable: number };
};

// ── Stream (NDJSON, one event per line) ──────────────────────────────────────────────────────────────────────────

export type ScreenEvent =
  | { type: "start"; query: string; model: { provider: string; model: string }; at: string }
  | { type: "thinking"; step: number } // a model turn started
  | { type: "plan"; step: number; text: string } // model narration: plan, verification, relax/re-query decisions
  | { type: "tool_call"; step: number; ref: string; tool: string; endpoint: string; input: Record<string, unknown>; estCredits: number }
  | { type: "tool_result"; step: number; ref: string; tool: string; status: LedgerCall["status"]; rows?: number; totalCount?: number | null; creditsUsed: number | null; ms: number; error?: string }
  | { type: "verify"; text: string; stats: ScreenResult["citationStats"] } // server-side citation check
  | { type: "final"; result: ScreenResult }
  | { type: "model_unavailable"; message: string }
  | { type: "error"; message: string; calls?: LedgerCall[] };

/** POST /api/live/screen request body. */
export type ScreenRequest = { query: string };
