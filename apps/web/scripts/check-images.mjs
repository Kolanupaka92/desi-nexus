/**
 * Every configured photograph must exist on disk.
 *
 * The design brief asks what should happen when an image fails to load. The
 * best answer is that it cannot: a `src` in content/imagery.ts pointing at a
 * file nobody copied across is a broken picture on the home page, and the
 * alternative -- catching the error in the browser -- means shipping
 * JavaScript to every marketing page to handle a mistake that is visible here
 * in milliseconds.
 *
 * So this runs before the build. A card with no `image` is fine and expected
 * while the photographs are still being sourced; a card whose `image.src` is
 * not on disk fails the build and names the file.
 *
 * The config is read as text rather than imported: this script is plain ESM,
 * the config is TypeScript, and adding a compile step in order to check a
 * compile step is worse than a regular expression over a file whose shape is
 * fixed by its own interface.
 *
 * Usage: node scripts/check-images.mjs
 */
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "../public");
const source = await readFile(resolve(here, "../content/imagery.ts"), "utf8");

const configured = [...source.matchAll(/^\s*src:\s*"(\/images\/[^"]+)"/gm)].map((m) => m[1]);

let missing = 0;
for (const src of configured) {
  try {
    await access(resolve(publicDir, src.replace(/^\//, "")));
    console.log(`  ok  ${src}`);
  } catch {
    console.error(`FAIL  ${src} is configured in content/imagery.ts but is not in public/`);
    missing += 1;
  }
}

if (configured.length === 0) {
  console.log("No photographs configured yet; every card renders its drawing.");
  console.log("See public/images/README.md to supply them.");
}
if (missing > 0) {
  console.error(`\n${missing} configured image(s) missing from public/`);
  process.exit(1);
}
