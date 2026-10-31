// Builds <out>/REPORT.md from raw_before.json and raw_after.json (scripts/skeleton-audit.mjs).
//   node scripts/skeleton-audit-report.mjs [--out=/workspace/skeleton_audit]
import fs from "node:fs";
import path from "node:path";
const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "/workspace/skeleton_audit";
const load = (l) => JSON.parse(fs.readFileSync(path.join(OUT, `raw_${l}.json`), "utf8")).filter((r) => !r.failed);
const before = load("before"), after = load("after");
const key = (r) => `${r.screen}|${r.width}|${r.final}`;
const B = new Map(before.map((r) => [key(r), r])), A = new Map(after.map((r) => [key(r), r]));
const f4 = (v) => (v == null ? "—" : v.toFixed(4));
const n = (v) => (v == null ? "—" : String(v));
const lines = [];
const rows = [...new Set([...B.keys(), ...A.keys()])].sort((a, b) => {
  const [sa, wa, fa] = a.split("|"), [sb, wb, fb] = b.split("|");
  return sa === sb ? (wa === wb ? ["loaded", "empty", "error"].indexOf(fa) - ["loaded", "empty", "error"].indexOf(fb) : wb - wa) : 0;
});
lines.push("# Skeleton audit", "",
  "Local `npm run build && DEALDESK_DATA_MODE=live npm start`, Chrome via Playwright, APIs mocked by route interception (0 Crustdata credits).",
  "Mock bodies: Crustdata-shaped ones are built from the checked-in E2B captures; the rest are small hand-written bodies (4 deals, 3 review items, 6 memories, 1 portfolio company, 1 workflow deal, 3 result rows).",
  "Skeleton row counts follow that common case (4 table rows, 3 review cards, 6 memories, a 2-row Ask result, a 3-company Sourcing result …).",
  "`/ask?q=` and `/agent?q=` show a result-shaped placeholder (summary, filter cards, table or cards; Understood, Steps, summary and results) from the first moment of the run; their timeline and steps grow above or beside it as the stream arrives.", "",
  "How to read the columns", "",
  "- **State**: the final state after the skeleton: `loaded` (mock data), `empty` (API returns nothing), `error` (API answers 500).",
  "- **CLS**: sum of `layout-shift` entries (PerformanceObserver, ignoring input-driven ones) from the moment the held API calls are released until the screen settles. React replaces skeleton nodes by new nodes, and the browser does not count replaced nodes as shifts, so CLS stays near 0 even when the page jumps. The two measures below catch that jump.",
  "- **Max Δ px**: for every loaded layout block (header, title, card, table, chart and, in `loaded`, each row) the distance to its nearest skeleton block = max(|Δx|, |Δy|, |Δwidth|, |Δheight|); the table shows the largest one. 0 = every block was already where it ends up.",
  "- **Mean Δ px**: the same distance averaged over all blocks of the screen.",
  "- **Page Δ px**: loaded document height minus skeleton document height (how far the page grew or shrank).", "",
  "| Screen | Width | State | CLS before | CLS after | Max Δ before | Max Δ after | Mean Δ before → after | Page Δ before → after |", "|---|---|---|---|---|---|---|---|---|");
for (const k of rows) {
  const b = B.get(k), a = A.get(k), r = a ?? b;
  if (r.static) continue;
  lines.push(`| ${r.screen} | ${r.width} | ${r.final} | ${f4(b?.cls.transition)} | ${f4(a?.cls.transition)} | ${n(b?.delta.max)} | ${n(a?.delta.max)} | ${n(b?.delta.mean)} → ${n(a?.delta.mean)} | ${n(b?.docHeight.delta)} → ${n(a?.docHeight.delta)} |`);
}
const statics = [...new Set((after.length ? after : before).filter((r) => r.static).map((r) => r.screen))];
lines.push("", `Screens with no API call have no loading state, so there is nothing to shift: ${statics.join(", ")}. They are in \`before/\` and \`after/\` as \`<screen>_<width>_loaded.png\`.`, "");
const worst = after.filter((r) => r.final === "loaded" && !r.static).sort((x, y) => (y.delta.max ?? 0) - (x.delta.max ?? 0)).slice(0, 8);
lines.push("## Largest remaining deltas after (loaded)", "", "| Screen | Width | Max Δ | Block |", "|---|---|---|---|", ...worst.map((r) => `| ${r.screen} | ${r.width} | ${r.delta.max} | ${r.delta.worst ? `${r.delta.worst.role} “${r.delta.worst.text}” at y=${r.delta.worst.y}, ${r.delta.worst.w}×${r.delta.worst.h}` : "—"} |`), "");
const ovf = after.filter((r) => r.final === "loaded" && r.horizontalOverflow.final > 0);
if (ovf.length) lines.push("## Horizontal overflow in the loaded page (px beyond the viewport)", "", ...ovf.map((r) => `- ${r.screen} @${r.width}: ${r.horizontalOverflow.final}px`), "");
const errs = after.filter((r) => r.consoleErrors.length);
lines.push("## Console errors and hydration warnings (after)", "", errs.length ? errs.map((r) => `- ${r.screen} @${r.width} ${r.final}: ${r.consoleErrors.join(" | ")}`).join("\n") : "None.", "");
lines.push("## Files", "", "- `before/`, `after/`: `<screen>_<width>_<state>.png` (state = loading, loaded, empty or error)", "- `compare/`: `<before|after>_<screen>_<width>_<state>.png`, skeleton on the left, final state on the right", "- `raw_before.json`, `raw_after.json`: every box (x, y, w, h, role), CLS entries, deltas, console errors", "- Reproduce: `npx tsx scripts/skeleton-audit/gen-mocks.ts` (only to rebuild mocks), `node scripts/skeleton-audit.mjs --label=after`, `node scripts/skeleton-audit-report.mjs`", "");
fs.writeFileSync(path.join(OUT, "REPORT.md"), lines.join("\n"));
console.log(`wrote ${path.join(OUT, "REPORT.md")} (${rows.length} rows)`);
