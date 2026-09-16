/**
 * Renders every public page in a real browser at a phone width and a desktop
 * width, and fails on anything the console reports.
 *
 * This exists because the one regression the unit suite missed this cycle was
 * caught by opening the app in a browser: a payout gate applied one level too
 * high emptied the vendor's own feed, which every test still passed through.
 * Screenshots are cheap and they are the only check that sees a layout.
 *
 * Usage: WEB_URL=http://127.0.0.1:3000 node e2e/screenshots.mjs [outDir]
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const WEB = process.env.WEB_URL ?? "http://127.0.0.1:3000";
const OUT = process.argv[2] ?? "e2e/shots";
const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/** Public pages only: everything here must render with no session. */
const PAGES = [
  ["home", "/"],
  ["plan-wedding", "/plan/wedding"],
  ["plan-festival", "/plan/festival"],
  ["hire", "/hire"],
  ["hire-metro", "/hire/dallas-fort-worth"],
  ["hire-speciality", "/hire/dallas-fort-worth/makeup-artist"],
  ["contact", "/contact"],
  ["for-vendors", "/for-vendors"],
  ["login", "/login"],
  ["register", "/register"],
];

const WIDTHS = [
  ["desktop", 1280, 900],
  ["mobile", 390, 844],
];

let failures = 0;
function check(condition, description) {
  console.log(`${condition ? "  ok  " : "FAIL  "}${description}`);
  if (!condition) failures += 1;
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });

for (const [name, path] of PAGES) {
  for (const [tag, width, height] of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();

    const problems = [];
    page.on("pageerror", (error) => problems.push(`pageerror: ${error}`));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      // A favicon that does not exist yet is not a page defect.
      if (/favicon/i.test(message.text())) return;
      problems.push(`console: ${message.text()}`);
    });

    const response = await page.goto(`${WEB}${path}`, { waitUntil: "networkidle" });
    check(response?.status() === 200, `${path} [${tag}] responds 200`);
    check(problems.length === 0, `${path} [${tag}] clean console${problems.length ? ` -- ${problems.join(" | ")}` : ""}`);

    // A horizontal scrollbar on a phone is the single most common responsive
    // failure and the one nobody notices in a desktop browser.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(overflow <= 0, `${path} [${tag}] no horizontal overflow (${overflow}px)`);

    // Exactly one h1: more than one is an outline a screen reader cannot use,
    // and none is a page with no subject.
    const h1s = await page.locator("main h1, main .hero h1, h1").count();
    check(h1s === 1, `${path} [${tag}] exactly one h1 (found ${h1s})`);

    await page.screenshot({ path: `${OUT}/${name}-${tag}.png`, fullPage: true });
    await context.close();
  }
}

// The mobile menu is a checkbox and a label with no JavaScript behind it, so
// the thing worth asserting is that the panel is actually reachable and that
// its links are hittable once it opens.
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${WEB}/`, { waitUntil: "networkidle" });
  const menuLink = page.locator(".masthead nav a").first();
  check(!(await menuLink.isVisible()), "mobile menu starts closed");
  await page.locator(".nav-button").click();
  await page.waitForTimeout(250);
  check(await menuLink.isVisible(), "mobile menu opens on tap");
  await page.screenshot({ path: `${OUT}/home-menu-mobile.png` });
  await context.close();
}

await browser.close();
console.log(failures === 0 ? "\nall good" : `\n${failures} failing check(s)`);
process.exit(failures === 0 ? 0 : 1);
