// Staging-only schema deploy for the mobile build (docs/mobile/BUILD_PROMPT.md).
// Fails closed: runs `prisma migrate deploy` only when the migration connection names the
// staging project and nothing in the environment names production. Prints no connection details.
// Run: node scripts/staging/deploy-schema.cjs [status|deploy]
"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const STAGING_REF = "brrdatmhoagaxmggurki";
const PRODUCTION_REF = "htlgjluegmdwfjkzzwic";
const root = path.resolve(__dirname, "../..");
const mode = process.argv[2] || "status";
if (!["status", "deploy"].includes(mode)) { console.error("Usage: deploy-schema.cjs [status|deploy]"); process.exit(2); }

try { process.loadEnvFile(path.join(root, ".env")); } catch { console.error("STAGING_ENV_MISSING: this clone has no readable .env"); process.exit(3); }

const url = process.env.MIGRATION_DATABASE_URL || "";
const fail = (code, message) => { console.error(`${code}: ${message}`); process.exit(4); };
if (!url || url.includes("REPLACE_ME")) fail("STAGING_KEYS_NOT_SET", "MIGRATION_DATABASE_URL is unset or still a placeholder");
if (!url.includes(STAGING_REF)) fail("NOT_STAGING", "the migration connection does not name the staging project");
for (const [name, value] of Object.entries(process.env))
  if (typeof value === "string" && value.includes(PRODUCTION_REF)) fail("PRODUCTION_REFERENCE", `${name} names the production project`);

const env = { ...process.env, DATABASE_URL: url };
const scrub = text => String(text || "").replace(/postgres(?:ql)?:\/\/\S+/g, "postgresql://[redacted]");
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: "utf8", timeout: 15 * 60 * 1000 });
  process.stdout.write(scrub(result.stdout));
  process.stderr.write(scrub(result.stderr));
  return result.status ?? 1;
}
console.log(`Target verified: staging (${STAGING_REF}). Mode: ${mode}.`);
const prisma = path.join(root, "node_modules/.bin/prisma");
if (mode === "deploy") {
  if (run(process.execPath, [path.join(root, "scripts/check-migration-path.cjs")]) !== 0) process.exit(5);
  if (run(prisma, ["migrate", "deploy"]) !== 0) process.exit(6);
}
// `migrate status` exits 1 when migrations are pending; that is information, not a failure.
const status = run(prisma, ["migrate", "status"]);
process.exit(mode === "deploy" ? status : 0);
