import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { FlatCompat } from "@eslint/eslintrc";

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
];

export default config;
