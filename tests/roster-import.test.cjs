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
    $queryRaw:async()=>[],club:{findUniqueOrThrow:async()=>({id:clubId,schoolId:'school-uva'})},
    clubMember:{findUnique:async()=>state.member,findMany:async()=>state.members},schoolIdentifierType:{findMany:async()=>[config]},
    user:{findUnique:async()=>({disabledAt:null}),findMany:async()=>state.users,create:()=>{throw Error('Fake user forbidden');}},
    schoolIdentity:{findMany:async()=>state.identities,upsert:async({create})=>{const existing=state.identities.find(i=>i.normalizedIdentifier===create.normalizedIdentifier);if(existing)return existing;const identity={id:'identity-'+create.normalizedIdentifier,...create};state.identities.push(identity);state.writes.push('identity');return identity;}},
    clubInvitation:{findMany:async({where})=>state.invitations.filter(invite=>invite.status==='PENDING'&&(where.expiresAt.gt?invite.expiresAt>where.expiresAt.gt:invite.expiresAt<=where.expiresAt.lte)),create:async({data})=>{const invite={id:'invite-'+state.invitations.length,status:'PENDING',...data};state.invitations.push(invite);state.writes.push('invitation');return invite;},update:async({where,data})=>Object.assign(state.invitations.find(i=>i.id===where.id),data)},
    rosterImport:{findUnique:async()=>state.record,findUniqueOrThrow:async()=>state.record,create:async({data})=>{state.record={id:importId,...data,rows:data.rows.create.map((row,i)=>({id:'row-'+i,...row}))};state.writes.push('import');return state.record;},update:async({data})=>Object.assign(state.record,data)},
    rosterImportRow:{update:async({where,data})=>Object.assign(state.record.rows.find(row=>row.id===where.id),data)},
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
