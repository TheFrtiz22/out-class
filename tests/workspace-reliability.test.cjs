const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();function load(file){if(cache.has(file))return cache.get(file);const mod={exports:{}};cache.set(file,mod.exports);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/')?n.startsWith('@/actions/')?{}:load(n.slice(2)+'.ts'):require(n),mod,mod.exports);cache.set(file,mod.exports);return mod.exports;}return load;}
const id='00000000-0000-4000-8000-000000000001';
test('voting GET allowlist validates scope, uses private no-store responses and denies Demo; invitation proof and provider errors stay distinct',async()=>{
 let demo=false,calls=0,failure,expectedSession=id;let api;
 const mocks={'next/headers':{cookies:async()=>({get:()=>demo?{value:'1'}:undefined})},'@/actions/voting':{getVotingWorkspace:async(club,session)=>{calls++;assert.equal(club,id);assert.equal(session,expectedSession);return{session:{id}}}},'@/actions/club-onboarding':{getOrganizationInvitations:async()=>{throw failure}}};
 const load=loader(mocks);api=load('utils/verified-email-policy.ts');const {GET}=load('app/api/workspace/route.ts');
 const request=(kind,args)=>GET(new Request(`https://outclass.test/api/workspace?${new URLSearchParams({kind,args:JSON.stringify(args)})}`));
 let response=await request('voting',[id,id]);assert.equal(response.status,200);assert.equal(calls,1);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.match(response.headers.get('Vary'),/(?:^|,\s*)Cookie(?:,|$)/);assert.match(response.headers.get('Vary'),/(?:^|,\s*)Accept-Encoding(?:,|$)/);
 expectedSession=undefined;response=await request('voting',[id,null]);assert.equal(response.status,200);response=await request('voting',[id]);assert.equal(response.status,200);
 response=await request('voting',['wrong',id]);assert.equal(response.status,400);assert.equal(calls,3);
 demo=true;response=await request('voting',[id,id]);assert.equal(response.status,403);assert.equal(calls,3);demo=false;
 for(const [code,status,body] of [['UNIVERSITY_VERIFICATION_REQUIRED',403,{error:'UNIVERSITY_VERIFICATION_REQUIRED',remedy:null,school:null}],['UNIVERSITY_VERIFICATION_UNAVAILABLE',503,{error:'UNIVERSITY_VERIFICATION_UNAVAILABLE'}]]){failure=new api.UniversityVerificationError(code);response=await request('invitations',[true]);assert.equal(response.status,status);assert.deepEqual(await response.json(),body);}
 failure=new api.UniversityVerificationError('UNIVERSITY_VERIFICATION_REQUIRED',{remedy:'provider',school:'University of Virginia'});response=await request('invitations',[true]);assert.deepEqual(await response.json(),{error:'UNIVERSITY_VERIFICATION_REQUIRED',remedy:'provider',school:'University of Virginia'});
 failure=Error('secret-bearing internal error');response=await request('invitations',[true]);assert.equal(response.status,403);assert.ok(!(await response.text()).includes('secret-bearing'));
});
test('workspace reads carry no client identity, bound slow reads, and expose only allowlisted invitation recovery messages',async t=>{
 const previous=global.fetch;t.after(()=>global.fetch=previous);const {readWorkspace}=loader()('lib/workspace-read.ts');
 for(const [code,message] of [['UNIVERSITY_VERIFICATION_REQUIRED',/confirm your university email/],['UNIVERSITY_VERIFICATION_UNAVAILABLE',/can’t be checked right now/],['internal secret',/Your access changed/]]){
 global.fetch=async(url,options)=>{assert.match(url,/^\/api\/workspace\?/);assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');assert.ok(options.signal);return{ok:false,status:403,json:async()=>({error:code})}};
 await assert.rejects(readWorkspace('invitations',[true]),error=>message.test(error.message)&&!/normal email verification|password recovery flow/.test(error.message)&&(code.startsWith('UNIVERSITY_')?error.code===code:true));
 }
});

test('the refusal names the school and the remedy that fits the account; a browser value cannot inject copy',async t=>{
 const previous=global.fetch;t.after(()=>global.fetch=previous);const load=loader();const {readWorkspace}=load('lib/workspace-read.ts');const policy=load('utils/verified-email-policy.ts');
 for(const [remedy,school,pattern,reject] of [['password','University of Virginia',/confirm your University of Virginia email: send yourself a password reset from Account settings/,/Microsoft/],['provider','University of Virginia',/confirm your University of Virginia email from your Microsoft sign-in\. Sign out and sign in with Microsoft again/,/password reset/],['bogus','x'.repeat(200),/confirm your university email: send yourself a password reset/,/x{20}/]]){
  global.fetch=async()=>({ok:false,status:403,json:async()=>({error:'UNIVERSITY_VERIFICATION_REQUIRED',remedy,school})});
  await assert.rejects(readWorkspace('invitations',[true]),error=>pattern.test(error.message)&&!reject.test(error.message)&&!/UVA email/.test(error.message)&&error.code==='UNIVERSITY_VERIFICATION_REQUIRED'&&error.remedy===(remedy==='bogus'?null:remedy));
 }
 const user=(metadata,identities=[])=>({supabaseUser:{app_metadata:metadata,identities}});
 assert.equal(policy.verificationRemedyFor(user({providers:['email']})),'password');
 assert.equal(policy.verificationRemedyFor(user({providers:['azure']},[{provider:'azure'}])),'provider','Microsoft-only accounts have no password to reset');
 assert.equal(policy.verificationRemedyFor(user({providers:['email','azure']})),'password','an account with a password can reset it');
 assert.equal(policy.verificationRemedyFor(user({})),'password');
});

test('an unconfirmed account is refused with its own school name and remedy, looked up from its email domain',async()=>{
 const queries=[];const load=loader({'@/utils/prisma':{prisma:{schoolIdentifierType:{findFirst:async query=>{queries.push(query);return query.where.emailDomain==='virginia.edu'?{school:{name:'University of Virginia'}}:null}}}}});
 const {prepareVerifiedSchoolAccount}=load('utils/school-identity.ts');
 const account=(providers,identities=[])=>({user:{id:'u',email:'mst3k@virginia.edu'},supabaseUser:{id:'u',email:'mst3k@virginia.edu',email_confirmed_at:'2026-10-05T00:00:00Z',confirmation_sent_at:null,app_metadata:{providers},identities}});
 await assert.rejects(prepareVerifiedSchoolAccount(account(['email'])),error=>error.code==='UNIVERSITY_VERIFICATION_REQUIRED'&&error.context.remedy==='password'&&error.context.school==='University of Virginia'&&/confirm your University of Virginia email: send yourself a password reset/.test(error.message));
 assert.deepEqual(queries[0].where,{emailDomain:'virginia.edu',school:{active:true}});
 await assert.rejects(prepareVerifiedSchoolAccount(account(['azure'],[{provider:'azure',user_id:'other',identity_data:{email:'mst3k@virginia.edu'}}])),error=>error.context.remedy==='provider'&&/Microsoft sign-in/.test(error.message)&&!/password reset/.test(error.message));
});

test('the refusal reads "To see club invitations" when listing and "To respond to this invitation" when acting on one',async()=>{
 const load=loader({'@/utils/prisma':{prisma:{schoolIdentifierType:{findFirst:async()=>({school:{name:'University of Virginia'}})}}}});
 const {prepareVerifiedSchoolAccount}=load('utils/school-identity.ts');const access=load('lib/invitation-access.ts');
 const account=()=>({user:{id:'u',email:'mst3k@virginia.edu'},supabaseUser:{id:'u',email:'mst3k@virginia.edu',email_confirmed_at:'2026-10-05T00:00:00Z',confirmation_sent_at:null,app_metadata:{providers:['email']}}});
 await assert.rejects(prepareVerifiedSchoolAccount(account(),'view'),error=>error.message===access.verificationRequiredMessage({remedy:'password',school:'University of Virginia',purpose:'view'})&&/^To see club invitations, /.test(error.message));
 await assert.rejects(prepareVerifiedSchoolAccount(account()),error=>error.message===access.verificationRequiredMessage({remedy:'password',school:'University of Virginia',purpose:'respond'})&&/^To respond to this invitation, /.test(error.message));
 const source=fs.readFileSync('actions/club-onboarding.ts','utf8');
 assert.match(source,/export async function getOrganizationInvitations[\s\S]{0,200}prepareVerifiedSchoolAccount\(account, "view"\)/,'listing uses the viewing copy');
 assert.equal((source.match(/prepareVerifiedSchoolAccount\(account\);/g)||[]).length,3,'accept, dismiss and decline use the responding copy');
});
