// Explicit, disposable PostgreSQL integration tests. Never reads an application .env
// or connects to a hosted database. Run: node scripts/run-disposable-postgres.cjs security|events
"use strict";
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");

const suites = {
  security: {
    container: "outclass-integration-security",
    port: 58454,
    database: "outclass_security_test",
    gate: "OUTCLASS_SECURITY_TEST_DATABASE_URL",
    tests: [
      "tests/onboarding-concurrency.test.cjs",
      "tests/interview-native-concurrency.test.cjs",
      "tests/interview-collaboration-native.test.cjs",
    ],
  },
  events: {
    container: "outclass-integration-events",
    port: 55442,
    database: "postgres",
    gate: "OUTCLASS_EVENTS_TEST_DATABASE_URL",
    tests: [
      "tests/campus-event-discovery.test.cjs",
      "tests/campus-event-discovery-browser.test.cjs",
    ],
  },
};
if (process.platform !== "linux") throw Error("Native fixture uses Linux Docker host networking to enforce loopback-only SQL.");
const suite = suites[process.argv[2]];
if (!suite || process.argv.length !== 3) {
  console.error("Usage: node scripts/run-disposable-postgres.cjs security|events");
  process.exit(2);
}
const image = "ghcr.io/supabase/postgres:17.11.0.002@sha256:0450166354dc9c1d25f0322ac8b580774d4fb0184d2b087f6e4fe9499c66cf53";
function command(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: options.input ? ["pipe", "inherit", "inherit"] : "inherit",
    ...options,
  });
  if (result.error || result.status !== 0)
    throw Error(cmd + " failed (" + (result.error?.message || result.status) + ")");
  return result;
}
function exists() {
  return spawnSync("docker", ["inspect", suite.container], { stdio: "ignore" }).status === 0;
}
if (exists()) throw Error("Fixture container already exists: " + suite.container + ". Refusing to replace it.");
const url = "postgresql://fixture_superuser@127.0.0.1:" + suite.port + "/" + suite.database +
  "?sslmode=disable&connection_limit=8";
const target = new URL(url);
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.port, String(suite.port));
assert.equal(target.pathname, "/" + suite.database);
const env = { ...process.env, DATABASE_URL: url, POSTGRES_PRISMA_URL: url,
  POSTGRES_URL: url, POSTGRES_URL_NON_POOLING: url,
  OUTCLASS_SECURITY_TEST_DATABASE_URL: "", OUTCLASS_EVENTS_TEST_DATABASE_URL: "",
  OUTCLASS_RECRUITMENT_TEST_DATABASE_URL: "", OUTCLASS_AUDIENCE_TEST_DATABASE_URL: "",
  OUTCLASS_TRANSACTION_TEST_DATABASE_URL: "", OUTCLASS_DECISION_RUNTIME_TEST_DATABASE_URL: "",
  SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", RESEND_API_KEY: "",
  SMTP_HOST: "", SMTP_USER: "", SMTP_PASSWORD: "", COMMUNICATIONS_EMAIL_ENABLED: "false",
  OUTCLASS_SITE_URL: "http://127.0.0.1:3107", VERCEL: "", VERCEL_ENV: "" };
env[suite.gate] = url;
let created = false;
function cleanup() {
  if (!created) return;
  // Never remove an unrelated container, even if the fixture's name was reused.
  const label = spawnSync("docker", ["inspect", suite.container,
    "--format", '{{index .Config.Labels "outclass.integration-suite"}}'],
    { encoding: "utf8" });
  if (label.status === 0 && label.stdout.trim() === process.argv[2])
    spawnSync("docker", ["rm", "-f", suite.container], { stdio: "ignore" });
}
try {
  const init = [
    "set -eu",
    "mkdir /tmp/fixturedb",
    "chown postgres:postgres /tmp/fixturedb",
    'su postgres -s /bin/bash -c "/nix/var/nix/profiles/default/bin/initdb -D /tmp/fixturedb -U fixture_superuser --auth=trust >/dev/null"',
    "printf 'host all all 0.0.0.0/0 trust\\n' >> /tmp/fixturedb/pg_hba.conf",
    'exec su postgres -s /bin/bash -c "/nix/var/nix/profiles/default/bin/postgres -D /tmp/fixturedb -p ' + suite.port + ' -c listen_addresses=127.0.0.1"',
  ].join("\n");
  command("docker", ["run", "-d", "--name", suite.container,
    "--label", "outclass.integration-suite=" + process.argv[2],
    "--network", "host", // Required: native tests verify inet_server_addr() is loopback.
    "--entrypoint", "bash", image, "-ec", init]);
  created = true;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (spawnSync("docker", ["exec", suite.container, "pg_isready", "-p", String(suite.port), "-U", "fixture_superuser"],
      { stdio: "ignore" }).status === 0) { ready = true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  if (!ready) throw Error("Disposable PostgreSQL did not become ready");
  if (suite.database !== "postgres")
    command("docker", ["exec", suite.container, "createdb", "-p", String(suite.port), "-U", "fixture_superuser", suite.database]);
  command("docker", ["exec", "-i", suite.container, "psql", "-p", String(suite.port), "-U", "fixture_superuser",
    "-d", suite.database, "-v", "ON_ERROR_STOP=1"], {
    input: "CREATE ROLE anon; CREATE ROLE authenticated; " +
      "CREATE ROLE outclass_production_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; " +
      "CREATE SCHEMA auth; CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz); " +
      "GRANT USAGE ON SCHEMA auth TO outclass_production_app; " +
      "GRANT SELECT ON auth.sessions TO outclass_production_app;",
  });
  command(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env });
  command("docker", ["exec", "-i", suite.container, "psql", "-U", "fixture_superuser",
    "-d", suite.database, "-v", "ON_ERROR_STOP=1"], {
    input: "DO $$ DECLARE t text; BEGIN FOR t IN SELECT tablename FROM pg_tables " +
      "WHERE schemaname='public' AND tablename<>'_prisma_migrations' LOOP " +
      "EXECUTE format('ALTER TABLE public.%I OWNER TO outclass_production_app',t); " +
      "END LOOP; END $$; REVOKE CREATE ON SCHEMA public FROM PUBLIC;",
  });
  console.log("Running " + suite.tests.length + " environment-gated suites against disposable " + suite.database);
  // No parallel test files: suites can mutate overlapping fixture state.
  command(process.execPath, ["--test", "--test-concurrency=1", ...suite.tests], { env });
  command(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "status"], { env });
  console.log("PASS: " + process.argv[2] + " integration suites ran against disposable PostgreSQL");
} finally {
  cleanup();
}
