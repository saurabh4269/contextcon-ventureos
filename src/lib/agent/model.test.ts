import { describe, expect, it } from "vitest";
import { DEFAULT_OPENAI_MODEL, ModelApiError, modelFromEnv, openaiModel, type AgentMessage, type ToolSpec } from "./model";

type Req = { url: string; headers: Record<string, string>; body: Record<string, unknown>; raw: string };

/** A fetch that records requests and answers from a queue of { status, body }. */
function mockFetch(replies: { status?: number; body: unknown }[]) {
  const reqs: Req[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = String(init?.body ?? "");
    reqs.push({ url: String(input), headers: { ...(init?.headers as Record<string, string>) }, body: raw ? JSON.parse(raw) : {}, raw });
    const r = replies.shift();
    if (!r) throw new Error("no more mock replies");
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { f, reqs };
}

const TOOLS: ToolSpec[] = [
  { name: "search_companies", description: "POST /company/search", input_schema: { type: "object", properties: { limit: { type: "integer" } }, required: ["limit"] } },
  { name: "submit_answer", description: "final", input_schema: { type: "object", properties: {} } },
];

const KEY = "sk-test-secret-not-real";

describe("openaiModel (Responses API)", () => {
  it("posts to /v1/responses with function tools, instructions and reasoning effort; parses function calls", async () => {
    const output = [
      { type: "reasoning", id: "rs_1", summary: [] },
      { type: "message", content: [{ type: "output_text", text: "Plan: search companies." }] },
      { type: "function_call", id: "fc_1", call_id: "call_1", name: "search_companies", arguments: '{"limit":5,"filters":{"field":"locations.country","type":"=","value":"IND"}}' },
    ];
    const { f, reqs } = mockFetch([{ body: { status: "completed", output } }]);
    const m = openaiModel(KEY, "gpt-test", f, { reasoningEffort: "medium" });
    expect(m.provider).toBe("openai");
    expect(m.model).toBe("gpt-test");

    const turn = await m.complete({ system: "SYS", messages: [{ role: "user", text: "find startups" }], tools: TOOLS });

    expect(reqs).toHaveLength(1);
    const r = reqs[0]!;
    expect(r.url).toBe("https://api.openai.com/v1/responses");
    expect(r.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(r.body).toMatchObject({ model: "gpt-test", instructions: "SYS", reasoning: { effort: "medium" }, input: [{ role: "user", content: "find startups" }] });
    expect(r.body.tools).toEqual(TOOLS.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.input_schema })));

    expect(turn.stop).toBe("tool_use");
    expect(turn.text).toBe("Plan: search companies.");
    expect(turn.toolCalls).toEqual([{ id: "call_1", name: "search_companies", input: { limit: 5, filters: { field: "locations.country", type: "=", value: "IND" } } }]);
    expect(turn.raw).toEqual(output);
  });

  it("omits reasoning when no effort is configured, and reports text-only turns as end", async () => {
    const { f, reqs } = mockFetch([{ body: { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "a" }, { type: "output_text", text: "b" }] }] } }]);
    const turn = await openaiModel(KEY, "gpt-test", f).complete({ system: "S", messages: [{ role: "user", text: "q" }], tools: [] });
    expect(reqs[0]!.body).not.toHaveProperty("reasoning");
    expect(turn).toMatchObject({ text: "a\nb", toolCalls: [], stop: "end" });
  });

  it("keeps unparseable arguments visible instead of throwing; maps max_output_tokens to max_tokens", async () => {
    const { f } = mockFetch([
      { body: { output: [{ type: "function_call", call_id: "c", name: "search_companies", arguments: "{oops" }] } },
      { body: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] } },
    ]);
    const m = openaiModel(KEY, "gpt-test", f);
    const t1 = await m.complete({ system: "S", messages: [{ role: "user", text: "q" }], tools: TOOLS });
    expect(t1.toolCalls[0]!.input).toEqual({ __unparseable_arguments: "{oops" });
    const t2 = await m.complete({ system: "S", messages: [{ role: "user", text: "q" }], tools: TOOLS });
    expect(t2.stop).toBe("max_tokens");
  });

  it("replays the previous turn's raw output items, then function_call_output items (errors prefixed)", async () => {
    const raw = [
      { type: "reasoning", id: "rs_1", encrypted_content: "opaque" },
      { type: "function_call", call_id: "call_1", name: "search_companies", arguments: '{"limit":5}' },
      { type: "function_call", call_id: "call_2", name: "search_people", arguments: "{}" },
    ];
    const messages: AgentMessage[] = [
      { role: "user", text: "find startups" },
      { role: "assistant", text: "", toolCalls: [{ id: "call_1", name: "search_companies", input: { limit: 5 } }, { id: "call_2", name: "search_people", input: {} }], raw },
      { role: "tool", results: [{ id: "call_1", content: '{"ref":"c1"}' }, { id: "call_2", content: "search_people needs filters.", isError: true }] },
    ];
    const { f, reqs } = mockFetch([{ body: { output: [] } }]);
    await openaiModel(KEY, "gpt-test", f).complete({ system: "S", messages, tools: TOOLS });
    expect(reqs[0]!.body.input).toEqual([
      { role: "user", content: "find startups" },
      ...raw,
      { type: "function_call_output", call_id: "call_1", output: '{"ref":"c1"}' },
      { type: "function_call_output", call_id: "call_2", output: "ERROR: search_people needs filters." },
    ]);
  });

  it("rebuilds assistant items from text + tool calls when there is no raw output", async () => {
    const { f, reqs } = mockFetch([{ body: { output: [] } }]);
    await openaiModel(KEY, "gpt-test", f).complete({
      system: "S",
      messages: [{ role: "user", text: "q" }, { role: "assistant", text: "thinking", toolCalls: [{ id: "x1", name: "search_companies", input: { limit: 2 } }] }],
      tools: TOOLS,
    });
    expect(reqs[0]!.body.input).toEqual([
      { role: "user", content: "q" },
      { role: "assistant", content: "thinking" },
      { type: "function_call", call_id: "x1", name: "search_companies", arguments: '{"limit":2}' },
    ]);
  });

  it("throws ModelApiError on non-2xx with the provider's message and status", async () => {
    const { f } = mockFetch([{ status: 401, body: { error: { message: "Incorrect API key provided" } } }]);
    const err = await openaiModel(KEY, "gpt-test", f).complete({ system: "S", messages: [{ role: "user", text: "q" }], tools: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(ModelApiError);
    expect(err).toMatchObject({ provider: "OpenAI", status: 401 });
    expect(err.message).toBe("OpenAI API 401: Incorrect API key provided");
    expect(err.message).not.toContain(KEY);
  });

  it("handles non-JSON error bodies", async () => {
    const { f } = mockFetch([{ status: 502, body: "<html>Bad gateway</html>" }]);
    await expect(openaiModel(KEY, "gpt-test", f).complete({ system: "S", messages: [{ role: "user", text: "q" }], tools: [] })).rejects.toMatchObject({ status: 502, message: expect.stringContaining("Bad gateway") });
  });
});

describe("modelFromEnv", () => {
  const ok = { body: { output: [] } };

  it("returns null without any model key (blank keys count as missing)", () => {
    expect(modelFromEnv({})).toBeNull();
    expect(modelFromEnv({ OPENAI_API_KEY: "  ", ANTHROPIC_API_KEY: "" })).toBeNull();
  });

  it("uses OpenAI with the default model and high reasoning effort", async () => {
    const { f, reqs } = mockFetch([ok]);
    const m = modelFromEnv({ OPENAI_API_KEY: ` ${KEY} ` }, f)!;
    expect(m).toMatchObject({ provider: "openai", model: DEFAULT_OPENAI_MODEL });
    await m.complete({ system: "S", messages: [{ role: "user", text: "q" }], tools: [] });
    expect(reqs[0]!.body).toMatchObject({ model: DEFAULT_OPENAI_MODEL, reasoning: { effort: "high" } });
  });

  it("respects OPENAI_MODEL and OPENAI_REASONING_EFFORT", async () => {
    const { f, reqs } = mockFetch([ok]);
    const m = modelFromEnv({ OPENAI_API_KEY: KEY, OPENAI_MODEL: " gpt-custom ", OPENAI_REASONING_EFFORT: "low" }, f)!;
    expect(m.model).toBe("gpt-custom");
    await m.complete({ system: "S", messages: [{ role: "user", text: "q" }], tools: [] });
    expect(reqs[0]!.body).toMatchObject({ model: "gpt-custom", reasoning: { effort: "low" } });
  });

  it("prefers Anthropic when ANTHROPIC_API_KEY is set", () => {
    expect(modelFromEnv({ ANTHROPIC_API_KEY: "ak-test", OPENAI_API_KEY: KEY })?.provider).toBe("anthropic");
  });

  it("puts the key only in the authorization header — never in the URL or body", async () => {
    const { f, reqs } = mockFetch([ok]);
    const m = modelFromEnv({ OPENAI_API_KEY: KEY }, f)!;
    await m.complete({ system: "S", messages: [{ role: "user", text: "q" }], tools: TOOLS });
    const r = reqs[0]!;
    expect(r.url).not.toContain(KEY);
    expect(r.raw).not.toContain(KEY);
    expect(Object.entries(r.headers).filter(([, v]) => v.includes(KEY))).toEqual([["authorization", `Bearer ${KEY}`]]);
    expect(JSON.stringify(m)).not.toContain(KEY);
  });
});
