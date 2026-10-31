#!/usr/bin/env tsx
/**
 * Live end-to-end run of the screening agent (real model + real Crustdata), same code path as POST /api/live/screen.
 *   tsx scripts/screen-live.ts "<query>" [out.json]
 * Env comes from .env.local (loaded in-process, never printed). Progress events go to stderr; the full event log and
 * verified result are written to the output file (default /workspace/nl-screener-run/live-output.json).
 */
import fs from "node:fs";
import { loadEnvLocal } from "./load-env";
import { createCrustdataClient, FileResponseCache } from "../src/lib/crustdata";
import { runScreenAgent } from "../src/lib/agent/agent";
import { modelFromEnv } from "../src/lib/agent/model";
import type { ScreenEvent } from "../src/lib/agent/contract";

loadEnvLocal();
const [query, out = "/workspace/nl-screener-run/live-output.json"] = process.argv.slice(2);
if (!query) throw new Error('usage: tsx scripts/screen-live.ts "<query>" [out.json]');

async function main() {
  const events: (ScreenEvent & { t: number })[] = [];
  const t0 = Date.now();
  const model = modelFromEnv();
  if (!model) {
    const e: ScreenEvent = { type: "model_unavailable", message: "No OPENAI_API_KEY / ANTHROPIC_API_KEY set." };
    fs.writeFileSync(out, JSON.stringify({ query, ranAt: new Date().toISOString(), events: [e] }, null, 2));
    console.error(e.message);
    return;
  }
  const client = createCrustdataClient({
    cache: new FileResponseCache(".cache/crustdata", 7 * 24 * 3600 * 1000),
    onLiveCall: (e) => console.error(`  [crustdata] ${e.method} ${e.path} ${e.status} credits=${e.creditsUsed ?? "?"} ${e.latencyMs}ms${e.error ? " " + e.error : ""}`),
  });
  const emit = (e: ScreenEvent) => {
    events.push({ ...e, t: Date.now() - t0 });
    const s = Math.round((Date.now() - t0) / 1000);
    if (e.type === "plan") console.error(`[${s}s] plan: ${e.text.slice(0, 400)}`);
    else if (e.type === "tool_call") console.error(`[${s}s] → ${e.ref} ${e.tool} ${JSON.stringify(e.input).slice(0, 400)}`);
    else if (e.type === "tool_result") console.error(`[${s}s] ← ${e.ref} ${e.status} rows=${e.rows ?? "-"} total=${e.totalCount ?? "-"} credits=${e.creditsUsed ?? "?"}${e.error ? " " + e.error : ""}`);
    else if (e.type === "verify") console.error(`[${s}s] verify: ${e.text}`);
    else if (e.type !== "final") console.error(`[${s}s] ${e.type}`);
  };
  try {
    const result = await runScreenAgent({ query, model, client, emit });
    fs.writeFileSync(out, JSON.stringify({ query, ranAt: new Date().toISOString(), model: result.model, events, result }, null, 2));
    console.error(`done: ${result.status} rows=${result.rows.length} credits=${result.credits.used} ${Math.round(result.timings.totalMs / 1000)}s → ${out}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    fs.writeFileSync(out, JSON.stringify({ query, ranAt: new Date().toISOString(), events, error: message }, null, 2));
    console.error(`failed: ${message}`);
    process.exitCode = 1;
  }
}
void main();
