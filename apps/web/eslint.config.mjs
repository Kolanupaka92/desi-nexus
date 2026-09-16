// @ts-check
/**
 * Lint rules for the web app.
 *
 * Same posture as the API's: correctness, not style. Two things here are worth
 * failing a build over.
 *
 * The Next plugin's rules catch mistakes that only show up in production —
 * an `<img>` that ships an unoptimised original to a phone, or an `<a>` to an
 * internal route that throws away client-side navigation. Both matter more than
 * usual here, because this is a marketplace whose pages are mostly photographs
 * and whose visitors mostly arrive on a phone from a shared link.
 *
 * `no-floating-promises` matters for the same reason it does in the API: a
 * server action whose write is never awaited returns success to the person who
 * just tried to book someone.
 *
 * `eslint-config-next` is not used because it still pins eslint 9, and pinning
 * one workspace a major version behind the other is worse than doing without
 * its handful of extra rules. The plugin itself carries the ones that matter.
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  // scripts/ and e2e/ are plain ESM outside the tsconfig, so the type-aware
  // rules cannot resolve them; both are developer tooling, not shipped code.
  { ignores: [".next/**", "node_modules/**", "eslint.config.mjs", "next-env.d.ts", "e2e/**", "scripts/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,

      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],

      // The API's responses arrive as unknown and are narrowed at the edge, the
      // same as on the server side; flagging each cast would bury the rules
      // above.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },
);
