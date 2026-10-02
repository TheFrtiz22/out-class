const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');

test('first-login discovery and atomic ownership acceptance run against all repository migrations',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  for(const migration of fs.readdirSync('prisma/migrations').sort()) {
    const file=path.join('prisma/migrations',migration,'migration.sql');if(fs.existsSync(file))await db.exec(fs.readFileSync(file,'utf8'));
  }
  const actor=randomUUID(),john=randomUUID(),club=randomUUID(),identity=randomUUID(),invitation=randomUUID();
  const previous=process.env.OUTCLASS_PLATFORM_ADMIN_IDS;process.env.OUTCLASS_PLATFORM_ADMIN_IDS=actor;
  t.after(()=>{if(previous===undefined)delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS;else process.env.OUTCLASS_PLATFORM_ADMIN_IDS=previous;});
  const one=async(sql,values=[]) => (await db.query(sql,values)).rows[0]??null;
  await db.query('INSERT INTO "User" (id,email) VALUES ($1,$2)',[actor,'platform@virginia.edu']);
  await db.query('INSERT INTO "PlatformAdmin" ("userId") VALUES ($1)',[actor]);
  await db.query('INSERT INTO "Club" (id,name,slug,"schoolId",tagline,description,color,category) VALUES ($1,\'Madison Investment Fund\',\'mif\',\'school-uva\',\'\',\'\',\'#ffffff\',\'Academic\')',[club]);
  await db.query('INSERT INTO "SchoolIdentity" (id,"schoolId","identifierTypeId",identifier,"normalizedIdentifier") VALUES ($1,\'school-uva\',\'school-uva-computing-id\',\' JMS8XY \',\'jms8xy\')',[identity]);
  await db.query(`INSERT INTO "ClubInvitation" (id,"clubId","schoolId","schoolIdentityId",email,"invitedBy","expiresAt",purpose,"requestedRole","authoritySource","invitedName","invitedYear") VALUES ($1,$2,'school-uva',$3,'jms8xy@virginia.edu',$4,NOW()+interval '7 days','OWNER_DESIGNATION','OWNER','PLATFORM_ADMIN','John Smith','2027')`,[invitation,club,identity,actor]);
  assert.equal((await one('SELECT count(*)::int AS n FROM "User"')).n,1);
  // Only a real subsequent provider sign-in creates John's account.
  await db.query('INSERT INTO "User" (id,email) VALUES ($1,$2)',[john,'jms8xy@virginia.edu']);
  let failAudit=false;
  async function update(table,id,data) {
    const keys=Object.keys(data),values=keys.map(key=>key==='permissions'?'{'+data[key].join(',')+'}':data[key]);
    return one(`UPDATE "${table}" SET ${keys.map((key,i)=>`"${key}"=$${i+1}`).join(',')} WHERE id=$${keys.length+1} RETURNING *`,[...values,id]);
  }
  const byId=table=>async({where})=>one(`SELECT * FROM "${table}" WHERE id=$1`,[where.id]);
  const tx={
    $queryRaw:async(strings,...values)=>db.query(strings.map((text,i)=>text+(i<values.length?`$${i+1}`:'')).join(''),values),
    user:{findUnique:byId('User')},
    platformAdmin:{findUnique:async({where})=>one('SELECT * FROM "PlatformAdmin" WHERE "userId"=$1',[where.userId])},
    schoolIdentifierType:{findMany:async({where})=>(await db.query('SELECT t.* FROM "SchoolIdentifierType" t JOIN "School" s ON s.id=t."schoolId" WHERE t.verification=$1 AND t."emailDomain"=$2 AND s.active',[where.verification,where.emailDomain])).rows},
    schoolIdentity:{
      upsert:async({where})=>{const key=where.schoolId_identifierTypeId_normalizedIdentifier;return one('SELECT * FROM "SchoolIdentity" WHERE "schoolId"=$1 AND "identifierTypeId"=$2 AND "normalizedIdentifier"=$3',[key.schoolId,key.identifierTypeId,key.normalizedIdentifier]);},
      findUniqueOrThrow:byId('SchoolIdentity'),
      update:async({where,data})=>update('SchoolIdentity',where.id,data),
      findMany:async({where})=>(await db.query('SELECT * FROM "SchoolIdentity" WHERE "userId"=$1 AND "verifiedAt" IS NOT NULL',[where.userId])).rows,
    },
    club:{update:async({where,data})=>update('Club',where.id,data)},
    clubMember:{
      count:async({where})=>(await one('SELECT count(*)::int AS n FROM "ClubMember" WHERE "clubId"=$1 AND "isOwner"',[where.clubId])).n,
      findUnique:async({where})=>one('SELECT * FROM "ClubMember" WHERE "userId"=$1 AND "clubId"=$2',[where.userId_clubId.userId,where.userId_clubId.clubId]),
      upsert:async(args)=>{const existing=await tx.clubMember.findUnique(args);if(existing)return update('ClubMember',existing.id,args.update);const d=args.create;return one('INSERT INTO "ClubMember" (id,"userId","clubId",permissions,"isOwner","accessRole") VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',[randomUUID(),d.userId,d.clubId,'{'+d.permissions.join(',')+'}',d.isOwner,d.accessRole]);},
    },
    clubInvitation:{
      findUnique:byId('ClubInvitation'),findUniqueOrThrow:byId('ClubInvitation'),
      update:async({where,data})=>update('ClubInvitation',where.id,data),
      findMany:async({where})=>(await db.query(`SELECT i.*,jsonb_build_object('id',c.id,'name',c.name) AS club FROM "ClubInvitation" i JOIN "Club" c ON c.id=i."clubId" WHERE i."schoolIdentityId"=ANY($1::text[]) AND i.status=$2 AND i."expiresAt">$3 ${where.dismissedAt === null ? 'AND i."dismissedAt" IS NULL' : ''}`,['{'+where.schoolIdentityId.in.join(',')+'}',where.status,where.expiresAt.gt])).rows,
    },
    auditLog:{create:async({data})=>{if(failAudit&&data.action==='club.invite.accept')throw Error('Audit failure');return one('INSERT INTO "AuditLog" (id,"actorId",action,"targetId","clubId",details) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',[randomUUID(),data.actorId,data.action,data.targetId,data.clubId??null,JSON.stringify(data.details??null)]);}},
  };
  let tail=Promise.resolve();const prisma={$transaction:fn=>{const result=tail.then(async()=>{await db.exec('BEGIN');try{const value=await fn(tx);await db.exec('COMMIT');return value;}catch(error){await db.exec('ROLLBACK');throw error;}});tail=result.catch(()=>{});return result;}};
  const cache={};function load(file) {
    file=path.resolve(file);if(cache[file])return cache[file].exports;const mod={exports:{}};cache[file]=mod;
    const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',compiled)(name=>name==='@/utils/verified-email-policy'?{...load('utils/verified-email-policy.ts'),requireVerifiedEmailPolicy:async()=>{}}:name==='@/utils/prisma'?{prisma}:name==='@/utils/auth'?{requireAuth:async()=>({user:{id:john,email:'jms8xy@virginia.edu'},supabaseUser:{id:john,email:' JMS8XY@VIRGINIA.EDU ',confirmation_sent_at: '2026-09-01', email_confirmed_at:'2026-10-01'}})}:name==='@/utils/platform-admin'?{}:name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports);return mod.exports;
  }
  const api=load('actions/club-onboarding.ts');
  const pending=await api.getOrganizationInvitations();assert.equal(pending.length,1);assert.equal(pending[0].invitedName,'John Smith');
  assert.equal((await one('SELECT * FROM "SchoolIdentity" WHERE id=$1',[identity])).userId,john);
  failAudit=true;await assert.rejects(api.acceptIdentityClubInvitation(invitation),/Audit failure/);failAudit=false;
  assert.equal((await one('SELECT * FROM "ClubInvitation" WHERE id=$1',[invitation])).status,'PENDING');
  assert.equal((await one('SELECT count(*)::int AS n FROM "ClubMember"')).n,0);
  assert.equal((await one('SELECT * FROM "Club" WHERE id=$1',[club])).claimedAt,null);
  const results=await Promise.allSettled([api.acceptIdentityClubInvitation(invitation),api.acceptIdentityClubInvitation(invitation)]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected').length,1);
  const claimed=await one('SELECT * FROM "ClubInvitation" WHERE id=$1',[invitation]);assert.equal(claimed.status,'ACCEPTED');assert.equal(claimed.claimedUserId,john);assert.ok(claimed.claimedAt);
  const membership=await one('SELECT * FROM "ClubMember" WHERE "userId"=$1',[john]);assert.equal(membership.accessRole,'OWNER');assert.equal(membership.isOwner,true);assert.equal(membership.status,'ACTIVE');
  assert.equal((await one('SELECT count(*)::int AS n FROM "ClubMember"')).n,1);assert.deepEqual(await api.getOrganizationInvitations(),[]);

  const memberClub=randomUUID(),memberInvite=randomUUID(),laterInvite=randomUUID();
  await db.query(`INSERT INTO "Club" (id,name,slug,"schoolId",tagline,description,color,category) VALUES ($1,'Member Club','member-club','school-uva','','','#ffffff','Academic')`,[memberClub]);
  async function inviteMember(id) {
    await db.query(`INSERT INTO "ClubInvitation" (id,"clubId","schoolId","schoolIdentityId",email,"invitedBy","expiresAt",purpose,"requestedRole","authoritySource") VALUES ($1,$2,'school-uva',$3,'jms8xy@virginia.edu',$4,NOW()+interval '7 days','MEMBERSHIP','MEMBER','PLATFORM_ADMIN')`,[id,memberClub,identity,actor]);
  }
  await inviteMember(memberInvite);
  assert.equal((await api.getOrganizationInvitations()).length,1);
  await api.setOrganizationInvitationDismissed(memberInvite,true);
  assert.equal((await one('SELECT status FROM "ClubInvitation" WHERE id=$1',[memberInvite])).status,'PENDING');
  assert.deepEqual(await api.getOrganizationInvitations(),[]);assert.equal((await api.getOrganizationInvitations(true)).length,1);
  await api.setOrganizationInvitationDismissed(memberInvite,false);assert.equal((await api.getOrganizationInvitations()).length,1);
  await api.declineIdentityClubInvitation(memberInvite);
  assert.equal((await one('SELECT status FROM "ClubInvitation" WHERE id=$1',[memberInvite])).status,'DECLINED');
  await assert.rejects(api.acceptIdentityClubInvitation(memberInvite),/unavailable/);
  assert.equal((await one('SELECT count(*)::int AS n FROM "ClubMember" WHERE "clubId"=$1',[memberClub])).n,0);
  await inviteMember(laterInvite);await api.setOrganizationInvitationDismissed(laterInvite,true);
  await api.acceptIdentityClubInvitation(laterInvite);
  assert.equal((await one('SELECT status FROM "ClubInvitation" WHERE id=$1',[laterInvite])).status,'ACCEPTED');
  const member=await one('SELECT * FROM "ClubMember" WHERE "clubId"=$1',[memberClub]);assert.equal(member.userId,john);assert.equal(member.accessRole,'MEMBER');assert.equal(member.isOwner,false);
  assert.equal((await one('SELECT count(*)::int AS n FROM "ClubMember" WHERE "clubId"=$1',[memberClub])).n,1);
  await assert.rejects(api.acceptIdentityClubInvitation(laterInvite),/unavailable/);
});
