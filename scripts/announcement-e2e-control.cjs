// Controls only the reserved local fixture. Real sending requires send-once and
// a private key file; it refuses any audience/job other than the approved event.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const { readConfig, localEnv } = require('../tests/helpers/announcement-e2e.cjs');
const root = path.join(os.tmpdir(), 'outclass-announcement-e2e'), config = readConfig(path.join(root, 'config.json'));
const repo = path.resolve(__dirname, '..'), command = process.argv[2];
function stop() {
  const file = path.join(root, 'server.pid');
  if (!fs.existsSync(file)) return;
  const pid = Number(fs.readFileSync(file));
  try { process.kill(pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  return pid;
}
async function start(email = false) {
  const oldPid = stop();
  if (oldPid) for (let i = 0; i < 100; i++) {
    try { process.kill(oldPid, 0); } catch (error) { if (error.code === 'ESRCH') break; throw error; }
    if (i === 99) process.kill(oldPid, 'SIGKILL');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  fs.rmSync(path.join(root, 'server.pid'), { force: true });
  const env = localEnv(config);
  if (email) Object.assign(env, { COMMUNICATIONS_EMAIL_ENABLED: 'true', RESEND_API_KEY: fs.readFileSync(process.env.OUTCLASS_TEST_RESEND_KEY_FILE, 'utf8').trim(), RESEND_FROM_EMAIL: 'no-reply@updates.out-class.net' });
  const fd = fs.openSync(path.join(root, 'server.log'), 'a');
  const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3117', '-H', '127.0.0.1'], { cwd: repo, env, detached: true, stdio: ['ignore', fd, fd] });
  fs.writeFileSync(path.join(root, 'server.pid'), String(app.pid)); fs.closeSync(fd); app.unref();
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(config.appUrl, { signal: AbortSignal.timeout(1000) })).ok) { console.log('Local app ready; email ' + (email ? 'enabled for one guarded request' : 'disabled')); return; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Local app did not become ready');
}
async function sendOnce(db) {
  const ledger = path.join(root, 'real-send-attempt.json');
  assert.ok(!fs.existsSync(ledger), 'A real attempt already exists; reconcile it, never blindly resend');
  assert.ok(process.env.OUTCLASS_TEST_RESEND_KEY_FILE, 'Private Resend key file required');
  const announcements = await db.clubAnnouncement.findMany({ where: { clubId: config.clubId }, include: { notifications: { include: { user: true, emailOutbox: true } } } });
  assert.equal(announcements.length, 1);
  const a = announcements[0]; assert.equal(a.title, 'OutClass Notification System Test'); assert.equal(a.notifications.length, 1);
  const n = a.notifications[0]; assert.equal(n.user.email, 'bsb4rd@virginia.edu'); assert.equal(n.userId, config.actors.recipient.id); assert.equal(n.emailOutbox.status, 'PENDING');
  const auth = createClient(config.status.API_URL, config.status.SECRET_KEY, { auth: { persistSession: false } });
  const verified = await auth.auth.admin.getUserById(n.userId); assert.ok(!verified.error && verified.data.user.email_confirmed_at); assert.equal(verified.data.user.email, n.user.email);
  assert.equal(await db.notificationEmailDelivery.count({ where: { status: { in: ['QUEUED', 'SENDING'] } } }), 0);
  const pending = await db.notificationEmailOutbox.findMany({ where: { status: 'PENDING' }, include: { notification: { include: { user: { include: { notificationPreferences: true } } } } } });
  const { loader } = require('../tests/helpers/communications-loader.cjs');
  const policy = loader({})('lib/communications-policy.ts');
  const eligible = pending.filter(row => policy.optionalEmailAllowed(row.notification.user.notificationPreferences, row.notification.type));
  assert.equal(eligible.length, 1); assert.equal(eligible[0].notificationId, n.id);
  assert.equal(n.user.disabledAt, null); assert.equal((await db.club.findUnique({ where: { id: config.clubId } })).suspendedAt, null);
  fs.writeFileSync(ledger, JSON.stringify({ startedAt: new Date(), announcementId: a.id, notificationId: n.id, recipient: n.user.email }), { mode: 0o600, flag: 'wx' });
  try {
    await start(true);
    const unauthorized = await fetch(config.appUrl + '/api/internal/notification-delivery', { method: 'POST' }); assert.equal(unauthorized.status, 401);
    const response = await fetch(config.appUrl + '/api/internal/notification-delivery', { method: 'POST', headers: { authorization: 'Bearer ' + config.cronSecret } });
    const result = await response.json(); assert.equal(response.status, 200); assert.equal(result.sent, 1); assert.equal(result.failed, 0);
    const item = await db.notificationEmailOutbox.findUnique({ where: { notificationId: n.id }, include: { delivery: true } });
    assert.equal(item.delivery.status, 'SENT'); assert.ok(item.delivery.providerMessageId); assert.equal(item.delivery.attemptCount, 1);
    const repeat = await fetch(config.appUrl + '/api/internal/notification-delivery', { headers: { authorization: 'Bearer ' + config.cronSecret } });
    assert.equal((await repeat.json()).sent, 0);
    const receipt = { ...JSON.parse(fs.readFileSync(ledger)), ...result, deliveryId: item.deliveryId, providerMessageId: item.delivery.providerMessageId, databaseStatus: item.delivery.status, attemptCount: item.delivery.attemptCount, repeatedWorkerSent: 0 };
    const key = fs.readFileSync(process.env.OUTCLASS_TEST_RESEND_KEY_FILE, 'utf8').trim();
    const provider = await fetch('https://api.resend.com/emails/' + receipt.providerMessageId, { headers: { authorization: 'Bearer ' + key } });
    if (provider.ok) { const data = await provider.json(); receipt.providerStatus = data.last_event; }
    else receipt.providerReadStatus = provider.status;
    fs.writeFileSync(ledger, JSON.stringify(receipt, null, 2), { mode: 0o600 });
    fs.writeFileSync(path.join(root, 'announcement-email.html'), item.delivery.payload.html);
    console.log(JSON.stringify(receipt));
  } finally { await start(false); }
}
async function main() {
  if (command === 'start') return start();
  if (command === 'stop') return stop();
  if (command === 'validate') {
    let failures = 0;
    const env = { ...localEnv(config), OUTCLASS_ANNOUNCEMENT_E2E_CONFIG: path.join(root, 'config.json') };
    for (const [name, args] of [
      ['schema', ['node_modules/prisma/build/index.js', 'validate']], ['migration-status', ['node_modules/prisma/build/index.js', 'migrate', 'status']],
      ['migration-tests', ['tests/authorization-migration.cjs']], ['tests', ['--test', 'tests/*.test.cjs']],
      ['lint', ['node_modules/eslint/bin/eslint.js', '.']], ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']],
      ['build', ['node_modules/next/dist/bin/next', 'build']],
    ]) {
      const fd = fs.openSync(path.join(root, name + '.log'), 'w'); const r = spawnSync(process.execPath, args, { cwd: repo, env, stdio: ['ignore', fd, fd] }); fs.closeSync(fd);
      console.log(name + ': ' + (r.status === 0 ? 'PASS' : 'FAIL') + ' (' + path.join(root, name + '.log') + ')'); if (r.status !== 0) failures++;
    }
    process.exitCode = failures ? 1 : 0; return;
  }
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL });
  try {
    if (command === 'send-once') return await sendOnce(db);
    if (command !== 'inspect') throw Error('Use start, stop, inspect, validate, or send-once');
    console.log(JSON.stringify({ clubId: config.clubId, announcements: await db.clubAnnouncement.findMany({ where: { clubId: config.clubId }, include: { _count: { select: { notifications: true } } } }), notifications: await db.userNotification.findMany({ where: { userId: config.actors.recipient.id }, include: { emailOutbox: { include: { delivery: true } } } }) }, null, 2));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
