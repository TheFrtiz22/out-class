// Every connection is pinned to the newly provisioned disposable project.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { spawn } = require('node:child_process');
const c = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'outclass-profile-p2-e2e/config.json')));
if (c.projectId !== 'outclass-profile-p2-e2e') throw Error('Disposable project required');
for (const [value, port] of [[c.status.DB_URL, '58322'], [c.status.API_URL, '58321']]) { const u = new URL(value); if (!['localhost', '127.0.0.1'].includes(u.hostname) || u.port !== port) throw Error('Disposable local services required'); }
const s = c.status;
const env = { ...process.env, DATABASE_URL:s.DB_URL, POSTGRES_PRISMA_URL:s.DB_URL, POSTGRES_URL:s.DB_URL, POSTGRES_URL_NON_POOLING:s.DB_URL, NEXT_PUBLIC_SUPABASE_URL:s.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY:s.ANON_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:s.PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY:s.SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY:s.SECRET_KEY, OUTCLASS_PLATFORM_ADMIN_IDS:c.identities.admin.id, OUTCLASS_SITE_URL:'http://127.0.0.1:3110', OUTCLASS_PUBLISH_BUILD:'1' };
const mode = process.argv[2] || 'validate';
const child = mode === 'start' ? spawn(process.execPath, ['node_modules/next/dist/bin/next','start','-p','3110','-H','127.0.0.1'], {env,stdio:'inherit'}) : mode === 'dev' ? spawn(process.execPath, ['node_modules/next/dist/bin/next','dev','-p','3110','-H','127.0.0.1'], {env,stdio:'inherit'}) : spawn('npm',['run',mode],{env,stdio:'inherit'});
child.on('exit', code => { process.exitCode = code }); process.on('SIGTERM', () => child.kill('SIGTERM'));
