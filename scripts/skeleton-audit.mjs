// Skeleton UI audit. Drives a local `npm run build && DEALDESK_DATA_MODE=live npm start` (port 3240) with Playwright.
//   node scripts/skeleton-audit.mjs --label=before|after [--base=http://localhost:3240] [--out=/workspace/skeleton_audit]
//        [--only=today,deal] [--widths=1440,390] [--states=loaded,empty,error]
// For every screen, width and final state (loaded | empty | error) it:
//   1. holds every API call of the screen (route interception, mocks from scripts/skeleton-audit/mocks.mjs: 0 credits),
//   2. captures the loading state (skeleton): screenshot + bounding boxes of the layout blocks,
//   3. releases the calls with the mocked body for the final state, waits until the screen settles, and captures again,
//   4. reports layout shift from PerformanceObserver("layout-shift") between release and settle, the largest box delta
//      between each loaded block and its nearest skeleton block, and the change in document height.
// Output: <out>/<label>/<screen>_<width>_<state>.png, <out>/compare/<label>_<screen>_<width>_<final>.png (skeleton | final),
// <out>/raw_<label>.json. Screens with no API call (landing, mandates, slack …) are measured once, as "loaded".
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { API, AMBIENT, errorResponse, FALLBACK_EXCEPTIONS } from "./skeleton-audit/mocks.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const BASE = opt("base", "http://localhost:3240");
const OUT = opt("out", "/workspace/skeleton_audit");
const LABEL = opt("label", "after");
const ONLY = opt("only", "")?.split(",").filter(Boolean);
const WIDTHS = opt("widths", "1440,390").split(",").map(Number);
const FINALS = opt("states", "loaded,empty,error").split(",");
const HEIGHT = { 1440: 900, 390: 844 };
const LI = encodeURIComponent("https://www.linkedin.com/in/mlejva");

/** id, path, api keys held while loading. No keys = static screen. */
export const SCREENS = [
  { id: "today", path: "/today", keys: ["pipeline", "exceptions", "gmail", "calendar", "research", "decisions"] },
  { id: "pipeline", path: "/pipeline", keys: ["pipeline", "exceptions", "research", "decisions"] },
  { id: "deal", path: "/deal?domain=e2b.dev", keys: ["research", "decisions"] },
  { id: "person", path: `/person?linkedin=${LI}&domain=e2b.dev`, keys: ["person"] },
  { id: "ask", path: "/ask", keys: [] },
  { id: "ask-result", path: "/ask?q=Find%20Indian%20B2B%20software%20companies", keys: ["screen"] },
  { id: "agent", path: "/agent", keys: [] },
  { id: "agent-run", path: "/agent?q=Indian%20B2B%20software%20companies%20founded%20after%202022%20growing%20fast", keys: ["sourcing"] },
  { id: "agents", path: "/agents", keys: [] },
  { id: "memo", path: "/memo?id=e2b.dev", keys: ["research", "decisions"] },
  { id: "review", path: "/review", keys: ["exceptions"] },
  { id: "portfolio", path: "/portfolio", keys: ["portfolio"] },
  { id: "brain", path: "/brain", keys: ["memory", "mandate"] },
  { id: "settings", path: "/settings", keys: ["connectors"] },
  { id: "settings-connectors", path: "/settings?section=connectors", keys: ["connectors"] },
  { id: "settings-mandate", path: "/settings/mandate", keys: ["mandate"] },
  { id: "workflow", path: "/workflow", keys: ["workflowList", "workflowInbox"] },
  { id: "workflow-deal", path: "/workflow?id=wf000001", keys: ["workflowDeal"] },
  { id: "deal-room", path: "/deal/room?id=e2b.dev", keys: [] },
  { id: "landing", path: "/landing", keys: [] },
  { id: "mandates", path: "/mandates", keys: [] },
  { id: "slack", path: "/slack", keys: [] },
  { id: "preview-slack", path: "/preview/slack", keys: [] },
  { id: "home", path: "/", keys: [] },
];

const CLS_INIT = `
window.__shifts = [];
try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ t: e.startTime, v: e.value }); }).observe({ type: "layout-shift", buffered: true }); } catch {}
`;

/** Runs in the page: layout blocks (headers, titles, cards, tables, rows, charts, skeleton bars) in document coordinates. */
function collectBoxes() {
  const sx = window.scrollX, sy = window.scrollY, out = [];
  const num = (v) => Math.round(v * 10) / 10;
  const fixedAncestor = (el) => { for (let p = el; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === "fixed") return true; return false; };
  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
    if (el.closest("[data-testid=data-mode-badge]") || fixedAncestor(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 16 || r.height < 8) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const tag = el.tagName.toLowerCase(), cls = typeof el.className === "string" ? el.className : "";
    const radius = parseFloat(cs.borderTopLeftRadius) || 0;
    const boxy = cs.boxShadow !== "none" || ["Top", "Right", "Bottom", "Left"].some((s) => parseFloat(cs[`border${s}Width`]) > 0) || (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent");
    let role = null;
    if (/\banimate-pulse\b/.test(cls)) role = "skeleton";
    else if (tag === "header" || el.getAttribute("role") === "banner") role = "header";
    else if (tag === "h1") role = "title";
    else if (tag === "table" || el.getAttribute("role") === "table") role = "table";
    else if (tag === "tr" || el.getAttribute("role") === "row" || (tag === "li" && boxy)) role = "row";
    else if ((tag === "svg" && r.width >= 60 && r.height >= 30) || tag === "canvas" || /recharts-wrapper/.test(cls)) role = "chart";
    else if ((tag === "section" || tag === "article" || (boxy && radius >= 8)) && r.width >= 80 && r.height >= 28) role = "card";
    if (!role) continue;
    out.push({ role, tag, x: num(r.left + sx), y: num(r.top + sy), w: num(r.width), h: num(r.height), cls: cls.slice(0, 70), text: (el.textContent || "").trim().slice(0, 24) });
  }
  // drop a child that repeats its parent's rectangle with the same role
  const keep = out.filter((b, i) => !out.slice(0, i).some((p) => p.role === b.role && Math.abs(p.x - b.x) < 1 && Math.abs(p.y - b.y) < 1 && Math.abs(p.w - b.w) < 1 && Math.abs(p.h - b.h) < 1));
  return { boxes: keep, docHeight: document.documentElement.scrollHeight, docWidth: document.documentElement.scrollWidth, busy: document.querySelectorAll(".animate-pulse, [aria-busy=true]").length };
}

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
const PRIMARY = new Set(["header", "title", "card", "table", "chart"]);
/** Largest / mean distance from each loaded block to its nearest skeleton block (rows only count for a loaded final). */
export function deltas(skel, fin, withRows) {
  const sk = skel.boxes, roles = withRows ? new Set([...PRIMARY, "row"]) : PRIMARY;
  const ls = fin.boxes.filter((b) => roles.has(b.role));
  if (!ls.length || !sk.length) return { max: null, mean: null, blocks: ls.length, worst: null };
  let max = 0, sum = 0, worst = null;
  for (const l of ls) {
    let best = Infinity;
    for (const s of sk) { const d = dist(l, s); if (d < best) best = d; }
    sum += best;
    if (best > max) { max = best; worst = { role: l.role, text: l.text, cls: l.cls, x: l.x, y: l.y, w: l.w, h: l.h, delta: Math.round(best) }; }
  }
  return { max: Math.round(max), mean: Math.round((sum / ls.length) * 10) / 10, blocks: ls.length, worst };
}

const sum = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) * 10000) / 10000;

async function runOne(browser, screen, width, final) {
  const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width] ?? 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.addInitScript(CLS_INIT);
  const consoleErrors = [];
  page.on("console", (m) => { if (/Failed to load resource/.test(m.text())) return; /* the mocked 500 of the error state */ if (m.type() === "error" || (m.type() === "warning" && /hydrat|did not match/i.test(m.text()))) consoleErrors.push(m.text().slice(0, 240)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 240)}`));
  let releaseFn;
  const gate = new Promise((r) => (releaseFn = r));
  let hold = screen.keys.length > 0;
  const mine = new Set(screen.keys);
  await page.route(/\/api\//, async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const amb = AMBIENT.find((a) => a.re.test(url) && (a.re.source.includes("events$") ? method === "POST" : true));
    if (amb) return route.fulfill({ status: amb.res.status, contentType: "application/json", body: JSON.stringify(amb.res.body) });
    const key = Object.keys(API).find((k) => API[k].re.test(url));
    if (!key) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ status: "error", message: "no mock" }) });
    if (!mine.has(key)) {
      // an API the screen shows in its shell (e.g. the Review count): always empty and instant
      const body = key === "exceptions" ? FALLBACK_EXCEPTIONS : { status: "ok" };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    }
    if (hold) await gate;
    const spec = final === "error" ? errorResponse() : final === "empty" ? API[key].empty : API[key].loaded;
    return route.fulfill({ status: spec.status, contentType: spec.type ?? "application/json", body: typeof spec.body === "string" ? spec.body : JSON.stringify(spec.body) });
  });
  const fileBase = `${screen.id}_${width}`;
  const shot = (state) => page.screenshot({ path: path.join(OUT, LABEL, `${fileBase}_${state}.png`), fullPage: true });
  await page.goto(BASE + screen.path, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(1300);
  const skeleton = await page.evaluate(collectBoxes);
  if (hold) await shot("loading");
  const mark = await page.evaluate(() => performance.now());
  hold = false; releaseFn();
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    await page.waitForTimeout(350);
    const busy = await page.evaluate(() => document.querySelectorAll(".animate-pulse, [aria-busy=true]").length);
    if (!busy && Date.now() - t0 > 900) break;
  }
  await page.waitForTimeout(700);
  const fin = await page.evaluate(collectBoxes);
  await shot(screen.keys.length ? final : "loaded");
  const shifts = await page.evaluate(() => window.__shifts);
  await ctx.close();
  const after = shifts.filter((s) => s.t >= mark);
  const withRows = final === "loaded";
  return {
    screen: screen.id, path: screen.path, width, final: screen.keys.length ? final : "loaded", static: !screen.keys.length,
    cls: { transition: sum(after.map((s) => s.v)), initial: sum(shifts.filter((s) => s.t < mark).map((s) => s.v)), shifts: after.length },
    docHeight: { skeleton: skeleton.docHeight, final: fin.docHeight, delta: fin.docHeight - skeleton.docHeight },
    horizontalOverflow: { skeleton: skeleton.docWidth - width, final: fin.docWidth - width },
    delta: screen.keys.length ? deltas(skeleton, fin, withRows) : { max: 0, mean: 0, blocks: 0, worst: null },
    skeletonBlocks: skeleton.boxes.length, finalBlocks: fin.boxes.length, skeletonBoxes: skeleton.boxes, finalBoxes: fin.boxes,
    stillBusy: fin.busy, consoleErrors: [...new Set(consoleErrors)],
  };
}

async function compare(rows) {
  const sharp = createRequire(import.meta.url)("sharp");
  fs.mkdirSync(path.join(OUT, "compare"), { recursive: true });
  for (const r of rows) {
    if (r.static) continue;
    const a = path.join(OUT, LABEL, `${r.screen}_${r.width}_loading.png`), b = path.join(OUT, LABEL, `${r.screen}_${r.width}_${r.final}.png`);
    if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
    const [ma, mb] = await Promise.all([sharp(a).metadata(), sharp(b).metadata()]);
    const H = Math.max(ma.height, mb.height), gap = 24;
    await sharp({ create: { width: ma.width + mb.width + gap, height: H, channels: 3, background: "#d4d4d8" } })
      .composite([{ input: a, left: 0, top: 0 }, { input: b, left: ma.width + gap, top: 0 }]).png().toFile(path.join(OUT, "compare", `${LABEL}_${r.screen}_${r.width}_${r.final}.png`));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.mkdirSync(path.join(OUT, LABEL), { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const rows = [];
  try {
    for (const screen of SCREENS) {
      if (ONLY.length && !ONLY.includes(screen.id)) continue;
      for (const width of WIDTHS) {
        for (const final of screen.keys.length ? FINALS : ["loaded"]) {
          if (!screen.keys.length && final !== "loaded") continue;
          try {
            const r = await runOne(browser, screen, width, final);
            rows.push(r);
            console.log(`${screen.id.padEnd(20)} ${String(width).padEnd(5)} ${r.final.padEnd(7)} CLS ${r.cls.transition.toFixed(4)}  maxΔ ${r.delta.max}  docΔ ${r.docHeight.delta}  err ${r.consoleErrors.length}`);
          } catch (e) {
            console.log(`${screen.id} ${width} ${final} FAILED ${String(e).slice(0, 160)}`);
            rows.push({ screen: screen.id, width, final, failed: String(e).slice(0, 300) });
          }
        }
      }
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(OUT, `raw_${LABEL}.json`), JSON.stringify(rows, null, 1));
  await compare(rows.filter((r) => !r.failed));
}
