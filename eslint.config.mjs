import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { FlatCompat } from "@eslint/eslintrc";
import { readFileSync } from "node:fs";
import outclass from "./eslint-rules/no-raw-colors.mjs";

const require = createRequire(import.meta.url);
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)), resolvePluginsRelativeTo: dirname(require.resolve("eslint-config-next")) });
const config = [
  { ignores: [".next*/**", "node_modules/**", ".pnpm-store/**", "out/**", "build/**", "public/pdfjs/**", "next-env.d.ts", ".agents/**", ".claude/**", ".codex/**", ".cursor/**", ".devin/**", ".openai/**"] },
  ...compat.extends("next/core-web-vitals"),
  ...compat.extends("plugin:jsx-a11y/recommended"),
  {
    settings: {
      "jsx-a11y": { components: { Input: "input", CsvInput: "input", Checkbox: "input", Textarea: "textarea", NativeSelect: "select", NativeSelectField: "select", Label: "label", Button: "button", IconButton: "button" } },
    },
    rules: {
      // Scrollable document regions need keyboard focus to scroll independently.
      "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["tabpanel", "region", "document"] }],
    },
  },
  {
    // One palette: styles/tokens.css. Raw neutral ramps and hex colors bypass it.
    files: ["**/*.tsx"],
    plugins: { outclass },
    rules: { "outclass/no-raw-colors": "error" },
  },
  {
    // Ratchet: files that predate the rule report their known violations as
    // warnings until fixed. tests/eslint-no-raw-colors-baseline.test.cjs fails if
    // any of them gains a violation; remove a file here once it is clean.
    files: Object.keys(JSON.parse(readFileSync(new URL("./eslint-rules/no-raw-colors-baseline.json", import.meta.url), "utf8"))).map(file => file.replace(/[[\]{}()*?!+@]/g, "\\$&")),
    rules: { "outclass/no-raw-colors": "warn" },
  },
];

export default config;
