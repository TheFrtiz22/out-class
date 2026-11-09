const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:name.startsWith('@/')?load(name.slice(2)+'.ts'):name.startsWith('./')?load(path.join(path.dirname(file),name)+'.ts'):require(name),mod,mod.exports);return mod.exports;}return load;}

const bearerUser={id:'u-bearer',email:'app@virginia.edu',disabledAt:null};
function harness(){
 const state={cookieReads:0,cookies:new Set(),bearerCalls:0,bearerError:null,sessionUser:null};
 const mocks={
  'next/headers':{cookies:async()=>{state.cookieReads++;return{has:k=>state.cookies.has(k),get:k=>state.cookies.has(k)?{value:'1'}:undefined};}},
  'next/navigation':{redirect:()=>{throw Error('NEXT_REDIRECT');}},
  'react':{cache:f=>f},
  '@supabase/supabase-js':{createClient:()=>({})},
  '@/lib/server-phase-trace':{serverPhase:(_n,f)=>f()},
  '@/lib/admin-failure':{AdminAccessError:class extends Error{constructor(c,m){super(m);this.code=c;}},providerAuthFailure:()=>false},
  '@/lib/club-suspension':{assertClubOperational:async()=>{state.events?.push('operational');}},
  '@/utils/platform-view-as':{platformViewSession:async()=>({id:'s',actorId:'admin',targetUserId:'victim',reason:'x'})},
  '@/lib/platform-view-as':{PLATFORM_VIEW_COOKIE:'oc_view_as'},
  '@/lib/permissions':{hasPermission:(m,p)=>m.permissions.includes(p),isActiveMembership:m=>m.status==='ACTIVE'},
  '@/lib/demo/access':{DEMO_COOKIE:'oc_demo'},
  '@/lib/auth':{isUvaEmail:e=>/@virginia\.edu$/.test(e)},
  '@/lib/auth-session':{sessionIdFromVerifiedToken:()=>'sid'},
  './supabase/server':{createClient:async()=>({auth:{getSession:async()=>({data:{session:state.sessionUser?{access_token:'t'}:null},error:null}),getUser:async()=>({data:{user:state.sessionUser},error:null})}})},
  './prisma':{prisma:{$queryRaw:async()=>[{live:true}],user:{findUnique:async({where})=>({id:where.id,email:state.sessionUser?.email,disabledAt:null}),upsert:async()=>null},clubMember:{findUnique:async({where})=>state.membership?.(where.userId_clubId)}}},
  '@/utils/bearer-auth':{requireBearerAuth:async()=>{state.bearerCalls++;if(state.bearerError)throw state.bearerError;return{supabaseUser:{id:bearerUser.id,email:bearerUser.email,email_confirmed_at:'2026-01-01'},user:bearerUser};}},
 };
 const load=loader(mocks);
 return {state,auth:load('utils/auth.ts'),ctx:load('utils/bearer-context.ts'),support:load('utils/support-audit.ts')};
}
const req=()=>new Request('https://out-class.net/api/v1/x',{headers:{authorization:'Bearer a.b.c'}});

test('inside the bearer scope requireAuth returns the verified account and never reads cookies',async()=>{
 const {state,auth,ctx}=harness();
 state.cookies.add('oc_view_as');state.cookies.add('oc_demo');
 const result=await ctx.withBearerIdentity(req(),()=>auth.requireAuth());
 assert.equal(result.user.id,'u-bearer');assert.equal(result.impersonation,null);
 assert.equal(state.cookieReads,0);assert.equal(state.bearerCalls,1);
});

test('the token is verified before the action runs; a rejected token never runs it',async()=>{
 const {state,auth,ctx}=harness();state.bearerError=Object.assign(Error('Sign-in required.'),{status:401});
 let ran=false;
 await assert.rejects(ctx.withBearerIdentity(req(),async()=>{ran=true;return auth.requireAuth();}),/Sign-in required/);
 assert.equal(ran,false);
});

test('admin-only options are refused for app tokens, even with an admin cookie session',async()=>{
 const {state,auth,ctx}=harness();state.cookies.add('oc_view_as');
 state.sessionUser={id:'admin',email:'admin@virginia.edu',email_confirmed_at:'x'};
 for(const options of [{allowPlatformView:true},{adminDiagnostics:true}])
  await assert.rejects(ctx.withBearerIdentity(req(),()=>auth.requireAuth(options)),/Admin tools/);
 assert.equal(state.cookieReads,0);
});

test('club permission checks still run against the bearer account',async()=>{
 const {state,auth,ctx}=harness();
 state.membership=k=>k.userId==='u-bearer'&&k.clubId==='c1'?{status:'ACTIVE',permissions:['tasks.view']}:null;
 const ok=await ctx.withBearerIdentity(req(),()=>auth.requireClubPermission('c1',['tasks.view']));
 assert.equal(ok.user.id,'u-bearer');
 await assert.rejects(ctx.withBearerIdentity(req(),()=>auth.requireClubPermission('c2',[])),/permission/);
 await assert.rejects(ctx.withBearerIdentity(req(),()=>auth.requireClubPermission('c1',['tasks.manage'])),/permission/);
});

test('outside the scope requireAuth is unchanged: cookies are read and no session redirects',async()=>{
 const {state,auth}=harness();
 await assert.rejects(auth.requireAuth(),/NEXT_REDIRECT/);
 assert.ok(state.cookieReads>0);assert.equal(state.bearerCalls,0);
 state.sessionUser={id:'u-web',email:'web@virginia.edu',email_confirmed_at:'x'};
 assert.equal((await auth.requireAuth()).user.id,'u-web');
});

test('the scope ends with its callback and concurrent scopes do not mix',async()=>{
 const {auth,ctx}=harness();
 const seen=await Promise.all([1,2,3].map(()=>ctx.withBearerIdentity(req(),async()=>{await new Promise(r=>setTimeout(r,5));return ctx.bearerIdentity().user.id;})));
 assert.deepEqual(seen,['u-bearer','u-bearer','u-bearer']);
 assert.equal(ctx.bearerIdentity(),undefined);
 await assert.rejects(auth.requireAuth(),/NEXT_REDIRECT/);
});

test('view-as never applies to a bearer request, even with the cookie present',async()=>{
 const {state,ctx,support}=harness();state.cookies.add('oc_view_as');
 assert.equal(await ctx.withBearerIdentity(req(),()=>support.supportContext()),null);
 assert.equal(state.cookieReads,0);
});

test('only withBearerIdentity can enter the scope',()=>{
 const src=fs.readFileSync('utils/bearer-context.ts','utf8');
 assert.match(src,/const store = new AsyncLocalStorage/);
 assert.ok(!/export\s+(const|let)\s+store/.test(src),'store must not be exported');
 assert.ok(!src.includes('enterWith'),'enterWith could leak identity across requests');
 const run=src.slice(src.indexOf('export async function withBearerIdentity'));
 assert.ok(run.indexOf('requireBearerAuth(request)')<run.indexOf('store.run('),'verify before entering the scope');
});
