// Optional two-step sign-in (OUTCLASS_USER_MFA). Supabase SDKs are mocked: no provider is contacted.
const {test,afterEach,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {NextRequest}=require('next/server');
const {sessionFor}=require('./helpers/auth-session.cjs');

function loader(mocks={}){const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:name.startsWith('@/')?load(['.ts','.tsx'].map(ext=>name.slice(2)+ext).find(f=>fs.existsSync(f))):require(name),mod,mod.exports);return mod.exports;}return load;}
// Unsigned fixture token carrying an aal claim; mocks independently "verify" it.
const tokenWith=(id,aal)=>['fixture',Buffer.from(JSON.stringify({sub:id,session_id:'00000000-0000-4000-8000-000000000099',aal})).toString('base64url'),'sig'].join('.');
const id='00000000-0000-4000-8000-000000000001',target='00000000-0000-4000-8000-000000000002';
const enrolled={id,email:'two@virginia.edu',email_confirmed_at:'2026-01-01',factors:[{id:'f1',status:'verified',factor_type:'totp'}]};
const plain={id,email:'two@virginia.edu',email_confirmed_at:'2026-01-01'};
const original=process.env.OUTCLASS_USER_MFA;
after(async()=>{if(database)await (await database).close();});
afterEach(()=>{if(original===undefined)delete process.env.OUTCLASS_USER_MFA;else process.env.OUTCLASS_USER_MFA=original;});

function authHarness({user=enrolled,aal='aal1',action=false,viewAs=false,returnPath=null}={}){
 const state={request:new Map(),calls:[]};
 const api=loader({react:{cache:fn=>{const key=Symbol();return()=>{if(!state.request.has(key))state.request.set(key,fn());return state.request.get(key);};}},
  'next/headers':{headers:async()=>new Headers({...(action?{'next-action':'x'}:{}),...(returnPath?{'x-outclass-return-path':returnPath}:{})}),cookies:async()=>({has:name=>viewAs&&name==='outclass-platform-view',get:()=>undefined})},
  'next/navigation':{redirect:to=>{throw Object.assign(Error('redirect'),{to});}},
  '@/utils/platform-view-as':{platformViewSession:async()=>({targetUserId:target})},
  '@/utils/site-settings':{assertSiteWritable:async()=>{}},
  './supabase/server':{createClient:async()=>({auth:{getSession:async()=>{state.calls.push('session');return{data:{session:{access_token:tokenWith(id,aal)}},error:null};},getUser:async()=>({data:{user},error:null})}})},
  './prisma':{prisma:{$queryRaw:async()=>[{live:true}],user:{findUnique:async({where})=>({id:where.id,email:where.id===id?user.email:'t@virginia.edu',disabledAt:null}),upsert:async()=>{throw Error('unexpected');}}}}})('utils/auth.ts');
 return {state,api};
}

test('pure rule: flag, verified factors and the verified token level decide; paths and return links are safe',()=>{
 const m=loader()('lib/user-mfa.ts');
 assert.equal(m.secondFactorPending(enrolled,tokenWith(id,'aal1'),{}),false,'flag off skips enforcement');
 const on={OUTCLASS_USER_MFA:'1'};
 assert.equal(m.secondFactorPending(enrolled,tokenWith(id,'aal1'),on),true);
 assert.equal(m.secondFactorPending(enrolled,'garbage',on),true,'unreadable token fails closed');
 assert.equal(m.secondFactorPending(enrolled,tokenWith(id,'aal2'),on),false);
 assert.equal(m.secondFactorPending(plain,tokenWith(id,'aal1'),on),false,'no factors: unaffected');
 assert.equal(m.secondFactorPending({factors:[{status:'unverified'}]},tokenWith(id,'aal1'),on),false,'abandoned set-up does not lock out');
 for(const p of ['/auth/two-step','/api/auth/two-step','/api/auth/logout','/api/demo'])assert.ok(m.allowedWhileSecondFactorPending(p));
 for(const p of ['/home','/api/workspace','/settings/account','/platform/login','/api/auth/student-claim'])assert.ok(!m.allowedWhileSecondFactorPending(p));
 assert.equal(m.twoStepChallengeHref('/club/x','?a=1'),'/auth/two-step?next=%2Fclub%2Fx%3Fa%3D1');
 assert.equal(m.twoStepChallengeHref('//evil.test'),'/auth/two-step?next=%2F');
});

test('enrolled aal1 session: not signed in, pages go to the challenge, Server Actions and admin entry refused',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 let h=authHarness();
 assert.equal((await h.api.getSessionUser()).data.user,null);
 assert.equal((await h.api.getSessionState()).pendingUser.id,id);
 await assert.rejects(h.api.requireAuth(),e=>e.to==='/auth/two-step?next=%2F');
 h=authHarness({action:true});
 await assert.rejects(h.api.requireAuth(),/authenticator app/);
 await assert.rejects(h.api.requireClubPermission('club',[]),/authenticator app/);
 h=authHarness();
 await assert.rejects(h.api.requireAuth({adminDiagnostics:true}),e=>e.code==='ADMIN_MFA_REQUIRED');
 h=authHarness({aal:'aal2',action:true});
 assert.equal((await h.api.requireAuth()).user.id,id,'verified code: full access');
});

test('non-enrolled users and flag-off deployments are unaffected',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 assert.equal((await authHarness({user:plain,action:true}).api.requireAuth()).user.id,id);
 delete process.env.OUTCLASS_USER_MFA;
 const h=authHarness({action:true});
 assert.equal((await h.api.getSessionUser()).data.user.id,id);
 assert.equal((await h.api.requireAuth()).user.id,id);
});

test('support/impersonation sessions resolve the target without consulting the target factors',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 const h=authHarness({viewAs:true,action:true});
 const result=await h.api.requireAuth();
 assert.equal(result.user.id,target);assert.ok(result.impersonation);
 assert.deepEqual(h.state.calls,[],'the impersonated path does not read the provider session');
});

// The middleware verifies the token locally (getClaims) and never asks Auth for the user; the
// assurance check mirrors Supabase's: level from the token, enrolment from the session's factors.
function middlewareFor({user=enrolled,aal='aal1',claimsError=null,calls=[]}={}){
 const verified=(user.factors??[]).some(f=>f.status==='verified');
 return loader({'@supabase/ssr':{createServerClient:()=>({auth:{
  getUser:async()=>{calls.push('getUser');return{data:{user},error:null};},
  getClaims:async()=>{calls.push('getClaims');return claimsError?{data:null,error:claimsError}:{data:{claims:{sub:id,aal}},error:null};},
  mfa:{getAuthenticatorAssuranceLevel:async()=>{calls.push('aal');return{data:{currentLevel:aal,nextLevel:verified?'aal2':aal},error:null};}}}})}})('utils/supabase/middleware.ts');
}
test('middleware: enrolled aal1 pages redirect, APIs and writes 401, allowed paths and demo-only pass; flag off passes',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 const {createClient}=middlewareFor();
 const page=await createClient(new NextRequest('https://outclass.test/club/x/workspace?tab=1'));
 assert.equal(page.status,307);assert.equal(new URL(page.headers.get('location')).pathname+new URL(page.headers.get('location')).search,'/auth/two-step?next=%2Fclub%2Fx%2Fworkspace%3Ftab%3D1');
 assert.equal((await createClient(new NextRequest('https://outclass.test/api/clubs'))).status,401);
 assert.equal((await createClient(new NextRequest('https://outclass.test/home',{method:'POST'}))).status,401);
 for(const p of ['/auth/two-step','/api/auth/logout'])assert.equal((await createClient(new NextRequest('https://outclass.test'+p))).status,200);
 assert.equal((await middlewareFor({aal:'aal2'}).createClient(new NextRequest('https://outclass.test/home'))).status,200);
 assert.equal((await middlewareFor({user:plain}).createClient(new NextRequest('https://outclass.test/home'))).status,200);
 delete process.env.OUTCLASS_USER_MFA;
 assert.equal((await createClient(new NextRequest('https://outclass.test/home'))).status,200);
});

test('middleware: no remote Auth user lookup on ordinary requests; a failed local check passes through to server auth',async()=>{
 delete process.env.OUTCLASS_USER_MFA;
 const calls=[];
 assert.equal((await middlewareFor({calls}).createClient(new NextRequest('https://outclass.test/home'))).status,200);
 assert.deepEqual(calls,['getClaims']);
 process.env.OUTCLASS_USER_MFA='1';
 const aal2=[];
 assert.equal((await middlewareFor({aal:'aal2',calls:aal2}).createClient(new NextRequest('https://outclass.test/home'))).status,200);
 assert.deepEqual(aal2,['getClaims'],'a verified aal2 token needs no factor lookup');
 const failed=[];
 const res=await middlewareFor({claimsError:Object.assign(Error('jwks unavailable'),{status:0}),calls:failed}).createClient(new NextRequest('https://outclass.test/club/x/workspace'));
 assert.equal(res.status,200,'middleware grants nothing; server loaders verify the session');
 assert.deepEqual(failed,['getClaims']);
});

// Attempt rows go to an isolated PGlite database built from the full migration chain, so the
// append-only AuditLog trigger and the real counting SQL run exactly as in production.
let database;
const auditDb=()=>database??=(async()=>{const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;');
 for(const name of fs.readdirSync('prisma/migrations').sort()){const file=`prisma/migrations/${name}/migration.sql`;if(fs.existsSync(file))await db.exec(fs.readFileSync(file,'utf8'));}
 return db;})();
// Test-only bypass of row triggers: clears or ages rows to simulate a fresh account or elapsed time.
async function asReplica(sql){const db=await auditDb();await db.exec(`SET session_replication_role = replica;${sql};RESET session_replication_role;`);}
const resetAudit=()=>asReplica('DELETE FROM "AuditLog"');
const ageAudit=minutes=>asReplica(`UPDATE "AuditLog" SET "createdAt"="createdAt"-interval '${minutes} minutes'`);
const auditRows=async()=>(await (await auditDb()).query('SELECT action,details FROM "AuditLog" ORDER BY "createdAt",action')).rows;
// Prisma-shaped adapter over one PGlite connection: tagged-template $queryRaw becomes a parameterized
// query; create/update issue the INSERT/UPDATE Prisma would (createdAt set client-side in UTC).
function prismaOver(q,log){
 return {
  $queryRaw:async(strings,...values)=>{const sql=strings.reduce((out,part,i)=>out+'$'+i+part);log?.push(sql.replace(/\s+/g,' ').trim());return (await q.query(sql,values)).rows;},
  auditLog:{
   create:async({data})=>(await q.query(`INSERT INTO "AuditLog"(id,"actorId",action,"targetId",details,"createdAt")VALUES($1,$2,$3,$4,$5::jsonb,$6)RETURNING *`,[require('node:crypto').randomUUID(),data.actorId,data.action,data.targetId,JSON.stringify(data.details??null),new Date().toISOString()])).rows[0],
   update:async({where,data})=>(await q.query(`UPDATE "AuditLog" SET details=$2::jsonb WHERE id=$1 RETURNING *`,[where.id,JSON.stringify(data.details)])).rows[0]}};
}
function routeHarness({pending=false,user=enrolled,cookies={},verifyOk=true,aal='aal2',factors=enrolled.factors,passwordOk=true,amr=[{method:'password',timestamp:Math.floor(Date.now()/1000)}],mailFails=false,successWriteFails=false,verifyDelay=0}={}){
 const calls=[],transactions=[];
 const mfa={listFactors:async()=>({data:{totp:factors.filter(f=>f.status==='verified'),all:factors},error:null}),
  enroll:async()=>{calls.push('enroll');return{data:{id:'new',totp:{qr_code:'data:image/svg+xml;utf-8,<svg/>',secret:'SECRET'}},error:null};},
  unenroll:async({factorId})=>{calls.push(['unenroll',factorId]);return{error:null};},
  challengeAndVerify:async({code})=>{calls.push(['verify',code]);if(verifyDelay)await new Promise(r=>setTimeout(r,verifyDelay));return verifyOk?{data:{},error:null}:{data:null,error:Object.assign(Error('bad'),{status:422,code:'mfa_verification_failed'})};},
  getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal},error:null})};
 const route=loader({'next/headers':{cookies:async()=>({has:n=>n in cookies,get:n=>n in cookies?{value:cookies[n]}:undefined})},
  '@/utils/auth':{getSessionState:async()=>pending?{identity:{data:{user:null},error:null},secondFactorPending:true,pendingUser:user}:{identity:{data:{user},error:null},secondFactorPending:false}},
  '@/utils/supabase/server':{createClient:async()=>({auth:{mfa,getClaims:async()=>({data:{claims:{amr}},error:null})}})},
  '@/utils/admin-elevation':{freshAuthClient:()=>({auth:{signInWithPassword:async({email,password})=>{calls.push(['password',email]);return passwordOk?{data:{session:{access_token:'t'},user:{id:user.id}},error:null}:{data:{session:null,user:null},error:Object.assign(Error('Invalid login credentials'),{status:400,code:'invalid_credentials'})};},signOut:async()=>({error:null})}})},
  '@/utils/email':{sendTwoStepNoticeEmail:async input=>{calls.push(['notice',input.recipient,input.enabled]);if(mailFails)throw Error('smtp down');return{messageId:'m'};}},
  '@/utils/prisma':{prisma:{
   $transaction:async fn=>(await auditDb()).transaction(async tx=>{const log=[];transactions.push(log);return fn(prismaOver(tx,log));}),
   auditLog:{create:async args=>{calls.push(['audit',args.data.action]);if(successWriteFails&&args.data.action==='user.two_step.success')throw Error('db down');return prismaOver(await auditDb()).auditLog.create(args);},
    update:async args=>prismaOver(await auditDb()).auditLog.update(args),upsert:async()=>{throw Error('unexpected');},delete:async()=>{throw Error('unexpected');}}}}})('app/api/auth/two-step/route.ts');
 const post=body=>route.POST(new NextRequest('https://outclass.test/api/auth/two-step',{method:'POST',headers:{origin:'https://outclass.test',host:'outclass.test','content-type':'application/json'},body:JSON.stringify(body)}));
 return {post,calls,transactions};
}
test('route: flag off is 404; impersonation and demo refused; pending session may only answer the challenge',async()=>{
 await resetAudit();
 delete process.env.OUTCLASS_USER_MFA;
 assert.equal((await routeHarness().post({action:'enroll'})).status,404);
 process.env.OUTCLASS_USER_MFA='1';
 assert.equal((await routeHarness({cookies:{'outclass-platform-view':'x'}}).post({action:'challenge',code:'123456'})).status,403);
 assert.equal((await routeHarness({cookies:{'outclass-demo-session':'1'}}).post({action:'enroll'})).status,403);
 for(const body of [{action:'enroll'},{action:'disable',code:'123456'},{action:'confirm',factorId:'f1',code:'123456'}])
  assert.equal((await routeHarness({pending:true}).post(body)).status,401);
 const h=routeHarness({pending:true});
 assert.equal((await h.post({action:'challenge',code:'123456'})).status,200);
 assert.deepEqual(h.calls,[['verify','123456'],['audit','user.two_step.success']]);
 assert.equal((await routeHarness({pending:true,verifyOk:false}).post({action:'challenge',code:'000000'})).status,400);
});
test('route: enrollment returns the provider QR and secret, then a verified code turns it on',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 await resetAudit();
 let h=routeHarness({user:plain,factors:[{id:'stale',status:'unverified',factor_type:'totp'}]});
 const res=await h.post({action:'enroll'});assert.equal(res.status,200,'university sign-in account with a recent sign-in');
 const body=await res.json();assert.equal(body.secret,'SECRET');assert.match(body.qr,/^data:image\/svg/);
 assert.deepEqual(h.calls,[['unenroll','stale'],'enroll']);
 h=routeHarness({user:plain,factors:[{id:'new',status:'unverified',factor_type:'totp'}]});
 assert.equal((await h.post({action:'confirm',factorId:'new',code:'123456'})).status,200);
 assert.deepEqual(h.calls,[['verify','123456'],['audit','user.two_step.success'],['audit','account.two-step.enable'],['notice',plain.email,true],['audit','account.two-step.email']]);
 assert.equal((await routeHarness().post({action:'enroll'})).status,409,'already on');
});
test('route: turning off needs a fresh valid code and an aal2 session; admins keep their authenticator',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 await resetAudit();
 let h=routeHarness({verifyOk:false});
 assert.equal((await h.post({action:'disable',code:'000000'})).status,400);
 assert.ok(!h.calls.some(c=>c[0]==='unenroll'));
 h=routeHarness({aal:'aal1'});
 assert.equal((await h.post({action:'disable',code:'123456'})).status,403);
 assert.ok(!h.calls.some(c=>c[0]==='unenroll'));
 h=routeHarness();
 assert.equal((await h.post({action:'disable',code:'123456'})).status,200);
 assert.deepEqual(h.calls,[['verify','123456'],['audit','user.two_step.success'],['unenroll','f1'],['audit','account.two-step.disable'],['notice',enrolled.email,false],['audit','account.two-step.email']]);
 const prior=process.env.OUTCLASS_PLATFORM_ADMIN_IDS;process.env.OUTCLASS_PLATFORM_ADMIN_IDS=id;
 try{h=routeHarness();assert.equal((await h.post({action:'disable',code:'123456'})).status,403);assert.deepEqual(h.calls,[]);}
 finally{if(prior===undefined)delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS;else process.env.OUTCLASS_PLATFORM_ADMIN_IDS=prior;}
});

test('settings: the section is hidden when the flag is off and shows state when on',async()=>{
 const page=impersonation=>loader({'@/components/settings/account-settings':{AccountSettings:()=>null},'@/actions/account-deletion':{getAccountDeletionRequest:async()=>null},'@/utils/auth':{requireAuth:async()=>({user:{id,email:enrolled.email},supabaseUser:{...enrolled,app_metadata:{provider:'email'}},impersonation})}})('app/(workspace)/settings/account/page.tsx').default;
 delete process.env.OUTCLASS_USER_MFA;
 assert.equal((await page(null)()).props.twoStep,null);
 process.env.OUTCLASS_USER_MFA='1';
 assert.deepEqual((await page(null)()).props.twoStep,{enabled:true,required:false});
 assert.equal((await page({id:'s'})()).props.twoStep.enabled,false,'support session never shows the target state');
 const source=fs.readFileSync('components/settings/account-settings.tsx','utf8');
 assert.match(source,/\{twoStep && <TwoStepSettings/);
 const settings=fs.readFileSync('components/settings/two-step-settings.tsx','utf8');
 assert.match(settings,/contact OutClass support/);
 assert.match(fs.readFileSync('app/(focus)/platform/login/page.tsx','utf8'),/AuthenticatorQr/,'admin and personal set-up share one QR component');
});

test('route: the sixth wrong code in 15 minutes is refused before the provider is called',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 await resetAudit();
 for(let i=0;i<5;i++){const h=routeHarness({pending:true,verifyOk:false});assert.equal((await h.post({action:'challenge',code:'000000'})).status,400);}
 const h=routeHarness({pending:true});
 const res=await h.post({action:'challenge',code:'123456'});
 assert.equal(res.status,429);assert.match((await res.json()).error,/15 minutes/);
 assert.deepEqual(h.calls,[],'provider not called');
 const off=routeHarness();
 assert.equal((await off.post({action:'disable',code:'123456'})).status,429,'turning off shares the cap');
 assert.deepEqual(off.calls,[]);
 await ageAudit(16);
 assert.equal((await routeHarness({pending:true}).post({action:'challenge',code:'123456'})).status,200,'window expires');
 const source=fs.readFileSync('app/api/auth/two-step/route.ts','utf8');
 assert.ok(source.indexOf('recordAttempt(userId, CODE_ATTEMPT)')<source.lastIndexOf('challengeAndVerify'),'attempt recorded first');
 assert.match(source,/pg_advisory_xact_lock/);
});
test('route: verified codes are appended as success rows on the append-only AuditLog and never count as failures',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 await resetAudit();
 const db=await auditDb();
 for(let i=0;i<8;i++)assert.equal((await routeHarness({pending:true}).post({action:'challenge',code:'123456'})).status,200,'success never throws');
 let rows=await auditRows();
 const attempts=rows.filter(r=>r.action==='user.two_step.attempt'),successes=rows.filter(r=>r.action==='user.two_step.success');
 assert.equal(attempts.length,8);assert.equal(successes.length,8);
 assert.ok(attempts.every(r=>r.details.result==='attempt'),'attempt rows are never rewritten');
 assert.ok(successes.every(r=>r.details.result==='success'&&typeof r.details.attempt==='string'));
 const [first]=(await db.query(`SELECT id FROM "AuditLog" WHERE action='user.two_step.attempt' LIMIT 1`)).rows;
 await assert.rejects(prismaOver(db).auditLog.update({where:{id:first.id},data:{details:{result:'success'}}}),/append-only/,'rewriting an attempt (the previous approach) is rejected by the trigger');
 // Successes mixed with failures: only the unmatched attempts count, so a sixth failure is still refused.
 for(let i=0;i<4;i++)assert.equal((await routeHarness({pending:true,verifyOk:false}).post({action:'challenge',code:'000000'})).status,400);
 assert.equal((await routeHarness({pending:true}).post({action:'challenge',code:'123456'})).status,200,'four failures leave room');
 assert.equal((await routeHarness({pending:true,verifyOk:false}).post({action:'challenge',code:'000000'})).status,400,'fifth failure reaches the provider');
 const h=routeHarness({pending:true});
 assert.equal((await h.post({action:'challenge',code:'123456'})).status,429,'limit enforced after five failures');
 assert.deepEqual(h.calls,[]);
 // A success row naming another account's attempt does not clear it.
 await resetAudit();
 for(let i=0;i<5;i++)await routeHarness({verifyOk:false}).post({action:'disable',code:'000000'});
 const other={...enrolled,id:'00000000-0000-4000-8000-000000000003'};
 for(const r of (await db.query(`SELECT id FROM "AuditLog" WHERE action='user.two_step.attempt'`)).rows)
  await db.query(`INSERT INTO "AuditLog"(id,"actorId",action,"targetId",details)VALUES(gen_random_uuid()::text,$1,'user.two_step.success',$1,$2::jsonb)`,[other.id,JSON.stringify({result:'success',attempt:r.id})]);
 assert.equal((await routeHarness().post({action:'disable',code:'123456'})).status,429);
 assert.equal((await routeHarness({user:other}).post({action:'disable',code:'123456'})).status,200,'limits are per account');
});
test('route: a failed success write still returns the verified result and fails closed on the limit',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 await resetAudit();
 const errors=[],original=console.error;console.error=line=>errors.push(String(line));
 try{
  for(let i=0;i<5;i++)assert.equal((await routeHarness({pending:true,successWriteFails:true}).post({action:'challenge',code:'123456'})).status,200);
 }finally{console.error=original;}
 assert.equal(errors.length,5);assert.ok(errors.every(e=>JSON.parse(e).event==='two-step.audit-failure'));
 assert.equal((await routeHarness({pending:true}).post({action:'challenge',code:'123456'})).status,429,'unconfirmed attempts keep counting');
});
test('route: concurrent wrong codes for one account cannot pass the limit',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 await resetAudit();
 const hs=Array.from({length:9},()=>routeHarness({pending:true,verifyOk:false,verifyDelay:5}));
 const statuses=(await Promise.all(hs.map(h=>h.post({action:'challenge',code:'000000'})))).map(r=>r.status);
 assert.equal(statuses.filter(s=>s===400).length,5);assert.equal(statuses.filter(s=>s===429).length,4);
 assert.equal(hs.reduce((n,h)=>n+h.calls.filter(c=>c[0]==='verify').length,0),5,'the provider saw at most the limit');
 const log=hs.find(h=>h.transactions.length).transactions[0];
 assert.match(log[0],/pg_advisory_xact_lock\(hashtext\(\$1\)\)/,'the per-account lock is taken first');
 assert.match(log[1],/count\(\*\)/,'then counted inside the same transaction');
 assert.equal((await auditRows()).filter(r=>r.action==='user.two_step.attempt').length,5);
});
test('no code path rewrites or removes AuditLog rows',()=>{
 const offenders=[];
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(ts|tsx|js|cjs|mjs)$/.test(e.name)){const src=fs.readFileSync(f,'utf8');if(/auditLog\.(update|updateMany|upsert|delete|deleteMany)\b|(UPDATE|DELETE\s+FROM)\s+(public\.)?"AuditLog"/i.test(src))offenders.push(f);}}};
 for(const dir of ['app','actions','lib','utils','components','scripts'])if(fs.existsSync(dir))walk(dir);
 assert.deepEqual(offenders,[]);
});
test('route: enrolling needs fresh re-authentication (password re-check or a recent university sign-in)',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 await resetAudit();
 const pw={...plain,app_metadata:{provider:'email',providers:['email']}};
 let h=routeHarness({user:pw,factors:[]});
 assert.equal((await h.post({action:'enroll'})).status,403,'password account without a password');
 assert.ok(!h.calls.includes('enroll'));
 h=routeHarness({user:pw,factors:[],passwordOk:false});
 assert.equal((await h.post({action:'enroll',password:'wrong'})).status,403);
 assert.ok(!h.calls.includes('enroll'));
 h=routeHarness({user:pw,factors:[]});
 assert.equal((await h.post({action:'enroll',password:'right'})).status,200);
 assert.deepEqual(h.calls,[['password',pw.email],'enroll']);
 await resetAudit();
 for(let i=0;i<5;i++)await routeHarness({user:pw,factors:[],passwordOk:false}).post({action:'enroll',password:'wrong'});
 h=routeHarness({user:pw,factors:[]});
 assert.equal((await h.post({action:'enroll',password:'right'})).status,429);assert.deepEqual(h.calls,[]);
 const sso={...plain,app_metadata:{provider:'azure',providers:['azure']}};
 h=routeHarness({user:sso,factors:[],amr:[{method:'oauth',timestamp:Math.floor(Date.now()/1000)-3600}]});
 assert.equal((await h.post({action:'enroll'})).status,403,'stale university sign-in');
 assert.ok(!h.calls.includes('enroll'));
 assert.equal((await routeHarness({user:sso,factors:[]}).post({action:'enroll'})).status,200);
 const m=loader()('lib/user-mfa.ts'),now=Date.now();
 assert.equal(m.recentlyAuthenticated([{timestamp:now/1000-60}],now),true);
 assert.equal(m.recentlyAuthenticated([{timestamp:now/1000-11*60}],now),false);
 assert.equal(m.recentlyAuthenticated('password',now),false);
});
test('route: a mail outage after the change is audited, not surfaced',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 await resetAudit();
 const h=routeHarness({mailFails:true});
 assert.equal((await h.post({action:'disable',code:'123456'})).status,200);
 assert.deepEqual(h.calls.slice(-2),[['notice',enrolled.email,false],['audit','account.two-step.email']]);
});
test('server-side challenge redirect keeps the requested path through safeReturnPath',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 const run=value=>authHarness({returnPath:value}).api.requireAuth().catch(e=>e.to);
 assert.equal(await run('/platform/login'),'/auth/two-step?next=%2Fplatform%2Flogin');
 assert.equal(await run('/club/x?tab=1'),'/auth/two-step?next=%2Fclub%2Fx%3Ftab%3D1');
 assert.equal(await run('//evil.test'),'/auth/two-step?next=%2F');
 assert.equal(await run(null),'/auth/two-step?next=%2F');
});
test('middleware forwards the requested path for the server-side redirect (flag on only)',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 const res=await middlewareFor({aal:'aal2'}).createClient(new NextRequest('https://outclass.test/home?x=1',{headers:{'x-outclass-return-path':'/spoof'}}));
 assert.equal(res.headers.get('x-middleware-request-x-outclass-return-path'),'/home?x=1');
 delete process.env.OUTCLASS_USER_MFA;
 const off=await middlewareFor({aal:'aal2'}).createClient(new NextRequest('https://outclass.test/home'));
 assert.equal(off.headers.get('x-middleware-request-x-outclass-return-path'),null);
});
test('challenge page offers to leave Demo Mode instead of failing the code',()=>{
 const page=fs.readFileSync('app/(focus)/auth/two-step/page.tsx','utf8');
 assert.match(page,/demo=\{\(await cookies\(\)\)\.get\(DEMO_COOKIE\)/);
 const ui=fs.readFileSync('components/security/two-step-challenge.tsx','utf8');
 assert.match(ui,/"\/api\/demo"[\s\S]*enabled: false/);
 assert.match(fs.readFileSync('components/settings/two-step-settings.tsx','utf8'),/TurnstileWidget action="two-step"/);
});
