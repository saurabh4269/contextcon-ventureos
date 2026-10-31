// Resilient wrapper for the screening agent's tool-use model client (OpenAI / Anthropic): per-call timeout + deadline,
// jittered retries, circuit breaker per model, one fallback model for outages, and tool-call sanitising so a malformed
// function call becomes an error tool_result instead of crashing the loop. Types here are structural copies of
// src/lib/agent/model.ts on the nl-screener branch (ModelClient, ModelTurn, ToolCall, ToolSpec) — nothing is imported from it.
//
// Merge seam (nl-screener, src/app/api/live/screen/route.ts):
//   const primary = modelFromEnv();
//   if (!primary) return single({ type: "model_unavailable", ... }, 503);
//   const model = primary && resilientModel(primary, { fallback: fastModelFromEnv() });
// replacing `const model = modelFromEnv()`. `fastModelFromEnv` (OPENAI_FAST_MODEL, default DEFAULT_OPENAI_FAST_MODEL) does
// not exist yet; pass `fallback: null` until it does. In agent.ts, wrap `model.complete` failures with
// `modelUnavailableMessage(e)`, and answer calls whose input has `__invalid_arguments` with an isError tool_result.
import { fmtTime } from "@/lib/format";
import { CircuitBreaker } from "./breaker";
import { classifyError, ResilienceError, scrub, withResilience, type ErrorClass, type ErrorKind } from "./index";

export type ToolSpecLike = { name: string; description?: string; input_schema?: Record<string, unknown> };
export type ToolCallLike = { id: string; name: string; input: Record<string, unknown> };
export type ModelTurnLike = { text: string; toolCalls: ToolCallLike[]; stop: "tool_use" | "end" | "max_tokens" | "other"; raw?: unknown };
export type CompleteInputLike = { system: string; messages: unknown[]; tools: ToolSpecLike[]; maxTokens?: number };

/** Generic over the complete() input so the wrapper of their ModelClient is assignable back to ModelClient. */
export interface ModelClientLike<I extends CompleteInputLike = CompleteInputLike> {
  readonly provider: "anthropic" | "openai";
  readonly model: string;
  complete(input: I): Promise<ModelTurnLike>;
}

export type ModelEvent = { type: "retry" | "fallback" | "repaired_tool_json" | "dropped_tool_call"; detail: string };

export type ResilientModelOptions<I extends CompleteInputLike> = {
  fallback?: ModelClientLike<I> | null;
  /** per attempt; default 120 s (reasoning models are slow) */
  timeoutMs?: number;
  /** per complete() call incl. backoff; default 240 s (the route's maxDuration is 300 s) */
  deadlineMs?: number;
  /** default 2 for the primary; the fallback gets at most 1 */
  retries?: number;
  breaker?: CircuitBreaker;
  onEvent?: (e: ModelEvent) => void;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const PROVIDER_NAME = { anthropic: "Anthropic", openai: "OpenAI" } as const;
const labelOf = (m: ModelClientLike<never>) => `${PROVIDER_NAME[m.provider] ?? m.provider} ${m.model}`;

/** Outage-shaped failures worth one try on another model. Auth / bad request / credits are misconfig: never masked. */
const FALLBACK_KINDS: ReadonlySet<ErrorKind> = new Set(["timeout", "upstream_unavailable", "rate_limited", "circuit_open", "malformed_response", "not_found", "network"]);

const sharedBreaker = new CircuitBreaker(4, 60_000);

export function resilientModel<I extends CompleteInputLike>(primary: ModelClientLike<I>, opts: ResilientModelOptions<I> = {}): ModelClientLike<I> {
  const breaker = opts.breaker ?? sharedBreaker;
  const emit = (type: ModelEvent["type"], detail: string) => opts.onEvent?.({ type, detail });
  const run = (client: ModelClientLike<I>, input: I, retries: number) => {
    const label = labelOf(client);
    return withResilience(() => client.complete(input), {
      label,
      timeoutMs: opts.timeoutMs ?? 120_000,
      deadlineMs: opts.deadlineMs ?? 240_000,
      retries,
      breaker,
      breakerKey: `model:${client.provider}:${client.model}`,
      sleep: opts.sleep,
      random: opts.random,
      onRetry: ({ attempt, delayMs, error }) => emit("retry", `${label} attempt ${attempt} failed (${error.kind}${error.status ? ` ${error.status}` : ""}); retrying in ${delayMs} ms`),
    });
  };

  return {
    provider: primary.provider,
    model: primary.model,
    async complete(input) {
      let turn: ModelTurnLike;
      try {
        turn = await run(primary, input, opts.retries ?? 2);
      } catch (e) {
        const fb = opts.fallback;
        const c = classifyError(e, labelOf(primary));
        if (!fb || !FALLBACK_KINDS.has(c.kind) || (fb.provider === primary.provider && fb.model === primary.model)) throw asResilience(e, c);
        emit("fallback", `${labelOf(primary)} failed (${c.kind}${c.status ? ` ${c.status}` : ""}); trying ${labelOf(fb)} once`);
        try {
          turn = await run(fb, input, Math.min(1, opts.retries ?? 2));
        } catch (e2) {
          const c2 = classifyError(e2, labelOf(fb));
          const attempts = (e instanceof ResilienceError ? e.attempts : 1) + (e2 instanceof ResilienceError ? e2.attempts : 1);
          throw new ResilienceError(
            { ...c, userMessage: `${c.userMessage} The fallback ${labelOf(fb)} also failed: ${c2.userMessage}`, detail: scrub(`${c.detail} | fallback: ${c2.detail}`, 400) },
            attempts,
            e2,
          );
        }
      }
      if (!input.tools?.length) return turn;
      const { turn: clean, problems } = sanitizeToolCalls(turn, input.tools);
      for (const p of problems) emit(p.startsWith("dropped") ? "dropped_tool_call" : "repaired_tool_json", p);
      return clean;
    },
  };
}

const asResilience = (e: unknown, c: ErrorClass) => (e instanceof ResilienceError ? e : new ResilienceError(c, 1, e));

/* ── tool-call hygiene ── */

/** Best-effort repair of model-written JSON: strip ``` fences, keep the outermost {...}, drop trailing commas. */
export function repairJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  let s = String(raw ?? "").trim();
  s = s.replace(/^```[a-zA-Z0-9_-]*\s*/, "").replace(/\s*```\s*$/, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  s = s.replace(/,(\s*[}\]])/g, "$1");
  try {
    return { ok: true, value: JSON.parse(s) as unknown };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** FNV-1a, for stable generated tool-call ids. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

/**
 * Validate a turn's tool calls against the offered tools:
 * - unknown tool name → dropped (and removed from an OpenAI-style `raw` output array so the replay has no orphan call);
 * - `__unparseable_arguments` → repaired via repairJson, else input becomes `{ __invalid_arguments: true, reason }` so the
 *   loop answers with an error tool_result;
 * - non-object input → same invalid marker; missing id → stable generated id.
 */
export function sanitizeToolCalls<T extends ModelTurnLike>(turn: T, tools: ToolSpecLike[]): { turn: T; problems: string[] } {
  const known = new Set(tools.map((t) => t.name));
  const problems: string[] = [];
  const dropped = new Set<string>();
  const calls: ToolCallLike[] = [];
  (turn.toolCalls ?? []).forEach((call, i) => {
    const name = typeof call?.name === "string" ? call.name : "";
    let input: unknown = call?.input;
    const id = typeof call?.id === "string" && call.id ? call.id : `call_gen_${i}_${hash(`${name}:${safeStringify(input)}`)}`;
    if (!known.has(name)) {
      problems.push(`dropped call to unknown tool "${scrub(name, 60) || "(no name)"}"`);
      dropped.add(id);
      return;
    }
    if (isPlainObject(input) && "__unparseable_arguments" in input) {
      const raw = String(input.__unparseable_arguments ?? "");
      const fixed = repairJson(raw);
      if (fixed.ok && isPlainObject(fixed.value)) {
        problems.push(`repaired malformed JSON arguments for ${name}`);
        input = fixed.value;
      } else {
        const reason = `arguments were not valid JSON (${fixed.ok ? "not an object" : scrub(fixed.error, 80)}): ${scrub(raw, 120)}`;
        problems.push(`invalid arguments for ${name}: ${reason}`);
        input = { __invalid_arguments: true, reason };
      }
    } else if (!isPlainObject(input)) {
      const reason = "arguments were not a JSON object";
      problems.push(`invalid arguments for ${name}: ${reason}`);
      input = { __invalid_arguments: true, reason };
    }
    calls.push({ id, name, input: input as Record<string, unknown> });
  });
  const raw =
    dropped.size && Array.isArray(turn.raw)
      ? turn.raw.filter((o: unknown) => !(isPlainObject(o) && o.type === "function_call" && typeof o.call_id === "string" && dropped.has(o.call_id)))
      : turn.raw;
  const stop = turn.stop === "tool_use" && !calls.length ? "other" : turn.stop;
  return { turn: { ...turn, toolCalls: calls, stop, ...(turn.raw !== undefined ? { raw } : {}) }, problems };
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v) ?? "";
  } catch {
    return "";
  }
}

const REASON: Record<ErrorKind, (c: ErrorClass) => string> = {
  timeout: () => "no answer in time",
  rate_limited: (c) => `rate-limited${c.status ? ` (${c.status})` : ""}`,
  upstream_unavailable: (c) => `provider error${c.status ? ` ${c.status}` : ""}`,
  circuit_open: (c) => `paused after repeated failures; retry after ${fmtTime(new Date(Date.now() + (c.retryAfterMs ?? 0)).toISOString())}`,
  auth: (c) => `API key rejected${c.status ? ` (${c.status})` : ""} — an operator must fix the key`,
  bad_request: (c) => `request rejected${c.status ? ` (${c.status})` : ""}`,
  not_found: () => "model not found (404)",
  insufficient_credits: () => "provider credits exhausted (402)",
  malformed_response: () => "unreadable response",
  network: () => "network error",
  aborted: () => "cancelled",
  unknown: () => "unexpected error",
};

/** Honest one-liner for the UI when complete() finally fails (or no model is usable). */
export function modelUnavailableMessage(e: unknown): string {
  const c = classifyError(e, "The model");
  return `The model is unavailable (${REASON[c.kind](c)}); the run stopped before inventing anything. Crustdata results gathered so far are kept.`;
}
