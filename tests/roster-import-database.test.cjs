const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');

test('roster preview, confirmation, rollback and retry respect the complete SQL migration stack',async t=>{
  const db=new PGlite();t.after(()=>db.close());await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  for(const name of fs.readdirSync('prisma/migrations').sort()) {const file=path.join('prisma/migrations',name,'migration.sql');if(fs.existsSync(file))await db.exec(fs.readFileSync(file,'utf8'));}
  const actor=randomUUID(),clubId=randomUUID();
  const all=async(sql,values=[]) => (await db.query(sql,values)).rows;
  const one=async(sql,values=[]) => (await all(sql,values))[0]??null;
  await db.query('INSERT INTO "User" (id,email) VALUES ($1,$2)',[actor,'owner@virginia.edu']);
  await db.query(`INSERT INTO "Club" (id,slug,name,tagline,description,color,category,"schoolId") VALUES ($1,'roster-test','Roster Test','','','#ffffff','Academic','school-uva')`,[clubId]);
  await db.query('INSERT INTO "ClubMember" (id,"clubId","userId","isOwner") VALUES ($1,$2,$3,true)',[randomUUID(),clubId,actor]);
  async function insert(table,data) {
    const record={id:randomUUID(),...data},keys=Object.keys(record);
    const values=keys.map(key=>['input','errors','details'].includes(key)?JSON.stringify(record[key]):key==='permissions'?'{'+record[key].join(',')+'}':record[key]);
    return one(`INSERT INTO "${table}" (${keys.map(key=>`"${key}"`).join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,values);
  }
  async function update(table,id,data) {
    const keys=Object.keys(data),values=keys.map(key=>['input','errors','details'].includes(key)?JSON.stringify(data[key]):data[key]);
    return one(`UPDATE "${table}" SET ${keys.map((key,i)=>`"${key}"=$${i+1}`).join(',')} WHERE id=$${keys.length+1} RETURNING *`,[...values,id]);
  }
  let failAudit=false;
  async function importRecord(where,include) {
    const row=where.id?await one('SELECT * FROM "RosterImport" WHERE id=$1',[where.id]):await one('SELECT * FROM "RosterImport" WHERE "clubId"=$1 AND "idempotencyKey"=$2',[where.clubId_idempotencyKey.clubId,where.clubId_idempotencyKey.idempotencyKey]);
    if(row&&include)row.rows=await all('SELECT * FROM "RosterImportRow" WHERE "importId"=$1 ORDER BY "rowNumber"',[row.id]);return row;
  }
  const tx={
    $executeRaw:async(strings)=>db.exec(strings.join('')),
    $queryRaw:async(strings,...values)=>db.query(strings.map((text,i)=>text+(i<values.length?`$${i+1}`:'')).join(''),values),
    club:{findUniqueOrThrow:async({where})=>one('SELECT * FROM "Club" WHERE id=$1',[where.id])},
    clubMember:{findUnique:async({where})=>one('SELECT * FROM "ClubMember" WHERE "userId"=$1 AND "clubId"=$2',[where.userId_clubId.userId,where.userId_clubId.clubId]),findMany:async({where})=>all('SELECT * FROM "ClubMember" WHERE "clubId"=$1 AND status=$2',[where.clubId,where.status])},
    schoolIdentifierType:{findMany:async({where})=>all(`SELECT t.*,jsonb_build_object('key',s.key,'active',s.active) AS school FROM "SchoolIdentifierType" t JOIN "School" s ON s.id=t."schoolId" WHERE t."schoolId"=$1 AND t.verification=$2 AND s.active`,[where.schoolId,where.verification])},
    user:{findUnique:async({where})=>one('SELECT * FROM "User" WHERE id=$1',[where.id]),findMany:async({where})=>(await all('SELECT * FROM "User"')).filter(user=>where.email.in.includes(user.email.toLowerCase()))},
    schoolIdentity:{findMany:async({where})=>(await all('SELECT * FROM "SchoolIdentity" WHERE "schoolId"=$1 AND "identifierTypeId"=$2',[where.schoolId,where.identifierTypeId])).filter(row=>where.normalizedIdentifier.in.includes(row.normalizedIdentifier)),upsert:async({where,create})=>{const key=where.schoolId_identifierTypeId_normalizedIdentifier;return await one('SELECT * FROM "SchoolIdentity" WHERE "schoolId"=$1 AND "identifierTypeId"=$2 AND "normalizedIdentifier"=$3',[key.schoolId,key.identifierTypeId,key.normalizedIdentifier])??insert('SchoolIdentity',create);}},
    clubInvitation:{findMany:async({where})=>(await all('SELECT * FROM "ClubInvitation" WHERE "clubId"=$1 AND status=$2',[where.clubId,where.status])).filter(row=>(!where.schoolIdentityId||row.schoolIdentityId===where.schoolIdentityId)&&(where.expiresAt.gt?row.expiresAt>where.expiresAt.gt:row.expiresAt<=where.expiresAt.lte)),create:async({data})=>insert('ClubInvitation',data),update:async({where,data})=>update('ClubInvitation',where.id,data)},
    rosterImport:{findUnique:async({where,include})=>importRecord(where,include),findUniqueOrThrow:async({where,include})=>importRecord(where,include),create:async({data})=>{const {rows,...fields}=data;const record=await insert('RosterImport',fields);for(const row of rows.create)await insert('RosterImportRow',{importId:record.id,...row});return record;},update:async({where,data})=>update('RosterImport',where.id,data)},
    rosterImportRow:{findUniqueOrThrow:async({where})=>one('SELECT * FROM "RosterImportRow" WHERE id=$1',[where.id]),findMany:async({where})=>all('SELECT * FROM "RosterImportRow" WHERE "importId"=$1 AND "clubId"=$2 ORDER BY "rowNumber"',[where.importId,where.clubId]),update:async({where,data})=>update('RosterImportRow',where.id,data)},
    auditLog:{create:async({data})=>{if(failAudit&&data.action==='club.roster.confirm')throw Error('Audit failed');return insert('AuditLog',data);}},
  };
  let tail=Promise.resolve();const prisma={...tx,$transaction:fn=>{const result=tail.then(async()=>{await db.exec('BEGIN');try{const value=await fn(tx);await db.exec('COMMIT');return value;}catch(error){await db.exec('ROLLBACK');throw error;}});tail=result.catch(()=>{});return result;}};
  const cache={};function load(file) {
    file=path.resolve(file);if(cache[file])return cache[file].exports;const mod={exports:{}};cache[file]=mod;
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',code)(name=>name==='@/utils/prisma'?{prisma}:name==='@/utils/auth'?{requireClubPermission:async()=>({user:{id:actor}})}:name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports);return mod.exports;
  }
  const api=load('actions/roster-import.ts');
  const preview=await api.previewRosterImport({clubId,requestId:randomUUID(),filename:'roster.csv',csv:'name,year,computing_id\nJohn,2028,JMS8XY\nJohn,2028,jms8xy\nSarah,,sl3ab\nBad,2040,bad12'});
  assert.equal(preview.summary.ready,2);
  assert.equal((await one('SELECT count(*)::int AS n FROM "SchoolIdentity"')).n,0);
  assert.equal((await one('SELECT count(*)::int AS n FROM "ClubInvitation"')).n,0);
  assert.equal((await one('SELECT count(*)::int AS n FROM "RosterImportRow"')).n,4);
  failAudit=true;await assert.rejects(api.confirmRosterImport(preview.id),/Audit failed/);failAudit=false;
  assert.equal((await one('SELECT count(*)::int AS n FROM "SchoolIdentity"')).n,0);
  assert.equal((await one('SELECT count(*)::int AS n FROM "ClubInvitation"')).n,0);
  assert.equal((await one('SELECT status FROM "RosterImport" WHERE id=$1',[preview.id])).status,'VALIDATED');
  const result=await api.confirmRosterImport(preview.id);assert.equal(result.created,2);assert.equal(result.skipped,2);
  assert.equal((await api.confirmRosterImport(preview.id)).reused,true);
  assert.equal((await one('SELECT count(*)::int AS n FROM "ClubInvitation"')).n,2);
  assert.equal((await one('SELECT count(*)::int AS n FROM "User"')).n,1);
  assert.equal((await one('SELECT count(*)::int AS n FROM "ClubMember"')).n,1);
  assert.equal((await one('SELECT count(*)::int AS n FROM "InvitationDelivery"')).n,0);
  assert.deepEqual((await all('SELECT status FROM "RosterImportRow" ORDER BY "rowNumber"')).map(row=>row.status),['INVITATION_CREATED','DUPLICATE_ROW','INVITATION_CREATED','INVALID']);
  const second=await api.previewRosterImport({clubId,requestId:randomUUID(),filename:'roster-again.csv',csv:'name,computing_id\nJohn,jms8xy'});assert.equal(second.summary.alreadyInvited,1);
  assert.equal((await api.confirmRosterImport(second.id)).created,0);

  // A database-level row constraint failure must roll back only that row's identity/invitation.
  await db.exec(`CREATE FUNCTION roster_test_reject_row() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.email='failedrow@virginia.edu' THEN RAISE EXCEPTION 'fixture row failure' USING ERRCODE='23514'; END IF;
    RETURN NEW; END $$;
    CREATE TRIGGER roster_test_reject_row BEFORE INSERT ON "ClubInvitation" FOR EACH ROW EXECUTE FUNCTION roster_test_reject_row();`);
  const partial=await api.previewRosterImport({clubId,requestId:randomUUID(),filename:'partial.csv',csv:'name,computing_id\nGood,goodrow\nBad,failedrow\nGood Two,goodtwo'});
  const partialResult=await api.confirmRosterImport(partial.id);
  assert.equal(partialResult.created,2);assert.equal(partialResult.failed,1);
  assert.deepEqual(partialResult.rows.map(row=>row.status),['INVITATION_CREATED','FAILED','INVITATION_CREATED']);
  assert.equal((await one('SELECT count(*)::int AS n FROM "SchoolIdentity" WHERE "normalizedIdentifier"=\'failedrow\'')).n,0);
  assert.equal((await one('SELECT count(*)::int AS n FROM "ClubInvitation" WHERE email=\'failedrow@virginia.edu\'')).n,0);

  const largeCsv=['name,year,computing_id'];
  for(let i=0;i<160;i++)largeCsv.push(`Student ${i},${i===159?'2040':'2028'},batch${i}`);
  // Ten active members and two preexisting invitations; retain a member absent from CSV.
  for(let i=0;i<10;i++) {
    const id=randomUUID();await insert('User',{id,email:`batch${i}@virginia.edu`});
    await insert('ClubMember',{clubId,userId:id});
  }
  for(let i=10;i<12;i++) {
    const identity=await insert('SchoolIdentity',{schoolId:'school-uva',identifierTypeId:'school-uva-computing-id',identifier:`batch${i}`,normalizedIdentifier:`batch${i}`});
    await insert('ClubInvitation',{clubId,schoolId:'school-uva',schoolIdentityId:identity.id,email:`batch${i}@virginia.edu`,invitedBy:actor,expiresAt:new Date(Date.now()+86400000),requestedRole:'MEMBER',purpose:'MEMBERSHIP'});
  }
  const large=await api.previewRosterImport({clubId,requestId:randomUUID(),filename:'large.csv',csv:largeCsv.join('\n')});
  const firstBatch=await api.confirmRosterImport(large.id);assert.equal(firstBatch.created,50);assert.equal(firstBatch.completed,false);
  // Global/audit failure in a later batch does not erase the first committed batch.
  failAudit=true;
  // Batch audits are fatal too; fail the final batch after the next batch has committed.
  const middle=await api.confirmRosterImport(large.id);assert.equal(middle.created,100);assert.equal(middle.completed,false);
  await assert.rejects(api.confirmRosterImport(large.id),/Audit failed/);failAudit=false;
  assert.equal((await one('SELECT "successfulRows" FROM "RosterImport" WHERE id=$1',[large.id])).successfulRows,100);
  const final=await api.confirmRosterImport(large.id);
  assert.equal(final.completed,true);assert.equal(final.created,147);assert.equal(final.alreadyMember,10);assert.equal(final.alreadyInvited,2);assert.equal(final.invalid,1);
  assert.equal(final.rows.filter(row=>row.status==='ALREADY_INVITED').length,2);
  assert.equal((await one('SELECT count(*)::int AS n FROM "ClubMember" WHERE "clubId"=$1',[clubId])).n,11);
  assert.equal((await one('SELECT count(*)::int AS n FROM "InvitationDelivery"')).n,0);

  const sharedCsv='name,computing_id\nConcurrent One,concurrent1\nConcurrent Two,concurrent2';
  const competingA=await api.previewRosterImport({clubId,requestId:randomUUID(),filename:'concurrent-a.csv',csv:sharedCsv});
  const competingB=await api.previewRosterImport({clubId,requestId:randomUUID(),filename:'concurrent-b.csv',csv:sharedCsv});
  const competing=await Promise.all([api.confirmRosterImport(competingA.id),api.confirmRosterImport(competingB.id)]);
  assert.equal(competing.reduce((sum,result)=>sum+result.created,0),2);
  assert.equal(competing.reduce((sum,result)=>sum+result.alreadyInvited,0),2);
  assert.equal((await one('SELECT count(*)::int AS n FROM "ClubInvitation" WHERE "clubId"=$1 AND email IN (\'concurrent1@virginia.edu\',\'concurrent2@virginia.edu\')',[clubId])).n,2);
  const otherClub=randomUUID();
  await insert('Club',{id:otherClub,slug:'separate-roster-club',name:'Separate Roster Club',tagline:'',description:'',color:'#ffffff',category:'Academic',schoolId:'school-uva'});
  await insert('ClubMember',{clubId:otherClub,userId:actor,isOwner:true});
  const separate=await api.previewRosterImport({clubId:otherClub,requestId:randomUUID(),filename:'separate.csv',csv:sharedCsv});
  assert.equal((await api.confirmRosterImport(separate.id)).created,2);
  assert.equal((await one('SELECT count(*)::int AS n FROM "ClubInvitation" WHERE "clubId"=$1',[otherClub])).n,2);
  assert.equal((await one('SELECT count(*)::int AS n FROM "ClubMember" WHERE "clubId"=$1',[clubId])).n,11);
});
