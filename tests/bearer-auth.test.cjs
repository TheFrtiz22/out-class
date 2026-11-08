const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {tokenFor}=require('./helpers/auth-session.cjs');
function loader(mocks={}){const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports);return mod.exports;}return load;}

const id='00000000-0000-4000-8000-000000000001',sid='00000000-0000-4000-8000-000000000099';
const authUser={id,email:'mobile@virginia.edu',email_confirmed_at:'2026-01-01'};
const request=header=>new Request('https://out-class.net/api/v1/me',{headers:header===undefined?{}:{authorization:header}});

function harness(){
 const state={identity:{data:{user:authUser},error:null},live:true,existing:{...authUser,disabledAt:null},events:[]};
 const api=loader({
  '@supabase/supabase-js':{createClient:()=>({auth:{getUser:async token=>{state.events.push(['verify',token]);return state.identity;}}})},
  './prisma':{prisma:{
   $queryRaw:async(strings,...params)=>{state.events.push('session');assert.match(strings.join(''),/FROM auth.sessions/);assert.match(strings.join(''),/not_after>clock_timestamp\(\)/);assert.deepEqual(params,[sid,id]);return[{live:state.live}];},
   user:{findUnique:async()=>state.existing,upsert:async({create})=>{state.events.push('upsert');return{...create,disabledAt:null};}},
  }},
 })('utils/bearer-auth.ts');
 return {state,api};
}

test('bearer header parsing accepts only a single well-formed JWT',()=>{
 const {api}=harness();
 assert.equal(api.bearerToken(`Bearer ${tokenFor(id)}`),tokenFor(id));
 for(const h of [null,undefined,'',tokenFor(id),`Basic ${tokenFor(id)}`,`Bearer  ${tokenFor(id)}`,`Bearer ${tokenFor(id)} extra`,'Bearer a.b','Bearer a.b.c.d','Bearer a.b.c;drop'])assert.equal(api.bearerToken(h),null);
});

test('a verified token with a live session resolves the account',async()=>{
 const {state,api}=harness();
 const result=await api.requireBearerAuth(request(`Bearer ${tokenFor(id)}`));
 assert.equal(result.user.id,id);
 assert.deepEqual(state.events,[['verify',tokenFor(id)],'session']);
});

test('missing tokens, provider failures, non-UVA or unconfirmed email and foreign session claims fail closed before the session query',async()=>{
 for(const variant of ['missing','provider','non-uva','unconfirmed','foreign-subject','bad-session-id']){
  const {state,api}=harness();
  let header=`Bearer ${tokenFor(id)}`;
  if(variant==='missing')header=undefined;
  if(variant==='provider')state.identity={data:{user:null},error:Error('invalid JWT')};
  if(variant==='non-uva')state.identity={data:{user:{...authUser,email:'x@virginia.edu.evil.com'}},error:null};
  if(variant==='unconfirmed')state.identity={data:{user:{...authUser,email_confirmed_at:null}},error:null};
  if(variant==='foreign-subject')header=`Bearer ${tokenFor('someone-else')}`;
  if(variant==='bad-session-id')header=`Bearer ${tokenFor(id,'not-a-uuid')}`;
  await assert.rejects(api.requireBearerAuth(request(header)),e=>e.name==='BearerAuthError'&&e.status===401,variant);
  assert.ok(!state.events.includes('session'),variant);
 }
});

test('signed-out or expired sessions are rejected even when the JWT still verifies',async()=>{
 const {state,api}=harness();state.live=false;
 await assert.rejects(api.requireBearerAuth(request(`Bearer ${tokenFor(id)}`)),e=>e.status===401);
});

test('disabled accounts are refused; a missing account row is created as a student, as on the web',async()=>{
 const disabled=harness();disabled.state.existing={...authUser,disabledAt:new Date()};
 await assert.rejects(disabled.api.requireBearerAuth(request(`Bearer ${tokenFor(id)}`)),e=>e.status===403);
 const fresh=harness();fresh.state.existing=null;
 const result=await fresh.api.requireBearerAuth(request(`Bearer ${tokenFor(id)}`));
 assert.equal(result.user.role,'STUDENT');assert.ok(fresh.state.events.includes('upsert'));
});

test('the bearer path never reads cookies, demo mode or platform view-as',()=>{
 const source=fs.readFileSync('utils/bearer-auth.ts','utf8');
 for(const forbidden of ['next/headers','cookies(','DEMO_COOKIE','PLATFORM_VIEW_COOKIE','platformViewSession'])assert.ok(!source.includes(forbidden),forbidden);
});
