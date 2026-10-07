const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,uuid}=require('./helpers/voting-harness.cjs');
const clubId=uuid(1),applicationId=uuid(2),memberId=uuid(3),sessionId=uuid(4);
function harness(){
 let caps=['applications.review','applicants.identify','decisions.vote','decisions.manage'],participant=true;
 const round={id:uuid(5),name:'Interview',anonymousReview:false,applicantDisplay:{version:1,fields:['name','major','resume']}};
 const app={id:applicationId,clubId,roundId:round.id,round,status:'INTERVIEWING',student:{id:uuid(6),studentProfile:{firstName:'Jordan',lastName:'Avery',major:'Math',gradYear:2028,gpa:3.9,actScore:33,actEnglish:35,bio:'Historical',headshotUrl:`${uuid(6)}/photo.png`,resumeUrl:`${uuid(6)}/resume.pdf`,linkedinUrl:'https://linkedin.com/in/example',experiences:[]}},evaluations:[],answers:[]};
 const session={displayConfig:{version:1,fields:['name','photo','gpa','act','resume','linkedin']},participants:[{memberId}],candidates:[{applicationId}]};
 const tx={clubMember:{findFirst:async()=>({id:memberId,status:'ACTIVE',permissions:caps})},application:{findFirst:async()=>app},applicantObservation:{findMany:async()=>[]},votingSession:{findFirst:async({where})=>where.id===sessionId&&where.clubId===clubId?{...session,participants:participant?session.participants:[]}:null}};
 const api=load('actions/applicant-intelligence.ts',{'@/utils/auth':{requireClubPermission:async(c,required)=>{if(c!==clubId||!required.every(v=>caps.includes(v)))throw Error('Denied');return{user:{id:memberId},membership:{id:memberId}}}},'@/utils/prisma':{prisma:{$transaction:f=>f(tx)}}});
 return{api,round,app,session,caps:v=>caps=v,uninvite:()=>participant=false};
}
test('session snapshot overrides general settings, returns only selected fields and keeps Prompt 37 privacy',async()=>{
 const h=harness(),scope={clubId,applicationId,sessionId};let view=await h.api.getApplicantDisplay(scope);assert.deepEqual(view.visible,h.session.displayConfig.fields);assert.ok(view.photo);assert.equal(view.links.length,2);assert.doesNotMatch(JSON.stringify(view),/Historical|actEnglish|Math/);
 h.round.applicantDisplay={version:1,fields:[]};view=await h.api.getApplicantDisplay(scope);assert.deepEqual(view.visible,h.session.displayConfig.fields);
 h.round.anonymousReview=true;h.caps(['applications.review','decisions.vote']);view=await h.api.getApplicantDisplay(scope);assert.equal(view.photo,null);assert.deepEqual(view.links,[]);assert.doesNotMatch(JSON.stringify(view),/Jordan|Avery|photo.png|resume.pdf|linkedin.com/);assert.deepEqual(view.sections.find(s=>s.field==='act').items,['33']);
});
test('voting display and previews require real server capabilities and correct session/candidate scope',async()=>{
 const h=harness();h.caps(['applications.review','applicants.identify','decisions.vote']);await assert.rejects(h.api.getApplicantDisplay({clubId,applicationId,previewConfig:{version:1,fields:['name']}}),/setup permission/);await h.api.getApplicantDisplay({clubId,applicationId,sessionId});h.uninvite();await assert.rejects(h.api.getApplicantDisplay({clubId,applicationId,sessionId}),/unavailable/);
 await assert.rejects(h.api.getApplicantDisplay({clubId,applicationId,sessionId:uuid(99)}),/unavailable/);h.session.candidates=[];h.caps(['applications.review','applicants.identify','decisions.manage']);await assert.rejects(h.api.getApplicantDisplay({clubId,applicationId,sessionId}),/unavailable/);h.caps(['applications.review','decisions.vote']);h.round.anonymousReview=false;await assert.rejects(h.api.getApplicantDisplay({clubId,applicationId,sessionId}),/reviewer/);
});
