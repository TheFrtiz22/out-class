// Dedicated disposable PostgreSQL for the club-write, live-vote ballot and interview
// self-booking contention benchmarks and application re-application tests.
// Never inherits a configured database target. Run: node scripts/run-contention-benchmark.cjs
// Optional: OUTCLASS_CONTENTION_STUDENTS=20 OUTCLASS_CONTENTION_RTT_MS=0,70 OUTCLASS_CONTENTION_REPORT=out.json
// Interview booking: OUTCLASS_BOOKING_STUDENTS=20,60 OUTCLASS_BOOKING_CLUBS=1,3 OUTCLASS_BOOKING_RTT_MS=0,2 OUTCLASS_BOOKING_REPORT=out.json
// OUTCLASS_CONTENTION_BASELINE_REF=<git ref> also measures that ref's applications.ts.
const { spawnSync } = require('node:child_process');
const name = 'outclass-club-write-contention';
const { ensurePostgresImage } = require('../tests/helpers/local-postgres-image.cjs');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: options.input ? ['pipe', 'inherit', 'inherit'] : 'inherit', ...options });
  if (result.status !== 0) throw Error(`${command} failed (${result.status})`);
  return result;
}
if (spawnSync('docker', ['inspect', name], { stdio: 'ignore' }).status === 0)
  throw Error('Dedicated fixture container already exists; refusing to replace it.');
const databaseUrl = 'postgresql://fixture_superuser@127.0.0.1:58455/outclass_contention_test?sslmode=disable&connection_limit=30';
const env = { ...process.env, DATABASE_URL: databaseUrl, POSTGRES_PRISMA_URL: databaseUrl,
  OUTCLASS_CONTENTION_TEST_DATABASE_URL: databaseUrl, COMMUNICATIONS_EMAIL_ENABLED: 'false', RESEND_API_KEY: '', SMTP_HOST: '' };
try {
  const postgresImage = ensurePostgresImage();
  run('docker', ['run', '-d', '--name', name, '--label', 'outclass.contention-test=disposable', '-p', '127.0.0.1:58455:5432',
    '--entrypoint', 'bash', postgresImage, '-ec',
    'mkdir /tmp/fixturedb; chown postgres:postgres /tmp/fixturedb; su postgres -s /bin/bash -c "/nix/var/nix/profiles/default/bin/initdb -D /tmp/fixturedb -U fixture_superuser --auth=trust >/dev/null"; printf "host all all 0.0.0.0/0 trust\\n" >> /tmp/fixturedb/pg_hba.conf; exec su postgres -s /bin/bash -c "/nix/var/nix/profiles/default/bin/postgres -D /tmp/fixturedb -c listen_addresses=\\\"*\\\""']);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'fixture_superuser'], { stdio: 'ignore' }).status === 0) { ready = true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  if (!ready) throw Error('Disposable PostgreSQL did not start.');
  run('docker', ['exec', name, 'createdb', '-U', 'fixture_superuser', 'outclass_contention_test']);
  run('docker', ['exec', '-i', name, 'psql', '-U', 'fixture_superuser', '-d', 'outclass_contention_test', '-v', 'ON_ERROR_STOP=1'], {
    input: 'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; CREATE SCHEMA auth; CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz); GRANT USAGE ON SCHEMA auth TO outclass_production_app; GRANT SELECT ON auth.sessions TO outclass_production_app;',
  });
  run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env });
  run('docker', ['exec', '-i', name, 'psql', '-U', 'fixture_superuser', '-d', 'outclass_contention_test', '-v', 'ON_ERROR_STOP=1'], {
    input: `REVOKE CREATE ON SCHEMA public FROM PUBLIC;`,
  });
  run(process.execPath, ['--test', '--test-concurrency=1', 'tests/club-write-contention-native.test.cjs', 'tests/application-reapplication-native.test.cjs', 'tests/voting-ballot-contention-native.test.cjs', 'tests/interview-booking-contention-native.test.cjs'], { env });
} finally {
  spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
}
