/**
 * The canonical origin has exactly one definition.
 *
 * Eight files under apps/web each needed the site's absolute origin -- for
 * `<link rel="canonical">`, `sitemap.xml`, `robots.txt`, the Organization and
 * WebSite structured data, and OpenGraph. Each worked it out independently,
 * and all eight landed on the same line:
 *
 *     process.env.NEXT_PUBLIC_SITE_URL ?? "https://desi-nexus.com"
 *
 * The variable is not set in Vercel, so the fallback was what production
 * actually served. Fetching the live site returned
 * `Sitemap: https://desi-nexus.com/sitemap.xml` and a canonical on every page
 * pointing at a domain nobody owns -- under the old brand name, after the
 * rebrand. A canonical naming a host that does not resolve is not a cosmetic
 * defect: it is the one tag with the authority to tell a crawler that the page
 * it just read is a duplicate of something else, and it was pointed at nothing.
 *
 * Nothing failed. No test covered it, the build was clean, and every page
 * rendered correctly -- the wrong string was simply in the head of all of them.
 * That is the same shape as the copy and taxonomy drift the sibling tests
 * catch, so it is guarded the same way.
 *
 * Two rules, both checkable:
 *   1. No source file may hard-code an absolute origin for this site.
 *   2. Only content/site.ts may read the origin out of the environment.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// Four levels: `npm test` runs the COMPILED file from dist/test/, so the
// repository root is four up, not three. The sibling drift tests resolve the
// same way and for the same reason.
const webRoot = resolve(here, "../../../../apps/web");
const siteModule = resolve(webRoot, "content/site.ts");

/** Every .ts/.tsx file under apps/web, excluding build output and deps. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  const skip = new Set(["node_modules", ".next", "dist", ".git", "screenshots"]);
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

test("the web app has source files to check at all", () => {
  // Without this, a wrong `webRoot` would make every assertion below vacuous
  // and the suite would pass by finding nothing -- which is precisely how the
  // bug this file exists for survived.
  const files = sourceFiles(webRoot);
  assert.ok(
    files.length > 20,
    `expected the web sources at ${webRoot}, found ${files.length} files. ` +
      "This path is resolved relative to the COMPILED location (dist/test/).",
  );
});

test("no page hard-codes an absolute origin for this site", () => {
  /*
   * Matches a bare origin for a host we might call our own. Deliberately NOT a
   * general https:// match: schema.org, the Google Fonts href and the docs
   * links are all absolute URLs that belong exactly where they are.
   */
  const ourOrigin = /https?:\/\/(?:www\.)?(?:desi-?nexus|utsav|bookutsav)[a-z0-9.-]*/i;

  for (const file of sourceFiles(webRoot)) {
    if (file === siteModule) continue; // documents the old value on purpose
    const source = readFileSync(file, "utf8");
    const hit = ourOrigin.exec(source);
    assert.equal(
      hit,
      null,
      `${relative(webRoot, file)} hard-codes the origin "${hit?.[0]}". ` +
        "Import SITE_URL from @/content/site instead -- a second copy is how " +
        "production ended up serving canonicals for a domain nobody owns.",
    );
  }
});

test("only content/site.ts reads the origin from the environment", () => {
  for (const file of sourceFiles(webRoot)) {
    if (file === siteModule) continue;
    const source = readFileSync(file, "utf8");
    for (const varName of ["NEXT_PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"]) {
      assert.ok(
        !source.includes(varName),
        `${relative(webRoot, file)} reads ${varName} directly. The resolution ` +
          "order (explicit domain, then Vercel's production host, then " +
          "localhost) belongs in content/site.ts alone; a second reader is a " +
          "second answer.",
      );
    }
  }
});

test("the origin module never falls back to a guessed domain", () => {
  const source = readFileSync(siteModule, "utf8");
  // Strip the doc comment: it quotes the old fallback to explain the bug.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  /*
   * A literal with a real hostname right after the scheme. The `[a-z0-9]`
   * after `//` is what keeps this honest: `https://${vercel}` puts a scheme in
   * front of a host read from the environment, which is the whole fix, and it
   * has `$` there rather than a letter. Matching every `https://` would flag
   * the fix itself -- a guard that fails on correct code gets deleted, and
   * then it guards nothing.
   */
  const literals = [...code.matchAll(/["'`](https?:\/\/[a-z0-9][^"'`]*)["'`]/gi)]
    .map((m) => m[1])
    .filter((literal): literal is string => literal !== undefined);
  for (const literal of literals) {
    assert.ok(
      literal.startsWith("http://localhost"),
      `content/site.ts falls back to the literal "${literal}". The only ` +
        "acceptable hard-coded origin is localhost for local development; a " +
        "real-looking domain here is a claim this deployment cannot verify.",
    );
  }
});

test("the resolution order prefers an explicit domain over the Vercel host", () => {
  const source = readFileSync(siteModule, "utf8");
  const explicit = source.indexOf("NEXT_PUBLIC_SITE_URL");
  const vercel = source.indexOf("VERCEL_PROJECT_PRODUCTION_URL", explicit + 1);
  const localhost = source.indexOf("localhost", vercel + 1);

  assert.ok(explicit !== -1 && vercel !== -1 && localhost !== -1, "all three branches must exist");
  assert.ok(
    explicit < vercel && vercel < localhost,
    "the order must be explicit domain, then Vercel's production host, then " +
      "localhost. Buying a domain and setting NEXT_PUBLIC_SITE_URL has to be " +
      "enough on its own -- if the Vercel host won, the real domain would " +
      "never take effect and nobody would know why.",
  );
});
