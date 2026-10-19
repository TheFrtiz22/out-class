const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {tokenFor,sessionFor}=require('./helpers/auth-session.cjs');
function loader(mocks={}){const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports);return mod.exports;}return load;}
const id='00000000-0000-4000-8000-000000000001',sid='00000000-0000-4000-8000-000000000099';
const user={id,email:'session@virginia.edu',email_confirmed_at:'2026-01-01'};
function harness(){
 const state={session:sessionFor(id),identity:{data:{user},error:null},live:true,disabled:false,dbError:null,events:[],request:new Map()};
 const api=loader({react:{cache:fn=>{const key=Symbol();return()=>{if(!state.request.has(key))state.request.set(key,fn());return state.request.get(key);};}},'next/headers':{cookies:async()=>({has:()=>false,get:()=>undefined})},'next/navigation':{redirect:()=>{throw Error('Sign-in required');}},'@/utils/platform-view-as':{platformViewSession:async()=>null},'./supabase/server':{createClient:async()=>({auth:{getSession:async()=>{state.events.push('cookie');return state.session;},getUser:async token=>{state.events.push(['verify',token]);return state.identity;}}})},'./prisma':{prisma:{$queryRaw:async(strings,...params)=>{state.events.push('database');assert.match(strings.join(''),/FROM auth.sessions/);assert.match(strings.join(''),/not_after>clock_timestamp\(\)/);assert.deepEqual(params,[sid,id]);if(state.dbError)throw state.dbError;return[{live:state.live}];},user:{findUnique:async()=>({...user,disabledAt:state.disabled?new Date():null})}}}})('utils/auth.ts');
 return {state,api};
}
test('session claim parser rejects missing, malformed, non-UUID and foreign-user claims',()=>{
 const {sessionIdFromVerifiedToken:parse}=loader()('lib/auth-session.ts');
 assert.equal(parse(tokenFor(id),id),sid);
 for(const token of ['invalid','a.bad-json.c',tokenFor('another-user'),tokenFor(id,'not-a-uuid'),tokenFor(id,"';DROP TABLE User;--"),'a.'+Buffer.from('null').toString('base64url')+'.c'])assert.equal(parse(token,id),null);
});
test('only an exactly verified token can reach the live session query; cache stays within its request',async()=>{
 const {state,api}=harness();assert.equal((await api.getSessionUser()).data.user.id,id);await api.getSessionUser();
 assert.deepEqual(state.events,['cookie',['verify',tokenFor(id)],'database']);
 state.live=false;state.request=new Map();assert.equal((await api.getSessionUser()).data.user,null);
 assert.equal(state.events.filter(e=>e==='database').length,2);
});
test('untrusted cookie content, refresh errors and provider verification failures never authorize or query sessions',async()=>{
 for(const variant of ['guest','refresh-error','provider-error','foreign-subject','invalid-session-id']){
  const {state,api}=harness();
  if(variant==='guest')state.session={data:{session:null},error:null};
  if(variant==='refresh-error')state.session={data:{session:null},error:Error('Refresh unavailable')};
  if(variant==='provider-error')state.identity={data:{user:null},error:Error('Verification unavailable')};
  if(variant==='foreign-subject')state.session={data:{session:{access_token:tokenFor('foreign')}},error:null};
  if(variant==='invalid-session-id')state.session={data:{session:{access_token:tokenFor(id,'invalid')}},error:null};
  const result=await api.getSessionUser();assert.equal(result.data.user,null);assert.ok(!state.events.includes('database'));
 }
});
test('missing/expired rows fail closed and database errors remain operational failures',async()=>{
 const {state,api}=harness();state.live=false;await assert.rejects(api.requireAuth(),/Sign-in/);
 state.request=new Map();state.dbError=Error('Session database unavailable');await assert.rejects(api.getSessionUser(),/Session database unavailable/);
});
test('request-cached session checks never cache current disabled-account status',async()=>{
 const {state,api}=harness();assert.equal((await api.requireAuth()).user.id,id);
 state.disabled=true;await assert.rejects(api.requireAuth(),/Sign-in/);
 assert.equal(state.events.filter(e=>e==='database').length,1);
});
