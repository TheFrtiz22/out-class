const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
function load(file, mocks = {}) {
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports);
  return mod.exports;
}
const { defaultDisplayConfig, projectApplicantDisplay, displayConfigSchema } = load('lib/applicant-display.ts');
const clubId='00000000-0000-4000-8000-000000000001', applicationId='00000000-0000-4000-8000-000000000002', roundId='00000000-0000-4000-8000-000000000003', observationId='00000000-0000-4000-8000-000000000004';
function application() {
  return { id:applicationId, clubId, roundId, studentId:'student', status:'IN_REVIEW', submittedAt:new Date(), anonymousReviewText:null,
    round:{id:roundId,name:'Interview',anonymousReview:false,applicantDisplay:defaultDisplayConfig,displayVersion:0},
    student:{id:'student',email:'private@virginia.edu',studentProfile:{id:'profile',userId:'student',firstName:'HiddenFirst',lastName:'HiddenLast',computingId:'secretid',major:'HiddenMajor',gradYear:2028,gpa:3.8,satScore:1500,actScore:32,headshotUrl:'https://example.com/secret-photo',resumeUrl:'secret-resume',linkedinUrl:'secret-link',bio:'Hidden biography',experiences:[{title:'Hidden experience',subtitle:'Private employer',period:'2025'}]}},
    answers:[{id:'answer',question:{type:'ESSAY',prompt:'Why?'},response:'Secret essay'}],bookings:[],evaluations:[{id:'evaluation',applicationId,interviewerId:'reviewer',round:'Interview',score:8,notes:'Secret feedback',createdAt:new Date()}] };
}
function harness() {
  let app=application(), permission=true, actor='author'; let observations=[];
  const member={id:'membership',permissions:['applications.review','applicants.identify','interviews.manage'],status:'ACTIVE'};
  const tx={
    evaluation:{findMany:async()=>app.evaluations.filter(e=>e.submittedAt)},
    $queryRaw:async()=>[],
    clubMember:{findFirst:async({where})=>permission&&where.clubId===clubId?member:null},
    application:{findFirst:async({where})=>where.id===applicationId&&where.clubId===clubId&&app.status!=='DRAFTING'?app:null},
    applicantObservation:{
      findMany:async({where})=>observations.filter(o=>o.applicationId===where.applicationId).map(o=>({...o,author:{studentProfile:{firstName:'Reviewer',lastName:'One'}}})),
      create:async({data})=>{const o={...data,id:observationId,createdAt:new Date(),updatedAt:new Date()}; observations.push(o);return o},
      updateMany:async({where,data})=>{const o=observations.find(o=>o.id===where.id&&o.applicationId===where.applicationId&&o.authorId===where.authorId);if(!o)return{count:0};Object.assign(o,data);return{count:1}},
      deleteMany:async({where})=>{const before=observations.length;observations=observations.filter(o=>!(o.id===where.id&&o.applicationId===where.applicationId&&o.authorId===where.authorId));return{count:before-observations.length}},
    },
    pipelineRound:{findFirst:async({where})=>where.id===roundId&&where.clubId===clubId?app.round:null,updateMany:async({where,data})=>{if(where.id!==roundId||where.clubId!==clubId||where.displayVersion!==app.round.displayVersion)return{count:0};app.round.applicantDisplay=data.applicantDisplay;app.round.displayVersion++;return{count:1}}},
    auditLog:{create:async()=>({})},
  };
  const api=load('actions/applicant-intelligence.ts',{'@/utils/auth':{requireClubPermission:async(id,caps)=>{if(!permission||id!==clubId||!caps.every(c=>member.permissions.includes(c)))throw Error('Denied');return{user:{id:actor},membership:member}}},'@/utils/prisma':{prisma:{...tx,$transaction:async f=>f(tx)}}});
  return {api,app,member,observations:()=>observations,deny(){permission=false},otherAuthor(){actor='other'},scope:{clubId,applicationId}};
}
for(const kind of ['PRO','CON']) test(`${kind} creation, attribution, own edit/delete and other-author denial`,async()=>{
 const h=harness();await h.api.saveApplicantObservation({...h.scope,kind,body:'Thoughtful evidence'});
 assert.equal(h.observations()[0].authorId,'author');assert.equal(h.observations()[0].kind,kind);
 let view=await h.api.getApplicantDisplay(h.scope);assert.equal(view.observations[0].author,'Reviewer One');assert.ok(view.observations[0].createdAt);assert.equal(view.observations[0].own,true);
 await h.api.saveApplicantObservation({...h.scope,id:observationId,kind,body:'Edited observation'});assert.equal(h.observations()[0].body,'Edited observation');
 h.otherAuthor();await assert.rejects(h.api.saveApplicantObservation({...h.scope,id:observationId,kind,body:'Overwrite'}),/author/);await assert.rejects(h.api.deleteApplicantObservation({...h.scope,id:observationId}),/author/);
 const own=harness();await own.api.saveApplicantObservation({...own.scope,kind,body:'Own observation'});await own.api.deleteApplicantObservation({...own.scope,id:observationId});assert.equal(own.observations().length,0);
});
test('ordinary applicant display omits closing feedback; authorized closing endpoints are separate',async()=>{
 const h=harness();await h.api.saveApplicantDisplayConfiguration({clubId,roundId,version:0,config:{version:1,fields:['name','major','gpa','score','feedback']}});
 const data=await h.api.getApplicantDisplay(h.scope);assert.equal(data.anonymous,false);assert.deepEqual(data.visible,['name','major','gpa','score','feedback']);assert.match(JSON.stringify(data),/HiddenFirst/);assert.doesNotMatch(JSON.stringify(data),/Secret feedback/);assert.doesNotMatch(JSON.stringify(data),/secret-photo|Secret essay|Hidden biography|secret-resume|private@/);
});
test('anonymous reviewer with the same configuration cannot recover identity, free text, observations, or files',async()=>{
 const h=harness();await h.api.saveApplicantDisplayConfiguration({clubId,roundId,version:0,config:{version:1,fields:['name','major','gpa','score','feedback']}});await h.api.saveApplicantObservation({...h.scope,kind:'PRO',body:'Secret observation'});h.app.round.anonymousReview=true;h.member.permissions=['applications.review'];
 const data=await h.api.getApplicantDisplay(h.scope);assert.equal(data.anonymous,true);assert.deepEqual(data.observations,[]);assert.ok(data.visible.includes('score'));assert.ok(data.visible.includes('gpa'));assert.deepEqual(data.configured,['name','major','gpa','score','feedback']);assert.deepEqual(data.visible,['gpa','score']);
 assert.doesNotMatch(JSON.stringify(data),/HiddenFirst|HiddenLast|HiddenMajor|secretid|secret-photo|secret-resume|Secret essay|Secret feedback|Secret observation|Private employer|private@/);
 await assert.rejects(h.api.saveApplicantObservation({...h.scope,kind:'CON',body:'Not safe anonymously'}),/withheld/);
});
test('student, unauthorized, suspended, cross-club, forged applicant and extra author inputs fail closed',async()=>{
 const h=harness();await assert.rejects(h.api.getApplicantDisplay({...h.scope,applicationId:roundId}),/unavailable/);await assert.rejects(h.api.getApplicantDisplay({...h.scope,clubId:roundId}),/Denied/);
 await assert.rejects(h.api.saveApplicantObservation({...h.scope,kind:'PRO',body:'Text',authorId:'forged'}));h.member.status='SUSPENDED';await assert.rejects(h.api.getApplicantDisplay(h.scope),/Review/);h.member.status='ACTIVE';h.member.permissions=[];await assert.rejects(h.api.getApplicantDisplay(h.scope),/Denied/);h.deny();await assert.rejects(h.api.deleteApplicantObservation({...h.scope,id:observationId}),/Denied/);
 assert.doesNotMatch(fs.readFileSync('actions/applications.ts','utf8'),/observations:\s*true/);
});
test('configuration updates reject unknown fields, duplicate fields, stale versions and cross-club scope',async()=>{
 const h=harness();assert.equal(displayConfigSchema.safeParse({version:1,fields:['password']}).success,false);assert.equal(displayConfigSchema.safeParse({version:1,fields:['name','name']}).success,false);
 assert.equal((await h.api.getApplicantDisplayConfiguration(clubId,roundId)).version,0);
 await h.api.saveApplicantDisplayConfiguration({clubId,roundId,version:0,config:{version:1,fields:[]}});
 await assert.rejects(h.api.saveApplicantDisplayConfiguration({clubId,roundId,version:0,config:defaultDisplayConfig}),/changed/);
 await assert.rejects(h.api.saveApplicantDisplayConfiguration({clubId:roundId,roundId,version:1,config:defaultDisplayConfig}),/Denied/);
 h.member.permissions=['applications.review'];await assert.rejects(h.api.getApplicantDisplayConfiguration(clubId,roundId),/Denied/);
});
test('Interview uses a narrow panel and Voting retains its server-filtered panel; legacy voting transport never receives production data',()=>{
 assert.match(fs.readFileSync('components/live-voting/board-decision-mode.tsx','utf8'),/ApplicantDisplayPanel/);assert.match(fs.readFileSync('components/views/interview-workspace-view.tsx','utf8'),/InterviewApplicantPanel/);assert.doesNotMatch(fs.readFileSync('components/views/interview-workspace-view.tsx','utf8'),/getClubPipeline|ApplicantDisplayPanel/);
 assert.match(fs.readFileSync('components/applicant-intelligence.tsx','utf8'),/getApplicantDisplay\(\{ clubId, applicationId, sessionId, previewConfig:/);
 assert.doesNotMatch(fs.readFileSync('components/live-voting/board-decision-mode.tsx','utf8'),/useProctorSession|localStorage|BroadcastChannel/);
});
test('migration preserves historical feedback and links canonical evaluations, constraints and browser isolation',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE TABLE "User"(id TEXT PRIMARY KEY); CREATE TABLE "Application"(id TEXT PRIMARY KEY);
 CREATE TABLE "PipelineRound"(id TEXT PRIMARY KEY,"clubId" TEXT,name TEXT);
 CREATE TABLE "Evaluation"(id TEXT PRIMARY KEY,"applicationId" TEXT,"interviewerId" TEXT,round TEXT,score FLOAT,notes TEXT);
 CREATE TABLE "InterviewRecord"(id TEXT PRIMARY KEY,"applicationId" TEXT,"interviewerId" TEXT,"roundId" TEXT,"completedAt" TIMESTAMP,draft JSONB);
 INSERT INTO "User" VALUES ('author');INSERT INTO "Application" VALUES ('app');INSERT INTO "PipelineRound" VALUES ('round','club','Interview');
 INSERT INTO "Evaluation" VALUES ('e','app','member','Interview',8,'Current canonical feedback'),('legacy','other','member','Old',20,'Legacy scale');
 INSERT INTO "InterviewRecord" VALUES ('r','app','member','round',NOW(),' {"score":7,"overallReview":"Original snapshot"}');`);
 await db.exec(fs.readFileSync('prisma/migrations/20261003000000_applicant_intelligence/migration.sql','utf8'));
 const r=(await db.query('SELECT * FROM "InterviewRecord"')).rows[0];assert.equal(r.evaluationId,'e');assert.equal(r.draft.overallReview,'Original snapshot');
 assert.equal((await db.query('SELECT notes FROM "Evaluation" WHERE id=\'e\'')).rows[0].notes,'Current canonical feedback');
 assert.equal((await db.query('SELECT score FROM "Evaluation" WHERE id=\'legacy\'')).rows[0].score,20);
 await assert.rejects(db.exec(`INSERT INTO "Evaluation" VALUES ('bad','app','member','Other',11,'bad')`),/check/);
 await db.exec(`INSERT INTO "ApplicantObservation" VALUES ('o','app','author','PRO','Evidence',false,NOW(),NOW())`);
 await assert.rejects(db.exec(`UPDATE "ApplicantObservation" SET kind='OTHER'`),/check/);
 await assert.rejects(db.exec(`UPDATE "ApplicantObservation" SET "authorId"='missing'`),/foreign key/);
 for(const role of ['anon','authenticated'])assert.equal((await db.query(`SELECT has_table_privilege('${role}','"ApplicantObservation"','SELECT') allowed`)).rows[0].allowed,false);
 assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='ApplicantObservation'`)).rows[0].relrowsecurity,true);
 await db.exec(`UPDATE "User" SET id='new-author' WHERE id='author'`);assert.equal((await db.query('SELECT "authorId" FROM "ApplicantObservation"')).rows[0].authorId,'new-author');
 } finally {await db.close()}
});

test('configured résumé/LinkedIn links reuse private download access and disappear anonymously',()=>{
 const app=application();app.student.studentProfile.resumeUrl=`${applicationId}/resume.pdf`;app.student.studentProfile.linkedinUrl='https://www.linkedin.com/in/example';
 const config={version:1,fields:['resume','linkedin']};let view=projectApplicantDisplay(app,app.round,config,[]);
 assert.equal(view.links.length,2);assert.match(view.links[0].href,/^\/api\/recruiting-resumes\?clubId=/);assert.doesNotMatch(JSON.stringify(view),/signedUrl/);
 app.round.anonymousReview=true;view=projectApplicantDisplay(app,app.round,config,[]);assert.deepEqual(view.links,[]);assert.deepEqual(view.visible,[]);
});

for (const office of ['PRESIDENT','VICE_PRESIDENT','BOARD']) test(`configured submitted feedback reaches explicit ${office} with review/identify access`,async()=>{
 const h=harness();h.member.interviewOffices=[office];h.app.evaluations[0].submittedAt=new Date();h.app.evaluations[0].stableRound={clubId,anonymousReview:false};h.app.evaluations[0].interviewRecords=[];
 const view=await h.api.getApplicantDisplay(h.scope);assert.match(view.sections.find(s=>s.field==='feedback').items[0],/Secret feedback/);assert.equal(view.withheld.includes('feedback'),false);
});
test('authorized absent feedback is absent; withheld feedback is explicit without existence disclosure',async()=>{
 const h=harness();h.member.interviewOffices=['BOARD'];h.app.evaluations=[];
 let view=await h.api.getApplicantDisplay(h.scope);assert.deepEqual(view.sections.find(s=>s.field==='feedback').items,[]);assert.equal(view.withheld.includes('feedback'),false);
 h.member.interviewOffices=[];view=await h.api.getApplicantDisplay(h.scope);assert.equal(view.sections.find(s=>s.field==='feedback').withheld,true);assert.ok(view.withheld.includes('feedback'));
});
test('feedback never discloses drafts, unresolved legacy rounds, historical anonymous evidence, self-review, or owner-only rights',async()=>{
 for(const edit of [h=>{h.app.evaluations[0].submittedAt=null},h=>{h.app.evaluations[0].stableRound=null},h=>{h.app.evaluations[0].stableRound.anonymousReview=true},h=>{h.app.evaluations[0].interviewRecords=[{anonymousReview:true}]},h=>{h.app.studentId='author'},h=>{h.member.interviewOffices=[];h.member.isOwner=true}]){
  const h=harness();h.member.interviewOffices=['BOARD'];h.app.evaluations[0].submittedAt=new Date();h.app.evaluations[0].stableRound={clubId,anonymousReview:false};h.app.evaluations[0].interviewRecords=[];
  edit(h);
  const view=await h.api.getApplicantDisplay(h.scope);assert.doesNotMatch(JSON.stringify(view),/Secret feedback/);assert.ok(view.withheld.includes('feedback'));
 }
});
test('configuration cannot override feedback disclosure in voting or preview',async()=>{
 const h=harness();h.member.permissions.push('decisions.manage');
 const view=await h.api.getApplicantDisplay({...h.scope,previewConfig:{version:1,fields:['feedback']}});assert.equal(view.sections[0].withheld,true);assert.deepEqual(view.sections[0].items,[]);
 h.deny();await assert.rejects(h.api.getApplicantDisplay(h.scope),/Denied/);
});
