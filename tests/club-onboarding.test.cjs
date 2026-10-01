const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loader(mocks) {
  const cache = {};
  function load(file) {
    file = path.resolve(file);
    if (cache[file]) return cache[file].exports;
    const mod = { exports: {} }; cache[file] = mod;
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require','module','exports',compiled)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2)+'.ts') : require(name),mod,mod.exports);
    return mod.exports;
  }
  return load;
}
const clubId = '00000000-0000-4000-8000-000000000001';
const inviteId = '00000000-0000-4000-8000-000000000002';
const importId = '00000000-0000-4000-8000-000000000003';

function setup() {
  const state = {
    actorId: 'recipient', verified: true, skipped: false, disabledInviter: false, platformAllowed: true,
    inviter: { userId: 'inviter', isOwner: true, status: 'ACTIVE', permissions: [], accessRole: 'OWNER' },
    recipient: null, identityIds: ['identity'], pending: null, imports: null, ownerCount: 0,
    invitation: { id: inviteId, clubId, schoolId: 'school-uva', schoolIdentityId: 'identity', invitedBy: 'inviter', requestedRole: 'MEMBER', purpose: 'MEMBERSHIP', authoritySource: 'CLUB_MEMBER', permissions: [], status: 'PENDING', expiresAt: new Date(Date.now()+86400000), dismissedAt: null },
    writes: [], audits: [], queries: [],
  };
  const account = () => ({ user: { id: state.actorId, email: state.actorId+'@virginia.edu' }, supabaseUser: { id: state.actorId, email: state.actorId+'@virginia.edu', email_confirmed_at: state.verified ? '2026-10-01' : null, app_metadata: { email_verification_skipped: state.skipped } } });
  const tx = {
    $queryRaw: async () => [],
    user: { findUnique: async () => ({ id: 'inviter', disabledAt: state.disabledInviter ? new Date() : null }), create: () => { throw Error('Fake User creation forbidden'); } },
    club: { findUniqueOrThrow: async () => ({ id: clubId, schoolId: 'school-uva', claimedAt: null }), update: async args => { state.writes.push(['club',args]); } },
    schoolIdentifierType: { findMany: async () => [], findUniqueOrThrow: async () => ({ id: 'computing', schoolId: 'school-uva', normalization: 'TRIM_LOWERCASE', validationRegex: '^[a-z0-9]+$', verification: 'EMAIL_LOCAL_PART', emailDomain: 'virginia.edu', school: { active: true } }) },
    schoolIdentity: { findMany: async ({where}) => { assert.equal(where.userId,state.actorId); return state.identityIds.map(id => ({ id, userId: state.actorId })); }, upsert: async args => { state.queries.push(['identity',args]); return {id:'identity'}; } },
    platformAdmin: { findUnique: async () => ({ active: state.platformAllowed }) },
    clubMember: {
      findUnique: async ({where}) => where.userId_clubId.userId === 'inviter' ? state.inviter : state.recipient,
      count: async () => state.ownerCount,
      upsert: async args => { state.writes.push(['membership',args]); return { id:'membership' }; },
    },
    clubInvitation: {
      findUnique: async () => state.invitation, findUniqueOrThrow: async () => state.invitation,
      findFirst: async () => state.pending,
      findMany: async args => { state.queries.push(['invitations',args]); return args.where.schoolIdentityId.in && (!state.invitation.dismissedAt || args.where.dismissedAt === undefined) ? [state.invitation] : []; },
      create: async args => { state.writes.push(['invitation',args]); return {id:inviteId}; },
      update: async args => { state.writes.push(['invitation-update',args]); Object.assign(state.invitation,args.data); return state.invitation; },
    },
    rosterImport: {
      findUnique: async () => state.imports,
      findUniqueOrThrow: async () => ({ id:importId,clubId }),
      create: async args => { state.writes.push(['import',args]); state.imports={...args.data,id:importId}; return state.imports; },
    },
    auditLog: { create: async args => { state.audits.push(args.data); } },
  };
  const load = loader({
    '@/utils/prisma': { prisma: {...tx,$transaction:fn=>fn(tx)} },
    '@/utils/auth': { requireAuth: async () => account(), requireClubPermission: async (_id,permissions) => {
      assert.deepEqual(permissions,['members.manage']);
      if (!state.recipient?.isOwner && !state.recipient?.permissions.includes('members.manage')) throw Error('Roster access denied');
      return account();
    } },
    '@/utils/platform-admin': { requirePlatformAdmin: async () => { if (!state.platformAllowed) throw Error('Platform denied'); return {id:'inviter'}; } },
  });
  return {state,tx,load,api:load('actions/club-onboarding.ts')};
}

test('membership roles cannot appoint owners through global role or ordinary admin capabilities', () => {
  const {load}=setup(), rules=load('lib/club-onboarding.ts');
  assert.equal(rules.canGrantOnboardingRole({role:'CLUB_ADMIN',permissions:[]},'OWNER'),false);
  assert.equal(rules.canGrantOnboardingRole({permissions:rules.onboardingRolePermissions.ADMIN,isOwner:false},'OWNER'),false);
  assert.equal(rules.canGrantOnboardingRole({isOwner:true,status:'LEFT'},'OWNER'),false);
  assert.equal(rules.canGrantOnboardingRole({permissions:[]},'MEMBER'),false);
  assert.equal(rules.canGrantOnboardingRole({permissions:['members.manage']},'MEMBER'),true);
});

test('inactive memberships confer neither capabilities nor private meeting visibility', () => {
  const {load}=setup(),permissions=load('lib/permissions.ts'),meetings=load('lib/meetings.ts');
  for (const status of ['LEFT','SUSPENDED']) {
    const member={isOwner:true,permissions:['members.manage'],status};
    assert.equal(permissions.hasWorkspace(member),false);
    assert.equal(permissions.hasPermission(member,'members.manage'),false);
    assert.equal(meetings.canReadMeeting({audience:'MEMBERS',isPublic:false},member),false);
  }
});

test('identity invitation creation normalizes identifiers without creating recipient accounts', async () => {
  const h=setup(); h.state.actorId='inviter';
  await h.api.createClubIdentityInvitation({clubId,identifierTypeId:'computing',identifier:' AbC123 ',invitedName:'Student Name',invitedYear:'2028'});
  const data=h.state.writes.find(([kind])=>kind==='invitation')[1].data;
  assert.equal(data.schoolIdentityId,'identity'); assert.equal(data.schoolId,'school-uva');
  assert.equal(data.email,'abc123@virginia.edu'); assert.equal(data.requestedRole,'MEMBER');
  assert.deepEqual(data.permissions,[]); assert.equal(data.invitedBy,'inviter');
  assert.equal(h.state.queries.find(([kind])=>kind==='identity')[1].create.userId,undefined);
  assert.equal(h.state.audits[0].action,'club.identity-invite.create');
});

test('ordinary members cannot invite owners; platform designations require platform authorization', async () => {
  const h=setup();h.state.actorId='inviter';h.state.inviter={isOwner:false,permissions:['members.manage'],status:'ACTIVE'};
  await assert.rejects(h.api.createClubIdentityInvitation({clubId,identifierTypeId:'computing',identifier:'abc',requestedRole:'OWNER'}),/cannot grant/);
  assert.equal(h.state.writes.length,0);
  h.state.platformAllowed=false;
  await assert.rejects(h.api.createClubIdentityInvitation({clubId,identifierTypeId:'computing',identifier:'abc',requestedRole:'OWNER',platformDesignation:true}),/Platform denied/);
});

test('pending imports cannot silently upgrade a pending invitation', async () => {
  const h=setup();h.state.actorId='inviter';h.state.pending={id:inviteId,requestedRole:'MEMBER',authoritySource:'CLUB_MEMBER'};
  assert.deepEqual(await h.api.createClubIdentityInvitation({clubId,identifierTypeId:'computing',identifier:'abc'}),{id:inviteId,reused:true});
  await assert.rejects(h.api.createClubIdentityInvitation({clubId,identifierTypeId:'computing',identifier:'abc',requestedRole:'ADMIN'}),/different invitation/);
  assert.equal(h.state.writes.length,0);
});

test('wrong, unverified, and verification-skipped identities cannot accept invitations', async () => {
  for (const modify of [s=>{s.identityIds=['other-identity'];},s=>{s.verified=false;},s=>{s.skipped=true;}]) {
    const h=setup();modify(h.state);
    await assert.rejects(h.api.acceptIdentityClubInvitation(inviteId),/unavailable|Verify/);
    assert.equal(h.state.writes.length,0);
  }
});

test('acceptance preserves existing access and records recipient and membership attribution', async () => {
  const h=setup();h.state.recipient={isOwner:false,status:'ACTIVE',permissions:['tasks.manage'],accessRole:'ADMIN'};
  await h.api.acceptIdentityClubInvitation(inviteId);
  const membership=h.state.writes.find(([kind])=>kind==='membership')[1];
  assert.deepEqual(membership.update.permissions,['tasks.manage']);assert.equal(membership.update.accessRole,'ADMIN');
  assert.equal(h.state.invitation.claimedUserId,'recipient');assert.equal(h.state.invitation.status,'ACCEPTED');
  assert.equal(h.state.audits.at(-1).details.membershipId,'membership');
});

test('revoked inviter authority and inactive memberships prevent acceptance', async () => {
  for (const modify of [s=>{s.inviter={isOwner:false,permissions:[],status:'ACTIVE'};},s=>{s.disabledInviter=true;},s=>{s.recipient={isOwner:false,permissions:[],accessRole:'MEMBER',status:'LEFT'};}]) {
    const h=setup();modify(h.state);
    await assert.rejects(h.api.acceptIdentityClubInvitation(inviteId),/no longer|unavailable|inactive/);
    assert.equal(h.state.writes.length,0);
  }
});

test('platform owner invitations recheck allowlist and cannot replace another owner', async () => {
  const saved=process.env.OUTCLASS_PLATFORM_ADMIN_IDS;
  try {
    const h=setup();h.state.invitation.authoritySource='PLATFORM_ADMIN';h.state.invitation.requestedRole='OWNER';
    process.env.OUTCLASS_PLATFORM_ADMIN_IDS='';
    await assert.rejects(h.api.acceptIdentityClubInvitation(inviteId),/revoked/);
    process.env.OUTCLASS_PLATFORM_ADMIN_IDS='inviter';h.state.ownerCount=1;
    await assert.rejects(h.api.acceptIdentityClubInvitation(inviteId),/already has an owner/);
    h.state.ownerCount=0;await h.api.acceptIdentityClubInvitation(inviteId);
    assert.equal(h.state.writes.find(([kind])=>kind==='membership')[1].create.isOwner,true);
  } finally {if(saved===undefined)delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS;else process.env.OUTCLASS_PLATFORM_ADMIN_IDS=saved;}
});

test('dismissal stays pending, disappears from dashboard, remains in settings, and restores', async () => {
  const h=setup();await h.api.setOrganizationInvitationDismissed(inviteId,true);
  assert.equal(h.state.invitation.status,'PENDING');
  assert.deepEqual(await h.api.getOrganizationInvitations(),[]);
  assert.equal((await h.api.getOrganizationInvitations(true)).length,1);
  await h.api.setOrganizationInvitationDismissed(inviteId,false);
  assert.equal((await h.api.getOrganizationInvitations()).length,1);
  assert.equal(h.state.writes.some(([kind])=>kind==='membership'),false);
  assert.deepEqual(h.state.audits.map(a=>a.action),['club.invite.dismiss','club.invite.restore']);
});

test('roster audit guards uploads and records every raw input row idempotently', async () => {
  const h=setup(),input={clubId,filename:'roster.csv',idempotencyKey:'upload-1',rows:[{name:'Name',year:'2028',computing_id:'abc'},{computing_id:'bad input'}]};
  await assert.rejects(h.api.recordRosterImport(input),/denied/);
  h.state.recipient={isOwner:false,status:'ACTIVE',permissions:['members.manage']};
  await h.api.recordRosterImport(input);
  const record=h.state.writes.find(([kind])=>kind==='import')[1].data;
  assert.equal(record.uploadedById,'recipient');assert.equal(record.rowCount,2);
  assert.deepEqual(record.rows.create.map(row=>row.input),input.rows);
  assert.equal(h.state.writes.some(([kind])=>kind==='membership'||kind==='invitation'),false);
  assert.deepEqual(await h.api.recordRosterImport(input),{id:importId,reused:true});
  await assert.rejects(h.api.recordRosterImport({...input,rows:[]}),/another upload/);
});

test('verified identity binding never moves a university identifier between accounts', async () => {
  const h=setup();
  h.tx.schoolIdentifierType.findMany=async()=>[{id:'computing',schoolId:'school-uva',normalization:'TRIM_LOWERCASE',validationRegex:'^[a-z0-9]+$'}];
  h.tx.schoolIdentity.findUniqueOrThrow=async()=>({id:'identity',userId:'someone-else'});
  const helper=h.load('utils/school-identity.ts');
  await assert.rejects(helper.verifiedSchoolIdentities(h.tx,{user:{id:'recipient',email:'recipient@virginia.edu'},supabaseUser:{id:'recipient',email:'recipient@virginia.edu',email_confirmed_at:'2026-10-01'}}),/manual review/);
  assert.equal(h.state.writes.length,0);
});

test('first login binds the normalized provider identity and discovers invitations without a recipient User insert', async () => {
  const h=setup();let bound=false;
  h.tx.schoolIdentifierType.findMany=async ({where})=>{assert.equal(where.emailDomain,'virginia.edu');return[{id:'computing',schoolId:'school-uva',normalization:'TRIM_LOWERCASE',validationRegex:'^[a-z0-9]+$'}];};
  h.tx.schoolIdentity.findUniqueOrThrow=async()=>({id:'identity',userId:bound?'recipient':null});
  h.tx.schoolIdentity.update=async({data})=>{assert.equal(data.userId,'recipient');assert.ok(data.verifiedAt instanceof Date);bound=true;};
  const invitations=await h.api.getOrganizationInvitations();
  assert.equal(bound,true);assert.equal(invitations.length,1);
  assert.equal(h.state.queries.find(([kind])=>kind==='identity')[1].create.normalizedIdentifier,'recipient');
  assert.equal(h.state.audits[0].action,'school.identity.verify');
});

test('expired, revoked, declined, or previously claimed invitations cannot be replayed',async()=>{
  for(const status of ['EXPIRED','REVOKED','DECLINED','ACCEPTED']) {
    const h=setup();h.state.invitation.status=status;
    await assert.rejects(h.api.acceptIdentityClubInvitation(inviteId),/unavailable/);
    assert.equal(h.state.writes.length,0);
  }
  const h=setup();h.state.invitation.expiresAt=new Date(Date.now()-1);
  await assert.rejects(h.api.acceptIdentityClubInvitation(inviteId),/expired/);
  assert.equal(h.state.writes.length,0);
});

test('ownership claiming upgrades an existing member once and records claim timestamps',async()=>{
  const h=setup();h.state.invitation.requestedRole='OWNER';h.state.invitation.purpose='OWNER_DESIGNATION';
  h.state.recipient={id:'existing',isOwner:false,status:'ACTIVE',accessRole:'MEMBER',permissions:['tasks.manage']};
  assert.deepEqual(await h.api.acceptIdentityClubInvitation(inviteId),{clubId});
  const membership=h.state.writes.find(([kind])=>kind==='membership')[1];
  assert.equal(membership.update.accessRole,'OWNER');assert.equal(membership.update.isOwner,true);
  assert.equal(h.state.invitation.claimedUserId,'recipient');assert.ok(h.state.invitation.claimedAt instanceof Date);
  assert.ok(h.state.writes.some(([kind])=>kind==='club'));
  await assert.rejects(h.api.acceptIdentityClubInvitation(inviteId),/unavailable/);
  assert.equal(h.state.writes.filter(([kind])=>kind==='membership').length,1);
});

test('concurrent claiming attempts revalidate after the organization transaction lock; only one succeeds',async()=>{
  const h=setup();h.state.invitation.requestedRole='OWNER';
  // Model the database transaction lock with a queue, including two concurrent callers.
  let tail=Promise.resolve();
  const prisma={...h.tx,$transaction:fn=>{const result=tail.then(()=>fn(h.tx));tail=result.catch(()=>{});return result;}};
  const load=loader({'@/utils/prisma':{prisma},'@/utils/auth':{requireAuth:async()=>({user:{id:'recipient',email:'recipient@virginia.edu'},supabaseUser:{id:'recipient',email:'recipient@virginia.edu',email_confirmed_at:'2026-10-01'}})},'@/utils/platform-admin':{}});
  const api=load('actions/club-onboarding.ts');
  const results=await Promise.allSettled([api.acceptIdentityClubInvitation(inviteId),api.acceptIdentityClubInvitation(inviteId)]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.filter(result=>result.status==='rejected').length,1);
  assert.equal(h.state.writes.filter(([kind])=>kind==='membership').length,1);
  assert.equal(h.state.audits.filter(audit=>audit.action==='club.invite.accept').length,1);
});
