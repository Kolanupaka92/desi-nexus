/**
 * The occasion cards name functions. Every one must actually exist.
 *
 * apps/web/content/occasions.ts is the home page's five occasion tiles, and
 * each carries a sentence listing the functions in that group. That sentence is
 * prose written by hand next to a taxonomy written in code, and the two drifted
 * immediately: the first version promised "Onam sadhya, Pongal and Eid
 * gatherings" under Festival nights and "anniversaries" under Family
 * milestones. None of the four is in the taxonomy. Nothing failed -- a card
 * cannot fail -- so a Malayali family clicking through for Onam would simply
 * have found garba, Diwali, Holi and bhangra, and concluded the site was not
 * for them. It also put "dhoti ceremonies" under milestones when upanayanam
 * sits in the religious group.
 *
 * This is the most expensive kind of wrong for this business. The whole pitch
 * is "we know your function"; naming a function we cannot serve disproves it in
 * one click, on the page that has to do the convincing.
 *
 * The check works off an explicit phrase -> code map. That is deliberate: a
 * writer adding a new function name to the copy must add it here too, and
 * adding it here means naming its taxonomy code, and naming its code is what
 * makes the group assertion possible. A regex that guessed at function names
 * would be either too loose to catch Onam or too noisy to keep.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { EVENT_GROUPS } from "../src/domain/taxonomy.js";

const here = dirname(fileURLToPath(import.meta.url));
/*
 * Four levels, not three: `npm test` compiles to dist/ and runs
 * `node --test dist/test/*.test.js`, so at runtime this file lives in
 * services/api/dist/test/ and the repository root is four up, not three.
 *
 * Three is what you get by counting the directories in the source tree, and it
 * passes when the test is run straight off the source with tsx -- which is how
 * I first ran it, and why CI caught this and my machine could not. The sibling
 * seo-content-drift test already resolves four up for the same reason.
 */
const copyPath = resolve(here, "../../../../apps/web/content/occasions.ts");

/**
 * Every function name the occasion copy is allowed to use, and the taxonomy
 * code it refers to. Lowercased; matched as a whole word.
 */
const PHRASE_TO_CODE: Readonly<Record<string, string>> = {
  // wedding
  roka: "roka_engagement",
  mehndi: "mehndi",
  haldi: "haldi",
  sangeet: "sangeet",
  baraat: "baraat",
  nikah: "nikah",
  "anand karaj": "sikh_anand_karaj",
  "kerala christian wedding": "kerala_christian_wedding",
  reception: "reception",
  // religious
  "griha pravesham": "griha_pravesham",
  "satyanarayan puja": "satyanarayan_puja",
  "naming ceremonies": "namakaranam",
  "ayush homam": "ayush_homam",
  upanayanam: "upanayanam",
  // milestone
  "half-saree functions": "half_saree_function",
  mundans: "mundan_child_carnival",
  "baby showers": "seemantham_baby_shower",
  "first birthdays": "first_birthday",
  "graduation parties": "graduation_party",
  // festival
  garba: "garba_navratri",
  dandiya: "garba_navratri",
  diwali: "diwali_celebration",
  holi: "holi_event",
  bhangra: "bhangra_night",
  // commercial
  "boutique lookbooks": "boutique_lookbook",
  "jewellery catalogues": "jewellery_catalogue",
  "brand shoots": "brand_campaign_shoot",
  "restaurant launches": "restaurant_launch",
  "corporate diwali": "corporate_diwali",
  "corporate offsites": "corporate_offsite",
  "influencer collabs": "influencer_collab",
};

/**
 * Function names that have appeared in this copy and are NOT in the taxonomy.
 *
 * Kept as an explicit denylist rather than relying on the allowlist alone,
 * because these four are the ones that actually shipped and each is a real
 * market that somebody will want to add back. Adding any of them to the copy
 * has to mean adding it to the taxonomy first.
 */
const NOT_IN_TAXONOMY = ["onam", "pongal", "eid", "anniversaries", "sweet 16"];

function readOccasions(): Array<{ key: string; description: string }> {
  // A missing file must say which path it tried. A bare ENOENT from inside a
  // test tells you nothing about whether the path is wrong or the file moved.
  let source: string;
  try {
    source = readFileSync(copyPath, "utf8");
  } catch (error) {
    throw new Error(
      `Could not read the occasion copy at ${copyPath}. ` +
        "This path is resolved relative to the COMPILED location (dist/test/), " +
        `not the source tree. Original error: ${(error as Error).message}`,
    );
  }
  const out: Array<{ key: string; description: string }> = [];
  // Each entry is `key: "x",` ... `description:\n  "...",`
  const entry = /key:\s*"([a-z_]+)"[\s\S]*?description:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = entry.exec(source)) !== null) {
    const [, key, description] = m;
    // Both groups are non-optional in the pattern, so a match means both are
    // present -- but asserting it beats a non-null assertion, because if the
    // pattern is ever edited into optional groups this says so instead of
    // silently pushing undefined and making every check below vacuous.
    assert.ok(key && description, `malformed occasion entry near: ${m[0].slice(0, 60)}`);
    out.push({ key, description });
  }
  return out;
}

test("the occasion copy parses at all", () => {
  const occasions = readOccasions();
  assert.equal(
    occasions.length,
    5,
    `expected 5 occasions in ${copyPath}, parsed ${occasions.length}. ` +
      "If the file's shape changed, this test's regex has to change with it -- " +
      "silently parsing zero entries would make every assertion below vacuous.",
  );
});

test("every occasion key is a real event group", () => {
  for (const { key } of readOccasions()) {
    assert.ok(
      Object.hasOwn(EVENT_GROUPS, key),
      `occasions.ts has a tile keyed "${key}", which is not a group in the ` +
        `taxonomy. Its /plan/${key} link has nothing to render.`,
    );
  }
});

test("no occasion names a function that is not in the taxonomy", () => {
  for (const { key, description } of readOccasions()) {
    const text = description.toLowerCase();
    for (const banned of NOT_IN_TAXONOMY) {
      assert.ok(
        !new RegExp(`\\b${banned}\\b`).test(text),
        `The "${key}" tile names "${banned}", which is not in the taxonomy. ` +
          "A visitor who clicks through for it finds something else and leaves. " +
          "Add the occasion to the taxonomy first, or take it out of the copy.",
      );
    }
  }
});

test("every function an occasion names belongs to that occasion's group", () => {
  for (const { key, description } of readOccasions()) {
    const group = EVENT_GROUPS[key as keyof typeof EVENT_GROUPS] as readonly string[];
    if (!group) continue; // covered by the key test above
    const text = description.toLowerCase();

    /*
     * Longest phrase first, and each match is blanked out of the text before
     * the next phrase is tried.
     *
     * Without this, "corporate Diwali nights" matches the bare `diwali`
     * (festival) before `corporate diwali` (commercial) and the commercial tile
     * fails for naming a festival it never named. A checker that reports a
     * failure that is not real gets switched off within a week, which costs
     * more than never having written it.
     */
    let remaining = text;
    const phrases = Object.entries(PHRASE_TO_CODE).sort((a, b) => b[0].length - a[0].length);

    for (const [phrase, code] of phrases) {
      const pattern = new RegExp(`\\b${phrase.replace(/[-/\\^$*+?.()|[\\]{}]/g, "\\$&")}\\b`);
      if (!pattern.test(remaining)) continue;
      remaining = remaining.replace(pattern, " ".repeat(phrase.length));
      assert.ok(
        group.includes(code),
        `The "${key}" tile names "${phrase}" (${code}), but ${code} is not in ` +
          `the ${key} group -- it is in ` +
          `${Object.entries(EVENT_GROUPS).find(([, v]) => (v as readonly string[]).includes(code))?.[0] ?? "no group at all"}. ` +
          "The card sends people to a page that cannot offer what the card promised.",
      );
    }
  }
});
