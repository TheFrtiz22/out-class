// Optional two-step sign-in (OUTCLASS_USER_MFA). Supabase SDKs are mocked: no provider is contacted.
const {test,afterEach}=require('node:test');
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
afterEach(()=>{if(original===undefined)delete process.env.OUTCLASS_USER_MFA;else process.env.OUTCLASS_USER_MFA=original;});

function authHarness({user=enrolled,aal='aal1',action=false,viewAs=false}={}){
 const state={request:new Map(),calls:[]};
 const api=loader({react:{cache:fn=>{const key=Symbol();return()=>{if(!state.request.has(key))state.request.set(key,fn());return state.request.get(key);};}},
  'next/headers':{headers:async()=>new Headers(action?{'next-action':'x'}:{}),cookies:async()=>({has:name=>viewAs&&name==='outclass-platform-view',get:()=>undefined})},
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
 for(const p of ['/auth/two-step','/api/auth/two-step','/api/auth/logout'])assert.ok(m.allowedWhileSecondFactorPending(p));
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

function middlewareFor({user=enrolled,aal='aal1'}={}){
 return loader({'@supabase/ssr':{createServerClient:()=>({auth:{getUser:async()=>({data:{user},error:null}),getSession:async()=>({data:{session:{access_token:tokenWith(id,aal)}}})}})}})('utils/supabase/middleware.ts');
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

function routeHarness({pending=false,user=enrolled,cookies={},verifyOk=true,aal='aal2',factors=enrolled.factors}={}){
 const calls=[];
 const mfa={listFactors:async()=>({data:{totp:factors.filter(f=>f.status==='verified'),all:factors},error:null}),
  enroll:async()=>{calls.push('enroll');return{data:{id:'new',totp:{qr_code:'data:image/svg+xml;utf-8,<svg/>',secret:'SECRET'}},error:null};},
  unenroll:async({factorId})=>{calls.push(['unenroll',factorId]);return{error:null};},
  challengeAndVerify:async({code})=>{calls.push(['verify',code]);return verifyOk?{data:{},error:null}:{data:null,error:Object.assign(Error('bad'),{status:422,code:'mfa_verification_failed'})};},
  getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal},error:null})};
 const route=loader({'next/headers':{cookies:async()=>({has:n=>n in cookies,get:n=>n in cookies?{value:cookies[n]}:undefined})},
  '@/utils/auth':{getSessionState:async()=>pending?{identity:{data:{user:null},error:null},secondFactorPending:true,pendingUser:user}:{identity:{data:{user},error:null},secondFactorPending:false}},
  '@/utils/supabase/server':{createClient:async()=>({auth:{mfa}})},
  '@/utils/prisma':{prisma:{auditLog:{create:async({data})=>calls.push(['audit',data.action])}}}})('app/api/auth/two-step/route.ts');
 const post=body=>route.POST(new NextRequest('https://outclass.test/api/auth/two-step',{method:'POST',headers:{origin:'https://outclass.test',host:'outclass.test','content-type':'application/json'},body:JSON.stringify(body)}));
 return {post,calls};
}
test('route: flag off is 404; impersonation and demo refused; pending session may only answer the challenge',async()=>{
 delete process.env.OUTCLASS_USER_MFA;
 assert.equal((await routeHarness().post({action:'enroll'})).status,404);
 process.env.OUTCLASS_USER_MFA='1';
 assert.equal((await routeHarness({cookies:{'outclass-platform-view':'x'}}).post({action:'challenge',code:'123456'})).status,403);
 assert.equal((await routeHarness({cookies:{'outclass-demo-session':'1'}}).post({action:'enroll'})).status,403);
 for(const body of [{action:'enroll'},{action:'disable',code:'123456'},{action:'confirm',factorId:'f1',code:'123456'}])
  assert.equal((await routeHarness({pending:true}).post(body)).status,401);
 const h=routeHarness({pending:true});
 assert.equal((await h.post({action:'challenge',code:'123456'})).status,200);
 assert.deepEqual(h.calls,[['verify','123456']]);
 assert.equal((await routeHarness({pending:true,verifyOk:false}).post({action:'challenge',code:'000000'})).status,400);
});
test('route: enrollment returns the provider QR and secret, then a verified code turns it on',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 let h=routeHarness({user:plain,factors:[{id:'stale',status:'unverified',factor_type:'totp'}]});
 const res=await h.post({action:'enroll'});assert.equal(res.status,200);
 const body=await res.json();assert.equal(body.secret,'SECRET');assert.match(body.qr,/^data:image\/svg/);
 assert.deepEqual(h.calls,[['unenroll','stale'],'enroll']);
 h=routeHarness({user:plain,factors:[{id:'new',status:'unverified',factor_type:'totp'}]});
 assert.equal((await h.post({action:'confirm',factorId:'new',code:'123456'})).status,200);
 assert.deepEqual(h.calls,[['verify','123456'],['audit','account.two-step.enable']]);
 assert.equal((await routeHarness().post({action:'enroll'})).status,409,'already on');
});
test('route: turning off needs a fresh valid code and an aal2 session; admins keep their authenticator',async()=>{
 process.env.OUTCLASS_USER_MFA='1';
 let h=routeHarness({verifyOk:false});
 assert.equal((await h.post({action:'disable',code:'000000'})).status,400);
 assert.ok(!h.calls.some(c=>c[0]==='unenroll'));
 h=routeHarness({aal:'aal1'});
 assert.equal((await h.post({action:'disable',code:'123456'})).status,403);
 assert.ok(!h.calls.some(c=>c[0]==='unenroll'));
 h=routeHarness();
 assert.equal((await h.post({action:'disable',code:'123456'})).status,200);
 assert.deepEqual(h.calls,[['verify','123456'],['unenroll','f1'],['audit','account.two-step.disable']]);
 const prior=process.env.OUTCLASS_PLATFORM_ADMIN_IDS;process.env.OUTCLASS_PLATFORM_ADMIN_IDS=id;
 try{h=routeHarness();assert.equal((await h.post({action:'disable',code:'123456'})).status,403);assert.deepEqual(h.calls,[]);}
 finally{if(prior===undefined)delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS;else process.env.OUTCLASS_PLATFORM_ADMIN_IDS=prior;}
});

test('settings: the section is hidden when the flag is off and shows state when on',async()=>{
 const page=impersonation=>loader({'@/components/settings/account-settings':{AccountSettings:()=>null},'@/utils/auth':{requireAuth:async()=>({user:{id,email:enrolled.email},supabaseUser:{...enrolled,app_metadata:{provider:'email'}},impersonation})}})('app/(workspace)/settings/account/page.tsx').default;
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
