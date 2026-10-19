const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers/communications-loader.cjs');

// The fixture honors nested Prisma selections instead of returning a pre-redacted
// object: widening either query to club:true exposes the sentinel private content.
function project(row, query) {
  if (row == null) return row;
  if (Array.isArray(row)) return row.map(value => project(value, query));
  const result = query.select ? {} : { ...row };
  for (const [key, enabled] of Object.entries(query.select || query.include || {})) {
    if (!enabled) continue;
    let value = row[key];
    if (enabled.where && Array.isArray(value)) value = value.filter(item => Object.entries(enabled.where).every(([field, expected]) => item[field] === expected));
    result[key] = enabled === true ? value : project(value, enabled);
  }
  for (const [key, omitted] of Object.entries(query.omit || {})) if (omitted) delete result[key];
  return result;
}

function fixture(options = {}) {
  const clubs = ['a', 'b'].map(id => ({ id, schoolId: 'campus-' + id, name: 'Club ' + id, color: '#142d45', applicationVersion: 2, pipelineVersion: 3, invitationEmailEnabled: true, suspendedAt: null, decisionLetterTemplates: { ACCEPTED: { body: 'PRIVATE-DRAFT-' + id } }, futurePrivateColumn: 'FUTURE-PRIVATE-' + id }));
  const people = ['student-a', 'student-b'].map(id => ({ id, email: id + '@virginia.edu', disabledAt: null, studentProfile: null,
    applications: [{ id: 'app-' + id, studentId: id, clubId: clubs[0].id, anonymousReviewText: 'PRIVATE-REVIEW', club: clubs[0] }],
    memberships: clubs.map((club, index) => ({ id: id + '-' + club.id, userId: id, clubId: club.id, club, status: 'ACTIVE', isOwner: !!options.owner && index === 0, permissions: options.recruiter && index === 0 ? ['recruitment.manage'] : [], interviewOffices: [] })).concat([{ id: 'left', clubId: 'left', status: 'LEFT', isOwner: false, permissions: [], club: clubs[1] }]),
  }));
  let actor = 'student-a', demo = false, support = false, authError, rowOverride;
  const calls = [];
  const load = loader({
    react: { cache: fn => fn },
    '@/utils/auth': { requireAuth: async () => { if (authError) throw authError; return { user: { id: actor }, impersonation: support ? {} : null }; } },
    '@/utils/prisma': { prisma: { user: { findUnique: async query => { calls.push(query); return project(rowOverride !== undefined ? rowOverride : people.find(p => p.id === query.where.id), query); } } } },
    'next/headers': { cookies: async () => ({ get: () => demo ? { value: '1' } : undefined, has: () => support }) },
  });
  return { calls, api: load('app/api/users/me/route.ts'), current: load('utils/current-user.ts'), as(id) { actor = id; }, mode(value) { demo = value; }, support(value) { support = value; }, fail(error) { authError = error; }, row(value) { rowOverride = value; } };
}

function assertAccount(body, id, admins) {
  assert.equal(body.id, id);
  assert.deepEqual(body.applications.map(a => a.studentId), [id]);
  assert.equal(body.memberships.length, 2);
  assert.equal(body.adminRoles.length, admins);
  const json = JSON.stringify(body);
  for (const marker of ['decisionLetterTemplates', 'PRIVATE-DRAFT', 'futurePrivateColumn', 'FUTURE-PRIVATE', 'anonymousReviewText', 'PRIVATE-REVIEW']) assert.ok(!json.includes(marker), marker + ' must not cross the account boundary');
  assert.equal(body.memberships[0].club.pipelineVersion, 3);
  assert.equal(body.memberships[0].club.invitationEmailEnabled, true);
}

for (const role of ['student', 'recruiter', 'owner']) {
  test('account HTTP and RSC omit internal Club data for ' + role + ' across user/club scopes', async () => {
    const h = fixture({ recruiter: role === 'recruiter', owner: role === 'owner' });
    for (const id of ['student-a', 'student-b']) {
      h.as(id);
      const response = await h.api.GET();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('vary'), 'Cookie');
      assertAccount(await response.json(), id, role === 'student' ? 0 : 1);
      assertAccount(await h.current.getCurrentUser(), id, role === 'student' ? 0 : 1);
    }
  });
}

test('all account denial/error branches are private and no-store', async () => {
  const redirect = Object.assign(new Error('Redirect'), { digest: 'NEXT_REDIRECT;/' });
  for (const scenario of ['demo', 'unauthenticated', 'support', 'disabled', 'missing', 'provider']) {
    const h = fixture();
    if (scenario === 'demo') h.mode(true);
    if (scenario === 'unauthenticated') h.fail(redirect);
    if (scenario === 'support') { h.support(true); h.fail(Error('Expired')); }
    if (scenario === 'disabled') h.row({ id: 'student-a', disabledAt: new Date() });
    if (scenario === 'missing') h.row(null);
    if (scenario === 'provider') h.fail(Error('Sensitive provider detail'));
    const response = await h.api.GET();
    assert.equal(response.status, { demo: 403, unauthenticated: 401, support: 403, disabled: 403, missing: 404, provider: 500 }[scenario]);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('vary'), 'Cookie');
    assert.ok(!(await response.text()).includes('Sensitive provider detail'));
    if (scenario === 'demo') assert.equal(h.calls.length, 0);
  }
});

test('RSC rejects disabled/missing accounts and retains the effective support identity', async () => {
  const h = fixture(); h.row(null); await assert.rejects(h.current.getCurrentUser(), /unavailable/);
  h.row({ id: 'student-a', disabledAt: new Date() }); await assert.rejects(h.current.getCurrentUser(), /unavailable/);
  const support = fixture(); support.as('student-b'); support.support(true);
  const body = await support.current.getCurrentUser(); assert.equal(body.impersonating, true); assertAccount(body, 'student-b', 0);
});
