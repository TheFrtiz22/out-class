import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });
const config = [
  { ignores: [".next*/**", "node_modules/**", ".pnpm-store/**", "out/**", "build/**", "next-env.d.ts", ".agents/**", ".claude/**", ".codex/**", ".cursor/**", ".devin/**", ".openai/**"] },
  ...compat.extends("next/core-web-vitals"),
];

export default config;
