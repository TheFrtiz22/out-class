// Start one of two fixed local builds for the active-room comparison.
// Never fetches environment values or changes a hosted service.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { spawn, spawnSync, execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readConfig } = require('../tests/helpers/onboarding-e2e.cjs');
const root = path.join(os.tmpdir(), 'outclass-onboarding-e2e');
const repo = path.resolve(__dirname, '..'), configFile = path.join(root, 'config.json');
const config = readConfig(configFile), s = config.status;
const reference = '3017e01d5b55bc8fb38d4f8fbec4906dd93bf619';
const target = process.argv[2];
assert.ok(['reference', 'current'].includes(target) && process.argv.length === 3);
const referenceRoot = path.join(root, 'active-workload-audit-reference');
const applicationPaths = ['app', 'actions', 'components', 'contexts', 'hooks', 'lib', 'utils', 'public', 'styles', 'prisma', 'middleware.ts', 'next.config.mjs', 'package.json', 'pnpm-lock.yaml'];
assert.equal(execFileSync('git', ['diff', 'HEAD', '--name-only', '--', ...applicationPaths], { cwd: repo, encoding: 'utf8' }).trim(), '', 'Current application changes must be built and identified before comparison');
assert.equal(execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', ...applicationPaths], { cwd: repo, encoding: 'utf8' }).trim(), '');

(async () => {
  const pid = Number(fs.readFileSync(path.join(root, 'server.pid'), 'utf8'));
  assert.equal(execFileSync('lsof', ['-tiTCP:3107', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim(), String(pid));
  const cwd = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).split('\n').find(line => line.startsWith('n'))?.slice(1);
  assert.ok([repo, referenceRoot].filter(p=>fs.existsSync(p)).map(p=>fs.realpathSync(p)).includes(fs.realpathSync(cwd)), 'Only the reserved app may be replaced');
  process.kill(pid, 'SIGTERM');
  for (let n = 0; n < 100; n++) {
    if (spawnSync('lsof', ['-tiTCP:3107', '-sTCP:LISTEN'], { stdio: 'ignore' }).status !== 0) break;
    await new Promise(r => setTimeout(r, 50));
    if (n === 99) throw Error('Reserved app did not stop');
  }
  if (target === 'reference' && !fs.existsSync(referenceRoot)) {
    fs.mkdirSync(referenceRoot);
    const archive = execFileSync('git', ['archive', '--format=tar', reference], { cwd: repo, maxBuffer: 64 * 1024 * 1024 });
    assert.equal(spawnSync('tar', ['-xf', '-', '-C', referenceRoot], { input: archive }).status, 0);
    fs.symlinkSync(path.join(repo, 'node_modules'), path.join(referenceRoot, 'node_modules'), 'dir');
    fs.writeFileSync(path.join(referenceRoot, '.outclass-audit-reference'), reference);
  }
  const source = target === 'reference' ? referenceRoot : repo;
  if (target === 'reference') assert.equal(fs.readFileSync(path.join(source, '.outclass-audit-reference'), 'utf8'), reference);
  const pool = new URL(s.DB_URL); pool.searchParams.set('connection_limit', '8');
  const env = { ...process.env, NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH: 'false', DATABASE_URL: pool.href, POSTGRES_PRISMA_URL: pool.href, POSTGRES_URL: pool.href, POSTGRES_URL_NON_POOLING: pool.href, NEXT_PUBLIC_SUPABASE_URL: s.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: s.PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY: s.ANON_KEY, SUPABASE_SECRET_KEY: s.SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY: s.SERVICE_ROLE_KEY, OUTCLASS_PUBLISH_BUILD: '1', OUTCLASS_SITE_URL: config.appUrl, OUTCLASS_PLATFORM_ADMIN_IDS: config.admin.id, SMTP_HOST: '127.0.0.1', SMTP_PORT: '55325', SMTP_USER: 'local-test', SMTP_PASSWORD: 'local-test', SMTP_FROM_EMAIL: 'outclass@virginia.edu', CRON_SECRET: randomUUID(), NODE_EXTRA_CA_CERTS: path.join(root, 'mailpit-cert.pem'), COMMUNICATIONS_EMAIL_ENABLED: 'false', RESEND_API_KEY: '', RESEND_FROM_EMAIL: '' };
  const buildDir = path.join(source, '.next-publish');
  if (target === 'reference' && !fs.existsSync(path.join(buildDir, 'BUILD_ID'))) {
    const fd = fs.openSync(path.join(root, 'active-reference-build.log'), 'w');
    const result = spawnSync(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), 'build'], { cwd: source, env, stdio: ['ignore', fd, fd] });
    fs.closeSync(fd); assert.equal(result.status, 0, 'Inspect the reserved reference build log');
  }
  assert.ok(fs.existsSync(path.join(buildDir, 'BUILD_ID')));
  const log = fs.openSync(path.join(root, 'active-' + target + '-server.log'), 'a');
  const app = spawn(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), 'start', '-p', '3107', '-H', '127.0.0.1'], { cwd: source, env, detached: true, stdio: ['ignore', log, log] });
  fs.closeSync(log); app.unref();
  fs.writeFileSync(path.join(root, 'server.pid'), String(app.pid));
  config.buildDir = buildDir;
  config.activeWorkload = { target, sourceCommit: target === 'reference' ? reference : execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), applicationSourcesModified: false, poolLimitPerPrismaClient: 8, buildId: fs.readFileSync(path.join(buildDir, 'BUILD_ID'), 'utf8').trim() };
  fs.writeFileSync(configFile, JSON.stringify(config), { mode: 0o600 });
  for (let n = 0; n < 100; n++) {
    try { if ((await fetch(config.appUrl)).ok) { console.log(JSON.stringify(config.activeWorkload)); return; } } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw Error('Reserved workload app did not start');
})().catch(error => { console.error(error.name + ': ' + String(error.message).split('\n')[0]); process.exitCode = 1; });
