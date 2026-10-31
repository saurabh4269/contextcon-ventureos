import { chromium } from "playwright";
const b = await chromium.launch({ args: ["--autoplay-policy=user-gesture-required"] });
const p = await b.newPage();
// Simulate a browser that refuses autoplay: the first play() without a gesture rejects with NotAllowedError.
await p.addInitScript(() => { const real = HTMLMediaElement.prototype.play; let first = true; HTMLMediaElement.prototype.play = function () { if (first) { first = false; return Promise.reject(new DOMException("play() failed because the user didn't interact with the document first.", "NotAllowedError")); } return real.call(this); }; });
await p.setViewportSize({ width: 1440, height: 900 });
await p.goto("http://localhost:3277/today");
await p.waitForSelector('[data-testid="voice-dock"]:is([data-phase="blocked"],[data-phase="speaking"])', { timeout: 60000 });
const ph = await p.getByTestId("voice-dock").getAttribute("data-phase");
await p.screenshot({ path: "verify_shots/live/today-voice-blocked.png", mask: [p.locator('[data-private], [data-testid="voice-caption"], [data-testid="voice-dock"] details')], maskColor: "#d4d4d8" });
console.log("phase", ph);
if (ph === "blocked") { await p.getByTestId("voice-tap").click(); await p.waitForSelector('[data-testid="voice-dock"][data-phase="speaking"]', { timeout: 30000 }); console.log("after tap: speaking"); }
await b.close();
