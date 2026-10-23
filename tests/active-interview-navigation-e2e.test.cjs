// Opt-in real HTTP/Auth/PostgreSQL checks for the reserved active navigation fixture.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { Actor, readConfig } = require('./helpers/onboarding-e2e.cjs');
const { load } = require('./helpers/voting-harness.cjs');
const { decodeWorkspaceData } = load('lib/workspace-wire.ts');
const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;

test('active Interview Rooms: distinct reviewers, concurrent reads and immediate assignment revocation', { skip: !configFile, timeout: 60000 }, async t => {
  const config = readConfig(configFile);
  const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(configFile), 'active-interview-fixture.json')));
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL });
  t.after(() => db.$disconnect());
  const actors = [];
  for (const credentials of fixture.credentials) {
    const actor = new Actor(config); await actor.signIn(credentials.email, credentials.password); actors.push(actor);
  }
  assert.equal(new Set(actors.map(actor => actor.user.id)).size, 4);
  const read = async (actor, kind) => {
    const response = await actor.request('/api/workspace?' + new URLSearchParams({ kind, args: JSON.stringify([fixture.clubId]) }));
    assert.equal(response.status, 200, kind);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('vary'), /(?:^|,\s*)Cookie(?:,|$)/);
    return { data: decodeWorkspaceData(await response.json()), trace: response.headers.get('x-outclass-trace-id') };
  };
  await t.test('four separately verified accounts receive all 24 authorized bookings and distinct request traces', async () => {
    const results = await Promise.all(actors.map(async actor => {
      const [assigned, workspace, rounds] = await Promise.all(['assignedRooms', 'interviewWorkspace', 'interviewRounds'].map(kind => read(actor, kind)));
      assert.equal(assigned.data.length, 24); assert.ok(assigned.data.every(row => row.canOpen && row.applicationId));
      assert.equal(workspace.data.applications.length, 24); assert.equal(rounds.data.status, 'ready');
      return [assigned.trace, workspace.trace, rounds.trace];
    }));
    const traces = results.flat(); assert.ok(traces.every(trace => /^[a-f0-9-]{36}$/.test(trace))); assert.equal(new Set(traces).size, 12);
  });
  await t.test('revoking one booking grant removes that candidate on the next requests and preserves other reviewers', async () => {
    const member = await db.clubMember.findUniqueOrThrow({ where: { userId_clubId: { userId: actors[1].user.id, clubId: fixture.clubId } } });
    const grant = await db.interviewPanelAssignment.findFirstOrThrow({ where: { memberId: member.id, revokedAt: null, bookingManaged: true } });
    try {
      await db.interviewPanelAssignment.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
      const assigned = await read(actors[1], 'assignedRooms'), workspace = await read(actors[1], 'interviewWorkspace');
      assert.equal(assigned.data.length, 23); assert.ok(assigned.data.every(row => row.applicationId !== grant.applicationId));
      assert.equal(workspace.data.applications.length, 23); assert.ok(workspace.data.applications.every(row => row.id !== grant.applicationId));
      assert.equal((await read(actors[2], 'assignedRooms')).data.length, 24);
    } finally { await db.interviewPanelAssignment.update({ where: { id: grant.id }, data: { revokedAt: grant.revokedAt } }); }
    assert.equal((await read(actors[1], 'assignedRooms')).data.length, 24);
  });
});
