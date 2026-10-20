const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {createClient}=require('@supabase/supabase-js');
const {Actor,readConfig,totp,confirmationMessage,randomUUID}=require('./helpers/onboarding-e2e.cjs');
const {loader}=require('./helpers/communications-loader.cjs');
const fingerprint=loader({})('lib/student-invitation.ts').studentInvitationFingerprint;
const filename=process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;

test('student invitations claim and resend through the compatibility runtime without Auth token SQL',{skip:!filename,timeout:90000},async t=>{
 const c=readConfig(filename),db=new PrismaClient({datasourceUrl:c.status.DB_URL});t.after(()=>db.$disconnect());
 const service=createClient(c.status.API_URL,c.status.SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const readiness=async()=>{const [row]=await db.$queryRawUnsafe(`SELECT jsonb_build_object(
  'pending_app_invites',(SELECT count(*) FROM auth.users a JOIN public."User" u ON u.id=a.id::text WHERE a.invited_at IS NOT NULL AND a.email_confirmed_at IS NULL AND a.confirmation_token<>''),
  'pending_without_binding',(SELECT count(*) FROM auth.users a JOIN public."User" u ON u.id=a.id::text WHERE a.invited_at IS NOT NULL AND a.email_confirmed_at IS NULL AND a.confirmation_token<>'' AND NOT EXISTS(SELECT FROM public."AuditLog" l WHERE l."targetId"=u.id AND l.action='platform.student.invitation.binding' AND l.details->>'fingerprint'=encode(sha256(convert_to('outclass-student-invite-v1','UTF8')||decode('00','hex')||convert_to(a.confirmation_token,'UTF8')),'hex')))
 ) AS readiness`);return row.readiness;};
 const admin=new Actor(c);await admin.signIn(c.admin.email,c.admin.password);
 const elevate=body=>admin.request('/api/platform/elevation',{method:'POST',headers:{origin:c.appUrl,'content-type':'application/json'},body:JSON.stringify(body)});
 const begun=await elevate({action:'password',password:c.admin.password});assert.equal(begun.status,200);
 assert.equal((await elevate({action:'verify',code:totp(c.admin.totpSecret)})).status,200);
 const claim=(f,actor=new Actor(c),email=f.email,tokenHash=f.tokenHash)=>actor.request('/api/auth/student-claim',{method:'POST',headers:{origin:c.appUrl,'content-type':'application/json'},body:JSON.stringify({email,tokenHash,password:f.password})});
 async function invitation(label){
  const email=`claim${label}${randomUUID().replaceAll('-','').slice(0,10)}@virginia.edu`;
  const result=await admin.action('actions/admin-workspace.ts','createAdminStudent',[{email,firstName:'Synthetic',lastName:'Invited',reason:'Verify the reserved compatibility invitation flow.'}]);
  assert.equal(result.status,'INVITED');assert.deepEqual(Object.keys(result).sort(),['email','id','status']);
  const message=await confirmationMessage(c,email,/Claim your OutClass/),tokenHash=message.Text.match(/token_hash=([a-f0-9]{56,64})/)?.[1];assert.ok(tokenHash);
  const binding=await db.auditLog.findFirstOrThrow({where:{targetId:result.id,action:'platform.student.invitation.binding'},orderBy:{createdAt:'desc'}});
  assert.deepEqual(binding.details,{fingerprint:fingerprint(tokenHash)});assert.ok(!JSON.stringify(binding).includes(tokenHash));
  return{id:result.id,email,tokenHash,password:'Disposable-claim!'+randomUUID()};
 }
 async function pending(f){const r=await service.auth.admin.getUserById(f.id);assert.equal(r.error,null);assert.ok(r.data.user.invited_at);assert.ok(!r.data.user.email_confirmed_at);}
 await t.test('wrong existing invited address and wrong signed-in account preserve the intended link',async()=>{
  const a=await invitation('a'),b=await invitation('b');
  assert.equal((await claim(a,new Actor(c),b.email)).status,400);
  const wrong=new Actor(c);await wrong.signIn(c.admin.email,c.admin.password);assert.equal((await claim(a,wrong)).status,400);
  await pending(a);await pending(b);
  const visitor=new Actor(c),accepted=await claim(a,visitor);assert.equal(accepted.status,200);assert.deepEqual(await accepted.json(),{success:true});
  assert.equal((await visitor.request('/api/users/me')).status,200);await visitor.profile('Claimed Student',2028);
  const login=createClient(c.status.API_URL,c.status.PUBLISHABLE_KEY,{auth:{persistSession:false}});assert.equal((await login.auth.signInWithPassword({email:a.email,password:a.password})).error,null);
  assert.equal((await claim(a)).status,400);assert.equal(await db.auditLog.count({where:{targetId:a.id,action:'student.invitation.claim'}}),1);
 });
 await t.test('unbound signup hashes and arbitrary hashes cannot consume a provider token',async()=>{
  const email=`signup${randomUUID()}@virginia.edu`,generated=await service.auth.admin.generateLink({type:'signup',email,password:'Original-signup!'+randomUUID()});assert.equal(generated.error,null);
  await db.user.upsert({where:{id:generated.data.user.id},create:{id:generated.data.user.id,email},update:{}});
  const f={id:generated.data.user.id,email,tokenHash:generated.data.properties.hashed_token,password:'Unwanted-password!'+randomUUID()};
  assert.equal((await claim(f)).status,400);
  const verify=createClient(c.status.API_URL,c.status.PUBLISHABLE_KEY,{auth:{persistSession:false}});
  assert.equal((await verify.auth.verifyOtp({token_hash:f.tokenHash,type:'email'})).error,null,'Rejected claim must leave signup token usable in its own flow');
  const invited=await invitation('random');assert.equal((await claim(invited,new Actor(c),invited.email,'f'.repeat(64))).status,400);assert.equal((await claim(invited)).status,200);
 });
 await t.test('disabled and already confirmed invited accounts deny without changing passwords',async()=>{
  const f=await invitation('disabled');await db.user.update({where:{id:f.id},data:{disabledAt:new Date()}});assert.equal((await claim(f)).status,400);await pending(f);
  await db.user.update({where:{id:f.id},data:{disabledAt:null}});assert.equal((await claim(f)).status,200);
  const g=await invitation('confirmed');assert.equal((await service.auth.admin.updateUserById(g.id,{email_confirm:true,password:'Existing-confirmed!'+randomUUID()})).error,null);assert.equal((await claim(g)).status,400);
 });
 await t.test('provider expiry still rejects a bound fingerprint and does not change confirmation',async()=>{
  const f=await invitation('expired');await db.$executeRaw`UPDATE auth.users SET confirmation_sent_at=clock_timestamp()-interval '2 days' WHERE id=${f.id}::uuid`;
  assert.equal((await claim(f)).status,400);await pending(f);assert.equal(await db.auditLog.count({where:{targetId:f.id,action:'student.invitation.claim'}}),0);
 });
 await t.test('resend records a new binding before email; old token rejects and renewed token claims',async()=>{
  const f=await invitation('resend');
  // Only the synthetic provider send time moves; application audit is immutable.
  await db.$executeRaw`UPDATE auth.users SET confirmation_sent_at=clock_timestamp()-interval '16 minutes' WHERE id=${f.id}::uuid`;
  // Audit is immutable: insert an expired invitation fixture instead of editing
  // earlier audit events. The pre-existing resend cooldown is asserted below.
  await assert.rejects(admin.action('actions/admin-workspace.ts','resendAdminStudentInvitation',[f.id,'Verify that the invitation cooldown is preserved.']));
  const email=`resendlegacy${randomUUID()}@virginia.edu`,old=await service.auth.admin.generateLink({type:'invite',email});assert.equal(old.error,null);
  const id=old.data.user.id;await db.user.upsert({where:{id},create:{id,email},update:{}});
  assert.equal(Number((await readiness()).pending_without_binding),1,'Operator preflight must detect a legacy unbound invitation');
  await db.$executeRaw`UPDATE auth.users SET confirmation_sent_at=clock_timestamp()-interval '16 minutes' WHERE id=${id}::uuid`;
  assert.deepEqual(await admin.action('actions/admin-workspace.ts','resendAdminStudentInvitation',[id,'Renew the disposable legacy invitation through supported APIs.']),{success:true});
  const message=await confirmationMessage(c,email,/Claim your OutClass/),tokenHash=message.Text.match(/token_hash=([a-f0-9]{56,64})/)?.[1];assert.ok(tokenHash);assert.notEqual(tokenHash,old.data.properties.hashed_token);
  const renewed={id,email,tokenHash,password:'Renewed-claim!'+randomUUID()};
  assert.equal((await claim(renewed,new Actor(c),email,old.data.properties.hashed_token)).status,400);
  assert.equal((await claim(renewed)).status,200);
  const ready=await readiness();assert.equal(Number(ready.pending_without_binding),0);assert.ok(Number(ready.pending_app_invites)>0,'Preflight must match actual digests for still-pending issued invitations');
 });
});
