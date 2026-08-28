import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plain Node utilities, run by hand and never bundled. The Next presets
    // load the React and type-aware rules for anything they are pointed at,
    // which on these files takes minutes and reports nothing useful.
    "scripts/**",
  ]),
]);

export default eslintConfig;
