// Dedicated local Supabase + an isolated production build of the real application.
// No application .env files, hosted credentials, existing DBs, or live panels are used.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const { spawn, spawnSync } = require('node:child_process'), { randomUUID } = require('node:crypto')
const { PrismaClient } = require('@prisma/client'), { createClient } = require('@supabase/supabase-js')
const repo = path.resolve(__dirname, '..'), root = path.join(os.tmpdir(), 'outclass-availability-e2e'), project = 'outclass-availability-e2e'
const publication = process.argv.includes('--publication'); const panels = process.argv.includes('--panels')||publication; const keep = process.argv.includes('--keep'); let server, touched = false
const supabase = path.join(repo, 'node_modules/supabase/dist/supabase.js')
function run(args, log, env, cwd = repo) {
  const fd = fs.openSync(path.join(root, log + '.log'), 'w')
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: ['ignore', fd, fd] }); fs.closeSync(fd)
  if (result.status !== 0) throw Error(`${log} failed; inspect ${path.join(root, log + '.log')}`)
  console.log(log + ': PASS')
}
function guards(config) {
  assert.equal(config.projectId, project)
  for (const [value, port] of [[config.appUrl, '3126'], [config.status.API_URL, '57321'], [config.status.DB_URL, '57322']]) {
    const url = new URL(value); assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname)); assert.equal(url.port, port)
  }
}
async function main() {
  if (fs.existsSync(path.join(root, 'config.json'))) throw Error('A retained local fixture exists. Remove it with --cleanup before starting another run.')
  fs.mkdirSync(path.join(root, 'supabase/templates'), { recursive: true, mode: 0o700 })
  const config = fs.readFileSync(path.join(repo, 'supabase/config.toml'), 'utf8').replace('project_id = "out-class"', `project_id = "${project}"`).replaceAll('5432', '5732').replaceAll('http://127.0.0.1:3000', 'http://127.0.0.1:3126').replaceAll('http://localhost:3000', 'http://127.0.0.1:3126')
  assert.ok(config.includes(`project_id = "${project}"`))
  fs.writeFileSync(path.join(root, 'supabase/config.toml'), config)
  for (const file of fs.readdirSync(path.join(repo, 'supabase/templates'))) if (file.endsWith('.html')) fs.copyFileSync(path.join(repo, 'supabase/templates', file), path.join(root, 'supabase/templates', file))
  touched = true
  run([supabase, 'start', '--workdir', root, '-x', 'studio,edge-runtime,logflare,vector,imgproxy'], 'supabase-start', process.env)
  const status = spawnSync(process.execPath, [supabase, 'status', '--workdir', root, '-o', 'json'], { cwd: repo, encoding: 'utf8' })
  if (status.status) throw Error('Local Supabase status unavailable')
  const settings = { projectId: project, appUrl: 'http://127.0.0.1:3126', status: JSON.parse(status.stdout), buildDir: path.join(root, 'app/.next-publish') }; guards(settings)
  const env = { ...process.env, DATABASE_URL: settings.status.DB_URL, POSTGRES_PRISMA_URL: settings.status.DB_URL, POSTGRES_URL: settings.status.DB_URL, POSTGRES_URL_NON_POOLING: settings.status.DB_URL,
    NEXT_PUBLIC_SUPABASE_URL: settings.status.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: settings.status.PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY: settings.status.ANON_KEY,
    SUPABASE_SECRET_KEY: settings.status.SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY: settings.status.SERVICE_ROLE_KEY, OUTCLASS_SITE_URL: settings.appUrl, OUTCLASS_PUBLISH_BUILD: '1',
    SMTP_HOST: '', SMTP_PASSWORD: '', RESEND_API_KEY: '', RESEND_FROM_EMAIL: '', COMMUNICATIONS_EMAIL_ENABLED: 'false', OUTCLASS_PLATFORM_ADMIN_IDS: '', VERCEL: '', VERCEL_ENV: '', NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH: 'false' }
  // Copy sources, including uncommitted work; keep the user's running builds untouched.
  fs.cpSync(repo, path.join(root, 'app'), { recursive: true, filter: file => {
    const relative = path.relative(repo, file), first = relative.split(path.sep)[0]
    return !['node_modules', '.git', '.agents', '.codex', '.claude', '.cursor', '.pnpm-store'].includes(first) && !first.startsWith('.next') && !path.basename(file).startsWith('.env') && !relative.startsWith('supabase' + path.sep + '.temp')
  } })
  fs.symlinkSync(path.join(repo, 'node_modules'), path.join(root, 'app/node_modules'), 'dir')
  run([path.join(repo, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'], 'migrate-local', env, path.join(root, 'app'))
  const db = new PrismaClient({ datasourceUrl: settings.status.DB_URL })
  const auth = createClient(settings.status.API_URL, settings.status.SECRET_KEY, { auth: { persistSession: false } })
  try {
    settings.actors = {}
    for (const role of ['owner', 'interviewer', 'outsider']) {
      const email = `availability.${role}.${randomUUID().slice(0, 8)}@virginia.edu`, password = 'Local-availability-only!' + randomUUID()
      const { data, error } = await auth.auth.admin.createUser({ email, password, email_confirm: true }); if (error) throw Error('Local test account creation failed')
      settings.actors[role] = { id: data.user.id, email, password }
      await db.user.create({ data: { id: data.user.id, email, studentProfile: { create: { firstName: role === 'interviewer' ? 'Test' : 'Local', lastName: role === 'interviewer' ? 'Interviewer' : role, computingId: role + randomUUID().slice(0, 8), major: 'Economics', gradYear: 2028 } } } })
    }
    settings.clubs = []
    for (const name of ['Availability Test Club', 'Other Availability Club']) {
      const club = await db.club.create({ data: { slug: randomUUID(), name, tagline: 'Local fixture', description: 'Disposable test only', category: 'Academic', color: '#142d4e', claimedAt: new Date() } })
      const round = await db.pipelineRound.create({ data: { clubId: club.id, name: 'Interview round', type: 'INTERVIEW', order: 0 } })
      await db.clubMember.create({ data: { clubId: club.id, userId: settings.actors.owner.id, isOwner: true, accessRole: 'OWNER' } })
      const member = await db.clubMember.create({ data: { clubId: club.id, userId: settings.actors.interviewer.id, accessRole: 'INTERVIEWER', permissions: ['applications.review', 'applicants.identify'] } })
      settings.clubs.push({ id: club.id, roundId: round.id, memberId: member.id })
      await db.interviewRoom.create({ data: { clubId: club.id, roundId: round.id, name: 'Existing test room', location: 'Hall', kind: 'IN_PERSON', timezone: 'America/New_York', duration: 20, slots: { create: { clubId: club.id, location: 'Hall', startTime: new Date('2026-10-12T13:00:00Z'), endTime: new Date('2026-10-12T13:20:00Z') } } } })
    }
    if (panels) await require(publication?'../tests/panel-publication-browser.cjs':'../tests/panel-proposals-browser.cjs').prepare(db, auth, settings)
    fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify(settings), { mode: 0o600 })
  } finally { await db.$disconnect() }
  run([path.join(repo, 'node_modules/next/dist/bin/next'), 'build'], 'build', env, path.join(root, 'app'))
  const fd = fs.openSync(path.join(root, 'server.log'), 'w')
  server = spawn(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), 'start', '-p', '3126', '-H', '127.0.0.1'], { cwd: path.join(root, 'app'), env, stdio: ['ignore', fd, fd] })
  fs.writeFileSync(path.join(root, 'server.pid'), String(server.pid))
  fs.closeSync(fd)
  for (let i = 0; i < 100; i++) { try { const r = await fetch(settings.appUrl); if (r.ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  await require(publication?'../tests/panel-publication-browser.cjs':panels ? '../tests/panel-proposals-browser.cjs' : '../tests/availability-browser.cjs').verify(settings, root)
  console.log('Browser → actual server actions → local Prisma/Postgres: PASS')
  if (keep) { server.unref(); fs.writeFileSync(path.join(root, 'server.pid'), String(server.pid)); console.log('Local fixture retained at ' + settings.appUrl) }
}
function cleanup() {
  // Only this dedicated test project, never --all or another project.
  if (server) server.kill('SIGTERM')
  const pid = path.join(root, 'server.pid'); if (fs.existsSync(pid)) { try { process.kill(Number(fs.readFileSync(pid)), 'SIGTERM') } catch {} }
  if (touched || fs.existsSync(path.join(root, 'supabase/config.toml'))) {
    const config = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8'); assert.ok(config.includes(`project_id = "${project}"`))
    run([supabase, 'stop', '--workdir', root, '--project-id', project, '--no-backup'], 'cleanup', process.env)
  }
  for (const item of ['config.json', 'server.pid', 'app']) fs.rmSync(path.join(root, item), { recursive: true, force: true })
}
if (process.argv.includes('--cleanup')) cleanup()
else main().catch(error => { console.error(error.message); process.exitCode = 1; if (keep && server) server.unref() }).finally(() => { if (!keep) cleanup() })
