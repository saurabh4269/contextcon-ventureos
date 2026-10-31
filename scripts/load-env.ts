// Loads KEY=value lines from .env.local into process.env (without overriding, never printing values).
import fs from "node:fs";
import path from "node:path";

export function loadEnvLocal(file = path.join(process.cwd(), ".env.local")) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || process.env[m[1]!]?.trim()) continue;
    process.env[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, "$2");
  }
}
