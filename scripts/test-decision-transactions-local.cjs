// Dedicated disposable PostgreSQL, never inherits a configured database target.
const { spawnSync } = require('node:child_process');
const name = 'outclass-decision-transaction-repair';
// Official Supabase 17.11.0.002 multi-platform image, pinned by digest.
// GHCR avoids ECR Public's anonymous shared-runner download quota.
const postgresImage = 'ghcr.io/supabase/postgres:17.11.0.002@sha256:0450166354dc9c1d25f0322ac8b580774d4fb0184d2b087f6e4fe9499c66cf53';
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: options.input ? ['pipe', 'inherit', 'inherit'] : 'inherit', ...options });
  if (result.status !== 0) throw Error(`${command} failed (${result.status})`);
  return result;
}
if (spawnSync('docker', ['inspect', name], { stdio: 'ignore' }).status === 0)
  throw Error('Dedicated fixture container already exists; refusing to replace it.');
const databaseUrl = 'postgresql://fixture_superuser@127.0.0.1:58452/outclass_recruitment_test?sslmode=disable&connection_limit=8';
const env = { ...process.env, DATABASE_URL: databaseUrl, POSTGRES_PRISMA_URL: databaseUrl,
  OUTCLASS_TRANSACTION_TEST_DATABASE_URL: databaseUrl, COMMUNICATIONS_EMAIL_ENABLED: 'false', RESEND_API_KEY: '', SMTP_HOST: '' };
try {
  run('docker', ['run', '-d', '--name', name, '--label', 'outclass.transaction-test=disposable', '-p', '127.0.0.1:58452:5432',
    '--entrypoint', 'bash', postgresImage, '-ec',
    'mkdir /tmp/fixturedb; chown postgres:postgres /tmp/fixturedb; su postgres -s /bin/bash -c "/nix/var/nix/profiles/default/bin/initdb -D /tmp/fixturedb -U fixture_superuser --auth=trust >/dev/null"; printf "host all all 0.0.0.0/0 trust\\n" >> /tmp/fixturedb/pg_hba.conf; exec su postgres -s /bin/bash -c "/nix/var/nix/profiles/default/bin/postgres -D /tmp/fixturedb -c listen_addresses=\\\"*\\\""']);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'fixture_superuser'], { stdio: 'ignore' }).status === 0) { ready = true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  if (!ready) throw Error('Disposable PostgreSQL did not start.');
  run('docker', ['exec', name, 'createdb', '-U', 'fixture_superuser', 'outclass_recruitment_test']);
  run('docker', ['exec', '-i', name, 'psql', '-U', 'fixture_superuser', '-d', 'outclass_recruitment_test', '-v', 'ON_ERROR_STOP=1'], {
    input: 'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; CREATE SCHEMA auth; CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz); GRANT USAGE ON SCHEMA auth TO outclass_production_app; GRANT SELECT ON auth.sessions TO outclass_production_app;',
  });
  run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env });
  run('docker', ['exec', '-i', name, 'psql', '-U', 'fixture_superuser', '-d', 'outclass_recruitment_test', '-v', 'ON_ERROR_STOP=1'], {
    input: `DO $$ DECLARE t text; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' LOOP EXECUTE format('ALTER TABLE public.%I OWNER TO outclass_production_app',t); END LOOP; END $$; REVOKE CREATE ON SCHEMA public FROM PUBLIC;`,
  });
  run(process.execPath, ['--test', 'tests/decision-transactions-native.test.cjs'], { env });
  // Also rerun the existing native offer and canonical communications producers.
  run(process.execPath, ['--test', '--test-concurrency=1', 'tests/recruitment-offers-native.test.cjs', 'tests/communications-native.test.cjs'], {
    env: { ...env, OUTCLASS_RECRUITMENT_TEST_DATABASE_URL: databaseUrl.replace('fixture_superuser@', 'outclass_production_app@') },
  });
} finally {
  spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
}
