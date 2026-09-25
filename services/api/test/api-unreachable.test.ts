/**
 * An unreachable API degrades; it does not crash the page.
 *
 * Production has no API connected, and five signed-in pages -- /gigs/new,
 * /gigs, /gigs/[id], /vendor and /dashboard -- all did the same thing:
 *
 *     try { await me(); }
 *     catch (error) {
 *       if (error instanceof ApiCallError && error.status === 401) redirect("/login");
 *       throw error;
 *     }
 *
 * A 401 was handled. "Nothing answered" was not, so it was rethrown and every
 * one of them returned a 500. /gigs/new is where the "Post a brief" button in
 * the header -- on every page of the site -- leads.
 *
 * The same distinction was already drawn correctly in one place: the server
 * actions matched the error TEXT against /fetch failed|ECONNREFUSED|timed out|
 * aborted/ and showed a proper message. So the pages did not check at all and
 * the forms checked by wording. Both now test one type, ApiUnavailableError,
 * raised at the single place fetch is called.
 *
 * Found by sweeping every route on the live deployment, not by a test. A route
 * sweep only covers the URLs it is given, though, and it missed /gigs and
 * /gigs/[id] -- they were caught by enumerating `await me()` across the source.
 * That enumeration is what this file makes permanent.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// Four levels: `npm test` runs the COMPILED file from dist/test/.
const webRoot = resolve(here, "../../../../apps/web");

function pageFiles(dir: string, out: string[] = []): string[] {
  const skip = new Set(["node_modules", ".next", "dist", ".git", "screenshots"]);
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) pageFiles(full, out);
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

const read = (path: string) => readFileSync(resolve(webRoot, path), "utf8");

test("there are signed-in pages to check at all", () => {
  // Guards the guard: if the pattern below stopped matching, every assertion
  // in the next test would pass by finding nothing.
  const signedIn = pageFiles(resolve(webRoot, "app")).filter((f) =>
    /await me\(\)/.test(readFileSync(f, "utf8")),
  );
  assert.ok(
    signedIn.length >= 5,
    `expected at least the five known signed-in pages, found ${signedIn.length}. ` +
      "Either pages were removed or `await me()` changed shape.",
  );
});

test("every page that waits on me() handles an unreachable API", () => {
  for (const file of pageFiles(resolve(webRoot, "app"))) {
    const source = readFileSync(file, "utf8");
    if (!/await me\(\)/.test(source)) continue;
    assert.ok(
      /instanceof ApiUnavailableError/.test(source),
      `${relative(webRoot, file)} waits on me() but never checks for ` +
        "ApiUnavailableError. With the API unreachable it rethrows and returns a " +
        "500. Return <ServiceUnavailable /> for that case, before the 401 check.",
    );
  }
});

test("the unreachable case is checked before the 401 redirect", () => {
  /*
   * Order matters. The 401 check is `instanceof ApiCallError`, and an
   * unreachable API is not one, so a later check would still be reached -- but
   * placing it first keeps the two meanings visibly apart: unreachable is not
   * "signed out", and must never be sent to /login, which would only fail again.
   */
  for (const file of pageFiles(resolve(webRoot, "app"))) {
    const source = readFileSync(file, "utf8");
    const unreachable = source.indexOf("instanceof ApiUnavailableError");
    const unauthorised = source.indexOf("error.status === 401");
    if (unreachable === -1 || unauthorised === -1) continue;
    assert.ok(
      unreachable < unauthorised,
      `${relative(webRoot, file)} checks the 401 before the unreachable case.`,
    );
  }
});

test("fetch failures are converted to ApiUnavailableError at the one call site", () => {
  const api = read("lib/api.ts");
  assert.match(api, /export class ApiUnavailableError extends Error/);
  assert.match(
    api,
    /catch \(error\) \{[\s\S]*?throw new ApiUnavailableError\(\{ cause: error \}\)/,
    "apiFetch must wrap its fetch() call and rethrow as ApiUnavailableError, " +
      "keeping the original as `cause` so the real reason survives into the log.",
  );
  // Exactly one fetch in the client, so there is exactly one place this can go wrong.
  const fetchCalls = api.match(/\bawait fetch\(/g) ?? [];
  assert.equal(fetchCalls.length, 1, "lib/api.ts should call fetch() in exactly one place");
});

test("the server actions check the type, not the error's wording", () => {
  const actions = read("lib/actions.ts");
  assert.match(actions, /instanceof ApiUnavailableError/);
  assert.doesNotMatch(
    actions,
    /fetch failed|ECONNREFUSED/,
    "lib/actions.ts is matching error text again. apiFetch now raises " +
      "ApiUnavailableError with its own message, so a text match would silently " +
      "stop firing -- every form would fall through to 'Something went wrong'.",
  );
});

test("the site has its own 404 and error pages", () => {
  // Without them Next renders built-in pages that repaint <body> white and
  // offer no way back into the site.
  for (const file of ["app/not-found.tsx", "app/error.tsx"]) {
    assert.ok(read(file).length > 0, `${file} is missing`);
  }
  assert.match(read("app/error.tsx"), /^"use client";/, "app/error.tsx must be a client component");
});

test("the Organization's areaServed is derived from the metros served", () => {
  const layout = read("app/layout.tsx");
  const block = /areaServed:\s*([\s\S]*?)(?:,\n\s*\}|\n\s*\},)/.exec(layout)?.[1] ?? "";
  assert.ok(block.length > 0, "could not find areaServed in app/layout.tsx");
  assert.doesNotMatch(
    block,
    /name:\s*["']/,
    "areaServed names a state as a literal. It said 'Texas' for the whole of " +
      "the move to three states, beside a description naming all three. Derive " +
      "it from METROS so it cannot fall behind.",
  );
});
