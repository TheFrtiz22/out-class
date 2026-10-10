// Explicitly pin every database/auth alias to the running local Supabase stack.
// This script never prints secrets and cannot target a hosted database.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const statusResult = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8' });
if (statusResult.status !== 0) throw Error('Start the local OutClass Supabase stack before validation.');
const status = JSON.parse(statusResult.stdout);
for (const [value, port] of [[status.DB_URL, '54322'], [status.API_URL, '54321']]) {
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== port) throw Error('Refusing a nonlocal validation target.');
}
const env = { ...process.env, DATABASE_URL: status.DB_URL, POSTGRES_PRISMA_URL: status.DB_URL, POSTGRES_URL: status.DB_URL, POSTGRES_URL_NON_POOLING: status.DB_URL,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY, OUTCLASS_PUBLISH_BUILD: '1',
  OUTCLASS_SITE_URL: 'http://127.0.0.1:3107', SMTP_HOST: '', RESEND_API_KEY: '', COMMUNICATIONS_EMAIL_ENABLED: 'false' };
const logRoot = path.join(os.tmpdir(), 'outclass-communications-validation');
fs.mkdirSync(logRoot, { recursive: true });
const commands = [
  ['schema', ['node_modules/prisma/build/index.js', 'validate']],
  ['generate', ['node_modules/prisma/build/index.js', 'generate']],
  ['migration-path', ['scripts/check-migration-path.cjs']],
  ['migrate-local', ['node_modules/prisma/build/index.js', 'migrate', 'deploy']],
  ['tests', ['--test', 'tests/*.test.cjs']],
  ['migration-tests', ['tests/authorization-migration.cjs']],
  ['lint', ['node_modules/eslint/bin/eslint.js', '.']],
  ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['build', ['node_modules/next/dist/bin/next', 'build']],
];
let failed = false;
for (const [name, args] of commands) {
  const log = path.join(logRoot, name + '.log'), fd = fs.openSync(log, 'w');
  const result = spawnSync(process.execPath, args, { env, stdio: ['ignore', fd, fd] });
  fs.closeSync(fd);
  console.log(`${name}: ${result.status === 0 ? 'PASS' : 'FAIL'} (${log})`);
  if (result.status !== 0) { failed = true; if (['schema', 'generate', 'migration-path', 'migrate-local'].includes(name)) break; }
}
process.exitCode = failed ? 1 : 0;
