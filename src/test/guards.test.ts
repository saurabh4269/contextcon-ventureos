// Repository guards for the trust rules (docs/API.md "Data rules"):
//  1. Demo fixtures / test helpers are importable from tests only.
//  2. No demo data mode in production code.
//  3. Screens/components/adapters carry no hard-coded data values (amounts, percentages, dates, times, durations,
//     counts) in strings or JSX text. Design tokens/layout px are fine. Lines that legitimately need a literal carry a
//     `data-literal-ok: <why>` comment.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const walk = (dir: string): string[] =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []))
    : [];
const rel = (f: string) => path.relative(ROOT, f);
const isTest = (f: string) => /\.test\.tsx?$/.test(f) || rel(f).startsWith("src/test/") || rel(f).startsWith("port/test/");
const production = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "port/src"))].filter((f) => !isTest(f));

describe("fixtures are test-only", () => {
  it("no production file imports fixtures or test helpers", () => {
    const bad = production.filter((f) => /from\s+["'][^"']*(fixtures|\/test\/|@\/test)[^"']*["']|import\(["'][^"']*fixtures/.test(fs.readFileSync(f, "utf8")));
    expect(bad.map(rel)).toEqual([]);
  });
  it("port fixtures live under port/test", () => {
    expect(fs.existsSync(path.join(ROOT, "port/src/fixtures"))).toBe(false);
  });
});

describe("no demo data mode", () => {
  it("production code has no DEALDESK_DATA_MODE / fixture-forcing switches", () => {
    const bad = production.filter((f) => /DEALDESK_DATA_MODE|CRUSTDATA_FORCE_FIXTURE|DEALDESK_FORCE_FIXTURE|DEALDESK_FIXTURES|forceFixture/.test(fs.readFileSync(f, "utf8")));
    expect(bad.map(rel)).toEqual([]);
  });
});

/** String literals, template-literal static parts and JSX text of a source file, with their line numbers. */
export function literals(src: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
  const lineOf = (i: number) => noComments.slice(0, i).split("\n").length;
  const re = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`|>([^<>{}\n]*[^\s<>{}][^<>{}\n]*)</g;
  for (let m; (m = re.exec(noComments)); ) {
    const text = (m[1] ?? m[2] ?? m[3]?.replace(/\$\{[^}]*\}/g, " ") ?? m[4] ?? "").trim();
    if (text) out.push({ line: lineOf(m.index), text });
  }
  return out;
}

const CLASSY = /(^|\s)(-?[a-z]+(-[a-z0-9.[\]/%#,_()]+)+|[a-z]+:[^\s]+)(\s|$)/; // Tailwind class lists
/** CSS / SVG geometry: inline styles, keyframes, data URIs, bare positional percentages ("-50%", "38%", "600px 100%"). */
const CSSY = /[{}]|url\(|@keyframes|\btranslate|^[\s\d.%px-]+$/;
const DATA_PATTERNS: [string, RegExp][] = [
  ["money", /(?<![\^\\])[$₹€£]\s?\d/],
  ["percent", /(^|[^\w[(.-])[+−-]?\d+(\.\d+)?\s?%(?![\])])/],
  ["iso date", /\b(19|20)\d\d-\d\d(-\d\d)?\b/],
  ["clock time", /\b([01]?\d|2[0-3]):[0-5]\d\b/],
  ["month day", /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]* \d{1,2}\b|\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/],
  ["duration/ago", /\b\d+\s?(s|m|h|d|w|min|mins|minutes|hours?|days?|weeks?|months?|years?|yrs?)\s+ago\b|\b\d+\s?(minutes?|hours?|days?|weeks?|months?|years?)\b/],
  ["counted claim", /\b\d[\d,.]*\s?(K|M|B)?\+?\s+(people|companies|employees|deals|decks|calls|memories|this week|founders|roles)\b/i],
];
const SCANNED = ["port/src/screens", "port/src/components", "src/live", "src/app", "src/lib/adapters", "src/content"];

describe("no hard-coded data values in screens, components and adapters", () => {
  const files = SCANNED.flatMap((d) => walk(path.join(ROOT, d))).filter((f) => !isTest(f));
  it.each(files.map(rel))("%s", (file) => {
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    const lines = src.split("\n");
    const hits: string[] = [];
    for (const { line, text } of literals(src)) {
      if (/data-literal-ok:/.test(lines[line - 1] ?? "")) continue;
      if ((CLASSY.test(text) || CSSY.test(text)) && !/[$₹€£]/.test(text)) continue;
      for (const [kind, re] of DATA_PATTERNS) if (re.test(text)) hits.push(`${file}:${line} [${kind}] ${text.slice(0, 90)}`);
    }
    expect(hits.join("\n")).toBe("");
  });
});
