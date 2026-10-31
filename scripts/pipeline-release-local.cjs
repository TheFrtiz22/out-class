// Owns only this run's loopback server. Never loads a repository .env.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,spawnSync,execFileSync}=require('node:child_process');
const {readConfig}=require('../tests/helpers/onboarding-e2e.cjs');
const root=path.join(os.tmpdir(),'outclass-onboarding-e2e'),repo=path.resolve(__dirname,'..');
const configFile=path.join(root,'config.json');
function config(){return readConfig(configFile)}
function environment(){const c=config(),s=c.status,db=new URL(s.DB_URL);db.searchParams.set('connection_limit','8');return {...process.env,
  DATABASE_URL:db.href,POSTGRES_PRISMA_URL:db.href,POSTGRES_URL:db.href,POSTGRES_URL_NON_POOLING:db.href,
  NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH:'false',NEXT_PUBLIC_SUPABASE_URL:s.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:s.PUBLISHABLE_KEY,NEXT_PUBLIC_SUPABASE_ANON_KEY:s.ANON_KEY,
  SUPABASE_SECRET_KEY:s.SECRET_KEY,SUPABASE_SERVICE_ROLE_KEY:s.SERVICE_ROLE_KEY,OUTCLASS_PUBLISH_BUILD:'1',OUTCLASS_SITE_URL:c.appUrl,OUTCLASS_PLATFORM_ADMIN_IDS:c.admin.id,
  SMTP_HOST:'127.0.0.1',SMTP_PORT:'55325',SMTP_USER:'local-test',SMTP_PASSWORD:'local-test',SMTP_FROM_EMAIL:'outclass@virginia.edu',COMMUNICATIONS_EMAIL_ENABLED:'true',RESEND_API_KEY:'',RESEND_FROM_EMAIL:'',
  NODE_EXTRA_CA_CERTS:path.join(root,'mailpit-cert.pem'),VERCEL:'',VERCEL_ENV:''}}
const variants={B:path.resolve(repo,'../../pipeline-release-baseline/out-class'),D:repo,C:path.resolve(repo,'../../pipeline-release-held/out-class')};
async function stop(){return require('./pipeline-release-process.cjs').stop({port:3107,pidFile:path.join(root,'server.pid'),allowed:Object.values(variants)});}
async function start(variant){assert.ok(variant in variants);await stop();assert.ok(await require('./pipeline-release-process.cjs').available(3107),'Owned runtime port must be free before startup');const cwd=process.env.OUTCLASS_RELEASE_CI_FROZEN_RUNTIME==='1' ? require('./pipeline-release-ci-runtime.cjs').restore(variant,{root,repo,variants}) : variants[variant],c=config();c.buildDir=path.join(cwd,'.next-publish');fs.writeFileSync(configFile,JSON.stringify(c),{mode:0o600});
  const fd=fs.openSync(path.join(root,'release-server-'+variant+'.log'),'a');const app=spawn(process.execPath,[path.join(cwd,'node_modules/next/dist/bin/next'),'start',cwd,'-p','3107','-H','127.0.0.1'],{cwd,env:environment(),detached:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);app.unref();fs.writeFileSync(path.join(root,'server.pid'),String(app.pid));
  for(let i=0;i<100;i++){try{if((await fetch(c.appUrl,{signal:AbortSignal.timeout(1000)})).ok){require('./pipeline-release-process.cjs').owned(app.pid,[cwd]);return{registeredProcessVerified:true,portVerifiedFreeBeforeStart:true}}}catch{}await new Promise(r=>setTimeout(r,200))}throw Error('Owned server did not become ready')}
module.exports={root,repo,variants,config,environment,stop,start};
if(require.main===module)(async()=>{const [op,variant='D']=process.argv.slice(2);if(op==='start')await start(variant);else if(op==='stop')await stop();else if(op==='build'){
  await stop();
  assert.ok(variant in variants);const fd=fs.openSync(path.join(root,'release-build-'+variant+'.log'),'w');const r=spawnSync('npm',['--prefix',variants[variant],'run','build','--',variants[variant]],{cwd:variants[variant],env:environment(),stdio:['ignore',fd,fd]});fs.closeSync(fd);assert.equal(r.status,0,'Inspect owned build log');
}else throw Error('Unknown owned lifecycle operation')})().catch(e=>{console.error(e.name+': '+e.message);process.exitCode=1});
