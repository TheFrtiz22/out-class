const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks) {
  const m = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.slice(2)+'.ts',mocks) : require(n),m,m.exports);
  return m.exports;
}
const clubId='00000000-0000-4000-8000-000000000001', eventId='00000000-0000-4000-8000-000000000002';
function harness() {
  const state={disabled:false,member:{status:'ACTIVE',permissions:['meetings.manage','meetings.attendance']},suspended:false,eventClub:clubId,queries:[],reads:0};
  const tx={
    $queryRaw:async (sql) => String(sql).includes('"suspendedAt"') && state.suspended ? [{id:clubId}] : [],
    user:{findUnique:async()=>({disabledAt:state.disabled ? new Date():null})},
    clubMember:{findUnique:async()=>state.member},
    meeting:{findMany:async q=>{state.queries.push(q);state.reads++;return []},findFirst:async q=>{state.queries.push(q);state.reads++;return q.where.clubId===state.eventClub ? {id:eventId,publication:{capacity:2}}:null}},
    eventRsvp:{findMany:async q=>{state.queries.push(q); return [
      {createdAt:new Date('2026-10-01'),user:{email:'attendee@virginia.edu',studentProfile:{firstName:'Student',lastName:'One'},applications:[]}},
      {createdAt:new Date('2026-10-02'),user:{email:'private@virginia.edu',studentProfile:{firstName:'Private',lastName:'Applicant'},applications:[{id:'app'}]}},
    ]}},
  };
  const api=load('actions/campus-events.ts',{
    '@/utils/prisma':{prisma:{$transaction:async fn=>fn(tx)}},
    '@/utils/auth':{requireClubPermission:async()=>({user:{id:'leader'}})},
    '@/utils/platform-admin':{},'next/cache':{},
  });
  return {state,api};
}
test('leader overview scopes and projects event data without fetching attendees or recruitment graphs',async()=>{
  const {api,state}=harness();await api.listClubCampusEvents(clubId);
  const q=state.queries[0];assert.equal(q.where.clubId,clubId);assert.deepEqual(q.select._count,{select:{rsvps:true}});
  assert.equal(q.select.publication.select.capacity,true);assert.equal(q.select.publication.select.reviewedAt,true);
  assert.equal(q.select.club.select.members,undefined);assert.equal(q.select.rsvps,undefined);
});
test('RSVP dashboard uses one canonical snapshot and redacts anonymous applicant identity',async()=>{
  const {api,state}=harness();const value=await api.getCampusEventRsvpDashboard(clubId,eventId);
  assert.equal(value.count,2);assert.equal(value.capacity,2);assert.equal(value.attendees[0].name,'Student One');
  assert.deepEqual(value.attendees[1],{name:'Anonymous applicant',email:null,createdAt:'2026-10-02T00:00:00.000Z'});
  const q=state.queries[1];assert.deepEqual(Object.keys(q.select.user.select).sort(),['applications','email','studentProfile']);assert.equal(q.select.user.select.applications.take,1);
  state.eventClub='other';await assert.rejects(api.getCampusEventRsvpDashboard(clubId,eventId),/unavailable/);
});
test('live reauthorization rejects disabled, revoked, wrong-capability and suspended actors before event reads/writes',async()=>{
  for(const patch of [{disabled:true},{member:null},{member:{status:'INACTIVE',isOwner:true}},{member:{status:'ACTIVE',permissions:[]}},{suspended:true}]){
    const {api,state}=harness();Object.assign(state,patch);
    await assert.rejects(api.listClubCampusEvents(clubId));await assert.rejects(api.getCampusEventRsvpDashboard(clubId,eventId));
    await assert.rejects(api.commandCampusEvent({clubId,eventId,revision:0,command:'SUBMIT'}));assert.equal(state.reads,0);
  }
});
test('leader labels preserve canonical states and capacity semantics',()=>{
  const {managedEventStatus,eventRsvpSummary}=load('lib/campus-events.ts',{});
  assert.equal(managedEventStatus({status:'DRAFT',submittedAt:null}),'Draft');
  assert.match(managedEventStatus({status:'DRAFT',submittedAt:'2026-10-01'}),/approval/i);
  assert.match(eventRsvpSummary(2,2),/full/i);assert.match(eventRsvpSummary(2,null),/unlimited/i);assert.match(eventRsvpSummary(2,5),/3 spots/i);
});
