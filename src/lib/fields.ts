/**
 * ComputedField — the builder's explainable-number contract (builder-main a5330b1; its docs/API.md is authoritative
 * once that branch lands — see our docs/API.md for the assumptions made here):
 *
 *   { status: "ok", value, inputs: [...], method, citations: [...], reasoning }
 *   { status: "unavailable", reason }
 *
 * Every number the integrated UI shows travels in this shape. Element types of `inputs`/`citations` are kept
 * permissive (extra keys allowed) so the builder's richer objects drop in without changes.
 */
import { fmtDateTime } from "@/lib/format";

export type FieldInput = { name: string; value: unknown; [k: string]: unknown };
export type Citation = {
  source: string; // e.g. "Crustdata"
  endpoint?: string; // e.g. "POST /company/enrich"
  path?: string; // JSON path in that response
  url?: string;
  retrievedAt?: string; // ISO
  [k: string]: unknown;
};

export type ComputedOk<T> = { status: "ok"; value: T; inputs: FieldInput[]; method: string; citations: Citation[]; reasoning: string };
export type ComputedUnavailable = { status: "unavailable"; reason: string };
export type ComputedField<T> = ComputedOk<T> | ComputedUnavailable;

export const isOk = <T>(f: ComputedField<T> | undefined | null): f is ComputedOk<T> => !!f && f.status === "ok";

export const ok = <T>(value: T, method: string, reasoning: string, citations: Citation[], inputs: FieldInput[] = []): ComputedOk<T> => ({
  status: "ok",
  value,
  inputs,
  method,
  citations,
  reasoning,
});

export const unavailable = (reason: string): ComputedUnavailable => ({ status: "unavailable", reason });

/** Hover text: reasoning, method and citations — or "Unavailable: <reason>". */
export function explain(f: ComputedField<unknown> | undefined | null): string {
  if (!f) return "Unavailable: not provided by the API";
  if (f.status !== "ok") return `Unavailable: ${f.reason}`;
  const cites = f.citations
    .map((c) => [c.source, c.endpoint, c.path].filter(Boolean).join(" · ") + (c.retrievedAt ? ` · retrieved ${fmtDateTime(String(c.retrievedAt))}` : ""))
    .join("\n");
  return [f.reasoning, `Method: ${f.method}`, cites].filter(Boolean).join("\n");
}

/** `fmt(value)` when ok, "—" when unavailable or missing. */
export function show<T>(f: ComputedField<T> | undefined | null, fmt: (v: T) => string = String): string {
  return isOk(f) ? fmt(f.value) : "—";
}
