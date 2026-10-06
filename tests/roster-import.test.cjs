const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const clubId='00000000-0000-4000-8000-000000000001',importId='00000000-0000-4000-8000-000000000002';
function setup() {
  const state={allowed:true,member:{isOwner:true,status:'ACTIVE',permissions:[]},identities:[],users:[],members:[],invitations:[],record:null,audits:[],writes:[],actor:'manager'};
  const config={id:'computing',key:'computing_id',schoolId:'school-uva',normalization:'TRIM_LOWERCASE',validationRegex:'^[a-z0-9]+$',verification:'EMAIL_LOCAL_PART',emailDomain:'virginia.edu',school:{key:'uva',active:true}};
  const tx={
    $queryRaw:async(strings)=>strings.join("").includes("FROM \"User\"")?state.users:[],$executeRaw:async(strings,...values)=>{if(strings.join("").startsWith('UPDATE "RosterImportRow"'))for(const row of JSON.parse(values[0]))Object.assign(state.record.rows.find(r=>r.id===row.id),{status:"INVITATION_CREATED",schoolIdentityId:row.identity,invitationId:row.invitation,matchedUserId:row.user});return 0;},club:{findUniqueOrThrow:async()=>({id:clubId,schoolId:'school-uva'})},
    clubMember:{findUnique:async()=>state.member,findMany:async()=>state.members},schoolIdentifierType:{findMany:async()=>[config]},
    user:{findUnique:async()=>({disabledAt:null}),findMany:async()=>state.users,create:()=>{throw Error('Fake user forbidden');}},
    schoolIdentity:{createMany:async({data})=>{for(const identity of data)if(!state.identities.some(i=>i.normalizedIdentifier===identity.normalizedIdentifier))state.identities.push(identity);},findMany:async()=>state.identities,upsert:async({create})=>{const existing=state.identities.find(i=>i.normalizedIdentifier===create.normalizedIdentifier);if(existing)return existing;const identity={id:'identity-'+create.normalizedIdentifier,...create};state.identities.push(identity);state.writes.push('identity');return identity;}},
    clubInvitation:{createMany:async({data})=>state.invitations.push(...data.map(d=>({status:"PENDING",...d}))),updateMany:async({where,data})=>state.invitations.filter(i=>where.id.in.includes(i.id)).forEach(i=>Object.assign(i,data)),findMany:async({where})=>state.invitations.filter(invite=>invite.status==='PENDING'&&(!invite.clubId||invite.clubId===where.clubId)&&(where.expiresAt.gt?invite.expiresAt>where.expiresAt.gt:invite.expiresAt<=where.expiresAt.lte)),create:async({data})=>{const invite={id:'invite-'+state.invitations.length,status:'PENDING',...data};state.invitations.push(invite);state.writes.push('invitation');return invite;},update:async({where,data})=>Object.assign(state.invitations.find(i=>i.id===where.id),data)},
    rosterImport:{findUnique:async()=>state.record,findUniqueOrThrow:async()=>state.record,create:async({data})=>{state.record={id:importId,...data,rows:(data.rows.createMany?.data || data.rows.create).map((row,i)=>({id:'row-'+i,importId,clubId:data.clubId,...row}))};state.writes.push('import');return state.record;},update:async({data})=>Object.assign(state.record,data)},
    rosterImportRow:{findUniqueOrThrow:async({where})=>state.record.rows.find(row=>row.id===where.id),findMany:async()=>state.record.rows,update:async({where,data})=>Object.assign(state.record.rows.find(row=>row.id===where.id),data)},
    auditLog:{create:async({data})=>state.audits.push(data)},
  };
  let tail=Promise.resolve();const prisma={...tx,$transaction:fn=>{const result=tail.then(()=>fn(tx));tail=result.catch(()=>{});return result;}};
  const cache={};function load(file) {
    file=path.resolve(file);if(cache[file])return cache[file].exports;const mod={exports:{}};cache[file]=mod;
    const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',compiled)(name=>name==='@/utils/prisma'?{prisma}:name==='@/utils/auth'?{requireClubPermission:async(id,permissions)=>{assert.equal(id,clubId);assert.deepEqual(permissions,['members.manage']);if(!state.allowed)throw Error('Denied');return{user:{id:state.actor}};}}:name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),mod,mod.exports);return mod.exports;
  }
  return{state,api:load('actions/roster-import.ts'),config};
}
const input=(overrides={})=>({clubId,requestId:'00000000-0000-4000-8000-000000000003',filename:'roster.csv',csv:'name,year,computing_id\nJohn Smith,2028,JMS8XY\nSarah Lee,,sl3ab',...overrides});

test('batch-scoped database checks retain complete-file duplicate semantics after a normalization change',async()=>{
  const h=setup();h.config.normalization='TRIM';
  const rows=['name,year,computing_id','First,2028,UPPERID'];
  for(let i=0;i<49;i++)rows.push(`Student ${i},2028,unique${i}`);
  rows.push('Later,2028,upperid');
  await h.api.previewRosterImport(input({csv:rows.join('\n')}));
  h.config.normalization='TRIM_LOWERCASE';
  let result;do{result=await h.api.confirmRosterImport(importId);}while(!result.completed);
  assert.equal(result.created,49);assert.equal(result.invalid,1);assert.equal(result.duplicates,1);
  assert.ok(!h.state.invitations.some(i=>i.email==='upperid@virginia.edu'));
});

test('preview enforces server permissions and never creates users, identities, invitations or memberships',async()=>{
  const h=setup();h.state.allowed=false;await assert.rejects(h.api.previewRosterImport(input()),/Denied/);assert.deepEqual(h.state.writes,[]);
  h.state.allowed=true;h.state.member={status:'ACTIVE',permissions:[]};await assert.rejects(h.api.previewRosterImport(input()),/member-management/);
  h.state.member={isOwner:true,status:'ACTIVE'};const result=await h.api.previewRosterImport(input());
  assert.equal(result.summary.ready,2);assert.equal(result.rows[0].identifier,'JMS8XY');assert.ok(result.rows[1].warnings.includes('Missing year'));
  assert.deepEqual(h.state.writes,['import']);assert.equal(h.state.record.rows[0].normalizedIdentifier,'jms8xy');assert.equal(h.state.audits[0].action,'club.roster.preview');
  await h.api.previewRosterImport(input());assert.deepEqual(h.state.writes,['import']);
  await assert.rejects(h.api.previewRosterImport(input({csv:'name,computing_id\nOther,abc12'})),/already used/);
});

test('preview distinguishes existing users, active members and pending identity or legacy-email invitations',async()=>{
  const h=setup();h.state.identities=[{id:'identity-john',normalizedIdentifier:'jms8xy',userId:'john'}];
  h.state.users=[{id:'john',email:'JMS8XY@VIRGINIA.EDU',disabledAt:null},{id:'sarah',email:'sl3ab@virginia.edu',disabledAt:null}];
  h.state.members=[{userId:'john'}];
  let result=await h.api.previewRosterImport(input());assert.equal(result.rows[0].status,'ALREADY_MEMBER');assert.equal(result.rows[1].status,'READY');assert.equal(result.rows[1].existingUser,true);
  const other=setup();other.state.identities=[{id:'identity-john',normalizedIdentifier:'jms8xy',userId:'john'}];other.state.invitations=[{id:'old',status:'PENDING',schoolIdentityId:null,email:'jms8xy@virginia.edu',expiresAt:new Date(Date.now()+86400000)}];
  result=await other.api.previewRosterImport(input());assert.equal(result.rows[0].status,'ALREADY_INVITED');assert.equal(other.state.record.rows[0].schoolIdentityId,null);assert.equal(other.state.record.rows[0].invitationId,'old');
});

test('explicit confirmation creates only MEMBER invitations, is idempotent, and does not send email',async()=>{
  const h=setup();await h.api.previewRosterImport(input({csv:'name,year,computing_id\nJohn,2028,jms8xy\nJohn,2028,JMS8XY\nBad,2050,bb1ab\nSarah,,sl3ab'}));
  assert.equal(h.state.invitations.length,0);
  const results=await Promise.all([h.api.confirmRosterImport(importId),h.api.confirmRosterImport(importId)]);
  assert.deepEqual(results.map(r=>r.created),[2,2]);assert.equal(results[1].reused,true);assert.equal(h.state.invitations.length,2);
  for(const invitation of h.state.invitations){assert.equal(invitation.requestedRole,'MEMBER');assert.deepEqual(invitation.permissions,[]);assert.equal(invitation.purpose,'MEMBERSHIP');}
  assert.equal(h.state.record.status,'COMPLETED');assert.equal(h.state.record.failedRows,1);assert.equal(h.state.audits.filter(a=>a.action==='club.roster.confirm').length,1);
});

test('confirmation rechecks uploader/access and skips rows that became active members or invited after preview',async()=>{
  const h=setup();await h.api.previewRosterImport(input());h.state.allowed=false;
  await assert.rejects(h.api.confirmRosterImport(importId),/Denied/);h.state.allowed=true;h.state.actor='different-manager';
  await assert.rejects(h.api.confirmRosterImport(importId),/Only the uploader/);h.state.actor='manager';
  h.state.identities=[{id:'identity-john',normalizedIdentifier:'jms8xy',userId:'john'}];h.state.members=[{userId:'john'}];
  h.state.invitations=[{id:'existing',status:'PENDING',schoolIdentityId:null,email:'sl3ab@virginia.edu',expiresAt:new Date(Date.now()+86400000)}];
  const result=await h.api.confirmRosterImport(importId);assert.equal(result.created,0);assert.equal(result.skipped,2);assert.equal(h.state.invitations.length,1);
  assert.deepEqual(h.state.record.rows.map(row=>row.status),['ALREADY_MEMBER','INVITATION_REUSED']);
});

test('ambiguous or disabled account identities fail validation without granting access',async()=>{
  const h=setup();h.state.users=[{id:'one',email:'jms8xy@virginia.edu',disabledAt:null},{id:'two',email:'JMS8XY@virginia.edu',disabledAt:null},{id:'sarah',email:'sl3ab@virginia.edu',disabledAt:new Date()}];
  const result=await h.api.previewRosterImport(input());assert.equal(result.summary.invalid,2);await h.api.confirmRosterImport(importId);assert.equal(h.state.invitations.length,0);
});

test('retried preview exclusions remain authoritative and never silently add previously excluded rows',async()=>{
  const h=setup();await h.api.previewRosterImport(input());
  h.state.users=[{id:'john',email:'jms8xy@virginia.edu',disabledAt:new Date()}];
  const latest=await h.api.previewRosterImport(input());assert.equal(latest.rows[0].status,'INVALID');
  h.state.users=[];
  const retry=await h.api.previewRosterImport(input());assert.equal(retry.rows[0].status,'INVALID');
  const result=await h.api.confirmRosterImport(importId);assert.equal(result.created,1);assert.equal(h.state.invitations[0].email,'sl3ab@virginia.edu');
});

test('expired invitations are audited and replaced only after confirmation, preserving the existing school identity',async()=>{
  const h=setup();h.state.identities=[{id:'identity-john',normalizedIdentifier:'jms8xy',userId:null}];
  h.state.invitations=[{id:'stale',status:'PENDING',schoolIdentityId:'identity-john',email:'jms8xy@virginia.edu',expiresAt:new Date(Date.now()-86400000)}];
  const preview=await h.api.previewRosterImport(input({csv:'name,computing_id\nJohn,jms8xy'}));assert.equal(preview.summary.ready,1);assert.equal(h.state.invitations[0].status,'PENDING');
  await h.api.confirmRosterImport(importId);
  assert.equal(h.state.invitations[0].status,'EXPIRED');assert.equal(h.state.invitations[1].status,'PENDING');
  assert.ok(h.state.audits.some(a=>a.action==='club.invite.expire'));assert.equal(h.state.identities[0].userId,null);assert.equal(h.state.identities.length,1);assert.equal(h.state.invitations[1].schoolIdentityId,'identity-john');
});

test('1,000-row imports advance in bounded batches, preserve absent members, and return exact durable category totals',async()=>{
  const h=setup();const csv=['name,year,computing_id'];
  for(let i=0;i<1000;i++)csv.push(`Student ${i},2028,large${i}`);
  h.state.users=Array.from({length:10},(_,i)=>({id:'member-'+i,email:`large${i}@virginia.edu`,disabledAt:null}));
  h.state.members=h.state.users.map(user=>({userId:user.id}));h.state.members.push({userId:'absent-from-csv'});
  h.state.invitations=Array.from({length:5},(_,i)=>({id:'existing-'+i,clubId,status:'PENDING',schoolIdentityId:null,email:`large${i+10}@virginia.edu`,expiresAt:new Date(Date.now()+86400000)}));
  await h.api.previewRosterImport(input({csv:csv.join('\n')}));let result,calls=0;
  do {const before=h.state.invitations.length;result=await h.api.confirmRosterImport(importId);assert.ok(h.state.invitations.length-before<=50);calls++;}while(!result.completed);
  assert.equal(result.created,985);assert.equal(result.alreadyMember,10);assert.equal(result.alreadyInvited,5);assert.equal(result.total,1000);assert.equal(result.processed,1000);
  assert.equal(calls,20);assert.ok(h.state.members.some(member=>member.userId==='absent-from-csv'));assert.equal(h.state.members.length,11);
  const replay=await h.api.confirmRosterImport(importId);assert.equal(replay.reused,true);assert.deepEqual(replay.rows,result.rows);
});

test('an existing account is associated through the audit row while its identity remains unclaimed; other clubs do not contaminate classification',async()=>{
  const h=setup();h.state.users=[{id:'john',email:'jms8xy@virginia.edu',disabledAt:null}];
  h.state.invitations=[{id:'other-org-invitation',clubId:'different-club',status:'PENDING',schoolIdentityId:null,email:'jms8xy@virginia.edu',expiresAt:new Date(Date.now()+86400000)}];
  await h.api.previewRosterImport(input({csv:'name,computing_id\nJohn,jms8xy'}));const result=await h.api.confirmRosterImport(importId);
  assert.equal(result.created,1);assert.equal(h.state.record.rows[0].matchedUserId,'john');assert.equal(h.state.identities[0].userId,undefined);
  assert.equal(h.state.invitations[1].clubId,clubId);assert.equal(h.state.invitations[1].requestedRole,'MEMBER');assert.equal(h.state.invitations[0].clubId,'different-club');
  await assert.rejects(h.api.previewRosterImport(input({csv:'name,computing_id,role\nJohn,jms8xy,OWNER'})),/Unsupported column/);
});
