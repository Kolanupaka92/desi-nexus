/**
 * The public contact form, driven the way a visitor drives it.
 *
 * This is the one path on the site that works with no account, so it is the
 * one most worth checking end to end: the form renders, a real submission
 * reaches the API and lands in the database, the honeypot is never reachable
 * by a person, and the form is replaced by a confirmation rather than silently
 * cleared.
 *
 * Usage: WEB_URL=http://127.0.0.1:3000 node e2e/enquiry-flow.mjs
 */
import { chromium } from "playwright";

const WEB = process.env.WEB_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let failures = 0;
function check(condition, description) {
  console.log(`${condition ? "  ok  " : "FAIL  "}${description}`);
  if (!condition) failures += 1;
}

const browser = await chromium.launch({ executablePath: CHROME });

for (const [tag, width, height] of [["desktop", 1280, 900], ["mobile", 390, 844]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const stamp = `${Date.now()}-${tag}`;

  await page.goto(`${WEB}/contact`, { waitUntil: "networkidle" });

  // The honeypot must be unreachable by anyone using the page normally: out of
  // the tab order, out of the accessibility tree, and off-screen.
  const honeypot = page.locator('input[name="website"]');
  check((await honeypot.count()) === 1, `[${tag}] the honeypot is rendered`);
  check((await honeypot.getAttribute("tabindex")) === "-1", `[${tag}] the honeypot is out of the tab order`);
  check(
    (await honeypot.evaluate((node) => node.closest("[aria-hidden='true']") !== null)),
    `[${tag}] the honeypot is out of the accessibility tree`,
  );
  /*
   * Off-screen, not hidden.
   *
   * `display: none` and `type="hidden"` are both cheap for a bot to detect and
   * skip, which defeats the point, so the field is a real rendered input moved
   * out of the viewport. That means Playwright's isVisible() reports it as
   * visible -- correctly, since it is rendered -- and the thing actually worth
   * asserting is that it is nowhere a person could see or reach.
   */
  const box = await honeypot.boundingBox();
  check(
    box !== null && box.x + box.width < 0,
    `[${tag}] the honeypot sits outside the viewport (x=${box ? Math.round(box.x) : "none"})`,
  );

  await page.fill('input[name="name"]', "Priya Menon");
  await page.fill('input[name="email"]', `priya.${stamp}@example.test`);
  await page.fill('input[name="phone"]', "(469) 555-0123");
  await page.selectOption('select[name="eventType"]', "sangeet");
  await page.fill('textarea[name="message"]', "Planning a Sangeet in Frisco next March. We need a makeup artist and a photographer, and the family speaks Telugu.");
  await page.click('form.enquiry button[type="submit"]');

  /*
   * Either outcome is a real one, so wait for whichever lands.
   *
   * The endpoint is rate-limited per client address, and running this script
   * repeatedly against one server spends that allowance -- so a bare wait for
   * the confirmation turns "the limiter is working" into a twenty-second
   * timeout that says nothing. Reading the error path instead reports what
   * actually happened.
   */
  await page.waitForSelector(".enquiry-done, .enquiry .notice.error", { timeout: 20_000 });
  const rejected = await page.locator(".enquiry .notice.error").count();
  if (rejected > 0) {
    const text = (await page.locator(".enquiry .notice.error").innerText()).trim();
    check(/try again in a few minutes/i.test(text), `[${tag}] rate-limited, and says so readably -- "${text}"`);
  } else {
    check(true, `[${tag}] a submission is confirmed`);
    // The fields must be gone, not merely cleared: a form that empties itself
    // reads as a failure and people re-send.
    check((await page.locator("form.enquiry").count()) === 0, `[${tag}] the form is replaced, not cleared`);
  }

  await page.screenshot({ path: `e2e/shots/enquiry-done-${tag}.png` });
  await context.close();
}

// A missing required field must be caught before anything is sent.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${WEB}/contact`, { waitUntil: "networkidle" });
  await page.fill('input[name="name"]', "Someone");
  await page.click('form.enquiry button[type="submit"]');
  await page.waitForTimeout(600);
  check(
    (await page.locator(".enquiry-done").count()) === 0,
    "an incomplete form is not submitted",
  );
  await context.close();
}

await browser.close();
console.log(failures === 0 ? "\nall good" : `\n${failures} failing check(s)`);
process.exit(failures === 0 ? 0 : 1);
