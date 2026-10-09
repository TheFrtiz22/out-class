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
    evaluations: [], answers: [], bookings: [] };
  const permissions = load('lib/permissions.ts');
  const membership = () => ({ id: id(7), status: state.status, permissions: state.permissions });
  const auth = {
    requireAuth: async () => { if (state.anonymous) throw { digest: 'NEXT_REDIRECT' }; return { user: { id: state.actor } }; },
    requireClubPermission: async (club, required) => {
      await auth.requireAuth();
      if (!state.clubAccess || club !== clubId || required.some(p => !permissions.hasPermission(membership(), p))) throw Error('Denied');
      return { user: { id: state.actor }, membership: membership() };
    }
  };
  const matches = where => where.clubId === app.clubId && (!where.id || where.id === app.id) && app.status !== 'DRAFTING';
  const tx = {
    $queryRaw: async()=>[],
    user: { findUnique: async()=>({disabledAt:state.disabled?new Date():null}) },
    pipelineRound: { findMany: async () => [app.round] },
    application: {
      findMany: async ({ where }) => (state.pipelineReads++, matches(where)) && (!where.round || app.round.anonymousReview) ? [app] : [],
      findFirst: async ({ where, select }) => { if(select)state.narrowReads++; return matches(where) ? app : null; }
    },
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
