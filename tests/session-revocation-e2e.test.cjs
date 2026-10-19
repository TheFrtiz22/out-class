const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {createClient}=require('@supabase/supabase-js');
const {createServerClient}=require('@supabase/ssr');
const {loader}=require('./helpers/communications-loader.cjs');
const {Actor,readConfig,randomUUID,confirmationMessage}=require('./helpers/onboarding-e2e.cjs');
const filename=process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;

test('captured ordinary-session cookies cannot replay protected reads or profile writes after revocation',{skip:!filename,timeout:90000},async t=>{
 const c=readConfig(filename),op=new PrismaClient({datasourceUrl:c.status.DB_URL});t.after(()=>op.$disconnect());
 const service=createClient(c.status.API_URL,c.status.SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const verifier=createClient(c.status.API_URL,c.status.PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const results=[];t.after(()=>fs.writeFileSync(path.join(path.dirname(filename),'session-revocation-results.json'),JSON.stringify(results,null,2)+'\n',{mode:0o600}));
 async function fixture(label){
  const email=`session.${label}.${randomUUID()}@virginia.edu`,password='Disposable-session!'+randomUUID();
  const created=await service.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null);
  await op.user.upsert({where:{id:created.data.user.id},create:{id:created.data.user.id,email},update:{}});
  const actor=new Actor(c);await actor.signIn(email,password);await actor.profile('Before Revocation',2028);
  const session=(await actor.client.auth.getSession()).data.session;assert.ok(session);
  const payload=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url'));
  assert.ok(payload.exp*1000>Date.now()+60000,'Probe must replay an unexpired captured access token');
  const snapshot=[...actor.cookies],replay=()=>{const visitor=new Actor(c);visitor.cookies=new Map(snapshot);return visitor;};
  assert.equal((await replay().request('/api/users/me')).status,200);
  const rows=await op.$queryRaw`SELECT id FROM auth.sessions WHERE id=${payload.session_id}::uuid AND user_id=${created.data.user.id}::uuid`;assert.equal(rows.length,1);
  return {actor,replay,email,password,id:created.data.user.id,sessionId:payload.session_id,token:session.access_token};
 }
 async function assertDenied(label,f){
  const before=await op.studentProfile.findUniqueOrThrow({where:{userId:f.id},include:{experiences:true}});
  const provider=await verifier.auth.getUser(f.token);
  const response=await f.replay().request('/api/users/me');
  let writeAccepted=false;try{await f.replay().profile('Captured Replay',2028);writeAccepted=true;}catch{}
  const after=await op.studentProfile.findUniqueOrThrow({where:{userId:f.id},include:{experiences:true}});
  const unchanged=JSON.stringify(before)===JSON.stringify(after);
  results.push({case:label,provider_user_accepted:!provider.error&&!!provider.data.user,account_status:response.status,profile_write_accepted:writeAccepted,profile_unchanged:unchanged});
  assert.ok([401,403].includes(response.status),'Revoked credentials must receive an authentication denial, not a server failure');
  assert.match(response.headers.get('cache-control'),/private.*no-store/);
  assert.equal(writeAccepted,false,'Captured credentials cannot mutate the profile');assert.ok(unchanged,'Denied replay must leave the full profile unchanged');
 }
 await t.test('global logout removes the provider session and rejects the unexpired captured cookie',async()=>{
  const f=await fixture('global');assert.equal((await f.actor.client.auth.signOut({scope:'global'})).error,null);
  assert.equal((await op.$queryRaw`SELECT id FROM auth.sessions WHERE id=${f.sessionId}::uuid`).length,0);
  await assertDenied('global_logout',f);
 });
 await t.test('local logout revokes only that session while another real device keeps working',async()=>{
  const f=await fixture('local'),second=new Actor(c);await second.signIn(f.email,f.password);
  assert.equal((await f.actor.client.auth.signOut({scope:'local'})).error,null);
  assert.equal((await op.$queryRaw`SELECT id FROM auth.sessions WHERE id=${f.sessionId}::uuid`).length,0);
  await assertDenied('local_logout',f);
  assert.equal((await second.request('/api/users/me')).status,200);await second.profile('Other Device',2028);
 });
 await t.test('actual emailed password recovery revokes the earlier captured session',async()=>{
  const f=await fixture('recovery'),visitor=new Actor(c);
  const request=body=>visitor.request('/api/auth/password-recovery',{method:'POST',headers:{origin:c.appUrl.replace('127.0.0.1','localhost'),'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await request({action:'request',email:f.email})).status,200);
  const message=await confirmationMessage(c,f.email,/Reset|Recovery/i),tokenHash=(message.HTML+' '+message.Text).match(/#token_hash=([a-f0-9]+)/i)?.[1];assert.ok(tokenHash);
  const nextPassword='Recovered-session!'+randomUUID();assert.equal((await request({action:'reset',tokenHash,password:nextPassword,confirmation:nextPassword})).status,200);
  assert.equal((await op.$queryRaw`SELECT id FROM auth.sessions WHERE id=${f.sessionId}::uuid`).length,0);
  await assertDenied('password_recovery',f);
  const fresh=new Actor(c);await fresh.signIn(f.email,nextPassword);assert.equal((await fresh.request('/api/users/me')).status,200);
 });
 await t.test('current disabled status denies a previously valid captured cookie',async()=>{
  const f=await fixture('disabled');await op.user.update({where:{id:f.id},data:{disabledAt:new Date()}});
  await assertDenied('disabled_account',f);
 });
 await t.test('an expired provider session cannot use its still-unexpired JWT',async()=>{
  const f=await fixture('expired');await op.$executeRaw`UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 second' WHERE id=${f.sessionId}::uuid`;
  await assertDenied('session_not_after',f);
 });
 await t.test('malformed authentication cookies deny without a server error or write',async()=>{
  const f=await fixture('invalid');const original=f.replay;
  f.replay=()=>{const visitor=original();for(const name of visitor.cookies.keys())if(/^sb-.+-auth-token(?:\.\d+)?$/.test(name))visitor.cookies.set(name,'base64-invalid');return visitor;};
  await assertDenied('malformed_cookie',f);
 });
 await t.test('real session validation adds one SQL statement per request and retains one Auth user verification',async()=>{
  const f=await fixture('querycount'),runtime=new PrismaClient({datasourceUrl:c.runtimeDatabaseUrl||c.status.DB_URL});
  let sql=0,providerRequests=0;
  try{
   const client=createServerClient(c.status.API_URL,c.status.PUBLISHABLE_KEY,{global:{fetch:async(input,init)=>{providerRequests++;return fetch(input,init);}},cookies:{getAll:()=>[...f.actor.cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>f.actor.cookies.set(name,value))}});
   const api=loader({react:{cache:fn=>{let value;return()=>value??=(fn());}},'next/headers':{cookies:async()=>({has:()=>false,get:()=>undefined})},'./supabase/server':{createClient:async()=>client},'./prisma':{prisma:{$queryRaw:async(strings,...values)=>{sql++;return runtime.$queryRaw(strings,...values);}}},'@/utils/platform-view-as':{platformViewSession:async()=>null}})('utils/auth.ts');
   assert.equal((await api.getSessionUser()).data.user.id,f.id);assert.equal((await api.getSessionUser()).data.user.id,f.id);
   assert.equal(sql,1);assert.equal(providerRequests,1);
   const explained=await runtime.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT EXISTS(SELECT 1 FROM public.outclass_auth_sessions WHERE id=${f.sessionId}::uuid AND user_id=${f.id}::uuid AND (not_after IS NULL OR not_after>clock_timestamp())) AS live`;
   const plan=explained[0]['QUERY PLAN'][0],nodes=[];function visit(n){nodes.push({type:n['Node Type'],index:n['Index Name'],rows:n['Actual Rows'],loops:n['Actual Loops']});for(const child of n.Plans||[])visit(child);}visit(plan.Plan);
   results.push({case:'native_session_query',sql_statements_per_valid_request:sql,provider_requests_per_valid_request:providerRequests,local_execution_ms:plan['Execution Time'],plan:nodes});
  }finally{await runtime.$disconnect();}
 });
});
