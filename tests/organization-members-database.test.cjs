const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite');

test('member management uses real migrated constraints, atomic transfer, queued delivery cancellation and soft removal',async t=>{
 const db=new PGlite();t.after(()=>db.close());await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
 for(const migration of fs.readdirSync('prisma/migrations').sort()){const file=path.join('prisma/migrations',migration,'migration.sql');if(fs.existsSync(file))await db.exec(fs.readFileSync(file,'utf8'));}
 const clubId=randomUUID(),owner=randomUUID(),target=randomUUID(),ownerMember=randomUUID(),targetMember=randomUUID(),invitation=randomUUID();
 const one=async(sql,values=[]) => (await db.query(sql,values)).rows[0]??null;
 await db.query('INSERT INTO "User" (id,email) VALUES ($1,$2),($3,$4)',[owner,'owner@virginia.edu',target,'target@virginia.edu']);
 await db.query('INSERT INTO "Club" (id,name,slug,tagline,description,color,category) VALUES ($1,\'Member Management\',\'member-management\',\'\',\'\',\'#ffffff\',\'Academic\')',[clubId]);
 await db.query('INSERT INTO "ClubMember" (id,"clubId","userId","isOwner","accessRole") VALUES ($1,$2,$3,true,\'OWNER\'),($4,$2,$5,false,\'MEMBER\')',[ownerMember,clubId,owner,targetMember,target]);
 await db.query('INSERT INTO "ClubInvitation" (id,"clubId",email,"invitedBy","expiresAt") VALUES ($1,$2,\'target@virginia.edu\',$3,CURRENT_TIMESTAMP+INTERVAL \'7 days\')',[invitation,clubId,owner]);
 let actorId=owner,failAudit=false;
 const update=async(table,id,data)=>{const entries=Object.entries(data);const values=entries.map(([key,value])=>key==='permissions'?'{'+value.join(',')+'}':value);return one(`UPDATE "${table}" SET ${entries.map(([key],i)=>`"${key}"=$${i+2}`).join(',')} WHERE id=$1 RETURNING *`,[id,...values]);};
 const tx={
  club:{findUnique:async()=>({invitationEmailEnabled:true})},
  $queryRaw:async(strings,...values)=>(await db.query(strings.reduce((sql,part,i)=>sql+(i?'$'+i:'')+part,''),values)).rows,
  user:{findUnique:async({where})=>one('SELECT * FROM "User" WHERE id=$1',[where.id]),findUniqueOrThrow:async({where})=>one('SELECT * FROM "User" WHERE id=$1',[where.id])},
  clubMember:{
   findUnique:async({where})=>one('SELECT * FROM "ClubMember" WHERE "userId"=$1 AND "clubId"=$2',[where.userId_clubId.userId,where.userId_clubId.clubId]),
   findFirst:async({where})=>one(`SELECT m.*,jsonb_build_object('disabledAt',u."disabledAt") AS "user" FROM "ClubMember" m JOIN "User" u ON u.id=m."userId" WHERE m.id=$1 AND m."clubId"=$2 ${where.status?'AND m.status=\'ACTIVE\'':''} ${where.user?'AND u."disabledAt" IS NULL':''}`,[where.id,where.clubId]),
   count:async({where})=>(await one('SELECT count(*)::int AS n FROM "ClubMember" m JOIN "User" u ON u.id=m."userId" WHERE m."clubId"=$1 AND m.id<>$2 AND m."isOwner" AND m.status=\'ACTIVE\' AND u."disabledAt" IS NULL',[where.clubId,where.id.not])).n,
   update:async({where,data})=>update('ClubMember',where.id,data),
  },
  clubInvitation:{
   findMany:async()=> (await db.query('SELECT i.*,jsonb_build_object(\'studentId\',a."studentId") AS application FROM "ClubInvitation" i JOIN "Application" a ON a.id=i."applicationId" WHERE i."clubId"=$1 AND i.status=\'PENDING\' AND i."revokedAt" IS NULL',[clubId])).rows,
   findFirst:async({where})=>one('SELECT * FROM "ClubInvitation" WHERE id=$1 AND "clubId"=$2',[where.id,where.clubId]),
   updateMany:async({where,data})=>db.query('UPDATE "ClubInvitation" SET status=$1,"revokedAt"=$2 WHERE "clubId"=$3 AND status=\'PENDING\' AND email=$4',[data.status,data.revokedAt,where.clubId,where.OR[0].email]),
   update:async({where,data})=>update('ClubInvitation',where.id,data),
  },
  invitationDelivery:{
   findUnique:async({where})=>one('SELECT * FROM "InvitationDelivery" WHERE "idempotencyKey"=$1',[where.idempotencyKey]),
   count:async()=> (await one('SELECT count(*)::int AS n FROM "InvitationDelivery"')).n,
   findFirst:async({where})=>one(`SELECT * FROM "InvitationDelivery" WHERE "invitationId"=$1 ${where.status?'AND status IN (\'QUEUED\',\'SENDING\')':''} ${where.createdAt?'AND "createdAt">$2':''}`,[where.invitationId,...(where.createdAt?[where.createdAt.gt]:[])]),
   create:async({data})=>one('INSERT INTO "InvitationDelivery" (id,"invitationId","requestedById","recipientEmail","idempotencyKey","updatedAt") VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP) RETURNING *',[randomUUID(),data.invitationId,data.requestedById,data.recipientEmail,data.idempotencyKey]),
   updateMany:async({where})=>where.invitationId?db.query('UPDATE "InvitationDelivery" SET status=\'CANCELLED\' WHERE "invitationId"=$1 AND status=\'QUEUED\'',[where.invitationId]):db.query('UPDATE "InvitationDelivery" d SET status=\'CANCELLED\' FROM "ClubInvitation" i WHERE d."invitationId"=i.id AND d.status=\'QUEUED\' AND i.status=\'PENDING\' AND i."clubId"=$1 AND i.email=$2',[where.invitation.clubId,where.invitation.OR[0].email]),
  },
  auditLog:{create:async({data})=>{if(failAudit)throw Error('Audit failure');return one('INSERT INTO "AuditLog" (id,"actorId",action,"targetId","clubId",details) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',[randomUUID(),data.actorId,data.action,data.targetId,data.clubId,JSON.stringify(data.details??null)]);}},
 };
 let tail=Promise.resolve();const prisma={$transaction:fn=>{const result=tail.then(async()=>{await db.exec('BEGIN');try{const value=await fn(tx);await db.exec('COMMIT');return value;}catch(error){await db.exec('ROLLBACK');throw error;}});tail=result.catch(()=>{});return result;}};
 const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const mod={exports:{}};cache[file]=mod;const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(name=>name==='@/utils/email'?{invitationEmailConfig:()=>{}}:name==='next/server'?{after:()=>{}}:name==='@/utils/prisma'?{prisma}:name==='@/utils/auth'?{requireAuth:async()=>({user:{id:actorId}})}:name==='@/actions/club-onboarding'?{}:name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports);return mod.exports;}
 const api=load('actions/organization-members.ts');
 await assert.rejects(db.query('UPDATE "ClubMember" SET "isOwner"=false WHERE id=$1',[ownerMember]),/active owner/);
 const queued=await Promise.all([api.manageOrganizationInvitation({clubId,invitationId:invitation,action:'RESEND'}),api.manageOrganizationInvitation({clubId,invitationId:invitation,action:'RESEND'})]);
 assert.ok(queued.every(row=>row.queued||row.reused));assert.equal((await one('SELECT count(*)::int AS n FROM "InvitationDelivery"')).n,1);
 await api.changeOrganizationMemberRole({clubId,memberId:targetMember,role:'ADMIN'});
 assert.equal((await one('SELECT status FROM "ClubInvitation" WHERE id=$1',[invitation])).status,'REVOKED');assert.equal((await one('SELECT status FROM "InvitationDelivery"')).status,'CANCELLED');
 assert.equal((await one('SELECT "accessRole" FROM "ClubMember" WHERE id=$1',[targetMember])).accessRole,'ADMIN');
 failAudit=true;await assert.rejects(api.transferOrganizationOwnership({clubId,memberId:targetMember,confirm:true}),/Audit failure/);failAudit=false;
 assert.equal((await one('SELECT "isOwner" FROM "ClubMember" WHERE id=$1',[ownerMember])).isOwner,true);assert.equal((await one('SELECT "isOwner" FROM "ClubMember" WHERE id=$1',[targetMember])).isOwner,false);
 await api.transferOrganizationOwnership({clubId,memberId:targetMember,confirm:true});
 assert.equal((await one('SELECT "accessRole" FROM "ClubMember" WHERE id=$1',[ownerMember])).accessRole,'ADMIN');assert.equal((await one('SELECT "isOwner" FROM "ClubMember" WHERE id=$1',[targetMember])).isOwner,true);
 await assert.rejects(api.removeOrganizationMember({clubId,memberId:targetMember}),/cannot remove/);
 await api.removeOrganizationMember({clubId,memberId:ownerMember});const removed=await one('SELECT * FROM "ClubMember" WHERE id=$1',[ownerMember]);assert.equal(removed.status,'LEFT');assert.deepEqual(removed.permissions,[]);
 actorId=target;await assert.rejects(api.changeOrganizationMemberRole({clubId,memberId:targetMember,role:'ADMIN'}),/last owner/);
 assert.ok((await one('SELECT count(*)::int AS n FROM "AuditLog" WHERE "clubId"=$1',[clubId])).n>=4);
});
