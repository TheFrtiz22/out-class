// Dedicated disposable services only; never uses application .env connection strings.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { spawn } = require('node:child_process');
const project = process.env.OUTCLASS_ADMIN_LOCAL_PROJECT || 'outclass-corkboard-e2e';
const ports = { 'outclass-corkboard-e2e': ['56321', '56322'], 'outclass-admin-session-e2e': ['60321', '60322'] }[project];
if (!ports) throw Error('Dedicated disposable fixture required.');
const root = path.join(os.tmpdir(), project);
const filename = path.join(root, 'config.json'), c = JSON.parse(fs.readFileSync(filename));
if(c.projectId !== project) throw Error('Disposable fixture required.');
for(const [value,port] of [[c.status.DB_URL,ports[1]],[c.status.API_URL,ports[0]]]) { const u=new URL(value); if(!['localhost','127.0.0.1'].includes(u.hostname)||u.port!==port)throw Error('Dedicated local services required.'); }
const s=c.status, cert=path.join(os.tmpdir(),'outclass-onboarding-e2e','mailpit-cert.pem');
if(!fs.existsSync(cert)) throw Error('Disposable SMTP verification certificate required.');
const env={...process.env,CRON_SECRET:'local-scheduling-fixture',COMMUNICATIONS_EMAIL_ENABLED:'false',RESEND_API_KEY:'',DATABASE_URL:s.DB_URL,POSTGRES_PRISMA_URL:s.DB_URL,POSTGRES_URL:s.DB_URL,POSTGRES_URL_NON_POOLING:s.DB_URL,NEXT_PUBLIC_SUPABASE_URL:s.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:s.PUBLISHABLE_KEY,NEXT_PUBLIC_SUPABASE_ANON_KEY:s.ANON_KEY,SUPABASE_SECRET_KEY:s.SECRET_KEY,SUPABASE_SERVICE_ROLE_KEY:s.SERVICE_ROLE_KEY,OUTCLASS_PLATFORM_ADMIN_IDS:c.identities.admin.id,OUTCLASS_SITE_URL:'http://127.0.0.1:3109',OUTCLASS_PUBLISH_BUILD:'1',SMTP_HOST:'localhost',SMTP_PORT:'55325',SMTP_USER:'local-test',SMTP_PASSWORD:'local-test',SMTP_FROM_EMAIL:'outclass@virginia.edu',NODE_EXTRA_CA_CERTS:cert};
const mode=process.argv[2]||'validate';
let binary='npm', args=['run',mode];
if(mode==='migrate'){binary=process.execPath;args=['node_modules/prisma/build/index.js','migrate','deploy'];}
if(mode==='start'){binary=process.execPath;args=['node_modules/next/dist/bin/next','start','-p','3109','-H','127.0.0.1'];}
if(mode==='integration'){binary=process.execPath;args=['--test','tests/admin-workspace-e2e.test.cjs'];env.OUTCLASS_ADMIN_E2E_CONFIG=filename;}
if(mode==='audience-integration'){binary=process.execPath;args=['--test','tests/recipient-audiences-e2e.test.cjs'];env.OUTCLASS_AUDIENCE_E2E_CONFIG=filename;}
if(mode==='scheduling-integration'){binary=process.execPath;args=['--test','tests/communication-schedules-e2e.test.cjs'];env.OUTCLASS_SCHEDULING_E2E_CONFIG=filename;}
if(mode==='session-integration'){binary=process.execPath;args=['--test','tests/admin-session-e2e.test.cjs'];env.OUTCLASS_ADMIN_SESSION_E2E_CONFIG=filename;}
const child=spawn(binary,args,{env,stdio:'inherit'});child.on('exit',code=>{process.exitCode=code;});process.on('SIGTERM',()=>child.kill('SIGTERM'));
