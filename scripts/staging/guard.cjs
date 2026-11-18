// Shared fail-closed guard for staging-only scripts (docs/mobile/BUILD_PROMPT.md).
// Loads this clone's .env and returns the staging connection details only when every
// database and Supabase value names the staging project and nothing names production.
// Never prints a value.
"use strict";
const path = require("node:path");

const STAGING_REF = "brrdatmhoagaxmggurki";
const PRODUCTION_REF = "htlgjluegmdwfjkzzwic";
const root = path.resolve(__dirname, "../..");

function fail(code, message) {
  console.error(`${code}: ${message}`);
  process.exit(4);
}

/** @returns {{ migrationUrl: string, supabaseUrl: string, secretKey: string, publishableKey: string, root: string }} */
function loadStagingEnv() {
  try { process.loadEnvFile(path.join(root, ".env")); } catch { fail("STAGING_ENV_MISSING", "this clone has no readable .env"); }
  for (const [name, value] of Object.entries(process.env))
    if (typeof value === "string" && value.includes(PRODUCTION_REF)) fail("PRODUCTION_REFERENCE", `${name} names the production project`);
  const migrationUrl = process.env.MIGRATION_DATABASE_URL || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  for (const [name, value] of Object.entries({ MIGRATION_DATABASE_URL: migrationUrl, NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, SUPABASE_SECRET_KEY: secretKey })) {
    if (!value || value.includes("REPLACE_ME")) fail("STAGING_KEYS_NOT_SET", `${name} is unset or still a placeholder`);
  }
  if (!migrationUrl.includes(STAGING_REF)) fail("NOT_STAGING", "the migration connection does not name the staging project");
  if (!supabaseUrl.includes(STAGING_REF)) fail("NOT_STAGING", "the Supabase URL does not name the staging project");
  const runtime = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || "";
  if (runtime && !runtime.includes(STAGING_REF)) fail("NOT_STAGING", "the runtime database connection does not name the staging project");
  return { migrationUrl, supabaseUrl, secretKey, publishableKey, root };
}

module.exports = { loadStagingEnv, STAGING_REF, PRODUCTION_REF };
