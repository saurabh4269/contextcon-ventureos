// Times shown to users are IST (docs/API.md "Data rules"; src/lib/format). Guard: production code never formats a
// date/time with the browser's or server's local zone — every toLocaleDateString/TimeString names a timeZone, and
// nothing reads local clock fields (getHours/getDate/…) for display.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const walk = (dir: string): string[] =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []))
    : [];
const rel = (f: string) => path.relative(ROOT, f);
const production = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "port/src"))].filter((f) => !/\.test\.tsx?$/.test(f) && !rel(f).startsWith("src/test/"));

describe("IST everywhere", () => {
  it("no local-zone date/time formatting in production code", () => {
    const bad: string[] = [];
    for (const f of production) {
      fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        const localFormat = /\.toLocale(Date|Time)String\(/.test(line) && !/timeZone/.test(line);
        const localFields = /\.get(Hours|Minutes|Date|Day|Month|FullYear)\(\)/.test(line) && !/ist-ok/.test(line);
        if (localFormat || localFields) bad.push(`${rel(f)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
