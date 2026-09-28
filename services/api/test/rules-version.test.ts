/**
 * The rules a person is recorded as agreeing to are the rules they were shown.
 *
 * Every account stores the version of the marketplace rules it agreed to at
 * signup (RULES_VERSION, in the API). The page that shows those rules lives in
 * the web app and carries its own copy of the version. If the page is edited
 * and only one of the two is bumped, new accounts would be recorded as agreeing
 * to a version they never saw -- and "they agreed to it" is the whole basis for
 * suspending someone under it.
 *
 * Two copies of one value drift. This fails the build when they do.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { RULES_VERSION } from "../src/domain/users.js";

const here = dirname(fileURLToPath(import.meta.url));
// Four levels: `npm test` runs the COMPILED file from dist/test/.
const webRules = resolve(here, "../../../../apps/web/content/rules.ts");

test("the rules page and the API agree on which version of the rules is in force", () => {
  let source: string;
  try {
    source = readFileSync(webRules, "utf8");
  } catch (error) {
    throw new Error(
      `Could not read ${webRules}. This path is resolved relative to the COMPILED location (dist/test/).`,
      { cause: error },
    );
  }
  const shown = /export const RULES_VERSION = "([^"]+)"/.exec(source)?.[1];
  assert.ok(shown, "apps/web/content/rules.ts must export RULES_VERSION as a string literal");
  assert.equal(
    shown,
    RULES_VERSION,
    "The rules page shows one version and the API records another. Bump RULES_VERSION in " +
      "BOTH apps/web/content/rules.ts and services/api/src/domain/users.ts together.",
  );
});

test("the rules version is a real date", () => {
  // It is displayed as "Last updated <date>", so it must parse as one.
  assert.match(RULES_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(`${RULES_VERSION}T00:00:00Z`)), `${RULES_VERSION} is not a valid date`);
});
