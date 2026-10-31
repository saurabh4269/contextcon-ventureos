#!/usr/bin/env tsx
// One tiny tool call per OpenAI model (Responses API): does it call the tool with the right args, and how fast?
// Usage: tsx scripts/model-smoke.ts [model ...]  → JSON timings on stdout. Never prints the key.
import { loadEnvLocal } from "./load-env";
import { openaiModel } from "../src/lib/agent/model";

loadEnvLocal();
const key = process.env.OPENAI_API_KEY?.trim();
if (!key) throw new Error("OPENAI_API_KEY not set");
const models = process.argv.slice(2).length ? process.argv.slice(2) : ["gpt-6.1-sol", "gpt-6-luna"];
const tool = {
  name: "search_companies",
  description: "Search companies by HQ country and minimum founding year.",
  input_schema: { type: "object", properties: { country: { type: "string", description: "ISO alpha-3" }, founded_min: { type: "integer" } }, required: ["country", "founded_min"], additionalProperties: false },
};
async function main() {
  const out = [];
  for (const model of models) {
    const m = openaiModel(key!, model, fetch, { reasoningEffort: "high" });
    const t0 = Date.now();
    try {
      const r = await m.complete({ system: "Use the tool to answer.", messages: [{ role: "user", text: "Find companies headquartered in India founded in 2023 or later." }], tools: [tool], maxTokens: 4000 });
      const c = r.toolCalls[0];
      const correct = c?.name === "search_companies" && /^(IND)$/i.test(String(c.input.country)) && Number(c.input.founded_min) === 2023;
      out.push({ model, ms: Date.now() - t0, ok: true, toolCalled: !!c, correct, input: c?.input ?? null, stop: r.stop });
    } catch (e) {
      out.push({ model, ms: Date.now() - t0, ok: false, error: e instanceof Error ? e.message.slice(0, 200) : String(e) });
    }
  }
  console.log(JSON.stringify(out, null, 2));
}
void main();
