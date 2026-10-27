const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();function load(file){if(cache.has(file))return cache.get(file);const mod={exports:{}};cache.set(file,mod.exports);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/')?n.startsWith('@/actions/')?{}:load(n.slice(2)+'.ts'):require(n),mod,mod.exports);cache.set(file,mod.exports);return mod.exports;}return load;}
const id='00000000-0000-4000-8000-000000000001';
test('voting GET allowlist validates scope, uses private no-store responses and denies Demo; invitation proof and provider errors stay distinct',async()=>{
 let demo=false,calls=0,failure,expectedSession=id;let api;
 const mocks={'next/headers':{cookies:async()=>({get:()=>demo?{value:'1'}:undefined})},'@/actions/voting':{getVotingWorkspace:async(club,session)=>{calls++;assert.equal(club,id);assert.equal(session,expectedSession);return{session:{id}}},getVotingJoinInfo:async()=>({status:'JOINABLE'})},'@/actions/club-onboarding':{getOrganizationInvitations:async()=>{throw failure}}};
 const load=loader(mocks);api=load('utils/verified-email-policy.ts');const {GET}=load('app/api/workspace/route.ts');
 const request=(kind,args)=>GET(new Request(`https://outclass.test/api/workspace?${new URLSearchParams({kind,args:JSON.stringify(args)})}`));
 let response=await request('voting',[id,id]);assert.equal(response.status,200);assert.equal(calls,1);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.match(response.headers.get('Vary'),/(?:^|,\s*)Cookie(?:,|$)/);assert.match(response.headers.get('Vary'),/(?:^|,\s*)Accept-Encoding(?:,|$)/);
 expectedSession=undefined;response=await request('voting',[id,null]);assert.equal(response.status,200);response=await request('voting',[id]);assert.equal(response.status,200);
 response=await request('voting',['wrong',id]);assert.equal(response.status,400);assert.equal(calls,3);
 demo=true;response=await request('voting',[id,id]);assert.equal(response.status,403);assert.equal(calls,3);demo=false;
 for(const [code,status] of [['UNIVERSITY_VERIFICATION_REQUIRED',403],['UNIVERSITY_VERIFICATION_UNAVAILABLE',503]]){failure=new api.UniversityVerificationError(code);response=await request('invitations',[true]);assert.equal(response.status,status);assert.deepEqual(await response.json(),{error:code});}
 failure=Error('secret-bearing internal error');response=await request('invitations',[true]);assert.equal(response.status,403);assert.ok(!(await response.text()).includes('secret-bearing'));
});
test('workspace reads carry no client identity, bound slow reads, and expose only allowlisted invitation recovery messages',async t=>{
 const previous=global.fetch;t.after(()=>global.fetch=previous);const {readWorkspace}=loader()('lib/workspace-read.ts');
 for(const [code,message] of [['UNIVERSITY_VERIFICATION_REQUIRED',/Verify your university email/],['UNIVERSITY_VERIFICATION_UNAVAILABLE',/temporarily unavailable/],['internal secret',/Your access changed/]]){
 global.fetch=async(url,options)=>{assert.match(url,/^\/api\/workspace\?/);assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');assert.ok(options.signal);return{ok:false,status:403,json:async()=>({error:code})}};
 await assert.rejects(readWorkspace('invitations',[true]),message);
 }
});
