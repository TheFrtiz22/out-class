// "Assign me" on the applicant review: the owner's one-click grant is the existing audited
// setInterviewPanelAssignment with the actor as target. These cover who may and may not use it.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,id}=require('./helpers/interview-harness.cjs');

const OWNER=10,OWNER_MEMBER=id(20),PEER=11,PEER_MEMBER=id(21);
function setup(){
  const h=harness(),api=h.load('actions/organization-members.ts'),notices=[];
  h.tx.interviewBooking.findMany=async()=>[];
  h.tx.userNotification.createMany=async({data})=>{notices.push(...data);return{count:data.length}};
  // Like Prisma, reads return copies and upsert returns the row (the shared harness mutates in place).
  const grants=h.tx.interviewPanelAssignment,find=grants.findUnique,upsert=grants.upsert;
  grants.findUnique=async args=>{const row=await find(args);return row&&{...row}};
  grants.upsert=async args=>{await upsert(args);return {...await find({where:args.where})}};
  // Neither the owner nor the peer is on this applicant's panel yet.
  h.assignments[0].revokedAt=new Date();h.assignments[1].revokedAt=new Date();
  const self=(member)=>({...h.scope,memberId:member,assigned:true});
  return {h,api,notices,self};
}
const raw=(h,graduated)=>{h.tx.$queryRaw=async(strings,...values)=>{const sql=strings.join('?');if(sql.includes('"graduatedAt"'))return graduated.includes(values[0])?[{graduatedAt:new Date('2020-05-20T00:00:00Z')}]:[{graduatedAt:null}];return[]}};

test('owner: Assign me grants their own panel seat through the audited action, then they can grade',async()=>{
  const {h,api,notices,self}=setup();h.as(OWNER);
  const result=await api.setInterviewPanelAssignment(self(OWNER_MEMBER));
  assert.equal(result.assigned,true);assert.equal(result.memberId,OWNER_MEMBER);
  assert.equal(h.assignments[0].revokedAt,null);assert.equal(h.assignments[0].grantedBy,id(OWNER));
  const audit=h.state.audits.at(-1);assert.equal(audit.action,'interview.panel.change');assert.equal(audit.actorId,id(OWNER));assert.equal(audit.targetId,OWNER_MEMBER);assert.equal(audit.details.assigned,true);
  assert.equal(notices.length,0,'no assignment notice to yourself');
  const session=await h.load('actions/interview-kits.ts').openInterviewSession(h.scope);
  assert.ok(session,'the newly assigned owner can open the interview to grade');
  const {applicationReviewVisibility}=h.load('lib/application-review-visibility.ts');
  const owner=h.members[0],vis=applicationReviewVisibility({studentId:h.app.studentId,roundId:h.app.roundId,evaluations:[],interviewAssignments:[{memberId:owner.id,roundId:h.app.roundId,member:owner}]},owner);
  assert.equal(vis.assigned&&vis.caps.participate&&!vis.ownSubmitted,true,'pipeline detail would report canEvaluate');
});

test('owner assigning someone else still notifies them (unchanged behaviour)',async()=>{
  const {h,api,notices,self}=setup();h.as(OWNER);
  await api.setInterviewPanelAssignment(self(PEER_MEMBER));
  assert.equal(notices.length,1);assert.equal(notices[0].userId,id(PEER));
});

test('non-manager is refused, including a member with scheduling and member-management permissions',async()=>{
  const {h,api,self}=setup();h.as(PEER);
  await assert.rejects(api.setInterviewPanelAssignment(self(PEER_MEMBER)),/access denied|owner/i);
  h.members[1].permissions.push('members.manage','leaders.manage','interviews.manage');
  await assert.rejects(api.setInterviewPanelAssignment(self(PEER_MEMBER)),/Only an active owner/);
  assert.ok(h.assignments[1].revokedAt,'no seat was granted');assert.equal(h.state.audits.length,0);
});

test('recused owner is refused and stays off the panel',async()=>{
  const {h,api,self}=setup();h.as(OWNER);
  h.tx.applicantRecusal.findFirst=async({where})=>where.memberId===OWNER_MEMBER&&where.applicationId===h.app.id&&where.liftedAt===null?{id:'recusal'}:null;
  await assert.rejects(api.setInterviewPanelAssignment(self(OWNER_MEMBER)),/stepped out/);
  assert.ok(h.assignments[0].revokedAt);assert.equal(h.state.audits.length,0);
});

test('alumni are refused: a graduate kept as owner and a graduated leader',async()=>{
  const {h,api,self}=setup();raw(h,[id(OWNER),id(PEER)]);
  h.as(OWNER);await assert.rejects(api.setInterviewPanelAssignment(self(OWNER_MEMBER)),/owner|access denied/i);
  h.members[1].permissions.push('members.manage');h.as(PEER);
  await assert.rejects(api.setInterviewPanelAssignment(self(PEER_MEMBER)),/owner|access denied/i);
  assert.ok(h.assignments[0].revokedAt);assert.ok(h.assignments[1].revokedAt);assert.equal(h.state.audits.length,0);
});

test('anonymous rounds and suspended clubs refuse Assign me',async()=>{
  const {h,api,self}=setup();h.as(OWNER);
  h.round.anonymousReview=true;
  await assert.rejects(api.setInterviewPanelAssignment(self(OWNER_MEMBER)),/identified reviewer/);
  h.round.anonymousReview=false;
  h.tx.$queryRaw=async strings=>strings.join('?').includes('"suspendedAt" IS NOT NULL')?[{id:h.scope.clubId}]:[];
  await assert.rejects(api.setInterviewPanelAssignment(self(OWNER_MEMBER)),/suspended/);
  assert.ok(h.assignments[0].revokedAt);
});

test('review grading offers Assign me only to owners not yet on an identified panel, via the existing action',()=>{
  const flow=fs.readFileSync('components/applicant-review/applicant-review-flow.tsx','utf8'),grading=fs.readFileSync('components/applicant-review/review-grading.tsx','utf8');
  assert.match(flow,/interviewAccess\.manageGrants && interviewAccess\.participate/);
  assert.match(flow,/!app\.canEvaluate && !anonymous && !activeRound\?\.anonymousReview && app\.studentId !== membership\.userId/);
  assert.match(flow,/setInterviewPanelAssignment\(\{ clubId, applicationId: app\.id, roundId: app\.roundId, memberId: membership\.id, assigned: true \}\)/);
  assert.match(grading,/"Assign me"/);
});

test('a leader of another club (no membership in this club) is refused',async()=>{
  const {h,api,self}=setup();h.as(OWNER);h.deny(true);
  await assert.rejects(api.setInterviewPanelAssignment(self(OWNER_MEMBER)),/access denied/i);
  assert.ok(h.assignments[0].revokedAt);assert.equal(h.state.audits.length,0);
});
