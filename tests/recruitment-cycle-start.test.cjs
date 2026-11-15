// Starting the next recruitment cycle from the last one: one serialized transaction,
// configuration kept in place, nothing applicant-side read into or written for the
// new cycle, club-scoped authorization through the real authorizeClubTransaction.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,uuid}=require('./helpers/voting-harness.cjs');
const {unwrapAction}=load('lib/action-result.ts');

const clubX=uuid(1),clubY=uuid(2),leader=uuid(3),reviewer=uuid(4),leaderY=uuid(5),fall=uuid(10),otherClubCycle=uuid(11),newId=uuid(20);
const past=new Date(Date.now()-30*86400000),future=new Date(Date.now()+30*86400000);
// Every model that holds applicant-side or dated operational records. No method on these may write.
const applicantSide=['application','applicationAnswer','evaluation','applicantObservation','applicantRecusal','interviewRecord','interviewBooking','interviewSlot','interviewRoom','interviewRoundParticipation','interviewPanelProposal','interviewPanelScheduleVersion','interviewPanelAssignment','interviewResumeDocument','interviewResumeAnnotation','interviewCollaboration','interviewInvitation','votingSession','votingParticipant','votingCandidate','votingPass','votingPassCandidate','votingBallot','votingBallotRule','votingObservationReference','decisionLetter','clubInvitation','recruitingRuleFlag','scheduledCommunication','notificationEmailOutbox','userNotification'];
const configModels=['applicationQuestion','pipelineRound','recruitingRule','votingRuleDefault'];
const writeMethods=['create','createMany','createManyAndReturn','update','updateMany','upsert','delete','deleteMany'];

const matches=(row,where={})=>Object.entries(where).every(([k,v])=>{
 if(k==='round')return true;
 if(k==='OR')return v.some(w=>matches(row,w)); // relation filter handled by the caller
 if(v&&typeof v==='object'&&!(v instanceof Date)){if('in'in v)return v.in.includes(row[k]);if('not'in v)return row[k]!==v.not;}
 return (row[k]??null)===v;});

function harness({deadline=past,undecided=false,extraOpenCycle=false,waitlisted=0,sessions=[]}={}){
 let state={
  clubs:[{id:clubX,applicationDeadline:deadline,applicationVersion:3,decisionLetterTemplates:{ACCEPTED:{subject:'Welcome'}},suspendedAt:null},{id:clubY,applicationDeadline:null,applicationVersion:0,decisionLetterTemplates:null,suspendedAt:null}],
  cycles:[{id:fall,clubId:clubX,name:'Fall 2026',archivedAt:null,createdAt:past},{id:otherClubCycle,clubId:clubY,name:'Y Fall 2026',archivedAt:null,createdAt:past},...(extraOpenCycle?[{id:uuid(12),clubId:clubX,name:'Spring pilot',archivedAt:null,createdAt:past}]:[])],
  questions:[{id:uuid(30),clubId:clubX,prompt:'Why us?',archivedAt:null,order:0},{id:uuid(31),clubId:clubX,prompt:'Resume',archivedAt:null,order:1},{id:uuid(32),clubId:clubX,prompt:'Old',archivedAt:past,order:2}],
  rounds:[{id:uuid(40),clubId:clubX,name:'Applied',order:0,archivedAt:null,interviewKit:[],configuration:{rubric:['Fit']}},{id:uuid(41),clubId:clubX,name:'Interview',order:1,archivedAt:null,interviewKit:[{prompt:'Tell us about a project'}],configuration:{}}],
  rules:[{roundId:uuid(40),minGpa:3}],
  votingDefaults:[{id:uuid(50),clubId:clubX,roundId:null,rules:{threshold:0.5}},{id:uuid(51),clubId:clubX,roundId:uuid(41),rules:{threshold:0.66}}],
  applications:[{id:uuid(60),clubId:clubX,recruitmentCycleId:fall,status:'ACCEPTED'},{id:uuid(61),clubId:clubX,recruitmentCycleId:fall,status:undecided?'INTERVIEWING':'REJECTED'}],
  votingSessions:sessions.map((v,i)=>({id:uuid(70+i),clubId:clubX,cycleId:fall,finalizedAt:null,publishedAt:null,...v})),
  audit:[],
 };
 for(let i=0;i<waitlisted;i++)state.applications.push({id:uuid(65+i),clubId:clubX,recruitmentCycleId:fall,status:'WAITLISTED'});
 const members=[{userId:leader,clubId:clubX,status:'ACTIVE',permissions:['recruitment.manage']},{userId:reviewer,clubId:clubX,status:'ACTIVE',permissions:['applications.review','applicants.identify']},{userId:leaderY,clubId:clubY,status:'ACTIVE',permissions:['recruitment.manage']}];
 const calls=[],forbidden=[],locks=[];
 const models={
  club:{findUniqueOrThrow:async({where})=>{const c=state.clubs.find(c=>c.id===where.id);if(!c)throw Error('missing');return c},update:async({where,data})=>{const c=state.clubs.find(c=>c.id===where.id);for(const[k,v]of Object.entries(data))c[k]=v&&typeof v==='object'&&'increment'in v?c[k]+v.increment:v;return c}},
  user:{findUnique:async({where})=>members.some(m=>m.userId===where.id)?{disabledAt:null}:null},
  clubMember:{findUnique:async({where})=>members.find(m=>m.userId===where.userId_clubId.userId&&m.clubId===where.userId_clubId.clubId)??null},
  recruitmentCycle:{
   findUnique:async({where})=>state.cycles.find(c=>c.id===where.id)??null,
   findFirst:async({where})=>state.cycles.find(c=>matches(c,where))??null,
   count:async({where})=>state.cycles.filter(c=>matches(c,where)).length,
   upsert:async({where,create,update})=>{const c=state.cycles.find(c=>c.id===where.id);if(c){Object.assign(c,update);return c}state.cycles.push({createdAt:new Date(),...create});return create},
   updateMany:async({where,data})=>{const rows=state.cycles.filter(c=>matches(c,where));rows.forEach(c=>Object.assign(c,data));return{count:rows.length}},
   create:async({data})=>{if(state.cycles.some(c=>c.id===data.id||(c.clubId===data.clubId&&c.name===data.name)))throw Object.assign(Error('Unique constraint'),{code:'P2002'});const c={archivedAt:null,createdAt:new Date(),...data};state.cycles.push(c);return c}},
  votingSession:{count:async({where})=>state.votingSessions.filter(v=>matches(v,where)).length},
  application:{count:async({where})=>state.applications.filter(a=>matches(a,where)).length},
  applicationQuestion:{count:async({where})=>state.questions.filter(q=>matches(q,where)).length},
  pipelineRound:{findMany:async({where})=>state.rounds.filter(r=>matches(r,where))},
  recruitingRule:{count:async({where})=>state.rules.filter(r=>state.rounds.some(x=>x.id===r.roundId&&x.clubId===where.round.clubId&&x.archivedAt===where.round.archivedAt)).length},
  votingRuleDefault:{count:async({where})=>state.votingDefaults.filter(v=>matches(v,where)).length},
  auditLog:{create:async({data})=>{state.audit.push(data);return data},findFirst:async({where})=>state.audit.find(a=>matches(a,where))??null},
 };
 const model=name=>new Proxy(models[name]??{},{get(target,method){
  if(typeof method!=='string')return target[method];
  return async(...args)=>{
   calls.push(`${name}.${method}`);
   if(writeMethods.includes(method)&&(applicantSide.includes(name)||configModels.includes(name)))forbidden.push(`${name}.${method}`);
   if(!target[method])throw Error(`Unexpected ${name}.${method}`);
   return target[method](...args);
  };}});
 const tx=new Proxy({},{get(_t,prop){
  if(prop==='$queryRaw')return async(strings,...values)=>{const sql=strings.join('?');if(/FOR UPDATE/.test(sql)&&/"Club"/.test(sql))locks.push(values[0]);if(/"suspendedAt" IS NOT NULL/.test(sql))return state.clubs.find(c=>c.id===values[0])?.suspendedAt?[{id:values[0]}]:[];return[]};
  if(prop==='then')return undefined;
  return model(prop);}});
 // Serialized like the club row lock; a failure rolls back every write in the command.
 let chain=Promise.resolve(),actor=leader,permissionChecks=[];
 const clubWriteTransaction=work=>{const run=chain.then(async()=>{const before=structuredClone(state);try{return await work(tx)}catch(e){state=before;throw e}});chain=run.catch(()=>{});return run};
 const api=load('actions/recruitment-management.ts',{
  '@/utils/club-write-transaction':{clubWriteTransaction},
  '@/utils/auth':{requireClubPermission:async(clubId,permissions)=>{permissionChecks.push([clubId,permissions]);return{user:{id:actor}}}},
 });
 // Both actions return actionResult envelopes; unwrapping turns a refusal into the UserFacingError the client shows.
 const start=async(extra={})=>unwrapAction(await api.startRecruitmentCycleFromPrevious({id:newId,clubId:clubX,sourceCycleId:fall,name:'Spring 2027',...extra}));
 const archive=async(id=fall)=>unwrapAction(await api.saveRecruitmentCycle({id,clubId:clubX,name:'Fall 2026',archived:true}));
 return{api,start,archive,state:()=>state,calls,forbidden,locks,permissionChecks,as:id=>actor=id,suspend:()=>state.clubs[0].suspendedAt=new Date()};
}
const configSnapshot=s=>structuredClone({questions:s.questions,rounds:s.rounds,rules:s.rules,votingDefaults:s.votingDefaults,templates:s.clubs[0].decisionLetterTemplates});

test('starts the next cycle: configuration kept in place, source archived and linked by audit, passed deadline unset',async()=>{
 const h=harness(),before=configSnapshot(h.state()),applicationsBefore=structuredClone(h.state().applications);
 const r=await h.start();
 assert.deepEqual(r,{success:true,id:newId,replayed:false,archivedSourceCycle:true,clearedApplicationDeadline:true,carriedForward:{questions:2,rounds:2,interviewKits:1,screeningRules:1,votingRuleDefaults:2,decisionLetterTemplates:true}});
 const s=h.state(),created=s.cycles.find(c=>c.id===newId);
 assert.equal(created.clubId,clubX);assert.equal(created.name,'Spring 2027');assert.equal(created.archivedAt,null);
 assert.ok(s.cycles.find(c=>c.id===fall).archivedAt instanceof Date,'source archived so new applications join only the new cycle');
 assert.equal(s.cycles.find(c=>c.id===otherClubCycle).archivedAt,null,'another club is untouched');
 assert.deepEqual(configSnapshot(s),before,'questions, rounds and order, rubric/rules, kits, voting defaults and letter templates are kept as is');
 assert.equal(s.clubs[0].applicationDeadline,null);assert.equal(s.clubs[0].applicationVersion,4,'clearing the deadline bumps the application version');
 assert.deepEqual(s.applications,applicationsBefore,'applications keep their original cycle');
 assert.equal(s.audit.length,1);
 assert.deepEqual(s.audit[0],{actorId:leader,clubId:clubX,targetId:newId,action:'recruitment.cycle.started_from_previous',details:{name:'Spring 2027',sourceCycleId:fall,sourceCycleName:'Fall 2026',archivedSourceCycle:true,clearedApplicationDeadline:true,carriedForward:r.carriedForward}});
 assert.deepEqual(h.locks,[clubX],'club row locked once, FOR UPDATE');
 assert.deepEqual(h.permissionChecks,[[clubX,['recruitment.manage']]]);
});

test('copies zero applicant-side rows and writes no configuration rows',async()=>{
 const h=harness();await h.start();
 assert.deepEqual(h.forbidden,[]);
 const writes=h.calls.filter(c=>writeMethods.includes(c.split('.')[1]));
 assert.deepEqual(writes,['recruitmentCycle.updateMany','club.update','recruitmentCycle.create','auditLog.create'],'the only writes: archive source, clear passed deadline, create cycle, audit');
 for(const name of applicantSide)assert.ok(!h.calls.some(c=>c.startsWith(`${name}.`)&&!['application.count','votingSession.count'].includes(c)),`${name} is only counted, never read or written`);
});

test('a future deadline is kept; an already archived source is not re-archived',async()=>{
 const h=harness({deadline:future});h.state().cycles[0].archivedAt=past;
 const r=await h.start();
 assert.equal(r.clearedApplicationDeadline,false);assert.equal(r.archivedSourceCycle,false);
 assert.equal(+h.state().clubs[0].applicationDeadline,+future);assert.equal(h.state().clubs[0].applicationVersion,3);
 assert.equal(+h.state().cycles[0].archivedAt,+past);
 assert.ok(!h.calls.includes('application.count'),'no applicant read when nothing is archived');
});

test('cross-club source is denied without writes',async()=>{
 const h=harness();
 await assert.rejects(h.start({sourceCycleId:otherClubCycle}),/Cycle unavailable/);
 assert.equal(h.state().cycles.length,2);assert.equal(h.state().audit.length,0);assert.equal(h.state().cycles[1].archivedAt,null);
 h.as(leaderY);
 await assert.rejects(h.start(),/Club access denied/,'a leader of another club cannot start a cycle in this club');
 await assert.rejects(h.start({clubId:clubY}),/Cycle unavailable/,'nor use this club\'s cycle as a source for theirs');
 assert.equal(h.state().cycles.length,2);assert.deepEqual(h.forbidden,[]);
});

test('a member without recruitment.manage is denied, and a suspended club is refused',async()=>{
 const h=harness();h.as(reviewer);
 await assert.rejects(h.start(),/Club access denied/);
 assert.equal(h.state().cycles.length,2);assert.equal(h.state().cycles[0].archivedAt,null);
 h.as(leader);h.suspend();
 await assert.rejects(h.start(),/suspended/);
 assert.equal(h.state().cycles.length,2);assert.equal(h.state().audit.length,0);
});

test('a double submit creates one cycle; a second tab with a new id is refused',async()=>{
 const h=harness();
 const [a,b]=await Promise.all([h.start(),h.start()]);
 assert.equal(a.replayed,false);assert.deepEqual(b,{success:true,id:newId,replayed:true});
 await assert.rejects(h.start({id:uuid(21),name:'Spring 2027 (2)'}),/other open cycles/);
 assert.equal(h.state().cycles.filter(c=>c.clubId===clubX).length,2);assert.equal(h.state().audit.length,1);
 await assert.rejects(h.start({sourceCycleId:uuid(12)}),/Cycle unavailable/,'replaying an id with a different source is refused');
});

test('refuses while the source has undecided applications, another cycle is open, or the name is taken; nothing persists',async()=>{
 let h=harness({undecided:true});
 await assert.rejects(h.start(),/Fall 2026 still has 1 undecided application\./);assert.equal(h.state().cycles[0].archivedAt,null);assert.equal(h.state().cycles.length,2);
 h=harness({extraOpenCycle:true});
 await assert.rejects(h.start(),/other open cycles/);assert.equal(h.state().cycles.length,3);
 h=harness();
 await assert.rejects(h.start({name:'Fall 2026'}),/already exists/);assert.equal(h.state().cycles[0].archivedAt,null);assert.equal(+h.state().clubs[0].applicationDeadline,+past);
});

test('input is strict zod: unknown fields and bad ids are rejected before any authorization',async()=>{
 const h=harness();
 await assert.rejects(h.api.startRecruitmentCycleFromPrevious({id:newId,clubId:clubX,sourceCycleId:fall,name:'X',copyApplicants:true}));
 await assert.rejects(h.api.startRecruitmentCycleFromPrevious({id:'nope',clubId:clubX,sourceCycleId:fall,name:'X'}));
 await assert.rejects(h.api.startRecruitmentCycleFromPrevious({id:newId,clubId:clubX,sourceCycleId:fall,name:'  '}));
 assert.deepEqual(h.permissionChecks,[]);
});

test('shared copy lists and deadline rule',()=>{
 const lib=load('lib/recruitment-cycle.ts');
 assert.equal(lib.nextCycleDeadline(past,new Date()),null);assert.equal(lib.nextCycleDeadline(null,new Date()),null);assert.equal(lib.nextCycleDeadline(future,new Date()),future);
 assert.ok(lib.nextCycleCarriesForward.length===6&&lib.nextCycleLeavesBehind.some(t=>/ballots/i.test(t)));
});

test('refuses while the source has a live or unfinalized voting session; nothing is written',async()=>{
 for(const session of [{state:'OPEN'},{state:'DRAFT'},{state:'PAUSED'},{state:'COMPLETED'}]){
  const h=harness({sessions:[session]});
  await assert.rejects(h.start(),/1 voting session in progress or awaiting finalization/,session.state);
  assert.equal(h.state().cycles.length,2);assert.equal(h.state().cycles[0].archivedAt,null);assert.equal(+h.state().clubs[0].applicationDeadline,+past);assert.equal(h.state().audit.length,0);
  assert.deepEqual(h.calls.filter(c=>writeMethods.includes(c.split('.')[1])),[]);
 }
 for(const session of [{state:'COMPLETED',finalizedAt:past},{state:'COMPLETED',publishedAt:past},{state:'OPEN',cycleId:uuid(99)},{state:'OPEN',clubId:clubY}]){
  const h=harness({sessions:[session]});assert.equal((await h.start()).replayed,false,JSON.stringify(session));
 }
});

test('refuses while the source has waitlisted applications, with the count',async()=>{
 let h=harness({waitlisted:2});
 await assert.rejects(h.start(),/Fall 2026 still has 2 waitlisted applications\./);
 assert.equal(h.state().cycles.length,2);assert.equal(h.state().cycles[0].archivedAt,null);assert.equal(h.state().audit.length,0);
 h=harness({waitlisted:1,undecided:true});
 await assert.rejects(h.start(),/1 undecided application and 1 waitlisted application\./);
});

test('replaying an id with a different name is refused, not reported as success',async()=>{
 const h=harness();await h.start();
 await assert.rejects(h.start({name:'Spring 2027 renamed'}),/Cycle unavailable/);
 assert.equal(h.state().cycles.find(c=>c.id===newId).name,'Spring 2027');assert.equal(h.state().audit.length,1);
 assert.equal((await h.start()).replayed,true);
});

test('the plain archive action refuses while a vote is live; restore and rename are unaffected',async()=>{
 const h=harness({sessions:[{state:'OPEN'}]});
 await assert.rejects(h.archive(),/voting session in progress/);
 assert.equal(h.state().cycles[0].archivedAt,null);assert.equal(h.state().audit.length,0);
 unwrapAction(await h.api.saveRecruitmentCycle({id:fall,clubId:clubX,name:'Fall 2026 class',archived:false}));
 assert.equal(h.state().cycles[0].name,'Fall 2026 class');
 h.state().votingSessions[0].finalizedAt=new Date();h.state().votingSessions[0].state='COMPLETED';
 unwrapAction(await h.api.saveRecruitmentCycle({id:fall,clubId:clubX,name:'Fall 2026 class',archived:true}));
 assert.ok(h.state().cycles[0].archivedAt instanceof Date);
});

test('Archive refuses while any applicant still waits on a decision, with the reason a leader sees; nothing is written',async()=>{
 for(const [options,reason] of [[{undecided:true},/^Fall 2026 still has 1 undecided application\. Record final decisions before archiving this cycle\.$/],[{waitlisted:2},/^Fall 2026 still has 2 waitlisted applications\. Record final decisions before archiving this cycle\.$/]]){
  const h=harness(options);
  const result=await h.api.saveRecruitmentCycle({id:fall,clubId:clubX,name:'Fall 2026',archived:true});
  // Returned, not thrown: a thrown message is replaced by a generic one in production builds.
  assert.equal(result.ok,false);assert.equal(result.code,'CYCLE_NOT_CLOSABLE');assert.match(result.error,reason);
  assert.equal(h.state().cycles[0].archivedAt,null);assert.equal(h.state().audit.length,0);
  assert.deepEqual(h.calls.filter(c=>writeMethods.includes(c.split('.')[1])),[]);
 }
});

test('Archive succeeds once every applicant has a final decision; renaming and restoring never read applicants',async()=>{
 let h=harness();
 await h.archive();
 assert.ok(h.state().cycles[0].archivedAt instanceof Date);assert.equal(h.state().audit[0].action,'recruitment.cycle.saved');
 h=harness({undecided:true});
 unwrapAction(await h.api.saveRecruitmentCycle({id:fall,clubId:clubX,name:'Fall 2026 class',archived:false}));
 assert.equal(h.state().cycles[0].name,'Fall 2026 class');
 h.state().cycles[0].archivedAt=past;
 unwrapAction(await h.api.saveRecruitmentCycle({id:fall,clubId:clubX,name:'Fall 2026 class',archived:true}));
 assert.equal(+h.state().cycles[0].archivedAt,+past,'an already archived cycle is renamed without re-checking or re-dating');
 assert.ok(!h.calls.includes('application.count'),'only archiving an open cycle reads applicant statuses');
});

test('start refusals are returned with the leader-facing reason; a lost permission is returned as FORBIDDEN, and bad input still throws',async()=>{
 const result=await harness({undecided:true}).api.startRecruitmentCycleFromPrevious({id:newId,clubId:clubX,sourceCycleId:fall,name:'Spring 2027'});
 assert.deepEqual([result.ok,result.code],[false,'CYCLE_NOT_CLOSABLE']);assert.match(result.error,/before starting the next cycle\.$/);
 const h=harness();h.as(reviewer);
 for(const denied of [await h.api.startRecruitmentCycleFromPrevious({id:newId,clubId:clubX,sourceCycleId:fall,name:'Spring 2027'}),await h.api.saveRecruitmentCycle({id:fall,clubId:clubX,name:'Fall 2026',archived:true})])
  assert.deepEqual([denied.ok,denied.code],[false,'FORBIDDEN']);
 assert.equal(h.state().cycles[0].archivedAt,null);assert.equal(h.state().audit.length,0);
 await assert.rejects(h.api.saveRecruitmentCycle({id:fall,clubId:clubX,name:'',archived:true}),'invalid input is a thrown validation error, never a result');
});

test('decision publication and offer responses do not depend on whether the cycle is archived',()=>{
 const fs=require('node:fs');
 for(const file of ['utils/recruitment-offers.ts','actions/recruitment-offers.ts','actions/decision-schedules.ts','utils/scheduled-communications.ts'])
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/recruitmentCycle|cycle\??\.archivedAt|cycleId/,`${file} must not gate decisions on the cycle`);
});
