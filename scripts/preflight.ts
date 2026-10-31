#!/usr/bin/env tsx
/**
 * Pre-demo checklist (run before recording a Loom):
 *   npx tsx scripts/preflight.ts [--offline] [--json]
 * Checks key presence (prints only "set"/"missing"), OUTBOUND_MODE safety, and — unless --offline — free health pings
 * (Crustdata GET /account/credits, model lookup, the local app). Exit 1 if any required check fails.
 * Logic lives in src/lib/preflight.ts (tested); this file only loads .env.local and prints.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkEnv, format, formatJson, hasFailures, redact, runPings } from "../src/lib/preflight";

/** Minimal dotenv: KEY=VALUE lines, optional `export ` and quotes; never overrides existing env, never prints. */
function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || process.env[m[1]!] !== undefined) continue;
    let v = m[2]!.trim();
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    process.env[m[1]!] = v;
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url)));
  const env = process.env;
  const results = [...checkEnv(env), ...(args.has("--offline") ? [] : await runPings(env, fetch))];
  if (args.has("--json")) console.log(formatJson(results, env));
  else console.log(`${format(results, env)}${args.has("--offline") ? "\n(live pings skipped: --offline)" : ""}`);
  process.exitCode = hasFailures(results) ? 1 : 0;
}

main().catch((e) => {
  console.error(redact(`preflight crashed: ${e instanceof Error ? e.message : String(e)}`, process.env));
  process.exit(1);
});
