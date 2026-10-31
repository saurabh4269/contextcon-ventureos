// Provider-neutral tool-use model client for the screening agent. Anthropic is used when ANTHROPIC_API_KEY is set,
// otherwise OpenAI's Responses API (OPENAI_API_KEY, model OPENAI_MODEL, reasoning effort OPENAI_REASONING_EFFORT); with neither set `modelFromEnv` returns null and callers report "model
// unavailable" — there is no fake/deterministic stand-in. Keys are only ever placed in request headers.

export type ToolSpec = { name: string; description: string; input_schema: Record<string, unknown> };
export type ToolCall = { id: string; name: string; input: Record<string, unknown> };
export type ModelTurn = { text: string; toolCalls: ToolCall[]; stop: "tool_use" | "end" | "max_tokens" | "other"; raw?: unknown };

/** Conversation in a neutral shape; each adapter converts it to its wire format. */
export type AgentMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: ToolCall[]; /** provider output items, replayed as-is (OpenAI reasoning) */ raw?: unknown }
  | { role: "tool"; results: { id: string; content: string; isError?: boolean }[] };

export interface ModelClient {
  readonly provider: "anthropic" | "openai";
  readonly model: string;
  complete(input: { system: string; messages: AgentMessage[]; tools: ToolSpec[]; maxTokens?: number }): Promise<ModelTurn>;
}

export class ModelApiError extends Error {
  constructor(readonly provider: string, readonly status: number, message: string) {
    super(`${provider} API ${status}: ${message}`);
    this.name = "ModelApiError";
  }
}

type Env = Record<string, string | undefined>;

const errText = (body: unknown) => {
  const b = body as { error?: { message?: string } | string; message?: string } | null;
  return (typeof b?.error === "object" ? b.error?.message : b?.error) ?? b?.message ?? "request failed";
};

async function postJson(f: typeof fetch, provider: string, url: string, headers: Record<string, string>, body: unknown, timeoutMs = 90_000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await f(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { message: text.slice(0, 200) };
    }
    if (!res.ok) throw new ModelApiError(provider, res.status, errText(json));
    return json;
  } finally {
    clearTimeout(t);
  }
}

export function anthropicModel(apiKey: string, model: string, f: typeof fetch = fetch): ModelClient {
  return {
    provider: "anthropic",
    model,
    async complete({ system, messages, tools, maxTokens = 4096 }) {
      const wire = messages.map((m) => {
        if (m.role === "user") return { role: "user", content: m.text };
        if (m.role === "assistant")
          return {
            role: "assistant",
            content: [...(m.text ? [{ type: "text", text: m.text }] : []), ...m.toolCalls.map((c) => ({ type: "tool_use", id: c.id, name: c.name, input: c.input }))],
          };
        return { role: "user", content: m.results.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.content, ...(r.isError ? { is_error: true } : {}) })) };
      });
      const data = (await postJson(f, "Anthropic", "https://api.anthropic.com/v1/messages", { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, {
        model,
        max_tokens: maxTokens,
        system,
        tools,
        messages: wire,
      })) as { content?: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[]; stop_reason?: string };
      const content = data.content ?? [];
      return {
        text: content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim(),
        toolCalls: content.filter((c) => c.type === "tool_use").map((c) => ({ id: c.id!, name: c.name!, input: c.input ?? {} })),
        stop: data.stop_reason === "tool_use" ? "tool_use" : data.stop_reason === "end_turn" ? "end" : data.stop_reason === "max_tokens" ? "max_tokens" : "other",
      };
    },
  };
}

/**
 * OpenAI Responses API (POST /v1/responses) with function tools. The assistant turn's raw output items (reasoning +
 * function_call) are replayed verbatim on the next request so reasoning context carries across tool calls.
 */
export function openaiModel(apiKey: string, model: string, f: typeof fetch = fetch, opts: { reasoningEffort?: string } = {}): ModelClient {
  return {
    provider: "openai",
    model,
    async complete({ system, messages, tools, maxTokens = 16_000 }) {
      const input: unknown[] = [];
      for (const m of messages) {
        if (m.role === "user") input.push({ role: "user", content: m.text });
        else if (m.role === "assistant") {
          if (Array.isArray(m.raw)) input.push(...m.raw);
          else {
            if (m.text) input.push({ role: "assistant", content: m.text });
            for (const c of m.toolCalls) input.push({ type: "function_call", call_id: c.id, name: c.name, arguments: JSON.stringify(c.input) });
          }
        } else for (const r of m.results) input.push({ type: "function_call_output", call_id: r.id, output: r.isError ? `ERROR: ${r.content}` : r.content });
      }
      const data = (await postJson(
        f,
        "OpenAI",
        "https://api.openai.com/v1/responses",
        { authorization: `Bearer ${apiKey}` },
        {
          model,
          instructions: system,
          input,
          max_output_tokens: maxTokens,
          ...(opts.reasoningEffort ? { reasoning: { effort: opts.reasoningEffort } } : {}),
          tools: tools.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.input_schema })),
        },
        300_000,
      )) as { output?: { type: string; call_id?: string; name?: string; arguments?: string; content?: { type: string; text?: string }[] }[]; status?: string; incomplete_details?: { reason?: string } | null };
      const output = data.output ?? [];
      const calls = output
        .filter((o) => o.type === "function_call")
        .map((o) => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(o.arguments || "{}");
          } catch {
            parsed = { __unparseable_arguments: o.arguments };
          }
          return { id: o.call_id!, name: o.name!, input: parsed };
        });
      const text = output
        .filter((o) => o.type === "message")
        .flatMap((o) => o.content ?? [])
        .filter((c) => c.type === "output_text")
        .map((c) => c.text ?? "")
        .join("\n")
        .trim();
      const stop = calls.length ? "tool_use" : data.status === "incomplete" ? (data.incomplete_details?.reason === "max_output_tokens" ? "max_tokens" : "other") : "end";
      return { text, toolCalls: calls, stop, raw: output };
    },
  };
}

export const DEFAULT_OPENAI_MODEL = "gpt-6.1-sol";
/** Cheap model for light sub-steps (OPENAI_FAST_MODEL). */
export const DEFAULT_OPENAI_FAST_MODEL = "gpt-6-luna";

/** Anthropic when ANTHROPIC_API_KEY is set, else OpenAI when OPENAI_API_KEY is set, else null (model unavailable). */
export function modelFromEnv(env: Env = process.env, f: typeof fetch = fetch): ModelClient | null {
  const a = env.ANTHROPIC_API_KEY?.trim();
  if (a) return anthropicModel(a, env.DEALDESK_LLM_MODEL?.trim() || "claude-sonnet-5-5", f);
  const o = env.OPENAI_API_KEY?.trim();
  if (o) return openaiModel(o, env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL, f, { reasoningEffort: env.OPENAI_REASONING_EFFORT?.trim() || "high" });
  return null;
}
