const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks = {}) {
  const m = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/') ? load(n.slice(2) + '.ts', mocks) : require(n), m, m.exports);
  return m.exports;
}
const id = n => `123e4567-e89b-12d3-a456-${String(n).padStart(12, '0')}`;
const owner = id(1), reader = id(2), clubId = id(3), applicationId = id(4), roundId = id(5);
function fixture() {
  const state = { actor: reader, permissions: ['applicants.identify'], anonymous: false, clubAccess: true, downloads: 0, status: 'ACTIVE', disabled: false, narrowReads: 0, pipelineReads: 0 };
  const app = { id: applicationId, clubId, studentId: owner, status: 'SUBMITTED', roundId,
    round: { id: roundId, name: 'Review', anonymousReview: false, applicantDisplay: { version: 1, fields: ['name'] } },
    student: { id: owner, email: 'owner@virginia.edu', studentProfile: { id: id(6), userId: owner, firstName: 'Student', lastName: 'Fixture', computingId: 'fixture', major: 'Math', gradYear: 2028, headshotUrl: `${owner}/photo.png`, experiences: [] } },
    evaluations: [], interviewAssignments: [], answers: [], bookings: [] };
  const permissions = load('lib/permissions.ts');
  const membership = () => ({ id: id(7), userId: state.actor, status: state.status, permissions: state.permissions, isOwner: state.isOwner, interviewOffices: state.offices || [] });
  const auth = {
    requireAuth: async () => { if (state.anonymous) throw { digest: 'NEXT_REDIRECT' }; return { user: { id: state.actor } }; },
    requireClubPermission: async (club, required) => {
      await auth.requireAuth();
      if (!state.clubAccess || club !== clubId || required.some(p => !permissions.hasPermission(membership(), p))) throw Error('Denied');
      return { user: { id: state.actor }, membership: membership() };
    }
  };
  const matches = where => where.AND ? where.AND.every(matches) : (!where.clubId || where.clubId === app.clubId) && (!where.id || typeof where.id === 'object' ? !where.id || where.id.in.includes(app.id) : where.id === app.id) && app.status !== 'DRAFTING';
  const tx = {
    $queryRaw: async()=>[],
    user: { findUnique: async()=>({disabledAt:state.disabled?new Date():null}) },
    pipelineRound: { findMany: async () => [app.round] },
    application: {
      findMany: async ({ where, include, omit, select }) => { state.pipelineOmit=omit; state.pipelineQuery=include; state.pipelineSelect=select; if(state.pipelineError)throw state.pipelineError; return (state.pipelineReads++, matches(where)) && (!where.round || app.round.anonymousReview) ? [app] : []; },
      findFirst: async ({ where, select }) => { if(select)state.narrowReads++; return matches(where) ? app : null; }
    },
    evaluation: {findMany:async ({where})=>matches(where.application) && where.applicationId.in.includes(app.id) ? app.evaluations.filter(e=>e.submittedAt).map(e=>({...e,applicationId:app.id})):[]},
    interviewPanelAssignment: {findMany:async ({where})=>matches(where.application) && where.applicationId.in.includes(app.id) ? app.interviewAssignments.map(e=>({...e,applicationId:app.id})):[]},
    clubMember: { findFirst: async () => membership(), findUnique: async({where})=>state.clubAccess && where.userId_clubId.clubId===clubId ? membership():null },
    applicantObservation: { findMany: async () => [] }
  };
  const mocks = { '@/utils/auth': auth, '@/utils/prisma': { prisma: { $transaction: async fn => fn(tx) } }, 'next/cache': { revalidatePath() {} } };
  // Execute the production CRM and Applicant Display authorization/projections.
  const crm = load('actions/crm.ts', mocks);
  const display = load('actions/applicant-intelligence.ts', mocks);
  const photo = load('lib/profile-photo.ts');
  const route = load('app/api/profile-photos/route.ts', { ...mocks,
    'next/server': { NextResponse: class extends Response {} },
    '@/utils/support-audit': { auditSupportAction: async () => {} },
    '@/actions/crm': crm, '@/actions/applicant-intelligence': display,
    '@/actions/interview-resumes': { getInterviewApplicantPanel: async () => { throw Error('Not this context'); } },
    '@/actions/evaluations': { getEvaluations: async () => { throw Error('Not this context'); } },
    '@supabase/supabase-js': { createClient: () => ({ storage: {
      getBucket: async () => ({ data: { public: false } }),
      from: () => ({ download: async path => { assert.equal(path, app.student.studentProfile.headshotUrl); state.downloads++; return { data: new Blob(['image'], { type: 'image/png' }) }; } })
    } }) }
  });
  const getUrl = async url => {
    // This is a dependency fixture, never a real Storage connection.
    const previous = process.env.SUPABASE_SECRET_KEY;
    process.env.SUPABASE_SECRET_KEY = 'fixture-secret';
    try { return await route.GET(new Request('http://localhost' + url)); }
    finally { if (previous === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = previous; }
  };
  const get = (mode, overrides = {}) => getUrl(photo.profilePhotoSource(app.student.studentProfile.headshotUrl, { clubId, applicationId, ...(mode ? { mode } : {}), ...overrides }));
  return { state, app, crm, get, getUrl, photo };
}
test('CRM identification-only reader retrieves the exact photo returned by canonical CRM', async () => {
  const f = fixture();
  const data = await f.crm.getClubPipeline(clubId);
  assert.equal(new URL(data.applications[0].student.studentProfile.headshotUrl, 'http://localhost').searchParams.get('mode'), 'crm');
  assert.equal((await f.get('crm')).status, 200);
});
test('CRM photo denies unrelated application, foreign club and draft application', async () => {
  const f = fixture();
  assert.equal((await f.get('crm', { applicationId: id(99) })).status, 403);
  assert.equal((await f.get('crm', { clubId: id(99) })).status, 403);
  f.app.status = 'DRAFTING';
  assert.equal((await f.get('crm')).status, 403);
  assert.equal(f.state.downloads, 0);
});
test('CRM photo denies missing identification permission, revoked membership and anonymous rounds', async () => {
  const f = fixture();
  f.state.permissions = ['applications.review'];
  assert.equal((await f.get('crm')).status, 403);
  f.state.permissions = ['applicants.identify']; f.state.clubAccess = false;
  assert.equal((await f.get('crm')).status, 403);
  f.state.clubAccess = true; f.app.round.anonymousReview = true;
  const data = await f.crm.getClubPipeline(clubId);
  assert.equal(data.applications[0].student.studentProfile.headshotUrl, null);
  assert.equal((await f.get('crm')).status, 403);
  assert.equal(f.state.downloads, 0);
});
test('ordinary reviewer photo context still requires explicitly enabled round photo', async () => {
  const f = fixture(); f.state.permissions = ['applications.review', 'applicants.identify'];
  assert.equal((await f.get()).status, 403);
  f.app.round.applicantDisplay.fields.push('photo');
  assert.equal((await f.get()).status, 200);
  f.state.permissions = ['applications.review'];
  assert.equal((await f.get()).status, 403);
});
test('photo proxy retains unauthenticated denial and owner access', async () => {
  const f = fixture(); f.state.anonymous = true;
  assert.equal((await f.get('crm')).status, 401);
  f.state.anonymous = false; f.state.actor = id(99); f.state.clubAccess = false;
  assert.equal((await f.get('crm')).status, 403);
  f.state.actor = owner;
  assert.equal((await f.get()).status, 200);
});
test('CRM context rejects conflicting scopes and mismatched stored photo paths', async () => {
  const f = fixture();
  assert.equal((await f.get('crm', { roundId })).status, 403);
  assert.equal((await f.get('crm', { sessionId: id(99) })).status, 403);
  const routePhoto = f.photo.profilePhotoSource(`${id(99)}/foreign.png`, { clubId, applicationId, mode: 'crm' });
  assert.equal((await f.getUrl(routePhoto)).status, 403);
  // A different applicant is already denied above; verify same application with
  // an old/stale path cannot match the current canonical CRM projection.
  const originalSource = f.app.student.studentProfile.headshotUrl;
  f.app.student.studentProfile.headshotUrl = `${owner}/replacement.png`;
  assert.equal((await f.getUrl(f.photo.profilePhotoSource(originalSource, { clubId, applicationId, mode: 'crm' }))).status, 403);
});

test('CRM photo uses one narrow read, never the pipeline, and denies inactive membership and disabled actor', async()=>{
 const f=fixture(); assert.equal((await f.get('crm')).status,200);assert.equal(f.state.narrowReads,1);assert.equal(f.state.pipelineReads,0);
 f.state.status='SUSPENDED';assert.equal((await f.get('crm')).status,403);
 f.state.status='ACTIVE';f.state.disabled=true;assert.equal((await f.get('crm')).status,403);assert.equal(f.state.downloads,1);
});

test('evaluation capability follows current panel assignment, anonymous review and self-review rules', async()=>{
 const f=fixture();f.state.permissions=['applications.review','applicants.identify'];
 const allowed=async()=>(await f.crm.getClubPipeline(clubId)).applications[0].canEvaluate;
 assert.equal(await allowed(),false);
 f.state.isOwner=true;f.state.offices=['PRESIDENT'];assert.equal(await allowed(),false,'owner/office does not bypass identified panel assignment');
 f.app.interviewAssignments=[{roundId,memberId:id(7)}];assert.equal(await allowed(),true);
 f.app.evaluations=[{roundId,interviewerId:id(7),submittedAt:new Date()}];assert.equal(await allowed(),false,'submitted evaluations stay read-only');f.app.evaluations=[];
 f.app.interviewAssignments=[{roundId:id(99),memberId:id(7)}];assert.equal(await allowed(),false,'another round does not authorize this evaluation');
 f.app.interviewAssignments=[];f.app.round.anonymousReview=true;f.state.isOwner=false;f.state.offices=[];f.state.permissions=['applications.review'];assert.equal(await allowed(),true);
 f.state.actor=owner;assert.equal(await allowed(),false,'self-review stays denied');
});

test('pipeline failure diagnostics identify the failing phase without serializing private exception content',async()=>{
 const f=fixture(),error={code:'P2028',message:'SELECT private applicant fixture@example.invalid',meta:{secret:'must not log'}};
 f.state.pipelineError=error;const rows=[],prior=console.error;console.error=(...args)=>rows.push(args);
 try { await assert.rejects(f.crm.getClubPipeline(clubId),e=>e===error); } finally { console.error=prior; }
 assert.equal(rows.length,1);assert.equal(rows[0][0],'recruitment.pipeline.read.failure');
 assert.equal(rows[0][1].code,'P2028');assert.equal(rows[0][1].phase,'applications');
 assert.ok(rows[0][1].elapsedMs>=0);assert.ok(rows[0][1].acquisitionMs>=0);assert.ok(rows[0][1].transactionMs>=0);
 assert.doesNotMatch(JSON.stringify(rows),/SELECT|private|example|must not log|123e4567/);
});

for (const reader of ['getClubPipeline', 'getClubPipelineList', 'getClubPipelinePage']) test(`${reader} repeats authorization and masks anonymous/self/foreign rows`, async()=>{
 const f=fixture();await f.crm[reader](clubId);f.state.clubAccess=false;await assert.rejects(f.crm[reader](clubId));f.state.clubAccess=true;
 f.state.permissions=[];await assert.rejects(f.crm[reader](clubId));f.state.permissions=['applications.review'];assert.equal((await f.crm[reader](clubId)).applications.length,0);
 f.app.round.anonymousReview=true;const row=(await f.crm[reader](clubId)).applications[0];assert.equal(row.student.studentProfile.firstName,'Applicant');assert.equal(row.student.email,'');
 await assert.rejects(f.crm[reader](id(99)));
});

test('summary database allowlist excludes detail/offer/member content and reads only submitted reviews',async()=>{
 const f=fixture();await f.crm.getClubPipelineList(clubId);const selected=f.state.pipelineSelect;
 assert.deepEqual(Object.keys(selected).sort(),['evaluations','id','interviewAssignments','round','roundId','status','student','studentId']);
 assert.deepEqual(selected.evaluations,{where:{submittedAt:{not:null}},select:{interviewerId:true,roundId:true,submittedAt:true,score:true}});
 assert.deepEqual(selected.interviewAssignments,{where:{revokedAt:null},select:{memberId:true,roundId:true,member:{select:{status:true,isOwner:true,permissions:true}}}});
 assert.deepEqual(selected.student.select.studentProfile.select,{firstName:true,lastName:true,major:true,gradYear:true,transferStudent:true,gpa:true,satScore:true,actScore:true});
 assert.deepEqual(selected.round,{select:{anonymousReview:true}});
 await f.crm.getClubPipeline(clubId,{applicationId});assert.ok(f.state.pipelineQuery.answers.include.question);assert.ok(f.state.pipelineQuery.bookings.include.slot);assert.ok(f.state.pipelineQuery.student.include.studentProfile.include.experiences);
});

test('page cursors bind the freshly authorized projection and selection reads contain no identities',async()=>{
 const f=fixture(),first=await f.crm.getClubPipelinePage(clubId);assert.equal(first.applications[0].id,applicationId);const cursor={id:applicationId,direction:'at',scope:first.page.scope};
 f.state.permissions.push('applications.review');await assert.rejects(f.crm.getClubPipelinePage(clubId,{cursor}),/selection changed/);
 for(const query of [{userId:owner},{limit:1000},{applicationId}])await assert.rejects(f.crm.getClubPipelinePage(clubId,query));
 const selected=await f.crm.getClubPipelineSelection(clubId);assert.deepEqual(selected.applications,[{id:applicationId,roundId,status:'SUBMITTED',canQuickReview:true}]);assert.doesNotMatch(JSON.stringify(selected),/owner@|Student|Fixture|studentId|headshot|score/);
 f.state.clubAccess=false;await assert.rejects(f.crm.getClubPipelineSelection(clubId));f.state.clubAccess=true;f.state.permissions=[];await assert.rejects(f.crm.getClubPipelineSelection(clubId));
});

test('narrow database summaries match canonical full privacy across viewer, profile and review states',async()=>{
 const f=fixture(),project=load('lib/pipeline-list.ts').pipelineListProjection;
 const member={status:'ACTIVE',isOwner:false,permissions:['applications.review','applicants.identify']};
 const originalProfile=structuredClone(f.app.student.studentProfile);
 let comparisons=0;
 for(const anonymous of [false,true])for(const profile of [originalProfile,null,{...originalProfile,gpa:5,transferStudent:true}])for(const self of [false,true])for(const role of ['identified','reviewer','participant','president'])for(const submitted of [false,true]){
  f.state.actor=self?owner:reader;f.state.permissions=role==='identified'?['applicants.identify']:role==='reviewer'?['applications.review']:['applications.review','applicants.identify'];f.state.offices=role==='president'?['PRESIDENT']:[];
  f.app.round.anonymousReview=anonymous;f.app.student.studentProfile=profile;
  f.app.interviewAssignments=[{roundId,memberId:id(7),member},{roundId,memberId:id(9),member:{...member,status:'SUSPENDED'}},{roundId:id(99),memberId:id(7),member}];
  f.app.evaluations=[{roundId,interviewerId:id(7),submittedAt:submitted?new Date():null,score:8},{roundId,interviewerId:id(8),submittedAt:new Date(),score:6},{roundId:id(99),interviewerId:id(8),submittedAt:new Date(),score:9}];
  const canonical=project(await f.crm.getClubPipeline(clubId));assert.deepEqual(await f.crm.getClubPipelineList(clubId),canonical);
  assert.deepEqual((await f.crm.getClubPipelinePage(clubId)).applications,(await f.crm.getClubPipeline(clubId)).applications);comparisons++;
 }
 assert.equal(comparisons,96);
});

test('summary scores preserve submission barrier, self exclusion, inactive assignments and historical review visibility',async()=>{
 const f=fixture();f.state.permissions=['applications.review','applicants.identify'];
 const active={status:'ACTIVE',permissions:f.state.permissions},inactive={...active,status:'SUSPENDED'};
 f.app.interviewAssignments=[{roundId,memberId:id(7),member:active},{roundId,memberId:id(8),member:inactive}];
 f.app.evaluations=[{roundId,interviewerId:id(7),submittedAt:null,score:10},{roundId,interviewerId:id(9),submittedAt:new Date(),score:6},{roundId:id(99),interviewerId:id(9),submittedAt:new Date(),score:9}];
 const row=async()=>(await f.crm.getClubPipelineList(clubId)).applications[0];
 assert.equal((await row()).roundScore,null);assert.deepEqual((await row()).evaluations,[]);
 f.state.offices=['PRESIDENT'];assert.equal((await row()).roundScore,null,'office does not bypass assigned reviewer submission');
 f.app.evaluations[0].submittedAt=new Date();let r=await row();assert.deepEqual(r.roundScore,{average:8,submitted:2,required:2,provisional:false});assert.equal(r.evaluations.length,3);
 f.state.offices=[];r=await row();assert.equal(r.evaluations.length,2,'ordinary assigned reviewer cannot see another round');
 f.app.interviewAssignments.push({roundId,memberId:id(10),member:active});assert.equal((await row()).roundScore.provisional,true);
 f.state.actor=owner;assert.equal((await row()).roundScore,null);assert.deepEqual((await row()).evaluations,[]);
});
