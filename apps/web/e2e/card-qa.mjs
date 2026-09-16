/**
 * The card visuals, at every width the design brief lists.
 *
 * Checks the properties that make a photo-led page feel finished rather than
 * assembled: the picture is a real share of the card at phone width, the
 * browser is told what width to download, nothing shifts as images arrive, and
 * a card without a photograph still occupies the same box as one with it.
 *
 * Usage: WEB_URL=http://127.0.0.1:3000 node e2e/card-qa.mjs
 */
import { chromium } from "playwright";

const WEB = process.env.WEB_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const WIDTHS = [375, 390, 430, 768, 1280, 1440];

let failures = 0;
function check(condition, description) {
  console.log(`${condition ? "  ok  " : "FAIL  "}${description}`);
  if (!condition) failures += 1;
}

const browser = await chromium.launch({ executablePath: CHROME });

for (const width of WIDTHS) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(String(e).slice(0, 160)));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url().slice(0, 90)}`); });

  await page.goto(WEB, { waitUntil: "networkidle" });
  await page.waitForSelector(".plan-card", { timeout: 20_000 });

  check(problems.length === 0, `${width}px clean console and no failed requests${problems.length ? ` -- ${problems.join(" | ")}` : ""}`);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check(overflow <= 0, `${width}px no horizontal overflow (${overflow}px)`);

  // The picture has to be a real share of the card, not a strip on top of it.
  const share = await page.evaluate(() => {
    const card = document.querySelector(".plan-card");
    const shot = card?.querySelector(".card-visual");
    if (!card || !shot) return 0;
    return shot.getBoundingClientRect().height / card.getBoundingClientRect().height;
  });
  check(share > 0.3, `${width}px the picture is ${(share * 100).toFixed(0)}% of the first event card`);

  // Both kinds of card must occupy the same box, or supplying a photograph
  // would move the page.
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll(".crew-card .card-visual")].map((n) => ({
      kind: n.getAttribute("data-visual"),
      h: Math.round(n.getBoundingClientRect().height),
    })),
  );
  const heights = new Set(boxes.map((b) => b.h));
  check(
    heights.size === 1,
    `${width}px photo and drawn cards share one box height (${[...heights].join(", ")}px across ${boxes.length} cards)`,
  );

  if (width === 390 || width === 1280) {
    await page.screenshot({ path: `e2e/shots/cards-${width}.png`, fullPage: true });
  }
  await context.close();
}

// The browser must be told what width to download, or a card four across a
// desktop grid pulls roughly four times the pixels it can show.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(WEB, { waitUntil: "networkidle" });
  const img = page.locator('.card-visual[data-visual="photo"] img').first();
  check((await img.count()) > 0, "at least one card renders a photograph");
  check(Boolean(await img.getAttribute("sizes")), "photographs declare a sizes attribute");
  check(Boolean(await img.getAttribute("srcset")), "photographs ship a srcset");
  const dims = await img.evaluate((n) => ({ w: n.getAttribute("width"), h: n.getAttribute("height") }));
  check(Boolean(dims.w && dims.h), `photographs carry explicit dimensions (${dims.w}x${dims.h})`);
  const lazy = await page.locator('.crew-card .card-visual[data-visual="photo"] img').first();
  if ((await lazy.count()) > 0) {
    check((await lazy.getAttribute("loading")) === "lazy", "below-the-fold photographs are lazy");
  }
  await context.close();
}

await browser.close();
console.log(failures === 0 ? "\nall good" : `\n${failures} failing check(s)`);
process.exit(failures === 0 ? 0 : 1);
