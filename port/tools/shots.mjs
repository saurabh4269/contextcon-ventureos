// Usage: node scripts/shots.mjs [ids...]  → review/new/<screen>.png (1600px wide @2x)
import { chromium } from "playwright";
import fs from "fs";
const BASE = process.env.BASE || "http://localhost:3240";
// [route, viewportOnly]
export const routes = {
  "today": ["/today"], "first-run": ["/today?first=1"], "agent-run": ["/today?run=1", true], "command-k": ["/today?k=1", true],
  "pipeline": ["/pipeline"], "watchlist": ["/pipeline?view=watchlist"], "portfolio": ["/portfolio"], "mandates": ["/mandates"],
  "deal-page": ["/deal"], "data-room": ["/deal/room"], "ic-memo": ["/memo"], "firm-brain": ["/brain"], "settings": ["/settings"],
  "pipeline-board": ["/pipeline?board=1"], "today-banking": ["/today?mode=bank"],
  "onboarding-1": ["/today?first=1&step=1"], "onboarding-2": ["/today?first=1&step=2"], "onboarding-3": ["/today?first=1&step=3"],
  "onboarding-4": ["/today?first=1&step=4"], "onboarding-5": ["/today?first=1&step=5"],
  "command-k-denied": ["/today?k=1&denied=1", true], "ask": ["/today?ask=1", true], "ask-denied": ["/today?ask=denied", true],
  "hold-queue": ["/today?hold=1&tick=0"], "deal-team-open": ["/deal?team=open"], "deal-restricted": ["/deal?restricted=1"],
  "deal-pinned": ["/deal?pin=1"], "mandates-gated": ["/mandates?m=cobalt"], "memo-priors": ["/memo"],
  "settings-integrations": ["/settings?section=integrations"], "settings-members": ["/settings?section=members"],
  "settings-access": ["/settings?section=access"], "settings-export": ["/settings?section=export"], "slack-preview": ["/preview/slack"], "deal-helio": ["/deal?id=helio"], "memo-helio": ["/memo?id=helio"], "portfolio-helio": ["/portfolio?company=helio"], "slack-claim-1": ["/slack?state=claim&frame=1"], "slack-claim-2": ["/slack?state=claim&frame=2"], "slack-vote-1": ["/slack?state=vote&frame=1"], "slack-vote-2": ["/slack?state=vote&frame=2"], "slack-dealflow": ["/slack"], "slack-vote-3": ["/slack?state=vote&frame=3"], "slack-vote-4": ["/slack?state=vote&frame=4"], "slack-vote-5": ["/slack?state=vote&frame=5"], "slack-milestone": ["/slack?state=milestone"], "brain-learned-1": ["/brain?learned=1"], "brain-learned-2": ["/brain?learned=2"], "brain-learned-3": ["/brain?learned=3"], "today-inbound": ["/today?inbound=1"], "handoff-1": ["/pipeline?board=1&handoff=1"], "handoff-2": ["/pipeline?board=1&handoff=2"], "handoff-3": ["/pipeline?board=1&handoff=3"], "handoff-4": ["/pipeline?board=1&handoff=4"],
  "today-calm": ["/today?layout=calm", true], "today-calm-mono": ["/today?layout=calm&tone=mono", true], "agent": ["/agent?frame=5", true], "agent-mono": ["/agent?frame=5&tone=mono", true], "agent-flow": ["/agent?view=flow&frame=7", true], "agent-flow-mono": ["/agent?view=flow&frame=7&tone=mono", true],
  ...Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`agent-frame-${i + 1}`, [`/agent?frame=${i + 1}`, true]])), ...Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`agent-flow-frame-${i + 1}`, [`/agent?view=flow&frame=${i + 1}`, true]])),
};
const W = +(process.env.W || 1600), H = +(process.env.H || 1000), OUT = process.env.OUT || "review/new", FULL = process.env.FULL !== "0";
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(routes);
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DPR || 2) });
let p;
const attach = (pg) => { pg.on("pageerror", (e) => console.log("PAGEERROR", e.message)); pg.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text().slice(0, 200))); };
for (const id of ids) {
  const [r, vp] = routes[id];
  if (p) await p.close(); p = await ctx.newPage(); attach(p);
  await p.setViewportSize({ width: W, height: H });
  let res = await p.goto(BASE + r, { waitUntil: "networkidle" });
  if (res.status() !== 200) { await p.waitForTimeout(1500); res = await p.goto(BASE + r, { waitUntil: "networkidle" }); }
  await p.evaluate(() => document.fonts.ready);
  if (!vp && FULL) {
    const h = await p.evaluate(() => Math.ceil((document.querySelector("main") || document.body).scrollHeight));
    await p.setViewportSize({ width: W, height: Math.max(H, h) });
    // scroll through so in-view animations fire
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  }
  await p.waitForTimeout(2800);
  for (let tries = 0; tries < 3; tries++) {
    const hidden = await p.evaluate(() => [...document.querySelectorAll("[style*='opacity: 0']")].filter(e => e.getBoundingClientRect().width > 200 && !e.closest("[aria-hidden]")).length);
    if (!hidden) break;
    console.log("RETRY", id, "hidden", hidden);
    await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(3500);
  }
  await p.screenshot({ path: `${OUT}/${id}.png` });
  console.log("saved", id, res.status());
}
await b.close();
