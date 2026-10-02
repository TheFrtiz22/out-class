// Opt-in, real multi-connection PostgreSQL regression suite. Never uses application DATABASE_URL.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {randomUUID}=require('node:crypto');
const databaseUrl=process.env.OUTCLASS_SECURITY_TEST_DATABASE_URL;

test('native PostgreSQL: concurrent claims, duplicate imports, email delivery, and owner suspensions', {skip:!databaseUrl,timeout:120000},async t=>{
 const url=new URL(databaseUrl);
 assert.ok(['127.0.0.1','localhost'].includes(url.hostname)&&url.pathname==='/outclass_security_test','Only an isolated local outclass_security_test database is allowed');
 const {PrismaClient}=require('@prisma/client');const prisma=new PrismaClient({datasourceUrl:databaseUrl});t.after(()=>prisma.$disconnect());
 const saved=process.env.OUTCLASS_PLATFORM_ADMIN_IDS;const platform=randomUUID();process.env.OUTCLASS_PLATFORM_ADMIN_IDS=platform;
 t.after(()=>{if(saved===undefined)delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS;else process.env.OUTCLASS_PLATFORM_ADMIN_IDS=saved;});
 const createUser=async prefix=>prisma.user.create({data:{id:randomUUID(),email:`${prefix}${randomUUID().replaceAll('-','').slice(0,8)}@virginia.edu`}});
 await prisma.user.create({data:{id:platform,email:`platform${randomUUID()}@virginia.edu`}});await prisma.platformAdmin.create({data:{userId:platform}});
 let account=await createUser('john');let smtp=[];
 const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const mod={exports:{}};cache[file]=mod;
 const authAccount=()=>({user:account,supabaseUser:{id:account.id,email:account.email,confirmation_sent_at: '2026-09-01', email_confirmed_at:'2026-10-02'}});
 const mocks={'@/utils/prisma':{prisma},'@/utils/verified-email-policy':{...load('utils/verified-email-policy.ts'),requireVerifiedEmailPolicy:async()=>{}},'@/utils/auth':{requireAuth:async()=>authAccount(),requireClubPermission:async(clubId,permissions)=>{const membership=await prisma.clubMember.findUnique({where:{userId_clubId:{userId:account.id,clubId}}});if(!membership||membership.status!=='ACTIVE'||(!membership.isOwner&&!permissions.every(p=>membership.permissions.includes(p))))throw Error('Denied');return{...authAccount(),membership};}},'@/utils/email':{invitationEmailConfig:()=>{},sendInvitationEmail:async data=>{smtp.push(data);await new Promise(resolve=>setTimeout(resolve,20));return{messageId:data.deliveryId};}}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/')?load(n.slice(2)+'.ts'):require(n),mod,mod.exports);return mod.exports;}
 const members=load('actions/organization-members.ts');
 const api=load('actions/club-onboarding.ts'),roster=load('actions/roster-import.ts'),mail=load('actions/invitation-emails.ts');
 const club=await prisma.club.create({data:{name:'Security Club',slug:randomUUID(),tagline:'',description:'',color:'#ffffff',category:'Other'}});
 async function invitation(person,clubId,role='OWNER'){
  const identifier=person.email.split('@')[0];const identity=await prisma.schoolIdentity.upsert({where:{schoolId_identifierTypeId_normalizedIdentifier:{schoolId:'school-uva',identifierTypeId:'school-uva-computing-id',normalizedIdentifier:identifier}},create:{schoolId:'school-uva',identifierTypeId:'school-uva-computing-id',identifier,normalizedIdentifier:identifier},update:{}});
  return prisma.clubInvitation.create({data:{clubId,schoolId:'school-uva',schoolIdentityId:identity.id,email:person.email,invitedBy:platform,authoritySource:'PLATFORM_ADMIN',requestedRole:role,purpose:role==='OWNER'?'OWNER_DESIGNATION':'MEMBERSHIP',permissions:[],expiresAt:new Date(Date.now()+86400000)}});
 }
 const ownerInvite=await invitation(account,club.id);
 const accepted=await Promise.allSettled([api.acceptIdentityClubInvitation(ownerInvite.id),api.acceptIdentityClubInvitation(ownerInvite.id)]);
 assert.equal(accepted.filter(x=>x.status==='fulfilled').length,1);assert.equal(await prisma.clubMember.count({where:{clubId:club.id,userId:account.id}}),1);
 const outsider=await createUser('outsider');const ownAccount=account;account=outsider;
 await assert.rejects(api.acceptIdentityClubInvitation(ownerInvite.id));await assert.rejects(roster.previewRosterImport({clubId:club.id,requestId:randomUUID(),filename:'roster.csv',csv:'name,computing_id\nJohn,jms8xy'}),/Denied/);account=ownAccount;
 // Different owner invitations, same unclaimed organization: only one platform claim succeeds.
 const unclaimed=await prisma.club.create({data:{name:'Unclaimed',slug:randomUUID(),tagline:'',description:'',color:'#fff',category:'Other'}});
 const one=await invitation(account,unclaimed.id),two=await invitation(outsider,unclaimed.id);
 const helper=load('utils/club-onboarding.ts');
 const makeAccount=p=>({user:p,supabaseUser:{id:p.id,email:p.email,confirmation_sent_at: '2026-09-01', email_confirmed_at:'2026-10-02'}});
 const claims=await Promise.allSettled([prisma.$transaction(tx=>helper.acceptIdentityInvitationInTransaction(tx,one.id,makeAccount(account))),prisma.$transaction(tx=>helper.acceptIdentityInvitationInTransaction(tx,two.id,makeAccount(outsider)))]);
 assert.equal(claims.filter(x=>x.status==='fulfilled').length,1);assert.equal(await prisma.clubMember.count({where:{clubId:unclaimed.id,isOwner:true}}),1);
 // Direct server action invocation cannot mass-assign recipient, grant, or state.
 const forgedBase={clubId:club.id,identifierTypeId:'school-uva-computing-id',identifier:'victimabc',requestedRole:'MEMBER'};
 for(const extra of [{userId:outsider.id},{organizationId:unclaimed.id},{status:'ACCEPTED'},{permissions:['leaders.manage']}])await assert.rejects(api.createClubIdentityInvitation({...forgedBase,...extra}));
 const administrator=await prisma.clubMember.create({data:{userId:outsider.id,clubId:club.id,accessRole:'ADMIN',permissions:load('lib/club-onboarding.ts').onboardingRolePermissions.ADMIN}});
 account=outsider;
 await assert.rejects(members.changeOrganizationMemberRole({clubId:club.id,memberId:administrator.id,role:'OWNER'}),/cannot change/);
 await assert.rejects(api.createClubIdentityInvitation({...forgedBase,requestedRole:'OWNER'}),/cannot grant/);
 await assert.rejects(members.transferOrganizationOwnership({clubId:club.id,memberId:administrator.id,confirm:true}),/Transfer requires/);
 const foreign=await prisma.club.create({data:{name:'Foreign',slug:randomUUID(),tagline:'',description:'',color:'#fff',category:'Other'}});
 await assert.rejects(members.getOrganizationMemberManagement(foreign.id),/denied/);
 await assert.rejects(members.changeOrganizationMemberRole({clubId:foreign.id,memberId:administrator.id,role:'ADMIN'}),/denied/);
 account=ownAccount;
 const suffix=randomUUID().replaceAll('-','').slice(0,8);const csv='name,year,computing_id\n'+Array.from({length:50},(_,i)=>`Student ${i},2028,sec${suffix}${i}`).join('\n');
 const previews=await Promise.all([roster.previewRosterImport({clubId:club.id,requestId:randomUUID(),filename:'roster.csv',csv}),roster.previewRosterImport({clubId:club.id,requestId:randomUUID(),filename:'roster.csv',csv})]);
 const imports=await Promise.all(previews.map(p=>roster.confirmRosterImport(p.id)));assert.equal(imports.reduce((n,x)=>n+x.created,0),50);assert.equal(imports.reduce((n,x)=>n+x.alreadyInvited,0),50);
 assert.equal(await prisma.clubInvitation.count({where:{clubId:club.id,status:'PENDING',requestedRole:'MEMBER'}}),50);
 const createdImport=previews[imports.findIndex(x=>x.created===50)];
 const batches=await Promise.all([mail.sendRosterInvitations(createdImport.id),mail.sendRosterInvitations(createdImport.id)]);assert.equal(batches.reduce((n,x)=>n+x.queued,0),50);
 await Promise.all([mail.deliverOrganizationInvitations(club.id),mail.deliverOrganizationInvitations(club.id)]);
 assert.ok(smtp.length>0);assert.equal(new Set(smtp.map(x=>x.deliveryId)).size,smtp.length);
 // A legacy invitation cannot restore a removed member's retained access/history.
 const member=await createUser('removed');await prisma.clubMember.create({data:{userId:member.id,clubId:club.id,status:'LEFT'}});
 const legacy=await prisma.clubInvitation.create({data:{clubId:club.id,email:member.email,invitedBy:account.id,permissions:[],expiresAt:new Date(Date.now()+86400000)}});
 account=member;await assert.rejects(load('actions/club-access.ts').acceptClubInvitation(legacy.id),/inactive/);account=ownAccount;
 // Database safeguards, with concurrent independent Prisma connections.
 const coOwner=await createUser('coowner');await prisma.clubMember.create({data:{userId:coOwner.id,clubId:club.id,isOwner:true}});
 const suspensions=await Promise.allSettled([prisma.user.update({where:{id:account.id},data:{disabledAt:new Date()}}),prisma.user.update({where:{id:coOwner.id},data:{disabledAt:new Date()}})]);
 assert.equal(suspensions.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(await prisma.clubMember.count({where:{clubId:club.id,isOwner:true,status:'ACTIVE',user:{disabledAt:null}}}),1);
 const transferClub=await prisma.club.create({data:{name:'Transfer race',slug:randomUUID(),tagline:'',description:'',color:'#fff',category:'Other'}});
 const transferOwner=await createUser('transferowner'),transferTarget=await createUser('transfertarget');
 await prisma.clubMember.create({data:{userId:transferOwner.id,clubId:transferClub.id,isOwner:true}});
 const targetMembership=await prisma.clubMember.create({data:{userId:transferTarget.id,clubId:transferClub.id}});
 account=transferOwner;
 await Promise.allSettled([members.transferOrganizationOwnership({clubId:transferClub.id,memberId:targetMembership.id,confirm:true}),prisma.user.update({where:{id:transferTarget.id},data:{disabledAt:new Date()}})]);
 assert.equal(await prisma.clubMember.count({where:{clubId:transferClub.id,isOwner:true,status:'ACTIVE',user:{disabledAt:null}}}),1);

});
