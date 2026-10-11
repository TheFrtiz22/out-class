// Dedicated local Auth/DB and a production Next build; never reads application .env.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
const repo = path.resolve(__dirname, '..');
const root = path.join(os.tmpdir(), 'outclass-announcement-e2e');
fs.mkdirSync(path.join(root, 'supabase/templates'), { recursive: true, mode: 0o700 });
function run(args, name, env = process.env) {
  const fd = fs.openSync(path.join(root, name + '.log'), 'w');
  const result = spawnSync(process.execPath, args, { cwd: repo, env, stdio: ['ignore', fd, fd] });
  fs.closeSync(fd);
  if (result.status !== 0) throw Error(name + ' failed; inspect ' + path.join(root, name + '.log'));
  console.log(name + ': PASS');
}
async function main() {
  const configFile = path.join(root, 'config.json');
  if (fs.existsSync(configFile)) throw Error('Existing fixture retained. Use scripts/announcement-e2e-control.cjs to inspect/restart it.');
  let config = fs.readFileSync(path.join(repo, 'supabase/config.toml'), 'utf8').replace('project_id = "out-class"', 'project_id = "outclass-announcement-e2e"');
  config = config.replaceAll('5432', '5632').replaceAll('http://127.0.0.1:3000', 'http://127.0.0.1:3117').replaceAll('https://127.0.0.1:3000', 'http://127.0.0.1:3117');
  if (!config.includes('project_id = "outclass-announcement-e2e"')) throw Error('Local project guard failed');
  fs.writeFileSync(path.join(root, 'supabase/config.toml'), config);
  for (const name of fs.readdirSync(path.join(repo, 'supabase/templates'))) if (name.endsWith('.html')) fs.copyFileSync(path.join(repo, 'supabase/templates', name), path.join(root, 'supabase/templates', name));
  run(['node_modules/supabase/dist/supabase.js', 'start', '--workdir', root, '-x', 'studio,edge-runtime,logflare,vector,imgproxy'], 'supabase-start');
  const result = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '--workdir', root, '-o', 'json'], { cwd: repo, encoding: 'utf8' });
  if (result.status) throw Error('Local status unavailable');
  const status = JSON.parse(result.stdout);
  const settings = { projectId: 'outclass-announcement-e2e', appUrl: 'http://127.0.0.1:3117', status, buildDir: path.join(repo, '.next-publish'), cronSecret: randomUUID() };
  require('../tests/helpers/announcement-e2e.cjs').assertLocalConfig(settings);
  const env = require('../tests/helpers/announcement-e2e.cjs').localEnv(settings);
  run(['node_modules/prisma/build/index.js', 'validate'], 'prisma-validate', env);
  run(['node_modules/prisma/build/index.js', 'generate'], 'prisma-generate', env);
  run(['scripts/check-migration-path.cjs'], 'migration-path', env);
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy'], 'migrate-local', env);
  const db = new PrismaClient({ datasourceUrl: status.DB_URL });
  const auth = createClient(status.API_URL, status.SECRET_KEY, { auth: { persistSession: false } });
  try {
    settings.actors = {};
    for (const [role, email] of [['owner', 'announcement-admin@virginia.edu'], ['recipient', 'bsb4rd@virginia.edu']]) {
      const password = 'Local-announcement-only!' + randomUUID();
      const { data, error } = await auth.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      if (!data.user.email_confirmed_at) throw Error('Fixture email not confirmed');
      const user = await db.user.upsert({ where: { id: data.user.id }, create: { id: data.user.id, email }, update: {} });
      await db.studentProfile.create({ data: { userId: user.id, computingId: role === 'recipient' ? 'bsb4rd' : 'announcement-admin', firstName: role === 'recipient' ? 'Test' : 'Club', lastName: role === 'recipient' ? 'Recipient' : 'Administrator', major: 'Economics', gradYear: 2028 } });
      settings.actors[role] = { id: user.id, email, password };
    }
    const club = await db.club.create({ data: { slug: 'isolated-notification-test', name: 'OutClass Notification Test Club', tagline: 'Isolated local test', description: 'A dedicated local test club.', category: 'Academic', color: '#142d4e' } });
    settings.clubId = club.id;
    await db.clubMember.create({ data: { clubId: club.id, userId: settings.actors.owner.id, isOwner: true, accessRole: 'OWNER' } });
    const round = await db.pipelineRound.create({ data: { clubId: club.id, name: 'Test audience', order: 0 } });
    await db.application.create({ data: { clubId: club.id, studentId: settings.actors.recipient.id, roundId: round.id, status: 'SUBMITTED', submittedAt: new Date() } });
    await db.userNotificationPreference.create({ data: { userId: settings.actors.recipient.id, emailAnnouncements: true, emailMessages: false, emailApplications: false, emailInterviews: false, emailInvitations: false, emailTasks: false, emailPlatform: false, emailFrequency: 'INSTANT' } });
    // Fixture's application update stays in-app and is ineligible for email.
    const audience = await db.application.findMany({ where: { clubId: club.id, status: { not: 'DRAFTING' }, submittedAt: { not: null }, student: { disabledAt: null } }, include: { student: true } });
    if (audience.length !== 1 || audience[0].student.email !== 'bsb4rd@virginia.edu') throw Error('Audience guard failed');
    fs.writeFileSync(configFile, JSON.stringify(settings), { mode: 0o600 });
  } finally { await db.$disconnect(); }
  run(['node_modules/next/dist/bin/next', 'build'], 'build', env);
  const fd = fs.openSync(path.join(root, 'server.log'), 'a');
  const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3117', '-H', '127.0.0.1'], { cwd: repo, env, detached: true, stdio: ['ignore', fd, fd] });
  fs.writeFileSync(path.join(root, 'server.pid'), String(app.pid)); app.unref(); fs.closeSync(fd);
  console.log('Isolated app: ' + settings.appUrl + '; private fixture: ' + configFile);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
