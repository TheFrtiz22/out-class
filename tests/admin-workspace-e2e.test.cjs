const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const{Actor,totp}=require('./helpers/onboarding-e2e.cjs'),{PrismaClient}=require('@prisma/client'),{createClient}=require('@supabase/supabase-js');
const filename=process.env.OUTCLASS_ADMIN_E2E_CONFIG;
test('disposable real Auth/password/MFA elevation, Admin routes/actions, invitations, reports, impersonation and logout',{skip:!filename},async t=>{
 const c=JSON.parse(fs.readFileSync(filename));assert.equal(c.projectId,'outclass-corkboard-e2e');
 for(const[value,port]of[[c.status.API_URL,'56321'],[c.status.DB_URL,'56322']]){const url=new URL(value);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.equal(url.port,port);}
 c.appUrl='http://127.0.0.1:3109';c.buildDir=path.resolve('.next-publish');
 const db=new PrismaClient({datasourceUrl:c.status.DB_URL});t.after(()=>db.$disconnect());
 const service=createClient(c.status.API_URL,c.status.SECRET_KEY||c.status.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const admin=new Actor(c),student=new Actor(c),leader=new Actor(c);
 await admin.signIn(c.identities.admin.email,c.identities.admin.password);await student.signIn(c.identities.student.email,c.identities.student.password);await leader.signIn(c.identities.leader.email,c.identities.leader.password);
 const existingAal=await admin.client.auth.mfa.challengeAndVerify({factorId:c.identities.admin.factorId,code:totp(c.identities.admin.totpSecret)});assert.equal(existingAal.error,null);
 const post=(actor,body)=>actor.request('/api/platform/elevation',{method:'POST',headers:{origin:c.appUrl,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const denied = async actor => { const response = await actor.request('/platform'); if(response.status === 307) assert.equal(response.headers.get('location'),'/platform/login'); else { assert.equal(response.status,200); const html=await response.text(); assert.match(html,/NEXT_REDIRECT|http-equiv="refresh"/); assert.match(html,/platform\/login/); assert.ok(!html.includes('Needs Attention')); } };
 for(const actor of[student,leader,admin])await denied(actor);
 assert.equal((await(await student.request('/api/platform/eligibility')).json()).eligible,false);
 assert.equal((await(await admin.request('/api/platform/eligibility')).json()).eligible,true);
 await assert.rejects(admin.action('actions/platform-admin.ts','readPlatformResource',['users',0,{}]));
 assert.equal((await post(student,{action:'password',password:c.identities.student.password})).status,403);
 const begin=await post(admin,{action:'password',password:c.identities.admin.password});assert.equal(begin.status,200,await begin.text());
 const pending=await db.adminElevationChallenge.findFirst({where:{actorId:c.identities.admin.id,consumedAt:null},orderBy:{createdAt:'desc'}});assert.ok(pending.encryptedCredentials);assert.ok(!pending.encryptedCredentials.includes(c.identities.admin.password));
 const verified=await post(admin,{action:'verify',code:totp(c.identities.admin.totpSecret)});assert.equal(verified.status,200,await verified.text());
 const elevation=await db.adminElevation.findFirst({where:{actorId:c.identities.admin.id,revokedAt:null},orderBy:{createdAt:'desc'}});assert.ok(elevation);assert.ok(elevation.mfaVerifiedAt>=elevation.passwordVerifiedAt);
 for(const route of['/platform','/platform/users','/platform/clubs','/platform/corkboard','/platform/applications','/platform/events','/platform/claims','/platform/onboarding','/platform/support','/platform/activity','/platform/permissions','/platform/settings','/platform/audit']){const response=await admin.request(route);assert.equal(response.status,200,route);assert.ok(!(await response.text()).includes('Fresh Admin authentication required'));}
 const users=await admin.action('actions/platform-admin.ts','readPlatformResource',['users',0,{query:c.identities.student.email}]);assert.ok(users.some(u=>u.id===c.identities.student.id));
 const report=await db.platformReport.create({data:{kind:'SUPPORT',targetId:c.identities.student.id,reporterId:c.identities.student.id,summary:'Disposable administrator support regression request'}});
 await admin.action('actions/admin-workspace.ts','resolveAdminReport',[{id:report.id,revision:0,status:'RESOLVED',reason:'Verified the isolated support issue and resolved it.'}]);
 assert.equal((await db.platformReport.findUnique({where:{id:report.id}})).resolvedBy,c.identities.admin.id);
 const start=await admin.request('/api/platform/view-as',{method:'POST',headers:{origin:c.appUrl,'Content-Type':'application/json'},body:JSON.stringify({action:'start',userId:c.identities.student.id,reason:'Investigate disposable student onboarding support.',confirmation:'LOG IN AS'})});assert.equal(start.status,200,await start.text());
 const effective=await(await admin.request('/api/users/me')).json();assert.equal(effective.id,c.identities.student.id);
 await assert.rejects(admin.action('actions/platform-admin.ts','readPlatformResource',['users',0,{}]));
 const view=await db.platformViewSession.findFirst({where:{actorId:c.identities.admin.id,endedAt:null},orderBy:{createdAt:'desc'}});assert.equal(view.targetUserId,c.identities.student.id);
 const end=await admin.request('/api/platform/view-as',{method:'POST',headers:{origin:c.appUrl,'Content-Type':'application/json'},body:JSON.stringify({action:'end'})});assert.equal(end.status,200); admin.cookies.delete("outclass-platform-view");
 assert.equal((await admin.request('/platform')).status,200);
 // Suspension regression uses only the pre-existing disposable club and local Auth identities.
 await db.clubMember.upsert({where:{userId_clubId:{userId:c.identities.student.id,clubId:c.clubId}},create:{userId:c.identities.student.id,clubId:c.clubId,permissions:[],status:'ACTIVE'},update:{}});
 const historyRound=await db.pipelineRound.create({data:{clubId:c.clubId,name:'Suspension history '+randomUUID(),order:99}});
 const application=await db.application.upsert({where:{studentId_clubId:{studentId:c.identities.student.id,clubId:c.clubId}},create:{studentId:c.identities.student.id,clubId:c.clubId,roundId:historyRound.id,status:'DRAFTING'},update:{}});
 const published=await db.meeting.findFirstOrThrow({where:{clubId:c.clubId,publication:{is:{status:'PUBLISHED',capacity:150}},date:{gt:new Date()}},include:{publication:true}});
 await db.eventRsvp.upsert({where:{eventId_userId:{eventId:published.id,userId:c.identities.student.id}},create:{eventId:published.id,userId:c.identities.student.id},update:{}});
 const snapshot=async()=>JSON.stringify(await db.club.findUniqueOrThrow({where:{id:c.clubId},select:{members:{orderBy:{id:'asc'}},applications:{orderBy:{id:'asc'},include:{answers:true,evaluations:true,bookings:true}},pipelineRounds:{orderBy:{id:'asc'}},events:{orderBy:{id:'asc'},include:{publication:true,flyers:true,rsvps:{orderBy:{userId:'asc'}}}}}}));
 const before=await snapshot(),unrelated=await db.club.findUniqueOrThrow({where:{id:c.otherClubId}});
 const requirement=(await db.club.findUniqueOrThrow({where:{id:c.clubId}})).testRequirement;
 await t.test('active leader can perform a protected recruitment operation',()=>leader.action('actions/crm.ts','setClubTestRequirement',[c.clubId,requirement]));
 await t.test('active approved Corkboard event is publicly visible',async()=>{assert.ok((await student.action('actions/campus-events.ts','getPublicCorkboard',[{clubId:c.clubId}])).events.some(e=>e.id===published.id));});
 for(const value of[true,false])await t.test('unelevated student cannot '+(value?'suspend':'restore')+' a club',()=>assert.rejects(student.action('actions/admin-workspace.ts','setAdminClubSuspended',[c.clubId,value,'Reject non-admin suspension changes in isolated regression.'])));
 await admin.action('actions/admin-workspace.ts','setAdminClubSuspended',[c.clubId,true,'Suspend disposable club to verify server enforcement.']);
 try {
  await t.test('suspended leader cannot manage recruitment through direct server action',()=>assert.rejects(leader.action('actions/crm.ts','setClubTestRequirement',[c.clubId,requirement])));
  await t.test('suspended leader cannot manage club settings through direct server action',()=>assert.rejects(leader.action('actions/club-workspace.ts','updateClubSettings',[{clubId:c.clubId,name:'Suspension must reject this change',tagline:'Blocked',description:'Blocked mutation'}])));
  await t.test('suspended club rejects new applications and leaves no new record',async()=>{const outsider=new Actor(c);await outsider.signIn(c.identities.outsider.email,c.identities.outsider.password);const count=await db.application.count({where:{clubId:c.clubId,studentId:c.identities.outsider.id}});await assert.rejects(outsider.action('actions/applications.ts','submitApplication',[{clubId:c.clubId,answers:[]}]));assert.equal(await db.application.count({where:{clubId:c.clubId,studentId:c.identities.outsider.id}}),count);});
  await t.test('existing application remains readable by its student',async()=>assert.ok((await student.action('actions/applications.ts','getStudentApplications',[])).some(a=>a.id===application.id)));
  await t.test('authorized historical pipeline read remains available',()=>leader.action('actions/crm.ts','getClubPipeline',[c.clubId]));
  await t.test('existing memberships, applications, answers, rounds, evaluations, bookings, events, flyers and RSVPs are unchanged',async()=>assert.equal(await snapshot(),before));
  await t.test('suspended club excluded from public board and detail readers',async()=>{const board=await student.action('actions/campus-events.ts','getPublicCorkboard',[{clubId:c.clubId}]);assert.equal(board.events.length,0);assert.ok(!board.clubs.some(x=>x.id===c.clubId));assert.equal(await student.action('actions/campus-events.ts','getPublicCampusEvent',[published.id]),null);});
  await t.test('suspended event rejects new RSVP without deleting existing RSVP',async()=>{await assert.rejects(leader.action('actions/campus-events.ts','setCampusEventRsvp',[{eventId:published.id,going:true}]));assert.ok(await db.eventRsvp.findUnique({where:{eventId_userId:{eventId:published.id,userId:c.identities.student.id}}}));});
  await t.test('leader and member workspace show explicit suspended state',async()=>{for(const actor of[leader,student])assert.match(await(await actor.request('/club/'+c.clubId+'/workspace')).text(),/This club is suspended/);});
  await t.test('unrelated club state remains unchanged',async()=>assert.deepEqual(await db.club.findUniqueOrThrow({where:{id:c.otherClubId}}),unrelated));
  await t.test('suspension audit records actual elevated actor',async()=>{const row=await db.auditLog.findFirstOrThrow({where:{clubId:c.clubId,action:'platform.club.suspension'},orderBy:{createdAt:'desc'}});assert.equal(row.actorId,c.identities.admin.id);assert.equal(row.details.suspended,true);});
 } finally {await admin.action('actions/admin-workspace.ts','setAdminClubSuspended',[c.clubId,false,'Restore disposable club after server regression.']);}
 await t.test('restoration resumes ordinary leader operations without reconstruction',async()=>{assert.equal((await db.club.findUniqueOrThrow({where:{id:c.clubId}})).suspendedAt,null);await leader.action('actions/crm.ts','setClubTestRequirement',[c.clubId,requirement]);assert.equal(await snapshot(),before);});
 await t.test('restoration exposes the still-approved current event',async()=>assert.ok((await student.action('actions/campus-events.ts','getPublicCorkboard',[{clubId:c.clubId}])).events.some(e=>e.id===published.id)));
 await t.test('restoration is audited with the same elevated actor',async()=>{const row=await db.auditLog.findFirstOrThrow({where:{clubId:c.clubId,action:'platform.club.suspension'},orderBy:{createdAt:'desc'}});assert.equal(row.actorId,c.identities.admin.id);assert.equal(row.details.suspended,false);});
 const forbidden=await admin.request('/api/platform/view-as',{method:'POST',headers:{origin:c.appUrl,'Content-Type':'application/json'},body:JSON.stringify({action:'start',userId:c.identities.admin.id,reason:'Reject another privileged identity in local regression.',confirmation:'LOG IN AS'})});assert.equal(forbidden.status,403);
 const mapping=await db.schoolIdentifierType.findFirstOrThrow({where:{verification:'EMAIL_LOCAL_PART',emailDomain:'virginia.edu'}});
 const prefix='leader'+randomUUID().replaceAll('-','').slice(0,10);
 const clubInput={organization:{requestId:randomUUID(),identifierTypeId:mapping.id,organizationName:'Admin disposable '+prefix,presidentName:'Invited Leader',presidentIdentifier:prefix,presidentYear:'2030',reason:'Create an isolated organization onboarding regression fixture.'},leaderEmail:prefix+'@virginia.edu',description:'Disposable organization created through the full Admin action.',category:'Academic',organizationInfo:'Local test only',additionalLeaders:[]};
 const createdClub=await admin.action('actions/admin-workspace.ts','createAdminClub',[clubInput]);assert.equal(createdClub.ok,true);
 const clubId=createdClub.organization.id;
 const oldOwner=await db.clubInvitation.findFirstOrThrow({where:{clubId,requestedRole:'OWNER',status:'PENDING'}});
 // A bad replacement must roll back revocation, audit and recipient creation together.
 await assert.rejects(admin.action('actions/admin-workspace.ts','changeAdminDesignatedLeader',[{clubId,invitationId:oldOwner.id,identifierTypeId:'missing-type',identifier:prefix+'new',name:'Replacement Leader',reason:'Verify atomic pending leader replacement in isolation.'}]));
 assert.equal((await db.clubInvitation.findUnique({where:{id:oldOwner.id}})).status,'PENDING');
 const replacement=await admin.action('actions/admin-workspace.ts','changeAdminDesignatedLeader',[{clubId,invitationId:oldOwner.id,identifierTypeId:mapping.id,identifier:prefix+'new',name:'Replacement Leader',reason:'Replace the isolated unclaimed club owner designation.'}]);
 assert.equal((await db.clubInvitation.findUnique({where:{id:oldOwner.id}})).status,'REVOKED');assert.equal((await db.clubInvitation.findUnique({where:{id:replacement.id}})).requestedRole,'OWNER');
 assert.equal(await db.clubMember.count({where:{clubId}}),0,'Admin does not receive club membership.');
 assert.ok(await db.auditLog.findFirst({where:{clubId,action:'platform.club.leader.change',actorId:c.identities.admin.id}}));
 const email='invited'+randomUUID().replaceAll('-','').slice(0,10)+'@virginia.edu';
 const invited=await admin.action('actions/admin-workspace.ts','createAdminStudent',[{email,firstName:'Invited',lastName:'Student',major:'Economics',gradYear:2030,clubId,reason:'Create a disposable student invitation regression fixture.'}]);assert.equal(invited.status,'INVITED');assert.ok(await db.clubInvitation.findFirst({where:{clubId,email,requestedRole:'MEMBER',status:'PENDING'}}));
 let message;
 for(let n=0;n<10;n++){const list=await(await fetch('http://127.0.0.1:55324/api/v1/messages?limit=100')).json();const m=list.messages.find(m=>m.To.some(to=>to.Address===email));if(m){message=await(await fetch('http://127.0.0.1:55324/api/v1/message/'+m.ID)).json();break;}await new Promise(r=>setTimeout(r,100));}
 assert.ok(message,'Invitation was delivered only to the disposable mail sink.');
 const tokenHash=message.Text.match(/token_hash=([a-f0-9]{56,64})/)?.[1];assert.ok(tokenHash);
 const wrong=new Actor(c),claim=new Actor(c),password='Local-claimed-student!'+randomUUID();
 const claimRequest=(actor,address)=>actor.request('/api/auth/student-claim',{method:'POST',headers:{origin:c.appUrl,'Content-Type':'application/json'},body:JSON.stringify({email:address,tokenHash,password})});
 // Existing wrong-account session is rejected before consuming the intended invitation.
 await wrong.signIn(c.identities.student.email,c.identities.student.password);assert.equal((await claimRequest(wrong,email)).status,400);
 assert.equal((await claimRequest(new Actor(c),'wrong'+randomUUID().replaceAll('-','').slice(0,10)+'@virginia.edu')).status,400);
 const accepted=await claimRequest(claim,email);assert.equal(accepted.status,200,await accepted.text());assert.equal((await claimRequest(new Actor(c),email)).status,400);
 const authUser=await service.auth.admin.getUserById(invited.id);assert.ok(authUser.data.user.email_confirmed_at);
 const claimLog=await db.auditLog.findFirst({where:{targetId:invited.id,action:'student.invitation.claim'}});assert.equal(claimLog.actorId,invited.id);
 await assert.rejects(admin.action('actions/admin-workspace.ts','resendAdminStudentInvitation',[invited.id,'Do not resend a previously claimed invitation.']));
 const inspected=await admin.action('actions/admin-workspace.ts','inspectAdminStudent',[invited.id,'Verify account claim timestamp in the local regression.']);assert.equal(inspected.invitation.status,'CLAIMED');
 const copy=new Actor(c);copy.cookies=new Map(admin.cookies);const providerSession=(await copy.client.auth.getSession()).data.session;assert.ok(providerSession);assert.equal((await service.auth.admin.signOut(providerSession.access_token,'local')).error,null);await denied(admin);
 const logout=await admin.request('/api/auth/logout',{method:'POST',headers:{origin:c.appUrl}});assert.equal(logout.status,200);
 assert.ok((await db.adminElevation.findUnique({where:{id:elevation.id}})).revokedAt);await denied(admin);
 assert.ok(await db.auditLog.findFirst({where:{actorId:c.identities.admin.id,action:'platform.elevation.logout'}}));
 t.diagnostic('Real password + MFA, HttpOnly elevation, server actions, intended-identity single-use invites, actual/effective support identity and revocation verified on localhost only.');
});
