const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {createClient}=require('@supabase/supabase-js');
const {Actor,totp,readConfig,confirmationMessage,randomUUID}=require('./helpers/onboarding-e2e.cjs');
const configFile=process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;

test('complete onboarding over real Next HTTP, Supabase Auth/MFA, PostgreSQL and captured SMTP',{skip:!configFile,timeout:180000},async t=>{
 const config=readConfig(configFile),db=new PrismaClient({datasourceUrl:config.status.DB_URL});t.after(()=>db.$disconnect());
 const admin=new Actor(config);await admin.signIn(config.admin.email,config.admin.password);
 const mfa=await admin.client.auth.mfa.challengeAndVerify({factorId:config.admin.factor,code:totp(config.admin.totpSecret)});assert.equal(mfa.error,null);
 const suffix=randomUUID().replaceAll('-','').slice(0,8),name=`Madison Investment Fund E2E ${suffix}`;
 const ids={president:`pres${suffix}`,existing:`sarah${suffix}`,newStudent:`michael${suffix}`,dismissed:`dismiss${suffix}`,incremental:`later${suffix}`};
 const president=new Actor(config),existing=new Actor(config),newStudent=new Actor(config),dismissed=new Actor(config);
 const call=(actor,file,name,...args)=>actor.action('actions/'+file+'.ts',name,args);
 let clubId,ownerInvitation,preview,importResult,memberInvitation;
 const complete=new Set();async function scenario(title,fn){await t.test(title,async()=>{await fn();complete.add(title);});assert.ok(complete.has(title),`Stop dependent scenarios after ${title} failed`);}
 await scenario('OTP — unconfirmed signup, resend, wrong/consumed token rejection, session and repeat login',async()=>{
  const actor=new Actor(config),email=`otp${suffix}@virginia.edu`,password='Local-otp-only!2026';
  const created=await actor.action('actions/onboarding.ts','registerStudent',[{firstName:'OTP',lastName:'Test',email,password}]);
  assert.equal(created.authenticated,false);assert.ok(!created.error,created.error);
  const authAdmin=createClient(config.status.API_URL,config.status.SECRET_KEY||config.status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const before=await authAdmin.auth.admin.listUsers();assert.equal(before.error,null);
  const pending=before.data.users.find(user=>user.email===email);assert.ok(pending);assert.ok(!pending.email_confirmed_at);
  assert.equal((await actor.client.auth.getSession()).data.session,null);
  assert.ok((await actor.client.auth.signInWithPassword({email,password})).error);
  const first=await confirmationMessage(config,email);assert.ok(/\b\d{6}\b/.test(first.Text));assert.ok(!first.HTML.includes('/auth/v1/verify'));
  const code=first.Text.match(/\b(\d{6})\b/)[1],wrong=code==='000000'?'000001':'000000';
  assert.ok((await actor.client.auth.verifyOtp({email,token:wrong,type:'email'})).error);
  // Respect the production-length resend cooldown rather than weakening it for the test.
  await new Promise(resolve=>setTimeout(resolve,61000));
  const resent=await actor.client.auth.resend({type:'signup',email});assert.equal(resent.error,null);
  const second=await confirmationMessage(config,email);assert.notEqual(second.ID,first.ID);
  const correct=second.Text.match(/\b(\d{6})\b/)[1];
  const verified=await actor.client.auth.verifyOtp({email,token:correct,type:'email'});assert.equal(verified.error,null);assert.ok(verified.data.session);
  actor.user=verified.data.user;assert.ok(actor.user.email_confirmed_at);
  assert.ok((await actor.client.auth.getUser()).data.user.email_confirmed_at);
  assert.ok((await actor.client.auth.getSession()).data.session);
  assert.ok((await actor.client.auth.verifyOtp({email,token:correct,type:'email'})).error);
  await actor.profile('OTP Test',2028);
  assert.equal((await actor.request('/')).status,200);
  assert.equal((await actor.request('/api/users/me')).status,200);
  await actor.client.auth.signOut();await actor.signIn(email,password);
  assert.equal((await actor.request('/api/users/me')).status,200);
  await actor.client.auth.signOut();
  const login=await actor.client.auth.signInWithOtp({email,options:{shouldCreateUser:false}});assert.equal(login.error,null);
  const loginMessage=await confirmationMessage(config,email,/Your OutClass sign-in code/);
  const loginCode=loginMessage.Text.match(/\b(\d{6})\b/)[1];
  const loginVerified=await actor.client.auth.verifyOtp({email,token:loginCode,type:'email'});assert.equal(loginVerified.error,null);assert.ok(loginVerified.data.session);
  const absent=await actor.client.auth.signInWithOtp({email:`absent${suffix}@virginia.edu`,options:{shouldCreateUser:false}});assert.ok(absent.error);
  const after=await authAdmin.auth.admin.listUsers();assert.ok(!after.data.users.some(user=>user.email===`absent${suffix}@virginia.edu`));
 });
 await scenario('A — superadmin designation → normal verified signup → profile → atomic ownership → club dashboard',async()=>{
  const count=await db.user.count();
  const result=await call(admin,'platform-organization-onboarding','createOrganizationAndInvitePresident',{requestId:randomUUID(),identifierTypeId:'school-uva-computing-id',organizationName:name,presidentName:'John Smith',presidentIdentifier:` ${ids.president.toUpperCase()} `,presidentYear:'2027',reason:'Isolated complete onboarding end-to-end validation'});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.accountMatch,'NEW');clubId=result.organization.id;ownerInvitation=result.invitation.id;
  assert.equal(await db.user.count(),count);assert.equal(await db.user.count({where:{email:ids.president+'@virginia.edu'}}),0);
  let invitation=await db.clubInvitation.findUniqueOrThrow({where:{id:ownerInvitation}});assert.equal(invitation.requestedRole,'OWNER');assert.equal(invitation.status,'PENDING');assert.equal(invitation.claimedUserId,null);
  await president.signUp('John Smith',ids.president,2027);
  fs.writeFileSync(path.join(path.dirname(configFile),'ui-fixture.json'),JSON.stringify({clubId,ownerInvitation,name,president:president.credentials}),{mode:0o600});
  const pending=await call(president,'club-onboarding','getOrganizationInvitations',true);assert.equal(pending.length,1);assert.equal(pending[0].invitedName,'John Smith');assert.equal(pending[0].invitedYear,'2027');
  assert.equal((await db.schoolIdentity.findUniqueOrThrow({where:{id:invitation.schoolIdentityId}})).userId,president.user.id);
  // Email invitation entry points must guide first-time users through the existing profile wizard.
  for(const target of [`/invitations/${ownerInvitation}`,'/settings/organizations']){
   const page=await president.request(target);assert.equal(page.status,307,`${target} must not bypass profile completion`);assert.ok(page.headers.get('location').includes('/?next='));
  }
  await president.profile('John Smith',2027);assert.equal((await db.studentProfile.findUniqueOrThrow({where:{userId:president.user.id}})).computingId,ids.president);
  await call(president,'club-onboarding','acceptIdentityClubInvitation',ownerInvitation);
  invitation=await db.clubInvitation.findUniqueOrThrow({where:{id:ownerInvitation}});assert.equal(invitation.status,'ACCEPTED');assert.equal(invitation.claimedUserId,president.user.id);assert.ok(invitation.claimedAt);
  const membership=await db.clubMember.findUniqueOrThrow({where:{userId_clubId:{userId:president.user.id,clubId}}});assert.equal(membership.isOwner,true);assert.equal(membership.accessRole,'OWNER');assert.equal(membership.status,'ACTIVE');
  const dashboard=await president.request(`/club/${clubId}/workspace`);assert.equal(dashboard.status,200);// Club data is fetched by the client; the checklist action verifies authorized organization data below.
  const checklist=await call(president,'organization-onboarding','getOrganizationSetupChecklist',clubId);assert.equal(checklist.organizationName,name);assert.equal(checklist.steps.find(s=>s.id==='claim').complete,true);
 });
 await scenario('B — roster preview, invalid rows, confirmation, no fake users, durable audit and no automatic email',async()=>{
  await existing.signUp('Sarah Lee',ids.existing,2028);await existing.profile('Sarah Lee',2028);
  const csv=`name,year,computing_id\nJohn Smith,2027,${ids.president}\nSarah Lee,2028,${ids.existing}\nMichael Chen,2029,${ids.newStudent}\nDismiss Student,2028,${ids.dismissed}\nInvalid Student,2099,\nDuplicate Sarah,2028,${ids.existing.toUpperCase()}`;
  const count=await db.user.count(),deliveryCount=await db.invitationDelivery.count();
  preview=await call(president,'roster-import','previewRosterImport',{clubId,requestId:randomUUID(),filename:'members.csv',csv});
  assert.equal(preview.summary.ready,3);assert.equal(preview.summary.invalid,1);assert.equal(preview.summary.duplicates,1);assert.equal(preview.summary.alreadyMember,1);
  assert.equal(await db.clubInvitation.count({where:{clubId,status:'PENDING'}}),0);
  importResult=await call(president,'roster-import','confirmRosterImport',preview.id);assert.equal(importResult.completed,true);assert.equal(importResult.created,3);assert.equal(importResult.invalid,1);assert.equal(importResult.duplicates,1);
  assert.equal(await db.user.count(),count);assert.equal(await db.invitationDelivery.count(),deliveryCount);
  const record=await db.rosterImport.findUniqueOrThrow({where:{id:preview.id},include:{rows:true}});assert.equal(record.uploadedById,president.user.id);assert.equal(record.status,'COMPLETED');assert.equal(record.rowCount,6);assert.equal(record.rows.length,6);
  assert.equal(await db.auditLog.count({where:{targetId:preview.id,action:'club.roster.confirm'}}),1);
  assert.ok(record.rows.filter(r=>r.status==='INVITATION_CREATED').every(r=>r.invitationId));
 });
 await scenario('C — existing account invitation → dashboard request source → accepted membership',async()=>{
  const pending=await call(existing,'club-onboarding','getOrganizationInvitations');assert.equal(pending.length,1);memberInvitation=pending[0].id;assert.equal(pending[0].requestedRole,'MEMBER');
  const profile=await db.studentProfile.findUniqueOrThrow({where:{userId:existing.user.id}});assert.equal(profile.firstName,'Sarah');
  const imported=await db.rosterImportRow.findFirstOrThrow({where:{importId:preview.id,invitationId:memberInvitation}});assert.equal(imported.matchedUserId,existing.user.id);
  await call(existing,'club-onboarding','acceptIdentityClubInvitation',memberInvitation);
  assert.equal((await db.clubMember.findUniqueOrThrow({where:{userId_clubId:{userId:existing.user.id,clubId}}})).accessRole,'MEMBER');
  assert.equal((await call(existing,'club-onboarding','getOrganizationInvitations')).length,0);
 });
 await scenario('D — invitation-only student → normal signup/verification → profile suggestions → join',async()=>{
  assert.equal(await db.user.count({where:{email:ids.newStudent+'@virginia.edu'}}),0);
  await newStudent.signUp('Michael Chen',ids.newStudent,2029);
  const invitations=await call(newStudent,'club-onboarding','getOrganizationInvitations',true);assert.equal(invitations.length,1);assert.equal(invitations[0].invitedName,'Michael Chen');assert.equal(invitations[0].invitedYear,'2029');
  await newStudent.profile('Michael Reviewed',2029);
  await call(newStudent,'club-onboarding','acceptIdentityClubInvitation',invitations[0].id);
  assert.equal((await db.studentProfile.findUniqueOrThrow({where:{userId:newStudent.user.id}})).lastName,'Reviewed');
  assert.equal(await db.clubMember.count({where:{userId:newStudent.user.id,clubId,status:'ACTIVE'}}),1);
 });
 await scenario('E — Not now hides dashboard only; Settings recovery uses the same acceptance',async()=>{
  await dismissed.signUp('Dismiss Student',ids.dismissed,2028);await dismissed.profile('Dismiss Student',2028);
  const [invitation]=await call(dismissed,'club-onboarding','getOrganizationInvitations');assert.ok(invitation);
  await call(dismissed,'club-onboarding','setOrganizationInvitationDismissed',invitation.id,true);
  assert.equal((await call(dismissed,'club-onboarding','getOrganizationInvitations')).length,0);assert.equal((await db.clubInvitation.findUniqueOrThrow({where:{id:invitation.id}})).status,'PENDING');
  const [recovered]=await call(dismissed,'club-onboarding','getOrganizationInvitations',true);assert.equal(recovered.id,invitation.id);
  const settings=await dismissed.request('/settings/organizations');assert.equal(settings.status,200);
  await call(dismissed,'club-onboarding','acceptIdentityClubInvitation',recovered.id);assert.equal(await db.clubMember.count({where:{clubId,userId:dismissed.user.id}}),1);
 });
 await scenario('F — incremental upload preserves all prior members and creates only additive invitations',async()=>{
  const before=await db.clubMember.findMany({where:{clubId},orderBy:{id:'asc'}});
  const next=await call(president,'roster-import','previewRosterImport',{clubId,requestId:randomUUID(),filename:'incremental.csv',csv:`name,year,computing_id\nSarah Lee,2028,${ids.existing}\nLater Student,2029,${ids.incremental}`});
  const result=await call(president,'roster-import','confirmRosterImport',next.id);assert.equal(result.created,1);assert.equal(result.alreadyMember,1);
  assert.deepEqual(await db.clubMember.findMany({where:{clubId},orderBy:{id:'asc'}}),before);
  assert.equal(await db.user.count({where:{email:ids.incremental+'@virginia.edu'}}),0);
 });
 await scenario('G — direct HTTP actions enforce member/admin/recruiter/owner boundaries and Supabase browser isolation',async()=>{
  const sarah=await db.clubMember.findUniqueOrThrow({where:{userId_clubId:{userId:existing.user.id,clubId}}});
  for(const [file,name,args]of [['roster-import','previewRosterImport',[{clubId,requestId:randomUUID(),filename:'attack.csv',csv:'name,computing_id\nVictim,victimabc'}]],['organization-members','changeOrganizationMemberRole',[{clubId,memberId:sarah.id,role:'ADMIN'}]],['invitation-emails','sendRosterInvitations',[preview.id]],['club-workspace','updateClubSettings',[{clubId,name:'Hijacked',tagline:'Valid unauthorized input',description:'Permission check must reject valid input.'}]],['organization-members','getOrganizationMemberManagement',[clubId]]])await assert.rejects(existing.action('actions/'+file+'.ts',name,args));
  await call(president,'organization-members','changeOrganizationMemberRole',{clubId,memberId:sarah.id,role:'RECRUITING_ADMIN'});
  const recruiter=await call(existing,'club-overview','getWorkspaceRounds',clubId);assert.ok(Array.isArray(recruiter));
  await assert.rejects(call(existing,'roster-import','previewRosterImport',{clubId,requestId:randomUUID(),filename:'attack.csv',csv:'name,computing_id\nVictim,victimabc'}));
  await call(president,'organization-members','changeOrganizationMemberRole',{clubId,memberId:sarah.id,role:'ADMIN'});
  await call(existing,'organization-members','getOrganizationMemberManagement',clubId);
  await assert.rejects(call(existing,'organization-members','changeOrganizationMemberRole',{clubId,memberId:sarah.id,role:'OWNER'}));
  await assert.rejects(call(existing,'organization-members','transferOrganizationOwnership',{clubId,memberId:sarah.id,confirm:true}));
  await call(president,'organization-members','changeOrganizationMemberRole',{clubId,memberId:sarah.id,role:'MEMBER'});
  const session=await existing.client.auth.getSession();
  for(const table of ['SchoolIdentity','ClubInvitation','ClubMember','RosterImport','RosterImportRow','InvitationDelivery']){
   const response=await fetch(config.status.API_URL+'/rest/v1/'+table+'?select=*',{headers:{apikey:config.status.PUBLISHABLE_KEY,authorization:'Bearer '+session.data.session.access_token}});assert.ok(response.status===401||response.status===403,`${table} browser CRUD denied`);
  }
 });
 await scenario('H — replayed claim/accept/upload/email batch do not duplicate identities, memberships or sends',async()=>{
  await assert.rejects(call(president,'club-onboarding','acceptIdentityClubInvitation',ownerInvitation));await assert.rejects(call(existing,'club-onboarding','acceptIdentityClubInvitation',memberInvitation));
  const replay=await call(president,'roster-import','confirmRosterImport',preview.id);assert.equal(replay.reused,true);assert.equal(replay.created,3);
  const before=await db.clubInvitation.count({where:{clubId}});
  const repeated=await call(president,'roster-import','previewRosterImport',{clubId,requestId:randomUUID(),filename:'repeat.csv',csv:`name,year,computing_id\nLater Student,2029,${ids.incremental}`});
  const repeatedResult=await call(president,'roster-import','confirmRosterImport',repeated.id);assert.equal(repeatedResult.created,0);assert.equal(repeatedResult.alreadyInvited,1);assert.equal(await db.clubInvitation.count({where:{clubId}}),before);
  const record=await db.rosterImport.findFirstOrThrow({where:{clubId,filename:'incremental.csv'}});
  const sends=await Promise.all([call(president,'invitation-emails','sendRosterInvitations',record.id),call(president,'invitation-emails','sendRosterInvitations',record.id)]);assert.equal(sends.reduce((n,s)=>n+s.queued,0),1);
  const deliveries=await Promise.all([call(president,'invitation-emails','deliverOrganizationInvitations',clubId),call(president,'invitation-emails','deliverOrganizationInvitations',clubId)]);assert.equal(deliveries.reduce((n,s)=>n+s.sent,0),1);
  const invitation=await db.clubInvitation.findFirstOrThrow({where:{clubId,email:ids.incremental+'@virginia.edu'}});assert.equal(invitation.emailSendCount,1);assert.ok(invitation.firstEmailSentAt&&invitation.lastEmailSentAt);
  const attempts=await db.invitationDelivery.findMany({where:{invitationId:invitation.id}});assert.equal(attempts.length,1);assert.equal(attempts[0].status,'SENT');
  await assert.rejects(call(president,'invitation-emails','resendOrganizationInvitation',clubId,invitation.id));
  const mail=await(await fetch(config.status.MAILPIT_URL+'/api/v1/messages?limit=100')).json();assert.equal(mail.messages.filter(m=>m.To.some(to=>to.Address===invitation.email)).length,1);
 });
 await scenario('I — legacy account re-verifies university mailbox through real password recovery before invitation acceptance',async()=>{
  const {createClient}=require('@supabase/supabase-js');
  const provider=createClient(config.status.API_URL,config.status.SECRET_KEY,{auth:{persistSession:false}});
  const identifier='legacy'+suffix,email=identifier+'@virginia.edu',password='Legacy-local-only!123',nextPassword='Recovered-local-only!123';
  const created=await provider.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{email_verification_skipped:true}});assert.equal(created.error,null);
  assert.equal(created.data.user.confirmation_sent_at,undefined);
  await db.user.create({data:{id:created.data.user.id,email}});
  const legacy=new Actor(config);await legacy.signIn(email,password);await legacy.profile('Legacy Student',2028);
  const invitation=await call(president,'club-onboarding','createClubIdentityInvitation',{clubId,identifierTypeId:'school-uva-computing-id',identifier,requestedRole:'MEMBER',invitedName:'Legacy Student',invitedYear:'2028'});
  await assert.rejects(call(legacy,'club-onboarding','getOrganizationInvitations',true));
  const session=await legacy.client.auth.getSession();
  await fetch(config.status.API_URL+'/auth/v1/user',{method:'PUT',headers:{apikey:config.status.PUBLISHABLE_KEY,authorization:'Bearer '+session.data.session.access_token,'content-type':'application/json'},body:JSON.stringify({app_metadata:{outclass_verified_email:{method:'password_recovery_v1',userId:created.data.user.id,email,emailConfirmedAt:created.data.user.email_confirmed_at,verifiedAt:new Date().toISOString()}},data:{computing_id:'victim'}})});
  assert.equal((await provider.auth.admin.getUserById(created.data.user.id)).data.user.app_metadata.outclass_verified_email,undefined,'Browser cannot set server identity proof');
  await assert.rejects(call(legacy,'club-onboarding','getOrganizationInvitations',true));
  const recovery=await legacy.request('/api/auth/password-recovery',{method:'POST',headers:{origin:config.appUrl.replace('127.0.0.1','localhost'),'content-type':'application/json'},body:JSON.stringify({action:'request',email})});assert.equal(recovery.status,200);
  let tokenHash;
  for(let attempt=0;attempt<30&&!tokenHash;attempt++){
   const list=await(await fetch(config.status.MAILPIT_URL+'/api/v1/messages?limit=100')).json();
   const found=list.messages.find(m=>m.To.some(to=>to.Address===email)&&/Reset|Recovery/i.test(m.Subject));
   if(found){const message=await(await fetch(config.status.MAILPIT_URL+'/api/v1/message/'+found.ID)).json();tokenHash=(message.HTML+' '+message.Text).match(/(?:[?&]token=|#token_hash=)([a-f0-9]+)/i)?.[1];}
   if(!tokenHash)await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(tokenHash,'Actual local recovery email must supply the one-use token');
  const result=await legacy.request('/api/auth/password-recovery',{method:'POST',headers:{origin:config.appUrl.replace('127.0.0.1','localhost'),'content-type':'application/json'},body:JSON.stringify({action:'reset',tokenHash,password:nextPassword,confirmation:nextPassword,userId:'attacker',email:'attacker@virginia.edu'})});assert.equal(result.status,200,await result.text());
  const recovered=await provider.auth.admin.getUserById(created.data.user.id);assert.equal(recovered.data.user.app_metadata.outclass_verified_email.email,email);assert.equal(recovered.data.user.app_metadata.email_verification_skipped,true,'Recovery proof must preserve other server metadata');
  await legacy.signIn(email,nextPassword);
  const pending=await call(legacy,'club-onboarding','getOrganizationInvitations',true);assert.ok(pending.some(item=>item.id===invitation.id));
  await call(legacy,'club-onboarding','acceptIdentityClubInvitation',invitation.id);
  assert.equal(await db.clubMember.count({where:{clubId,userId:created.data.user.id,status:'ACTIVE'}}),1);
  await assert.rejects(call(legacy,'club-onboarding','acceptIdentityClubInvitation',invitation.id));
 });

});
