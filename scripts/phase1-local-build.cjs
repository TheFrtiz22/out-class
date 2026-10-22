// Rebuild/restart ONLY the reserved, validated local navigation fixture.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,spawnSync,execFileSync}=require('node:child_process');
const {readConfig}=require('../tests/helpers/onboarding-e2e.cjs');
const root=path.join(os.tmpdir(),'outclass-onboarding-e2e'),repo=path.resolve(__dirname,'..');
const config=readConfig(path.join(root,'config.json')),s=config.status;
assert.equal(config.appUrl,'http://127.0.0.1:3107');assert.equal(config.buildDir,path.join(repo,'.next-publish'));
const pid=Number(fs.readFileSync(path.join(root,'server.pid'),'utf8'));
const listener=execFileSync('lsof',['-tiTCP:3107','-sTCP:LISTEN'],{encoding:'utf8'}).trim();assert.equal(listener,String(pid));
assert.ok(execFileSync('lsof',['-a','-p',String(pid),'-d','cwd','-Fn'],{encoding:'utf8'}).split('\n').includes('n'+repo));
process.kill(pid,'SIGTERM');
const env={...process.env,NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH:'false',DATABASE_URL:s.DB_URL,POSTGRES_PRISMA_URL:s.DB_URL,POSTGRES_URL:s.DB_URL,POSTGRES_URL_NON_POOLING:s.DB_URL,NEXT_PUBLIC_SUPABASE_URL:s.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:s.PUBLISHABLE_KEY,NEXT_PUBLIC_SUPABASE_ANON_KEY:s.ANON_KEY,SUPABASE_SECRET_KEY:s.SECRET_KEY,SUPABASE_SERVICE_ROLE_KEY:s.SERVICE_ROLE_KEY,OUTCLASS_PUBLISH_BUILD:'1',OUTCLASS_SITE_URL:config.appUrl,OUTCLASS_PLATFORM_ADMIN_IDS:config.admin.id,SMTP_HOST:'127.0.0.1',SMTP_PORT:'55325',SMTP_USER:'local-test',SMTP_PASSWORD:'local-test',SMTP_FROM_EMAIL:'outclass@virginia.edu',CRON_SECRET:require('node:crypto').randomUUID(),NODE_EXTRA_CA_CERTS:path.join(root,'mailpit-cert.pem'),COMMUNICATIONS_EMAIL_ENABLED:'true',RESEND_API_KEY:'',RESEND_FROM_EMAIL:''};
const fd=fs.openSync(path.join(root,'phase1-build.log'),'w');
const built=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{cwd:repo,env,stdio:['ignore',fd,fd]});fs.closeSync(fd);
if(built.status!==0)throw Error('Local build failed; inspect reserved phase1-build.log');
const log=fs.openSync(path.join(root,'server.log'),'a');
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3107','-H','127.0.0.1'],{cwd:repo,env,detached:true,stdio:['ignore',log,log]});
fs.closeSync(log);fs.writeFileSync(path.join(root,'server.pid'),String(app.pid));app.unref();
(async()=>{for(let n=0;n<100;n++){try{if((await fetch(config.appUrl)).ok){console.log('Reserved local production build ready.');return}}catch{}await new Promise(r=>setTimeout(r,200))}throw Error('Reserved local app failed to start')})().catch(e=>{console.error(e.message);process.exitCode=1});
