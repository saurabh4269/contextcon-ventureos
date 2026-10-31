// Client bundles: no "use client" module may reach (through value imports) a module that uses node:fs, postgres or
// server-only. A dev build fails on that import ("node:fs is not handled"), and the store must never ship to browsers.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));
const files = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "port/src"))].filter((f) => !/\.test\.tsx?$/.test(f) && !f.includes(`${path.sep}test${path.sep}`));
const SERVER = /from\s+["'](node:fs|fs|node:os|postgres|server-only)["']|^import\s+["']server-only["']/m;

function resolve(spec: string, from: string): string | null {
  const base = spec.startsWith("@/") ? path.join(ROOT, "src", spec.slice(2)) : spec.startsWith("@port/") ? path.join(ROOT, "port/src", spec.slice(6)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}
const valueImports = (src: string) => [...src.matchAll(/^import\s+(?!type\s)([^;]*?)\s+from\s+["']([^"']+)["']|^export\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[2] ?? m[3]!).filter(Boolean);

describe("client bundles", () => {
  it("no client module reaches node:fs / postgres / server-only through value imports", () => {
    const bad: string[] = [];
    for (const f of files.filter((x) => /^["']use client["']/.test(fs.readFileSync(x, "utf8").trimStart()))) {
      const seen = new Set<string>(), stack: [string, string[]][] = [[f, [path.relative(ROOT, f)]]];
      while (stack.length) {
        const [cur, trail] = stack.pop()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        const src = fs.readFileSync(cur, "utf8");
        if (cur !== f && SERVER.test(src)) { bad.push(trail.join(" → ")); break; }
        for (const s of valueImports(src)) { const r = resolve(s, cur); if (r) stack.push([r, [...trail, path.relative(ROOT, r)]]); }
      }
    }
    expect(bad).toEqual([]);
  });
});
