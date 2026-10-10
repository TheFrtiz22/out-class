// Disposable local validation only. Never reads application .env or production credentials.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const {PrismaClient}=require('@prisma/client');
const {totp,confirmationMessage,readConfig}=require('../tests/helpers/onboarding-e2e.cjs');
const repo=path.resolve(__dirname,'..'),root=path.join(os.tmpdir(),'outclass-onboarding-e2e');
const keep=process.argv.includes('--keep');let app,stackTouched=false;
fs.mkdirSync(path.join(root,'supabase/templates'),{recursive:true});
// Invoke package CLIs through Node: Windows .cmd shims cannot be launched by
// spawnSync without a shell. Keep arguments separate and never enable shell mode.
function invocation(binary,args){
 if(binary==='supabase')return [process.execPath,[path.join(repo,'node_modules/supabase/dist/supabase.js'),...args]];
 if(binary==='npm'&&process.platform==='win32'){
  const cli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  if(!fs.existsSync(cli))throw Error('npm CLI unavailable beside Node; install the supported Node distribution.');
  return [process.execPath,[cli,...args]];
 }
 if(binary==='openssl'&&process.platform==='win32'){
  const bundled=path.join(process.env.ProgramFiles||'C:\\Program Files','Git/usr/bin/openssl.exe');
  if(fs.existsSync(bundled))return [bundled,args];
 }
 return [binary,args];
}
function command(binary,args,env=process.env){
 const [executable,argv]=invocation(binary,args);
 const result=spawnSync(executable,argv,{cwd:repo,env,encoding:'utf8'});
 if(result.status!==0)throw Error(`${binary} failed (${result.error?.code||result.status}); inspect the isolated test logs.`);
 return result.stdout;
}
function logged(binary,args,log,env=process.env){
 const [executable,argv]=invocation(binary,args);
 const fd=fs.openSync(path.join(root,log),'w');const result=spawnSync(executable,argv,{cwd:repo,env,stdio:['ignore',fd,fd]});fs.closeSync(fd);
 if(result.status!==0)throw Error(`${binary} failed; inspect ${path.join(root,log)}`);
}
async function ready(url,headers={}){
 for(let n=0;n<100;n++){try{const response=await fetch(url,{headers,signal:AbortSignal.timeout(1000)});if(response.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
 throw Error('Dedicated local service did not become ready');
}
(async()=>{
 // Diagnose prerequisites before touching even the disposable stack.
 command('supabase',['--version']);command('npm',['--version']);command('openssl',['version']);
 if(command('docker',['info','--format','{{.OSType}}']).trim()!=='linux')throw Error('The isolated Supabase test requires a Linux-container Docker engine.');
 if(process.argv.includes('--check-prerequisites')){console.log('Node package CLIs, OpenSSL and Docker engine are available.');return;}
 console.log('Provisioning reserved disposable Supabase project outclass-onboarding-e2e on ports 55321–55327.');
 let config=fs.readFileSync(path.join(repo,'supabase/config.toml'),'utf8').replace('project_id = "out-class"','project_id = "outclass-onboarding-e2e"');
 for(const [from,to] of [['54321','55321'],['54322','55322'],['54323','55323'],['54324','55324'],['54325','55325'],['54327','55327'],['54320','55320'],['54329','55329'],['http://127.0.0.1:3000','http://127.0.0.1:3107'],['https://127.0.0.1:3000','http://127.0.0.1:3107']])config=config.replaceAll(from,to);
 config=config.replace('# smtp_port = 55325','smtp_port = 55325');
 const start=config.indexOf('[auth.email]'),end=config.indexOf('[auth.sms]',start);config=config.slice(0,start)+config.slice(start,end).replace('enable_confirmations = false','enable_confirmations = true')+config.slice(end);
 const mfaStart=config.indexOf('[auth.mfa.totp]'),mfaEnd=config.indexOf('[auth.mfa.phone]',mfaStart);config=config.slice(0,mfaStart)+config.slice(mfaStart,mfaEnd).replace('enroll_enabled = false','enroll_enabled = true').replace('verify_enabled = false','verify_enabled = true')+config.slice(mfaEnd);
 if(!/^project_id = "outclass-onboarding-e2e"$/m.test(config))throw Error('Refusing to operate on a non-test Supabase project');
 config+='\n[auth.email.template.recovery]\nsubject = \"Reset your OutClass password\"\ncontent_path = \"./supabase/templates/recovery.html\"\n';
 fs.writeFileSync(path.join(root,'supabase/templates/recovery.html'),'<h2>Reset your password</h2><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}">Reset password</a>');
 fs.writeFileSync(path.join(root,'supabase/config.toml'),config);
 for(const name of ['confirmation.html','magic-link.html']) fs.copyFileSync(path.join(repo,'supabase/templates',name),path.join(root,'supabase/templates',name));
 // Stop only this explicitly disposable project; the normal out-class stack is untouched.
 stackTouched=true;
 logged('supabase',['stop','--workdir',root],'supabase-stop.log');
 logged('supabase',['start','--workdir',root,'-x','studio,edge-runtime,analytics,vector,imgproxy'],'supabase-start.log');
 const status=JSON.parse(command('supabase',['status','--workdir',root,'-o','json']));
 const settings={projectId:'outclass-onboarding-e2e',appUrl:'http://127.0.0.1:3107',status,buildDir:path.join(repo,'.next-publish')};
 const configFile=path.join(root,'config.json');fs.writeFileSync(configFile,JSON.stringify(settings),{mode:0o600});readConfig(configFile);
 const env={...process.env,NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH:'false',DATABASE_URL:status.DB_URL,POSTGRES_PRISMA_URL:status.DB_URL,POSTGRES_URL:status.DB_URL,POSTGRES_URL_NON_POOLING:status.DB_URL,NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:status.PUBLISHABLE_KEY,NEXT_PUBLIC_SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SECRET_KEY:status.SECRET_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,OUTCLASS_PUBLISH_BUILD:'1',OUTCLASS_SITE_URL:settings.appUrl,SMTP_HOST:'localhost',SMTP_PORT:'55325',SMTP_USER:'local-test',SMTP_PASSWORD:'local-test',SMTP_FROM_EMAIL:'outclass@virginia.edu',CRON_SECRET:randomUUID(),NODE_EXTRA_CA_CERTS:path.join(root,'mailpit-cert.pem')};
 logged('npm',['run','db:deploy'],'migrate.log',env);
 console.log('All Prisma migrations applied through the authoritative deployment command.');
 // Test-only trusted TLS for the same Mailpit provider used by local Supabase Auth.
 fs.writeFileSync(path.join(root,'certificate.conf'),'[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost,DNS:supabase_inbucket_outclass-onboarding-e2e,IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\nextendedKeyUsage=serverAuth\n');
 logged('openssl',['req','-x509','-nodes','-days','2','-newkey','rsa:2048','-keyout',path.join(root,'mailpit-key.pem'),'-out',path.join(root,'mailpit-cert.pem'),'-config',path.join(root,'certificate.conf')],'certificate.log');
 const mailContainer='supabase_inbucket_outclass-onboarding-e2e',authContainer='supabase_auth_outclass-onboarding-e2e';
 const image=command('docker',['inspect',mailContainer,'--format','{{.Config.Image}}']).trim();assertImage(image);
 command('docker',['stop',mailContainer]);command('docker',['rm',mailContainer]);
 command('docker',['run','-d','--name',mailContainer,'--network','supabase_network_outclass-onboarding-e2e','-p','127.0.0.1:55324:8025','-p','127.0.0.1:55325:1025','-v',`${path.join(root,'mailpit-cert.pem')}:/tmp/mailpit-cert.pem:ro`,'-v',`${path.join(root,'mailpit-key.pem')}:/tmp/mailpit-key.pem:ro`,'--label','com.supabase.cli.project=outclass-onboarding-e2e',image,'--smtp-tls-cert','/tmp/mailpit-cert.pem','--smtp-tls-key','/tmp/mailpit-key.pem','--smtp-auth-accept-any','--smtp-auth-allow-insecure']);
 command('docker',['cp',path.join(root,'mailpit-cert.pem'),`${authContainer}:/usr/local/share/ca-certificates/outclass-e2e.crt`]);
 logged('docker',['exec','-u','root',authContainer,'update-ca-certificates'],'auth-ca.log');command('docker',['restart',authContainer]);
 await ready(status.API_URL+'/auth/v1/settings',{apikey:status.PUBLISHABLE_KEY});
 const auth=createClient(status.API_URL,status.PUBLISHABLE_KEY,{auth:{persistSession:false}});
 const email=`admin${randomUUID().replaceAll('-','').slice(0,8)}@virginia.edu`,password='Local-admin-only!'+randomUUID();
 const signup=await auth.auth.signUp({email,password});if(signup.error)throw signup.error;
 const message=await confirmationMessage(settings,email),code=message.Text.match(/\b(\d{6})\b/)?.[1];if(!code)throw Error('Signup confirmation OTP missing');
 const verification=await auth.auth.verifyOtp({email,token:code,type:'email'});if(verification.error)throw verification.error;
 const factor=await auth.auth.mfa.enroll({factorType:'totp',friendlyName:'Local E2E admin'});if(factor.error)throw factor.error;
 const challenge=await auth.auth.mfa.challengeAndVerify({factorId:factor.data.id,code:totp(factor.data.totp.secret)});if(challenge.error)throw challenge.error;
 const db=new PrismaClient({datasourceUrl:status.DB_URL});try{await db.user.create({data:{id:signup.data.user.id,email}});await db.platformAdmin.create({data:{userId:signup.data.user.id}});}finally{await db.$disconnect();}
 settings.admin={id:signup.data.user.id,email,password,factor:factor.data.id,totpSecret:factor.data.totp.secret};
 env.OUTCLASS_PLATFORM_ADMIN_IDS=settings.admin.id;fs.writeFileSync(configFile,JSON.stringify(settings),{mode:0o600});
 console.log('Administrator bootstrapped through normal verified signup and actual TOTP MFA.');
 logged('npm',['run','build'],'build.log',env);
 const appLog=fs.openSync(path.join(root,'server.log'),'w');app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3107','-H','127.0.0.1'],{cwd:repo,env,stdio:['ignore',appLog,appLog]});
 fs.writeFileSync(path.join(root,'server.pid'),String(app.pid));
 await ready(settings.appUrl);
 const result=spawnSync(process.execPath,['--test','tests/onboarding-e2e.test.cjs'],{cwd:repo,env:{...env,OUTCLASS_ONBOARDING_E2E_CONFIG:configFile},stdio:'inherit'});
 if(result.status!==0)throw Error('Complete onboarding E2E failed');
 if(keep){console.log(`Keeping the isolated app for review at ${settings.appUrl}. Local test configuration: ${configFile}`);return;}
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>{
 if(!keep&&stackTouched){if(app)app.kill('SIGTERM');const [binary,args]=invocation('supabase',['stop','--workdir',root]);const result=spawnSync(binary,args,{cwd:repo,encoding:'utf8'});fs.writeFileSync(path.join(root,'cleanup.log'),(result.stdout||'')+(result.stderr||''));}
});
function assertImage(image){if(!/^public\.ecr\.aws\/supabase\/mailpit:/.test(image))throw Error('Unexpected local SMTP image');}
