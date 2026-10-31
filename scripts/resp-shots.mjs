// Responsive screenshots + overflow report for any routes, at phone / tablet / desktop widths.
//   node scripts/resp-shots.mjs [--base=http://localhost:3240] [--out=/tmp/resp_shots] [--sizes=390,768,1440] [--sim] [--full] <route...>
// Default routes = every product screen. Writes <out>/<slug>@<w>.png and prints, per shot, the document scroll width and
// the widest elements inside <main> that stick out past the viewport (ignoring ones clipped by a scrolling parent).
// --sim: fakes the shell's responsive work (drops min-w-[1280px], hides the sidebar and dock under 1024px, clips the top bar)
//        so page content can be judged on its own before the shell change lands.
import fs from "node:fs";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const BASE = opt("base", "http://localhost:3240");
const OUT = opt("out", "/tmp/resp_shots");
const SIZES = opt("sizes", "390,768,1440").split(",").map(Number);
const SIM = args.includes("--sim");
const FULL = args.includes("--full");
fs.mkdirSync(OUT, { recursive: true });

let routes = args.filter((a) => !a.startsWith("--"));
if (!routes.length) {
  let founder = null;
  try {
    const r = await (await fetch(`${BASE}/api/live/research?domain=e2b.dev`)).json();
    founder = r.calls?.founders?.data?.people?.find((p) => p.linkedinUrl)?.linkedinUrl ?? null;
  } catch {}
  routes = [
    "/today", "/pipeline", "/deal?domain=e2b.dev", "/deal?domain=e2b.dev&tab=team", "/deal?domain=e2b.dev&tab=market",
    "/deal?domain=e2b.dev&tab=valuation", "/deal/room?id=e2b.dev", "/memo?id=e2b.dev",
    ...(founder ? [`/person?linkedin=${encodeURIComponent(founder)}&domain=e2b.dev`] : ["/person"]),
    "/portfolio", "/mandates", "/brain", "/settings", "/settings?section=connectors", "/settings?section=workflow",
    "/slack", "/preview/slack", "/landing",
  ];
}
const slug = (r) => r.replace(/^\//, "").replace(/linkedin=[^&]+/, "linkedin").replace(/[^a-z0-9]+/gi, "_").replace(/_+$/, "") || "home";

const SIM_CSS = `
[data-dock]{min-width:0!important}
@media (max-width:1023px){[data-dock]>aside{display:none!important}}
main>header, main>div:first-child{max-width:100%;overflow:hidden}
`;

const browser = await chromium.launch();
try {
  for (const w of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : w < 1000 ? 1024 : 900 }, deviceScaleFactor: 1 });
    for (const r of routes) {
      const page = await ctx.newPage();
      const errs = [];
      try {
      page.on("pageerror", (e) => errs.push(e.message));
      await page.goto(BASE + r, { waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => errs.push(String(e)));
      if (SIM) await page.addStyleTag({ content: SIM_CSS }).catch(() => {});
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(1800);
      if (SIM) await page.addStyleTag({ content: SIM_CSS }).catch(() => {});
      const report = await page.evaluate(() => {
        const vw = window.innerWidth;
        const clipped = (el) => {
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { const pr = p.getBoundingClientRect(); if (pr.right <= vw + 1) return true; }
          }
          return false;
        };
        const root = document.querySelector("main") ?? document.body;
        const out = [];
        for (const el of root.querySelectorAll("*")) {
          const b = el.getBoundingClientRect();
          if (!b.width || b.right <= vw + 1) continue;
          if (clipped(el)) continue;
          const s = getComputedStyle(el);
          if (s.visibility === "hidden" || s.display === "none" || s.position === "fixed") continue;
          const cls = typeof el.className === "string" ? el.className : el.getAttribute("class") ?? "";
          out.push({ tag: el.tagName.toLowerCase(), right: Math.round(b.right), w: Math.round(b.width), cls: cls.slice(0, 110), text: (el.textContent ?? "").trim().slice(0, 40) });
        }
        // keep only outermost offenders
        const top = out.filter((o, i) => !out.slice(0, i).some((p) => p.right === o.right && p.w >= o.w)).slice(0, 8);
        return { scrollW: document.documentElement.scrollWidth, vw, offenders: top };
      });
      const file = `${OUT}/${slug(r)}@${w}.png`;
      await page.screenshot({ path: file, fullPage: FULL || w < 1000 }).catch((e) => errs.push(String(e)));
      const flag = report.scrollW > report.vw + 1 ? `OVERFLOW scrollW=${report.scrollW}` : "ok";
      console.log(`${w}\t${r}\t${flag}\t${file}`);
      for (const o of report.offenders) console.log(`    > ${o.tag} right=${o.right} w=${o.w} .${o.cls} "${o.text}"`);
      for (const e of errs.slice(0, 3)) console.log(`    ! ${e.slice(0, 200)}`);
      } catch (e) { console.log(`${w}\t${r}\tFAILED ${String(e).split("\n")[0]}`); }
      await page.close().catch(() => {});
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
