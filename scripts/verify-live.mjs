// Live click-through of every route against a running server (default http://localhost:3277).
//   node scripts/verify-live.mjs [baseUrl]
// - screenshots → verify_shots/live/<name>.png, console errors → verify_shots/live/console.json
// - checks that the numbers rendered on the live E2B deal page and memo equal the API JSON (exits 1 on mismatch)
// - voice: /today greeting (speaking / idle / autoplay-blocked / TTS error), floating orb open on several screens,
//   and a short video of the /today greeting → verify_shots/voice/
// The "error" capture intercepts /api/voice/tts in the browser and answers 502 — the only mocked response here, used
// to show the error state without breaking the real key.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3277";
const OUT = "verify_shots/live";
const VOICE = "verify_shots/voice";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(VOICE, { recursive: true });
const api = async (p) => (await fetch(BASE + p)).json();
const consoleLog = {};
const failures = [];

const research = await api("/api/live/research?domain=e2b.dev");
const numbers = await api("/api/deals/e2b.dev/numbers");
const founder = research.calls?.founders?.data?.people?.find((p) => p.linkedinUrl);

const ROUTES = [
  ["home", "/"], ["landing", "/landing"], ["today-sections", "/today"], ["pipeline", "/pipeline"], ["deal-prompt", "/deal"],
  ["deal-e2b", "/deal?domain=e2b.dev"], ["deal-e2b-overview", "/deal?domain=e2b.dev&tab=overview"], ["deal-e2b-team", "/deal?domain=e2b.dev&tab=team"],
  ["deal-e2b-market", "/deal?domain=e2b.dev&tab=market"], ["deal-e2b-valuation", "/deal?domain=e2b.dev&tab=valuation"],
  ["deal-nomatch", "/deal?domain=zz9-no-such-startup-qx7.com"], ["deal-room", "/deal/room?id=e2b.dev"],
  ["memo", "/memo"], ["memo-e2b", "/memo?id=e2b.dev"], ["person-prompt", "/person"],
  ...(founder ? [["person-founder", `/person?linkedin=${encodeURIComponent(founder.linkedinUrl)}&domain=e2b.dev`]] : []),
  ["portfolio", "/portfolio"], ["mandates", "/mandates"], ["brain", "/brain"], ["agents", "/agents"], ["agent", "/agent"], ["ask", "/ask"],
  ["settings-connectors", "/settings?section=connectors"], ["settings-workflow", "/settings?section=workflow"], ["slack", "/slack"], ["preview-slack", "/preview/slack"],
];

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const watch = (page, name) => {
  consoleLog[name] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleLog[name].push(m.text()); });
  page.on("pageerror", (e) => consoleLog[name].push(`pageerror: ${e.message}`));
};
// Personal content (Gmail senders/subjects, calendar titles, and the Today greeting captions that speak them) is
// masked in every screenshot; the /today video is kept out of git (verify_shots/voice/ is gitignored).
const shot = (page, file, opts = {}, privateCaptions = false) =>
  page.screenshot({ path: file, ...opts, mask: [page.locator(privateCaptions ? '[data-private], [data-testid="voice-caption"], [data-testid="voice-dock"] details' : "[data-private]")], maskColor: "#d4d4d8" });
const settle = async (page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
};

// ── every route (no autoplay surprises: today's greeting is captured separately below) ──
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const [name, url] of ROUTES) {
  const page = await ctx.newPage();
  watch(page, name);
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await settle(page);
  await shot(page, `${OUT}/${name}.png`, { fullPage: true }, name.startsWith("today"));

  if (name === "deal-e2b") {
    const f = research.fields;
    const want = { hc: String(f.headcountLatest.value), raised: "$35M", round: "Series A", roles: String(f.openRoles.value) };
    for (const [id, v] of Object.entries(want)) {
      const got = (await page.locator(`[data-metric="${id}"]`).first().textContent())?.trim();
      if (got !== v) failures.push(`deal header ${id}: DOM "${got}" ≠ API "${v}"`);
    }
    const money = f.fundingTotal.value;
    if (money.amount !== 35_000_000 || money.currency !== "USD") failures.push(`fundingTotal API value changed: ${JSON.stringify(money)}`);
  }
  if (name === "deal-e2b-valuation") {
    if (!(await page.locator('[data-testid="valuation-unavailable"]').count())) failures.push("valuation: unavailable state not rendered");
  }
  if (name === "memo-e2b") {
    for (const [k, fld] of Object.entries(numbers.fields)) {
      const el = page.locator(`[data-testid="memo-field-${k}"]`);
      if (!(await el.count())) { failures.push(`memo: no element for ${k}`); continue; }
      const st = await el.getAttribute("data-status");
      const txt = (await el.textContent())?.trim();
      if (st !== fld.status) failures.push(`memo ${k}: DOM status ${st} ≠ API ${fld.status}`);
      if (fld.status === "unavailable" && txt !== "—") failures.push(`memo ${k}: unavailable but shows "${txt}"`);
    }
    const want = { headcountLatest: String(numbers.fields.headcountLatest.value), growthYoY: `+${Math.round(numbers.fields.growthYoY.value)}%`, lastFundingUsdM: "$21M" };
    for (const [k, v] of Object.entries(want)) {
      const got = (await page.locator(`[data-testid="memo-field-${k}"]`).textContent())?.trim();
      if (got !== v) failures.push(`memo ${k}: DOM "${got}" ≠ API "${v}"`);
    }
  }
  // floating orb popover on a few screens (clicked = user gesture, so it speaks right away)
  if (["deal-e2b", "settings-connectors", "pipeline", "brain", "memo-e2b"].includes(name)) {
    await page.getByTestId("voice-orb").click();
    await page.waitForSelector('[data-testid="voice-popover"][data-phase="speaking"], [data-testid="voice-popover"][data-phase="error"]', { timeout: 60000 }).catch(() => failures.push(`${name}: orb popover never spoke`));
    await page.waitForTimeout(1200);
    await shot(page, `${OUT}/${name}-orb-open.png`, {}, false);
    const phase = await page.getByTestId("voice-popover").getAttribute("data-phase");
    if (phase === "error") failures.push(`${name}: orb error: ${await page.getByTestId("voice-error").textContent()}`);
    await page.keyboard.press("Escape");
    if (await page.getByTestId("voice-popover").count()) failures.push(`${name}: Esc did not close the popover`);
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    if (focused !== "voice-orb") failures.push(`${name}: focus not returned to the orb (${focused})`);
  }
  await page.close();
}
await ctx.close();

// ── /today voice greeting: speaking → idle, with video ──
{
  const vctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: VOICE, size: { width: 1280, height: 800 } } });
  const page = await vctx.newPage();
  watch(page, "today-voice");
  await page.goto(BASE + "/today", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="voice-dock"][data-phase="speaking"]', { timeout: 60000 }).catch(() => failures.push("today: greeting never reached speaking"));
  await page.waitForTimeout(2500);
  await shot(page, `${OUT}/today-voice-speaking.png`, {}, true);
  await page.waitForSelector('[data-testid="voice-dock"][data-phase="idle"]', { timeout: 90000 }).catch(() => failures.push("today: greeting never finished"));
  await page.waitForTimeout(3500); // memory panel polls; let greeting.played appear
  await shot(page, `${OUT}/today-voice-idle.png`, {}, true);
  await shot(page, `${OUT}/today.png`, {fullPage: true}, true);
  const video = page.video();
  await vctx.close();
  if (video) fs.renameSync(await video.path(), `${VOICE}/today-greeting.webm`);
}
await browser.close();

// ── autoplay blocked (default policy, no gesture) and TTS error ──
{
  const b2 = await chromium.launch();
  const c2 = await b2.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await c2.newPage();
  watch(page, "today-voice-blocked");
  await page.goto(BASE + "/today", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="voice-dock"]:is([data-phase="blocked"],[data-phase="speaking"])', { timeout: 60000 }).catch(() => {});
  const ph = await page.getByTestId("voice-dock").getAttribute("data-phase");
  await shot(page, `${OUT}/today-voice-blocked.png`, {}, true);
  if (ph !== "blocked") failures.push(`today without autoplay: expected "blocked" (Tap to hear), got ${ph}`);
  const e = await c2.newPage();
  watch(e, "today-voice-error");
  await e.route("**/api/voice/tts**", (r) => r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ status: "error", upstreamStatus: 401, message: "ElevenLabs TTS failed (401): simulated in the verification script" }) }));
  await e.goto(BASE + "/today", { waitUntil: "domcontentloaded" });
  await e.waitForSelector('[data-testid="voice-dock"][data-phase="error"]', { timeout: 60000 }).catch(() => failures.push("today: error state not shown"));
  await shot(e, `${OUT}/today-voice-error.png`, {}, true);
  consoleLog["today-voice-error"] = consoleLog["today-voice-error"].filter((m) => !/502/.test(m)); // the simulated 502 itself
  await b2.close();
}

fs.writeFileSync(`${OUT}/console.json`, JSON.stringify(consoleLog, null, 2));
const errs = Object.entries(consoleLog).filter(([, v]) => v.length);
console.log(`routes: ${ROUTES.length} · pages with console errors: ${errs.length}`);
for (const [k, v] of errs) console.log(`  ${k}: ${v.slice(0, 3).join(" | ").slice(0, 300)}`);
console.log(failures.length ? `FAILURES:\n- ${failures.join("\n- ")}` : "number checks + voice checks: all passed");
process.exit(failures.length ? 1 : 0);
