// Launch against the explicitly reserved LOCAL synthetic fixture, never application .env values.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), {spawn} = require('node:child_process')
const {readConfig} = require('../tests/helpers/onboarding-e2e.cjs')
const c = readConfig(path.join(os.tmpdir(),'outclass-dashboards-e2e/config.json')), s = c.status
if(c.suite !== 'dashboards') throw Error('Reserved dashboard fixture required')
const env = {...process.env, DATABASE_URL:s.DB_URL,POSTGRES_PRISMA_URL:s.DB_URL,POSTGRES_URL:s.DB_URL,POSTGRES_URL_NON_POOLING:s.DB_URL,NEXT_PUBLIC_SUPABASE_URL:s.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:s.PUBLISHABLE_KEY,NEXT_PUBLIC_SUPABASE_ANON_KEY:s.ANON_KEY,SUPABASE_SECRET_KEY:s.SECRET_KEY,SUPABASE_SERVICE_ROLE_KEY:s.SERVICE_ROLE_KEY,OUTCLASS_PLATFORM_ADMIN_IDS:c.admin.id,OUTCLASS_SITE_URL:c.appUrl,OUTCLASS_PUBLISH_BUILD:'',NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH:'false',COMMUNICATIONS_EMAIL_ENABLED:'true',SMTP_HOST:'127.0.0.1',SMTP_PORT:'59325',SMTP_USER:'local-test',SMTP_PASSWORD:'local-test',SMTP_FROM_EMAIL:'outclass@virginia.edu',NODE_EXTRA_CA_CERTS:path.join(os.tmpdir(),'outclass-dashboards-e2e/mailpit-cert.pem')}
const mode=process.argv[2]||'start', port=process.argv[3]||'3115'
if(!['3115','3116'].includes(port))throw Error('Only reserved visual fixture app ports are allowed')
const args=mode==='build'?['node_modules/next/dist/bin/next','build']:['node_modules/next/dist/bin/next',mode,'-p',port,'-H','127.0.0.1']
const child=mode==='build'?spawn('pnpm',['--config.verify-deps-before-run=false','build'],{env,stdio:'inherit'}):spawn(process.execPath,args,{env,stdio:'inherit'});child.on('exit',code=>process.exitCode=code);process.on('SIGTERM',()=>child.kill('SIGTERM'));process.on('SIGINT',()=>child.kill('SIGINT'))
