const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

function loader(mocks = {}) {
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
const actor = '00000000-0000-4000-8000-000000000001';
const input = overrides => ({ requestId: randomUUID(), identifierTypeId:'school-uva-computing-id', organizationName:'Madison Investment Fund',
  presidentName:'John Smith',presidentIdentifier:' JMS8XY ',presidentYear:'2027',reason:'Initial organization onboarding and president invitation.',...overrides });

test('platform onboarding respects the actual allowlist, grant, MFA and impersonation guard', async () => {
  const previous=process.env.OUTCLASS_PLATFORM_ADMIN_IDS;
  let grant=true,aal='aal2',impersonating=false,writes=0;
  try {
    const load=loader({
      '@/utils/auth': {requireAuth:async()=>({user:{id:actor,role:'CLUB_ADMIN'}})},
      '@/utils/prisma': {prisma:{platformAdmin:{findUnique:async()=>({active:grant})},$transaction:async()=>{writes++;throw Error('Unexpected transaction');}}},
      '@/utils/supabase/server': {createClient:async()=>({auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal}})}}})},
      'next/headers': {cookies:async()=>({has:()=>impersonating})},
    });
    const api=load('actions/platform-organization-onboarding.ts');
    for (const mutate of [()=>{process.env.OUTCLASS_PLATFORM_ADMIN_IDS='';},()=>{process.env.OUTCLASS_PLATFORM_ADMIN_IDS=actor;grant=false;},()=>{grant=true;aal='aal1';},()=>{aal='aal2';impersonating=true;}]) {
      mutate();const result=await api.createOrganizationAndInvitePresident(input());
      assert.equal(result.ok,false);assert.match(result.error,/administrator access/);
      await assert.rejects(api.getOrganizationOnboardingSchools());
    }
    assert.equal(writes,0);
  } finally {if(previous===undefined)delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS;else process.env.OUTCLASS_PLATFORM_ADMIN_IDS=previous;}
});

test('organization and owner invitation workflow runs atomically against the complete local SQL stack', async t => {
  const db=new PGlite();t.after(()=>db.close());
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  const root=path.resolve('prisma/migrations');
  for(const name of fs.readdirSync(root).filter(name=>fs.existsSync(path.join(root,name,'migration.sql'))).sort()) {
    await db.exec(fs.readFileSync(path.join(root,name,'migration.sql'),'utf8'));
  }
  await db.query('INSERT INTO "User" (id,email) VALUES ($1,$2)',[actor,'platform@virginia.edu']);
  await db.query('INSERT INTO "PlatformAdmin" ("userId") VALUES ($1)',[actor]);
  const state={allowed:true,failAudit:false,transactions:0};
  const first=async(sql,values=[]) => (await db.query(sql,values)).rows[0] || null;
  async function insert(table,data) {
    const record={id:randomUUID(),...data},columns=Object.keys(record);
    const values=columns.map(column=>column==='permissions' ? `{${record[column].map(value=>`"${value}"`).join(',')}}` : column==='details' ? JSON.stringify(record[column]) : record[column]);
    try {return await first(`INSERT INTO "${table}" (${columns.map(column=>`"${column}"`).join(',')}) VALUES (${columns.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,values);}
    catch(error) {if(error.code==='23505')error.code='P2002';throw error;}
  }
  const configQuery=`SELECT t.*, jsonb_build_object('id',s.id,'key',s.key,'name',s.name,'active',s.active) AS school FROM "SchoolIdentifierType" t JOIN "School" s ON s.id=t."schoolId"`;
  const tx={
    $queryRaw:async(strings,...values)=>db.query(strings.map((text,index)=>text+(index<values.length?`$${index+1}`:'')).join(''),values),
    schoolIdentifierType:{findUnique:async({where})=>first(configQuery+' WHERE t.id=$1',[where.id]),findMany:async()=> (await db.query(configQuery+` WHERE s.active AND t.verification='EMAIL_LOCAL_PART' AND t."emailDomain" IS NOT NULL`)).rows},
    club:{
      findMany:async({where})=>(await db.query('SELECT id,name FROM "Club" WHERE "schoolId"=$1',[where.schoolId])).rows,
      findUnique:async({where})=>first('SELECT id,name FROM "Club" WHERE '+(where.id?'id=$1':'slug=$1'),[where.id||where.slug]),
      findUniqueOrThrow:async({where})=>{const row=await first('SELECT id,name FROM "Club" WHERE id=$1',[where.id]);if(!row)throw Error('Missing club');return row;},
      create:async({data})=>{const row=await insert('Club',data);return{id:row.id,name:row.name};},
    },
    schoolIdentity:{upsert:async({where,create})=>{
      const key=where.schoolId_identifierTypeId_normalizedIdentifier;
      const current=await first('SELECT * FROM "SchoolIdentity" WHERE "schoolId"=$1 AND "identifierTypeId"=$2 AND "normalizedIdentifier"=$3',[key.schoolId,key.identifierTypeId,key.normalizedIdentifier]);
      return current || insert('SchoolIdentity',create);
    }},
    user:{findUnique:async({where})=>first('SELECT * FROM "User" WHERE id=$1',[where.id]),findMany:async({where})=>(await db.query('SELECT * FROM "User" WHERE lower(email)=lower($1) LIMIT 2',[where.email.equals])).rows},
    clubInvitation:{create:async({data})=>insert('ClubInvitation',data),findUniqueOrThrow:async({where})=>{const row=await first('SELECT * FROM "ClubInvitation" WHERE id=$1',[where.id]);if(!row)throw Error('Missing invitation');return row;}},
    auditLog:{
      findFirst:async({where})=>first('SELECT * FROM "AuditLog" WHERE "actorId"=$1 AND action=$2 AND details->>\'requestId\'=$3',[where.actorId,where.action,where.details.equals]),
      create:async({data})=>{if(state.failAudit)throw Error('Audit unavailable');return insert('AuditLog',data);},
    },
  };
  let tail=Promise.resolve();
  const prisma={...tx,$transaction:fn=>{
    const run=tail.then(async()=>{state.transactions++;await db.exec('BEGIN');try{const result=await fn(tx);await db.exec('COMMIT');return result;}catch(error){await db.exec('ROLLBACK');throw error;}});
    tail=run.catch(()=>{});return run;
  }};
  const api=loader({'@/utils/prisma':{prisma},'@/utils/platform-admin':{requirePlatformAdmin:async()=>{if(!state.allowed)throw Error('Denied');return{id:actor};}}})('actions/platform-organization-onboarding.ts');
  let created,request;

  await t.test('unauthorized requests never begin a transaction',async()=>{
    state.allowed=false;const result=await api.createOrganizationAndInvitePresident(input());state.allowed=true;
    assert.equal(result.ok,false);assert.equal(state.transactions,0);
  });
  await t.test('valid creation reserves a normalized university identity without a fake User or membership',async()=>{
    request=input();created=await api.createOrganizationAndInvitePresident(request);
    assert.equal(created.ok,true);assert.equal(created.accountMatch,'NEW');assert.equal(created.invitation.identifier,'jms8xy');assert.equal(created.emailDelivery,'NOT_SENT');
    const club=await first('SELECT * FROM "Club" WHERE id=$1',[created.organization.id]);
    assert.equal(club.schoolId,'school-uva');assert.equal(club.claimedAt,null);
    const invite=await first('SELECT * FROM "ClubInvitation" WHERE id=$1',[created.invitation.id]);
    assert.equal(invite.requestedRole,'OWNER');assert.equal(invite.status,'PENDING');assert.equal(invite.invitedBy,actor);
    assert.equal(invite.invitedName,'John Smith');assert.equal(invite.invitedYear,'2027');assert.equal(invite.claimedUserId,null);
    const identity=await first('SELECT * FROM "SchoolIdentity" WHERE id=$1',[invite.schoolIdentityId]);
    assert.equal(identity.normalizedIdentifier,'jms8xy');assert.equal(identity.userId,null);
    assert.equal((await first('SELECT count(*)::int AS n FROM "User"')).n,1);
    assert.equal((await first('SELECT count(*)::int AS n FROM "ClubMember"')).n,0);
    assert.equal((await first('SELECT count(*)::int AS n FROM "InvitationDelivery"')).n,0);
  });
  await t.test('duplicate normalized organization names are rejected, including alternate capitalization and spacing',async()=>{
    const result=await api.createOrganizationAndInvitePresident(input({organizationName:'  madison   INVESTMENT fund  '}));
    assert.equal(result.ok,false);assert.match(result.error,/already exists/);
    assert.equal((await first('SELECT count(*)::int AS n FROM "Club" WHERE id=$1',[created.organization.id])).n,1);
  });
  await t.test('repeated submissions cannot create duplicate owner invitations',async()=>{
    const results=await Promise.all([api.createOrganizationAndInvitePresident(request),api.createOrganizationAndInvitePresident(request)]);
    assert.ok(results.every(result=>result.ok&&result.reused&&result.invitation.id===created.invitation.id));
    assert.equal((await first('SELECT count(*)::int AS n FROM "ClubInvitation" WHERE "clubId"=$1',[created.organization.id])).n,1);
    const changed=await api.createOrganizationAndInvitePresident({...request,presidentIdentifier:'different'});
    assert.equal(changed.ok,false);assert.match(changed.error,/different details/);
  });
  await t.test('verified existing school identities are reused and remain pending until acceptance',async()=>{
    const userId=randomUUID();await db.query('INSERT INTO "User" (id,email) VALUES ($1,$2)',[userId,'existing@virginia.edu']);
    const identity=await insert('SchoolIdentity',{schoolId:'school-uva',identifierTypeId:'school-uva-computing-id',identifier:'existing',normalizedIdentifier:'existing',userId,verifiedAt:new Date(),verificationMethod:'EMAIL_LOCAL_PART'});
    const result=await api.createOrganizationAndInvitePresident(input({organizationName:'Existing Account Organization',presidentIdentifier:'existing'}));
    assert.equal(result.ok,true);assert.equal(result.accountMatch,'EXISTING');
    const invite=await first('SELECT * FROM "ClubInvitation" WHERE id=$1',[result.invitation.id]);
    assert.equal(invite.schoolIdentityId,identity.id);assert.equal(invite.claimedUserId,null);
    assert.equal((await first('SELECT count(*)::int AS n FROM "User"')).n,2);
  });
  await t.test('email-only account matches are advisory and do not invent verification',async()=>{
    const userId=randomUUID();await db.query('INSERT INTO "User" (id,email) VALUES ($1,$2)',[userId,'emailonly@virginia.edu']);
    const result=await api.createOrganizationAndInvitePresident(input({organizationName:'Email Match Organization',presidentIdentifier:'emailonly'}));
    assert.equal(result.ok,true);assert.equal(result.accountMatch,'EXISTING');
    const identity=await first('SELECT * FROM "SchoolIdentity" WHERE "normalizedIdentifier"=$1',['emailonly']);
    assert.equal(identity.userId,null);assert.equal(identity.verifiedAt,null);
    const audit=await first('SELECT details FROM "AuditLog" WHERE action=$1 AND "targetId"=$2',['platform.club.onboard',result.organization.id]);
    assert.equal(audit.details.matchedUserId,userId);
  });
  await t.test('malformed computing IDs and invalid form fields fail without writes',async()=>{
    const before=(await first('SELECT count(*)::int AS n FROM "Club"')).n;
    for(const presidentIdentifier of ['jms8xy@virginia.edu','jms 8xy','jms8xy+alias',"'; DROP TABLE",'8xy']) {
      const result=await api.createOrganizationAndInvitePresident(input({organizationName:'Malformed Organization',presidentIdentifier}));
      assert.equal(result.ok,false);assert.ok(result.fieldErrors.presidentIdentifier);
    }
    for(const overrides of [{organizationName:' '},{presidentName:''},{presidentYear:'202x'},{requestedRole:'MEMBER'}]) {
      assert.equal((await api.createOrganizationAndInvitePresident(input(overrides))).ok,false);
    }
    assert.equal((await first('SELECT count(*)::int AS n FROM "Club"')).n,before);
  });
  await t.test('failed audit writes roll back organization, identity, and invitation together',async()=>{
    state.failAudit=true;
    const result=await api.createOrganizationAndInvitePresident(input({organizationName:'Rolled Back Organization',presidentIdentifier:'rollback'}));state.failAudit=false;
    assert.equal(result.ok,false);
    assert.equal((await first('SELECT count(*)::int AS n FROM "Club" WHERE name=$1',['Rolled Back Organization'])).n,0);
    assert.equal((await first('SELECT count(*)::int AS n FROM "SchoolIdentity" WHERE "normalizedIdentifier"=$1',['rollback'])).n,0);
  });
  await t.test('school options are protected and expose the identifier validation rule',async()=>{
    const schools=await api.getOrganizationOnboardingSchools();assert.equal(schools[0].schoolName,'University of Virginia');
    assert.equal(schools[0].validationRegex,'^[a-z][a-z0-9]{1,31}$');
  });
});
