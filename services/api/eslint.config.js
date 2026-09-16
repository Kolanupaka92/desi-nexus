// @ts-check
/**
 * Lint rules for the API.
 *
 * Deliberately not a style guide. Formatting arguments are cheap to have and
 * worth nothing here, and the repository has been consistent without one. What
 * this catches is the class of mistake that is invisible in review and
 * expensive in production: a promise nobody awaited.
 *
 * `no-floating-promises` is the reason this file exists. Almost every function
 * that touches money, the outbox or the database is async, and an unawaited
 * call to one of them fails silently -- the request returns 200, the write
 * never lands, and nothing is logged. That is the same shape as the two
 * defects the audit turned up, both of which were rules that existed but were
 * never actually wired to the code path that needed them.
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // scripts/ is plain ESM outside the tsconfig, so the type-aware rules
  // cannot resolve it; it is developer tooling, not shipped code.
  { ignores: ["dist/**", "node_modules/**", "eslint.config.js", "scripts/**"] },
  js.configs.recommended,
  // Type-aware: the rules that matter here cannot be decided from syntax alone.
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // The ones worth failing a build over.
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          // node:test's test() returns a promise nobody is meant to await.
          // Without this the rule fires on every test in the suite and the
          // real findings are buried, which is how a lint gate gets disabled.
          allowForKnownSafeCalls: [
            { from: "package", package: "node:test", name: ["test", "describe", "it", "suite"] },
          ],
        },
      ],
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "no-console": ["error", { allow: ["error", "warn"] }],

      // The in-memory store implements an async repository interface with
      // synchronous maps. Every method is correctly async -- the interface
      // says so -- and none of them awaits anything. That is the design, not
      // an oversight, and it accounts for every hit this rule produced.
      "@typescript-eslint/require-await": "off",
      // Precision rather than correctness, and it fires on narrowing casts the
      // request-parsing code uses deliberately.
      "@typescript-eslint/no-unnecessary-type-assertion": "off",

      // TypeScript already refuses an unused local; the lint copy only adds
      // noise, except for the underscore convention the routes use to name a
      // value they are deliberately discarding.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],

      // Casts are how this codebase narrows request bodies, which arrive as
      // unknown by design. Flagging every one would bury the rules above.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },
  {
    // Tests print diagnostics on purpose, and construct partial fixtures.
    files: ["test/**/*.ts"],
    rules: { "no-console": "off" },
  },
  {
    // The entry point's job is to say what it started and on which port.
    files: ["src/index.ts"],
    rules: { "no-console": "off" },
  },
);
