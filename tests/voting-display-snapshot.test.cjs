const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,uuid}=require('./helpers/voting-harness.cjs');
const clubId=uuid(1),applicationId=uuid(2),memberId=uuid(3),sessionId=uuid(4);
function harness(live=false){
 let caps=['applications.review','applicants.identify','decisions.vote','decisions.manage'],participant=true;
 const round={id:uuid(5),name:'Interview',anonymousReview:false,applicantDisplay:{version:1,fields:['name','major','resume']}};
 const app={id:applicationId,clubId,roundId:round.id,round,status:'INTERVIEWING',student:{id:uuid(6),studentProfile:{firstName:'Jordan',lastName:'Avery',major:'Math',gradYear:2028,gpa:3.9,actScore:33,actEnglish:35,bio:'Historical',headshotUrl:`${uuid(6)}/photo.png`,resumeUrl:`${uuid(6)}/resume.pdf`,linkedinUrl:'https://linkedin.com/in/example',experiences:[]}},evaluations:[],answers:[]};
 const session={displayConfig:{version:1,fields:['name','photo','gpa','act','resume','linkedin']},participants:[{memberId}],candidates:[{applicationId}]};
 const tx={clubMember:{findFirst:async()=>({id:memberId,status:'ACTIVE',permissions:caps})},application:{findFirst:async()=>app},applicantObservation:{findMany:async()=>[]},votingSession:{findFirst:async({where})=>where.id===sessionId&&where.clubId===clubId?{...session,participants:participant?session.participants:[]}:null}};
 if(live){
  Object.assign(app,{recruitmentCycleId:uuid(20)});Object.assign(session,{id:sessionId,clubId,cycleId:uuid(20),roundId:round.id,mode:'LIVE',leaderMemberIds:[memberId],activeApplicationId:applicationId,passes:[]});
  Object.assign(tx,{$queryRaw:async()=>[],club:{findUnique:async()=>({suspendedAt:null})},user:{findUnique:async()=>({disabledAt:null})},pipelineRound:{findFirst:async()=>round},recruitmentCycle:{findFirst:async()=>({id:uuid(20)})}});
  tx.clubMember.findUnique=async()=>({id:memberId,status:'ACTIVE',permissions:caps});
 }
 const api=load('actions/applicant-intelligence.ts',{'@/utils/auth':{requireClubPermission:async(c,required)=>{if(c!==clubId||!required.every(v=>caps.includes(v)))throw Error('Denied');return{user:{id:memberId},membership:{id:memberId}}}},'@/utils/prisma':{prisma:{$transaction:f=>f(tx)}}});
 return{api,round,app,session,tx,caps:v=>caps=v,uninvite:()=>participant=false};
}
test('session snapshot overrides general settings, returns only selected fields and keeps Prompt 37 privacy',async()=>{
 const h=harness(),scope={clubId,applicationId,sessionId};let view=await h.api.getApplicantDisplay(scope);assert.deepEqual(view.visible,h.session.displayConfig.fields);assert.ok(view.photo);assert.equal(view.links.length,2);assert.doesNotMatch(JSON.stringify(view),/Historical|actEnglish|Math/);
 h.round.applicantDisplay={version:1,fields:[]};view=await h.api.getApplicantDisplay(scope);assert.deepEqual(view.visible,h.session.displayConfig.fields);
 h.round.anonymousReview=true;h.caps(['applications.review','decisions.vote']);view=await h.api.getApplicantDisplay(scope);assert.equal(view.photo,null);assert.deepEqual(view.links,[]);assert.doesNotMatch(JSON.stringify(view),/Jordan|Avery|photo.png|resume.pdf|linkedin.com/);assert.deepEqual(view.sections.find(s=>s.field==='act').items,['33']);
});
test('LIVE presentation reuses canonical field/anonymity projection and rechecks current cycle, role and candidate',async()=>{
 const h=harness(true),scope={clubId,applicationId,sessionId};h.caps(['applications.review','applicants.identify','decisions.start']);
 let view=await h.api.getApplicantDisplay(scope);assert.ok(view.photo,'explicit nonvoting leader may present selected fields');assert.doesNotMatch(JSON.stringify(view),/Historical|actEnglish/);
 h.caps(['applications.review','applicants.identify','decisions.vote']);h.session.activeApplicationId=uuid(99);await assert.rejects(h.api.getApplicantDisplay(scope),/presentation changed/);
 h.session.activeApplicationId=applicationId;h.app.recruitmentCycleId=uuid(99);await assert.rejects(h.api.getApplicantDisplay(scope),/presentation changed/);h.app.recruitmentCycleId=uuid(20);
 h.round.anonymousReview=true;h.caps(['applications.review','decisions.vote']);view=await h.api.getApplicantDisplay(scope);assert.doesNotMatch(JSON.stringify(view),/Jordan|Avery|resume.pdf|linkedin.com/);
 h.uninvite();h.caps(['applications.review','decisions.manage']);await assert.rejects(h.api.getApplicantDisplay(scope),/access denied/);
});
test('LIVE display reloads privacy after acquiring the club lock rather than returning a pre-lock identity snapshot',async()=>{
 const h=harness(true);let reads=0;
 h.tx.application.findFirst=async()=>{const snapshot=structuredClone(h.app);if(++reads===1)h.round.anonymousReview=true;return snapshot;};
 const view=await h.api.getApplicantDisplay({clubId,applicationId,sessionId});assert.equal(reads,2);assert.doesNotMatch(JSON.stringify(view),/Jordan|Avery|resume.pdf|photo.png|linkedin.com/);
});
test('voting display and previews require real server capabilities and correct session/candidate scope',async()=>{
 const h=harness();h.caps(['applications.review','applicants.identify','decisions.vote']);await assert.rejects(h.api.getApplicantDisplay({clubId,applicationId,previewConfig:{version:1,fields:['name']}}),/setup permission/);await h.api.getApplicantDisplay({clubId,applicationId,sessionId});h.uninvite();await assert.rejects(h.api.getApplicantDisplay({clubId,applicationId,sessionId}),/unavailable/);
 await assert.rejects(h.api.getApplicantDisplay({clubId,applicationId,sessionId:uuid(99)}),/unavailable/);h.session.candidates=[];h.caps(['applications.review','applicants.identify','decisions.manage']);await assert.rejects(h.api.getApplicantDisplay({clubId,applicationId,sessionId}),/unavailable/);h.caps(['applications.review','decisions.vote']);h.round.anonymousReview=false;await assert.rejects(h.api.getApplicantDisplay({clubId,applicationId,sessionId}),/reviewer/);
});
