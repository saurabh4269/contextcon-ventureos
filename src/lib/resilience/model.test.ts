import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker, ResilienceError } from "./index";
import { modelUnavailableMessage, repairJson, resilientModel, sanitizeToolCalls, type ModelClientLike, type ModelEvent, type ModelTurnLike } from "./model";

/* Structural copies of nl-screener's src/lib/agent/model.ts types, to prove the wrapper stays assignable after merge. */
type ToolSpec = { name: string; description: string; input_schema: Record<string, unknown> };
type ToolCall = { id: string; name: string; input: Record<string, unknown> };
type ModelTurn = { text: string; toolCalls: ToolCall[]; stop: "tool_use" | "end" | "max_tokens" | "other"; raw?: unknown };
type AgentMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: ToolCall[]; raw?: unknown }
  | { role: "tool"; results: { id: string; content: string; isError?: boolean }[] };
interface ModelClient {
  readonly provider: "anthropic" | "openai";
  readonly model: string;
  complete(input: { system: string; messages: AgentMessage[]; tools: ToolSpec[]; maxTokens?: number }): Promise<ModelTurn>;
}
class ModelApiError extends Error {
  constructor(readonly provider: string, readonly status: number, message: string) {
    super(`${provider} API ${status}: ${message}`);
    this.name = "ModelApiError";
  }
}

const TOOLS: ToolSpec[] = [
  { name: "search_companies", description: "search", input_schema: { type: "object" } },
  { name: "submit_answer", description: "finish", input_schema: { type: "object" } },
];
const INPUT = { system: "s", messages: [{ role: "user", text: "fintechs in Bengaluru" }] as AgentMessage[], tools: TOOLS };
const turnWith = (...toolCalls: ToolCall[]): ModelTurn => ({ text: "", toolCalls, stop: toolCalls.length ? "tool_use" : "end" });

function fakeModel(model: string, impl: () => Promise<ModelTurn>): ModelClient & { complete: ReturnType<typeof vi.fn> } {
  return { provider: "openai", model, complete: vi.fn(impl) };
}
const fast = { sleep: async () => {}, random: () => 0 };

describe("resilientModel", () => {
  it("is assignable to the agent's ModelClient and reports the primary", () => {
    const primary = fakeModel("gpt-main", async () => turnWith());
    const wrapped: ModelClient = resilientModel(primary, { fallback: null, breaker: new CircuitBreaker() });
    expect(wrapped.provider).toBe("openai");
    expect(wrapped.model).toBe("gpt-main");
  });

  it("falls back once when the primary keeps returning 503", async () => {
    const primary = fakeModel("gpt-main", async () => {
      throw new ModelApiError("OpenAI", 503, "overloaded");
    });
    const fallback = fakeModel("gpt-fast", async () => turnWith({ id: "c1", name: "search_companies", input: { q: "x" } }));
    const events: ModelEvent[] = [];
    const m = resilientModel(primary, { fallback, ...fast, breaker: new CircuitBreaker(), onEvent: (e) => events.push(e) });
    const turn = await m.complete(INPUT);
    expect(primary.complete).toHaveBeenCalledTimes(3);
    expect(fallback.complete).toHaveBeenCalledTimes(1);
    expect(turn.toolCalls).toEqual([{ id: "c1", name: "search_companies", input: { q: "x" } }]);
    expect(events.filter((e) => e.type === "retry")).toHaveLength(2);
    expect(events.find((e) => e.type === "fallback")?.detail).toBe("OpenAI gpt-main failed (upstream_unavailable 503); trying OpenAI gpt-fast once");
  });

  it("primary and fallback share one budget: no fallback when the primary used it all", async () => {
    let clock = 0;
    const primary = fakeModel("gpt-main", async () => {
      clock += 1_000; // each attempt "takes" 1 s of the 2.5 s budget
      throw new ModelApiError("OpenAI", 503, "overloaded");
    });
    const fallback = fakeModel("gpt-fast", async () => turnWith());
    const err = await resilientModel(primary, { fallback, ...fast, now: () => clock, deadlineMs: 2_500, breaker: new CircuitBreaker() })
      .complete(INPUT)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ResilienceError);
    expect(fallback.complete).not.toHaveBeenCalled();
  });

  it("does not fall back on 401 — misconfiguration is surfaced, not hidden", async () => {
    const primary = fakeModel("gpt-main", async () => {
      throw new ModelApiError("OpenAI", 401, "Incorrect API key provided");
    });
    const fallback = fakeModel("gpt-fast", async () => turnWith());
    const onEvent = vi.fn();
    const err = await resilientModel(primary, { fallback, ...fast, breaker: new CircuitBreaker(), onEvent })
      .complete(INPUT)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ResilienceError);
    expect((err as ResilienceError).classification.kind).toBe("auth");
    expect((err as ResilienceError).message).toBe("OpenAI rejected the API key (401) — an operator must fix the key.");
    expect(primary.complete).toHaveBeenCalledTimes(1);
    expect(fallback.complete).not.toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
    expect(modelUnavailableMessage(err)).toBe(
      "The model is unavailable (API key rejected (401) — an operator must fix the key); the run stopped before inventing anything. Crustdata results gathered so far are kept.",
    );
  });

  it("reports both failures when the fallback also fails", async () => {
    const primary = fakeModel("gpt-main", async () => {
      throw new ModelApiError("OpenAI", 502, "bad gateway");
    });
    const fallback = fakeModel("gpt-fast", async () => {
      throw new ModelApiError("OpenAI", 503, "overloaded");
    });
    const err = (await resilientModel(primary, { fallback, ...fast, retries: 1, breaker: new CircuitBreaker() })
      .complete(INPUT)
      .catch((e: unknown) => e)) as ResilienceError;
    expect(err.classification.kind).toBe("upstream_unavailable");
    expect(err.attempts).toBe(4);
    expect(err.message).toContain("The fallback OpenAI gpt-fast also failed");
    expect(modelUnavailableMessage(err)).toMatch(/^The model is unavailable \(provider error 502\); the run stopped before inventing anything\./);
  });

  it("times out a hung primary and falls back", async () => {
    const primary = fakeModel("gpt-main", () => new Promise<ModelTurn>(() => {}));
    const fallback = fakeModel("gpt-fast", async () => turnWith());
    const events: ModelEvent[] = [];
    const turn = await resilientModel(primary, { fallback, ...fast, timeoutMs: 20, retries: 0, breaker: new CircuitBreaker(), onEvent: (e) => events.push(e) }).complete(INPUT);
    expect(turn.stop).toBe("end");
    expect(events.map((e) => e.type)).toEqual(["fallback"]);
  });

  it("sanitises tool calls and reports repairs and drops via onEvent", async () => {
    const primary = fakeModel("gpt-main", async () =>
      turnWith({ id: "c1", name: "search_companies", input: { __unparseable_arguments: '```json\n{"a":1,}\n```' } }, { id: "c2", name: "delete_db", input: {} }),
    );
    const events: ModelEvent[] = [];
    const turn = await resilientModel(primary, { breaker: new CircuitBreaker(), onEvent: (e) => events.push(e) }).complete(INPUT);
    expect(turn.toolCalls).toEqual([{ id: "c1", name: "search_companies", input: { a: 1 } }]);
    expect(events.map((e) => e.type)).toEqual(["repaired_tool_json", "dropped_tool_call"]);
  });
});

describe("sanitizeToolCalls", () => {
  it("repairs fenced JSON with trailing commas", () => {
    const { turn, problems } = sanitizeToolCalls(turnWith({ id: "c1", name: "submit_answer", input: { __unparseable_arguments: '```json {"a":1,} ```' } }), TOOLS);
    expect(turn.toolCalls[0]!.input).toEqual({ a: 1 });
    expect(problems).toEqual(["repaired malformed JSON arguments for submit_answer"]);
  });

  it("marks unrepairable arguments as invalid instead of throwing", () => {
    const { turn, problems } = sanitizeToolCalls(turnWith({ id: "c1", name: "search_companies", input: { __unparseable_arguments: '{"q": "fin' } }), TOOLS);
    const input = turn.toolCalls[0]!.input;
    expect(turn.toolCalls[0]!.id).toBe("c1");
    expect(input.__invalid_arguments).toBe(true);
    expect(String(input.reason)).toMatch(/^arguments were not valid JSON \(.+\): \{"q": "fin$/);
    expect(problems[0]).toMatch(/^invalid arguments for search_companies/);
  });

  it("drops unknown tools, strips them from OpenAI raw output, and downgrades an emptied tool_use turn", () => {
    const raw = [{ type: "reasoning" }, { type: "function_call", call_id: "c9", name: "rm_rf", arguments: "{}" }];
    const { turn, problems } = sanitizeToolCalls({ ...turnWith({ id: "c9", name: "rm_rf", input: {} }), raw }, TOOLS);
    expect(turn.toolCalls).toEqual([]);
    expect(turn.stop).toBe("other");
    expect(turn.raw).toEqual([{ type: "reasoning" }]);
    expect(problems).toEqual(['dropped call to unknown tool "rm_rf"']);
  });

  it("generates a stable id when one is missing", () => {
    const t = turnWith({ id: "", name: "search_companies", input: { q: "x" } });
    const a = sanitizeToolCalls(t, TOOLS).turn.toolCalls[0]!.id;
    const b = sanitizeToolCalls(t, TOOLS).turn.toolCalls[0]!.id;
    expect(a).toMatch(/^call_gen_0_/);
    expect(a).toBe(b);
  });

  it("leaves a clean turn untouched", () => {
    const t: ModelTurnLike = turnWith({ id: "c1", name: "search_companies", input: { q: "x" } });
    expect(sanitizeToolCalls(t, TOOLS)).toEqual({ turn: t, problems: [] });
  });
});

describe("repairJson", () => {
  it("takes the outermost object out of surrounding prose", () => {
    expect(repairJson('Here you go: {"a": [1, 2,], "b": {"c": 3,},} thanks')).toEqual({ ok: true, value: { a: [1, 2], b: { c: 3 } } });
    expect(repairJson("not json").ok).toBe(false);
  });
});

describe("modelUnavailableMessage", () => {
  it("is honest for unclassified errors", () => {
    expect(modelUnavailableMessage(new Error("boom"))).toBe(
      "The model is unavailable (unexpected error); the run stopped before inventing anything. Crustdata results gathered so far are kept.",
    );
  });
});

// Type-only check: a ModelClientLike with the agent's input type round-trips.
const _typecheck: ModelClientLike<Parameters<ModelClient["complete"]>[0]> = resilientModel({} as ModelClient);
void _typecheck;
