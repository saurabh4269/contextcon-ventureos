// Usage: BASE=http://localhost:3240 OUT=dir node scripts/chartshots.mjs ids...
// → <OUT>/<id>__<n>.png : one element screenshot per chart card (1440 wide @2x), in page order.
import { chromium } from "playwright";
import fs from "fs";
const R = { today: "/today", "deal-page": "/deal", "deal-helio": "/deal?id=helio", "ic-memo": "/memo", "memo-helio": "/memo?id=helio", pipeline: "/pipeline", portfolio: "/portfolio", "portfolio-helio": "/portfolio?company=helio", "firm-brain": "/brain" };
const BASE = process.env.BASE || "http://localhost:3240", OUT = process.env.OUT || "/tmp/charts";
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
for (const id of process.argv.slice(2)) {
  const p = await ctx.newPage();
  await p.goto(BASE + R[id], { waitUntil: "networkidle" });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } window.scrollTo(0, 0); });
  await p.waitForTimeout(2500);
  const n = await p.evaluate(() => {
    const out = [];
    for (const s of document.querySelectorAll("svg")) {
      const r = s.getBoundingClientRect();
      if (r.width < 160 || r.height < 56 || s.closest("[data-chart-skip]")) continue;
      let c = s.parentElement, best = null;
      while (c && c !== document.body) {
        const cs = getComputedStyle(c), w = c.getBoundingClientRect().width;
        if (w > 1250) break;
        if (parseFloat(cs.borderTopLeftRadius) >= 10 && (cs.borderTopWidth !== "0px" || cs.boxShadow !== "none" || cs.backgroundColor !== "rgba(0, 0, 0, 0)")) best = c;
        c = c.parentElement;
      }
      if (best && !out.includes(best) && !out.some((o) => o.contains(best) || best.contains(o))) out.push(best);
    }
    out.forEach((e, i) => e.setAttribute("data-chartshot", String(i)));
    return out.length;
  });
  for (let i = 0; i < n; i++) {
    const el = p.locator(`[data-chartshot="${i}"]`);
    await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(900);
    await el.screenshot({ path: `${OUT}/${id}__${i + 1}.png` });
  }
  console.log(id, n); await p.close();
}
await b.close();
