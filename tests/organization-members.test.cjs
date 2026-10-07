const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const clubId='00000000-0000-4000-8000-000000000001',otherClub='00000000-0000-4000-8000-000000000002',memberId='00000000-0000-4000-8000-000000000003',actorId='00000000-0000-4000-8000-000000000004',inviteId='00000000-0000-4000-8000-000000000005';
function load(file,mocks={}){
 mocks={"next/server":{after:()=>{}},...mocks};const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(n=>n in mocks?mocks[n]:n.startsWith('@/')?load(n.slice(2)+'.ts',mocks):require(n),mod,mod.exports);return mod.exports;
}
const rules=load('lib/organization-authorization.ts');
const member=(id,role='MEMBER')=>({id,userId:id,clubId,accessRole:role,isOwner:role==='OWNER',permissions:[...rules.organizationRolePermissions[role]],status:'ACTIVE',user:{disabledAt:null,email:id+'@virginia.edu'}});
function harness(actorRole='OWNER',targetRole='MEMBER'){
 const state={members:[member(actorId,actorRole),member(memberId,targetRole)],invitation:{id:inviteId,clubId,status:'PENDING',requestedRole:'MEMBER',permissions:[],expiresAt:new Date(Date.now()+86400000),email:'member@virginia.edu'},deliveries:[],audits:[],reads:[],locks:0,failAudit:false};
 const tx={
  $queryRaw:async()=>{state.locks++;return [];},
  club:{findUnique:async()=>({invitationEmailEnabled:true}),findUniqueOrThrow:async()=>({schoolId:'school-uva'})},
  schoolIdentifierType:{findMany:async args=>{state.reads.push(args);return[];}},
  user:{findUnique:async()=>({disabledAt:null}),findUniqueOrThrow:async({where})=>state.members.find(m=>m.userId===where.id).user},
  clubMember:{
   findUnique:async({where})=>state.members.find(m=>m.clubId===where.userId_clubId.clubId&&m.userId===where.userId_clubId.userId)||null,
   findFirst:async({where})=>state.members.find(m=>m.id===where.id&&m.clubId===where.clubId&&(!where.status||m.status===where.status)&&(!where.user||!m.user.disabledAt))||null,
   findMany:async args=>{state.reads.push(args);return state.members.filter(m=>m.clubId===args.where.clubId);},
   count:async args=>{assert.equal(args.where.status,'ACTIVE');assert.deepEqual(args.where.user,{disabledAt:null});return state.members.filter(m=>m.clubId===args.where.clubId&&m.id!==args.where.id.not&&m.isOwner&&m.status==='ACTIVE'&&!m.user.disabledAt).length;},
   update:async({where,data})=>Object.assign(state.members.find(m=>m.id===where.id),data),
  },
  clubInvitation:{
   findFirst:async({where})=>state.invitation.id===where.id&&state.invitation.clubId===where.clubId?state.invitation:null,
   findMany:async args=>{state.reads.push(args);return[state.invitation];},
   update:async({where,data})=>{assert.equal(where.id,inviteId);Object.assign(state.invitation,data);},
   updateMany:async({where,data})=>{assert.equal(where.clubId,clubId);assert.equal(where.status,'PENDING');Object.assign(state.invitation,data);},
  },
  invitationDelivery:{findUnique:async({where})=>state.deliveries.find(d=>d.idempotencyKey===where.idempotencyKey)||null,count:async()=>state.deliveries.length,findFirst:async({where})=>state.deliveries.find(d=>d.invitationId===where.invitationId&&(!where.status||(where.status.in?where.status.in.includes(d.status):d.status!==where.status.not))&&(!where.createdAt||d.createdAt>where.createdAt.gt))||null,create:async({data})=>state.deliveries.push({...data,status:'QUEUED',createdAt:new Date()}),updateMany:async()=>{}},
  auditLog:{create:async({data})=>{if(state.failAudit)throw Error('Audit failure');state.audits.push(data);}},
 };
 let tail=Promise.resolve();const prisma={$transaction:fn=>{const result=tail.then(async()=>{const snapshot=structuredClone(state);try{return await fn(tx);}catch(e){Object.assign(state,snapshot);throw e;}});tail=result.catch(()=>{});return result;}};
 let manual;
 const api=load('actions/organization-members.ts',{'@/utils/auth':{requireAuth:async()=>({user:{id:actorId}})},'@/utils/prisma':{prisma},'@/utils/email':{invitationEmailConfig:()=>{}},'@/actions/club-onboarding':{createClubIdentityInvitation:async input=>{manual=input;return{id:inviteId};}}});
 return{state,api,manual:()=>manual};
}

test('centralized capabilities ignore global/legacy roles and reject inactive authority',()=>{
 for(const role of ['OWNER','ADMIN','PRESIDENT','CLUB_ADMIN'])assert.equal(rules.organizationCapabilities({role}).canManageMembers,false);
 for(const status of ['LEFT','SUSPENDED'])assert.ok(Object.values(rules.organizationCapabilities({...member(actorId,'OWNER'),status})).every(value=>!value));
 assert.equal(rules.organizationCapabilities(member(actorId,'ADMIN')).canTransferOwnership,false);
 assert.equal(rules.organizationCapabilities(member(actorId,'RECRUITING_ADMIN')).canManageRecruiting,true);
});

test('ordinary members and recruiters cannot read or modify the directory or upload authority',async()=>{
 for(const role of ['MEMBER','INTERVIEWER','RECRUITING_ADMIN']){
  const h=harness(role);await assert.rejects(h.api.getOrganizationMemberManagement(clubId),/denied/);
  await assert.rejects(h.api.changeOrganizationMemberRole({clubId,memberId,role:'ADMIN'}),/denied/);
  await assert.rejects(h.api.removeOrganizationMember({clubId,memberId}),/denied/);assert.equal(h.state.audits.length,0);
 }
});

test('directory reads are organization-scoped and include only brief profiles and delivery status',async()=>{
 const h=harness();await h.api.getOrganizationMemberManagement(clubId);
 for(const query of h.state.reads.filter(q=>q.where.clubId))assert.equal(query.where.clubId,clubId);
 const memberRead=h.state.reads.find(q=>q.include?.user);assert.deepEqual(Object.keys(memberRead.include.user.select.studentProfile.select).sort(),['firstName','gradYear','lastName','major']);
 const invitationRead=h.state.reads.find(q=>q.select?.deliveries);assert.deepEqual(Object.keys(invitationRead.select.deliveries.select).sort(),['createdAt','failureCode','status']);
 await assert.rejects(h.api.getOrganizationMemberManagement(otherClub),/denied/);
});

test('admins can grant ordinary roles but cannot grant ownership or edit/remove an owner',async()=>{
 const h=harness('ADMIN');await h.api.changeOrganizationMemberRole({clubId,memberId,role:'RECRUITING_ADMIN'});
 assert.equal(h.state.members[1].accessRole,'RECRUITING_ADMIN');assert.deepEqual(h.state.members[1].permissions,rules.organizationRolePermissions.RECRUITING_ADMIN);
 await assert.rejects(h.api.changeOrganizationMemberRole({clubId,memberId,role:'OWNER'}),/cannot change/);
 const owner=harness('ADMIN','OWNER');await assert.rejects(owner.api.changeOrganizationMemberRole({clubId,memberId,role:'MEMBER'}),/cannot change/);await assert.rejects(owner.api.removeOrganizationMember({clubId,memberId}),/cannot remove/);
 await assert.rejects(owner.api.transferOrganizationOwnership({clubId,memberId,confirm:true}),/Transfer requires/);
});

test('custom managers cannot grant or strip capabilities above their authority',async()=>{
 const h=harness('MEMBER');h.state.members[0].permissions=['leaders.manage','members.manage'];
 await assert.rejects(h.api.changeOrganizationMemberRole({clubId,memberId,role:'INTERVIEWER'}),/cannot change/);
 h.state.members[1].permissions=['applications.review'];await assert.rejects(h.api.removeOrganizationMember({clubId,memberId}),/cannot remove/);
 assert.equal(rules.canManageOrganizationInvitation(h.state.members[0],{requestedRole:'MEMBER',permissions:['club.settings']}),false);
});

test('role changes validate IDs, scope targets, reject disabled/inactive accounts, and revoke stale pending grants',async()=>{
 const h=harness();await assert.rejects(h.api.changeOrganizationMemberRole({clubId:otherClub,memberId,role:'MEMBER'}),/denied/);
 await assert.rejects(h.api.changeOrganizationMemberRole({clubId,memberId:'bad',role:'MEMBER'}));
 await assert.rejects(h.api.changeOrganizationMemberRole({clubId,memberId,role:'MEMBER',permissions:['club.settings']}));
 h.state.members[1].status='LEFT';await assert.rejects(h.api.changeOrganizationMemberRole({clubId,memberId,role:'ADMIN'}),/cannot change/);
 h.state.members[1].status='ACTIVE';h.state.members[1].user.disabledAt=new Date();await assert.rejects(h.api.changeOrganizationMemberRole({clubId,memberId,role:'OWNER'}),/active account/);
 h.state.members[1].user.disabledAt=null;await h.api.changeOrganizationMemberRole({clubId,memberId,role:'OWNER'});
 assert.equal(h.state.members[1].isOwner,true);assert.equal(h.state.invitation.status,'REVOKED');assert.equal(h.state.audits[0].details.after.role,'OWNER');
});

test('removal preserves the membership row/history and clears every capability',async()=>{
 const h=harness('OWNER','ADMIN');await h.api.removeOrganizationMember({clubId,memberId});
 assert.equal(h.state.members.length,2);assert.equal(h.state.members[1].status,'LEFT');assert.deepEqual(h.state.members[1].permissions,[]);assert.equal(h.state.members[1].isOwner,false);assert.equal(h.state.invitation.status,'REVOKED');
});

test('last active owner cannot be removed or demoted; disabled owners do not count',async()=>{
 const h=harness();await assert.rejects(h.api.removeOrganizationMember({clubId,memberId:actorId}),/last owner/);
 await assert.rejects(h.api.changeOrganizationMemberRole({clubId,memberId:actorId,role:'ADMIN'}),/last owner/);
 h.state.members[1]=member(memberId,'OWNER');h.state.members[1].user.disabledAt=new Date();await assert.rejects(h.api.removeOrganizationMember({clubId,memberId:actorId}),/last owner/);
});

test('concurrent owner demotions serialize and leave one owner',async()=>{
 const h=harness('OWNER','OWNER');
 const results=await Promise.allSettled([h.api.changeOrganizationMemberRole({clubId,memberId,role:'MEMBER'}),h.api.changeOrganizationMemberRole({clubId,memberId:actorId,role:'ADMIN'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(h.state.members.filter(m=>m.isOwner&&m.status==='ACTIVE').length,1);
});

test('intentional ownership transfer grants first, demotes the actor to ADMIN, preserves other owners, and blocks replay',async()=>{
 const h=harness();h.state.members.push(member('other-owner','OWNER'));
 await assert.rejects(h.api.transferOrganizationOwnership({clubId,memberId,confirm:false}));
 await h.api.transferOrganizationOwnership({clubId,memberId,confirm:true});assert.equal(h.state.members[0].accessRole,'ADMIN');assert.equal(h.state.members[1].accessRole,'OWNER');assert.equal(h.state.members[2].isOwner,true);
 await assert.rejects(h.api.transferOrganizationOwnership({clubId,memberId,confirm:true}),/Transfer requires/);
 assert.equal(h.state.audits[0].action,'club.owner.transfer');
});

test('audit failure rolls back ownership transfer and removal',async()=>{
 for(const operation of ['transferOrganizationOwnership','removeOrganizationMember']){const h=harness();h.state.failAudit=true;await assert.rejects(h.api[operation]({clubId,memberId,...(operation.startsWith('transfer')?{confirm:true}:{})}),/Audit failure/);assert.equal(h.state.members[0].isOwner,true);assert.equal(h.state.members[1].status,'ACTIVE');assert.equal(h.state.members[1].isOwner,false);}
});

test('manual member creation delegates to identity invitations and rejects role/authority injection',async()=>{
 const h=harness();const input={clubId,identifierTypeId:'computing',identifier:' JMS8XY ',invitedName:'John Smith',invitedYear:'2027',requestedRole:'MEMBER'};
 await h.api.inviteOrganizationMember(input);assert.deepEqual(h.manual(),input);
 for(const extra of [{platformDesignation:true},{permissions:['leaders.manage']},{requestedRole:'SUPERADMIN'},{invitedYear:'2099'}])await assert.rejects(h.api.inviteOrganizationMember({...input,...extra}));
});

test('resend queues once under repeated/concurrent clicks and never claims email was sent',async()=>{
 const h=harness();const input={clubId,invitationId:inviteId,action:'RESEND'};
 const results=await Promise.all([h.api.manageOrganizationInvitation(input),h.api.manageOrganizationInvitation(input)]);
 assert.equal(h.state.deliveries.length,1);assert.ok(results.every(r=>r.queued||r.reused));assert.equal(h.state.deliveries[0].status,'QUEUED');assert.equal(h.state.audits.length,1);
 h.state.deliveries[0].status='SENT';await assert.rejects(h.api.manageOrganizationInvitation(input),/Wait 15 minutes/);
});

test('revoke and resend enforce invitation scope, state, expiry, role and capability boundaries',async()=>{
 for(const action of ['REVOKE','RESEND']){
  const input={clubId,invitationId:inviteId,action};const admin=harness('ADMIN');admin.state.invitation.requestedRole='OWNER';await assert.rejects(admin.api.manageOrganizationInvitation(input),/above your authority/);
  const h=harness();h.state.invitation.clubId=otherClub;await assert.rejects(h.api.manageOrganizationInvitation(input),/unavailable/);
  for(const status of ['ACCEPTED','DECLINED','REVOKED','EXPIRED']){h.state.invitation.clubId=clubId;h.state.invitation.status=status;await assert.rejects(h.api.manageOrganizationInvitation(input),/unavailable/);}
 }
 const h=harness();h.state.invitation.expiresAt=new Date(0);await assert.rejects(h.api.manageOrganizationInvitation({clubId,invitationId:inviteId,action:'RESEND'}),/unavailable/);
 await h.api.manageOrganizationInvitation({clubId,invitationId:inviteId,action:'REVOKE'});assert.equal(h.state.invitation.status,'REVOKED');assert.ok(h.state.invitation.revokedAt instanceof Date);
});


test('an enabled owner can remove a disabled owner when another enabled owner remains',async()=>{
  const h=harness('OWNER','OWNER');h.state.members[1].user.disabledAt=new Date();await h.api.removeOrganizationMember({clubId,memberId});assert.equal(h.state.members[1].status,'LEFT');assert.equal(h.state.members[0].isOwner,true);
});

test('bulk selection protects all owners together, rejects stale versions and escalation, and updates granted capabilities atomically',async()=>{
 const targetId=memberId,otherId=require('node:crypto').randomUUID();const a=member(actorId,'OWNER'),b=member(targetId,'OWNER');
 // Add real bulk-model semantics to this fixture through a separate action harness.
 const state={members:[a,b,member(otherId,'MEMBER')],audits:[]};for(const m of state.members)m.updatedAt=new Date('2026-10-05T12:00:00Z');
 let actor=actorId,writes=0;const tx={$queryRaw:async()=>[],user:{findUnique:async()=>({disabledAt:null})},clubMember:{findUnique:async()=>state.members.find(m=>m.userId===actor),findMany:async({where})=>state.members.filter(m=>where.id.in.includes(m.id)),count:async({where})=>state.members.filter(m=>m.isOwner&&m.status==='ACTIVE'&&!where.id.notIn.includes(m.id)).length,updateMany:async({where,data})=>{writes++;for(const m of state.members.filter(m=>where.id.in.includes(m.id)))Object.assign(m,data);}},invitationDelivery:{updateMany:async()=>{}},clubInvitation:{updateMany:async()=>{}},auditLog:{create:async({data})=>state.audits.push(data)}};
 const api=load('actions/organization-members.ts',{'@/utils/auth':{requireAuth:async()=>({user:{id:actor}})},'@/utils/prisma':{prisma:{$transaction:async fn=>{const before=structuredClone(state);try{return await fn(tx);}catch(e){Object.assign(state,before);throw e;}}}},'@/actions/club-onboarding':{}});
 const targets=ids=>state.members.filter(m=>ids.includes(m.userId)).map(m=>({id:m.id,updatedAt:m.updatedAt}));
 await assert.rejects(api.bulkOrganizationMembers({clubId,targets:targets([actorId,targetId]),action:'REMOVE'}),/active owner/);assert.equal(writes,0);
 const stale=targets([otherId]);stale[0].updatedAt=new Date(0);await assert.rejects(api.bulkOrganizationMembers({clubId,targets:stale,action:'ROLE',role:'ADMIN'}),/changed/);assert.equal(writes,0);
 await api.bulkOrganizationMembers({clubId,targets:targets([otherId]),action:'ROLE',role:'ADMIN'});assert.equal(writes,1);assert.ok(state.members[2].permissions.includes('application.manage'));
 actor=otherId;await assert.rejects(api.bulkOrganizationMembers({clubId,targets:targets([targetId]),action:'ROLE',role:'MEMBER'}),/cannot grant/);
 actor=actorId;await api.bulkOrganizationMembers({clubId,targets:targets([otherId]),action:'PERMISSIONS',permissions:['applications.review']});assert.deepEqual(state.members[2].permissions,['applications.review']);assert.equal(state.audits.length,2);
});
