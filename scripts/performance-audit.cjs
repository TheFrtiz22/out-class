// Audit-only tooling. Never loads .env, PrismaClient, Supabase clients, or SMTP.
// Run from the repository root: node scripts/performance-audit.cjs > /tmp/outclass-audit.json
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { performance } = require('node:perf_hooks');
const { PGlite } = require('@electric-sql/pglite');

function load(file, mocks = {}, cache = {}) {
  file = path.resolve(file);
  if (cache[file]) return cache[file].exports;
  const mod = { exports: {} };
  cache[file] = mod;
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/utils/')) throw Error(`Unmocked service dependency: ${name}`);
    return name.startsWith('@/') ? load(`${name.slice(2)}.ts`, mocks, cache) : require(name);
  }, mod, mod.exports);
  return mod.exports;
}
const rounded = n => Number(n.toFixed(3));
function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { samples: sorted.length, medianMs: rounded(sorted[Math.floor(sorted.length / 2)]), p95Ms: rounded(sorted[Math.ceil(sorted.length * .95) - 1]) };
}

async function csvMeasurements() {
  const api = load('lib/roster-csv.ts');
  const config = { normalization: 'TRIM_LOWERCASE', validationRegex: '^[a-z][a-z0-9]+$' };
  const results = [];
  for (const n of [10, 50, 100, 500, 1000]) {
    const csv = ['name,year,computing_id', ...Array.from({ length: n }, (_, i) => `Synthetic Student ${i},2028,audit${i}`)].join('\n');
    const parse = [], validate = [];
    for (let i = 0; i < 110; i++) {
      const start = performance.now();
      const rows = api.parseRosterCsv(csv);
      const parsed = performance.now();
      const checked = api.validateRosterRows(rows, config);
      const end = performance.now();
      assert.equal(checked.filter(r => r.status === 'READY').length, n);
      if (i >= 10) { parse.push(parsed - start); validate.push(end - parsed); }
    }
    results.push({ rows: n, utf8Bytes: Buffer.byteLength(csv), parse: stats(parse), validate: stats(validate) });
  }
  return results;
}

// Reuse the existing hermetic fixture; expose its mock handles in this evaluation only.
// This counts original action-level ORM/raw calls, not generated SQL or network trips.
async function rosterCallCounts() {
  const source = fs.readFileSync('tests/roster-import.test.cjs', 'utf8').split('\nconst input=')[0];
  const needle = 'return{state,api:load(\'actions/roster-import.ts\'),config};';
  assert.ok(source.includes(needle), 'Roster fixture changed; review audit adapter.');
  const setup = new Function('require', source.replace(needle, 'return{state,api:load(\'actions/roster-import.ts\'),config,tx,prisma};') + '\nreturn setup;')(require);
  const results = [];
  for (const n of [10, 50, 100, 500]) {
    const h = setup();
    let calls = [];
    let classifiedRows = 0;
    for (const [model, value] of Object.entries(h.tx)) {
      if (typeof value === 'function') {
        const original = value;
        h.tx[model] = h.prisma[model] = async (...args) => { calls.push(model); if (model === '$queryRaw' && args[0].join('').includes('lower(email)')) classifiedRows += args[1].length; return original(...args); };
      } else {
        for (const [operation, original] of Object.entries(value)) {
          value[operation] = async (...args) => { calls.push(`${model}.${operation}`); return original(...args); };
        }
      }
    }
    const csv = ['name,year,computing_id', ...Array.from({ length: n }, (_, i) => `Synthetic Student ${i},2028,audit${i}`)].join('\n');
    const previewStart = performance.now();
    const preview = await h.api.previewRosterImport({ clubId: '00000000-0000-4000-8000-000000000001', requestId: '00000000-0000-4000-8000-000000000003', filename: 'audit.csv', csv });
    const previewMs = performance.now() - previewStart;
    const previewCalls = [...calls];
    calls = [];
    let result;
    const batches = [];
    const confirmationStart = performance.now();
    do {
      const offset = calls.length;
      result = await h.api.confirmRosterImport(preview.id);
      batches.push({ processed: result.processed, calls: calls.slice(offset) });
    } while (!result.completed);
    assert.equal(result.created, n);
    assert.equal(h.state.members.length, 0);
    results.push({ rows: n, previewMs: rounded(previewMs), confirmationMs: rounded(performance.now() - confirmationStart), classifiedRows, previewCalls: previewCalls.length, confirmationBatches: batches.length, confirmationCalls: calls.length, previewTrace: previewCalls, batchTraces: batches, membershipsCreated: 0, invitationCount: h.state.invitations.length, emailsSent: 0 });
  }
  return results;
}

async function directoryScheduling() {
  const timeline = [];
  let active = 0, maxActive = 0;
  const clubId = '00000000-0000-4000-8000-000000000001';
  const actor = { id: 'actor', userId: 'actor', clubId, isOwner: true, status: 'ACTIVE', permissions: [] };
  const operation = (name, result) => async () => {
    timeline.push({ operation: name, phase: 'start' });
    active++; maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--; timeline.push({ operation: name, phase: 'end' });
    return result;
  };
  const tx = {
    user: { findUnique: operation('account', { disabledAt: null }) },
    clubMember: { findUnique: operation('membership', actor), findMany: operation('members', []) },
    club: { findUniqueOrThrow: operation('club', { schoolId: 'school-uva' }) },
    clubInvitation: { findMany: operation('invitations', []) },
    schoolIdentifierType: { findMany: operation('identifierTypes', []) },
  };
  const api = load('actions/organization-members.ts', {
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'actor' } }) },
    '@/utils/prisma': { prisma: { $transaction: fn => fn(tx) } },
    '@/utils/email': {}, '@/utils/invitation-delivery': {}, '@/utils/invitation-background': {},
    '@/actions/invitation-emails': {}, '@/actions/club-onboarding': {},
  });
  const start = performance.now();
  await api.getOrganizationMemberManagement(clubId);
  assert.ok(maxActive >= 1);
  return { measuredMs: rounded(performance.now() - start), injectedDelayMs: 5, maxConcurrentMockOperations: maxActive, timeline, note: 'JavaScript scheduling with mocked transaction. Real interactive Prisma transactions use one connection and serialize SQL; this mock timing cannot establish a database concurrency improvement.' };
}

async function pipelineScheduling() {
  let active = 0, maxActive = 0;
  const query = async () => { active++; maxActive = Math.max(maxActive, active); await new Promise(resolve => setTimeout(resolve, 5)); active--; return []; };
  const api = load('actions/crm.ts', {
    '@/utils/auth': { requireClubPermission: async () => ({ membership: { isOwner: true, status: 'ACTIVE' } }) },
    '@/utils/prisma': { prisma: { pipelineRound: { findMany: query }, application: { findMany: query } } },
    'next/cache': {},
  });
  const timings = [];
  for (let i = 0; i < 12; i++) { const start = performance.now(); await api.getClubPipeline('club'); if (i >= 2) timings.push(performance.now() - start); }
  return { ...stats(timings), injectedQueryDelayMs: 5, maxConcurrentQueries: maxActive, note: 'Controlled scheduling measurement, not production latency.' };
}

async function publicProfileRendering() {
  let privateReads = 0;
  const api = load('app/club/[clubId]/page.tsx', {
    '@/utils/auth': { getSessionUser: async () => ({ data: { user: { id: 'synthetic-user' } } }) },
    'next/headers': { cookies: async () => ({ get: () => undefined, has: () => false }) },
    '@/actions/club-directory': { getPublicClub: async () => ({ club: { id: 'synthetic-club', name: 'Synthetic Club' } }) },
    '@/actions/applications': { getStudentDashboardData: async () => { privateReads++; await new Promise(resolve => setTimeout(resolve, 5)); return { applications: [], attendances: [], meetings: [] }; } },
    '@/components/qr/public-club-page': { PublicClubPage: 'PublicClubPage' },
    '@/lib/public-club-seo': {}, '@/lib/public-clubs': { publicClubs: [] },
  });
  const timings = [];
  for (let i = 0; i < 12; i++) { const start = performance.now(); await api.default({ params: Promise.resolve({ clubId: 'synthetic-club' }) }); if (i >= 2) timings.push(performance.now() - start); }
  return { ...stats(timings), calls: privateReads, renders: 12, injectedPrivateReadDelayMs: 5, note: 'Server page execution with controlled private-loader delay; not browser/production route timing.' };
}

async function directoryEventGrouping() {
  const clubs = Array.from({ length: 250 }, (_, i) => ({ id: `club-${i}`, name: `Synthetic Club ${i}`, pipelineRounds: [], questions: [], marketing: null }));
  const events = Array.from({ length: 5000 }, (_, i) => ({ id: `event-${i}`, clubId: `club-${i % 250}`, title: 'Synthetic Event', date: new Date(1791288000000 + i * 60000), location: 'Synthetic Location', description: '' }));
  const api = load('actions/club-directory.ts', { '@/utils/prisma': { prisma: { club: { findMany: async () => clubs }, meeting: { findMany: async () => events } } }, 'next/cache': { unstable_cache: fn => fn } });
  const timings = [];
  for (let i = 0; i < 13; i++) {
    const start = performance.now(), result = await api.getClubDirectory();
    if (i >= 3) timings.push(performance.now() - start);
    assert.equal(result.clubs.length, 250); assert.equal(result.clubs.reduce((count, club) => count + club.publicEvents.length, 0), 5000);
    assert.deepEqual(result.clubs[0].publicEvents.map(e => e.id), events.filter(e => e.clubId === 'club-0').map(e => e.id));
  }
  return { ...stats(timings), clubCount: 250, eventCount: 5000, note: 'Local original-loader CPU with synthetic data and immediate database mocks, not production latency.' };
}

async function applicantDisplayReads() {
  let memberReads = 0;
  const member = { id: 'member', isOwner: true, status: 'ACTIVE', permissions: [] };
  const delay = async value => { await new Promise(resolve => setTimeout(resolve, 5)); return value; };
  const tx = {
    clubMember: { findFirst: async () => { memberReads++; return delay(member); } },
    application: { findFirst: async () => delay({ id: '00000000-0000-4000-8000-000000000002', clubId: '00000000-0000-4000-8000-000000000001', round: { anonymousReview: true }, evaluations: [] }) },
  };
  const api = load('actions/applicant-intelligence.ts', {
    '@/utils/prisma': { prisma: { $transaction: fn => fn(tx) } },
    '@/utils/auth': { requireClubPermission: async () => ({ user: { id: 'user' }, membership: member }) },
    '@/lib/applicant-display': { ...load('lib/applicant-display.ts'), readDisplayConfig: () => ({ fields: [] }), projectApplicantDisplay: () => ({}) },
  });
  const timings = [];
  for (let i = 0; i < 12; i++) { const start = performance.now(); await api.getApplicantDisplay({ clubId: '00000000-0000-4000-8000-000000000001', applicationId: '00000000-0000-4000-8000-000000000002' }); if (i >= 2) timings.push(performance.now() - start); }
  return { ...stats(timings), memberReadsPerDisplay: memberReads / 12, injectedQueryDelayMs: 5, note: 'Controlled query scheduling inside original repeatable-read loader; not production latency. Initial external permission guard excluded.' };
}

async function nextActionScheduling() {
  const timeline = [];
  let active = 0, maxActive = 0;
  const completions = [];
  const types = { ACTION_SERVER_ACTION: 'server-action', ACTION_NAVIGATE: 'navigate', ACTION_RESTORE: 'restore', ACTION_REFRESH: 'refresh' };
  const mod = { exports: {} };
  const file = require.resolve('next/dist/client/components/app-router-instance.js');
  new Function('require', 'module', 'exports', fs.readFileSync(file, 'utf8'))(name => {
    if (name === 'react') return { startTransition: fn => fn() };
    if (name.endsWith('router-reducer-types')) return types;
    if (name.endsWith('is-thenable')) return { isThenable: value => !!value?.then };
    if (name.endsWith('/router-reducer')) return { reducer: async (state, action) => {
      timeline.push({ action: action.label, phase: 'start' });
      active++; maxActive = Math.max(active, maxActive);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--; timeline.push({ action: action.label, phase: 'end' });
      completions.push(action.label);
      return state;
    } };
    return {};
  }, mod, mod.exports);
  const queue = mod.exports.createMutableActionQueue({}, null);
  const pending = [];
  for (const label of ['invitations', 'workspaceOverview', 'memberDirectory']) {
    queue.dispatch({ type: types.ACTION_SERVER_ACTION, label }, value => { if (value?.then) pending.push(value); });
  }
  await Promise.all(pending);
  assert.deepEqual(completions, ['invitations', 'workspaceOverview', 'memberDirectory']);
  assert.equal(maxActive, 1);
  return { nextVersion: require('next/package.json').version, source: path.relative(process.cwd(), file), injectedReducerDelayMs: 5, maxConcurrentReducers: maxActive, timeline, note: 'Installed Next action queue with synthetic reducer; not browser or HTTP latency. Navigation preemption is a separate branch.' };
}

async function localSql() {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    const migrations = [];
    for (const dir of fs.readdirSync('prisma/migrations').sort()) {
      const file = path.join('prisma/migrations', dir, 'migration.sql');
      if (fs.existsSync(file)) { await db.exec(fs.readFileSync(file, 'utf8')); migrations.push(dir); }
    }
    // Synthetic rows only. This database exists only in this process's memory.
    await db.exec(`
      INSERT INTO "User" (id,email) SELECT 'audit-user-'||g, 'audit'||g||'@virginia.edu' FROM generate_series(1,10000) g;
      INSERT INTO "Club" (id,slug,name,tagline,description,color,category)
        SELECT 'audit-club-'||g,'audit-club-'||g,'Synthetic Club '||g,'','','#000000','Academic' FROM generate_series(1,20) g;
      INSERT INTO "ClubMember" (id,"clubId","userId")
        SELECT 'audit-member-'||g,'audit-club-'||(1+(g-1)/500),'audit-user-'||g FROM generate_series(1,10000) g;
      INSERT INTO "ClubInvitation" (id,"clubId",email,"invitedBy","expiresAt")
        SELECT 'audit-invite-'||g,'audit-club-'||(1+(g-1)/500),'invite'||g||'@virginia.edu','audit-user-1',now()+interval '7 days' FROM generate_series(1,10000) g;
      INSERT INTO "InvitationDelivery" (id,"invitationId","requestedById","recipientEmail","idempotencyKey")
        SELECT 'audit-delivery-'||g,'audit-invite-'||g,'audit-user-1','invite'||g||'@virginia.edu','audit-key-'||g FROM generate_series(1,10000) g;
      INSERT INTO "Event" (id,"clubId",title,date,location)
        SELECT 'audit-event-'||g,'audit-club-'||(1+(g-1)/500),'Synthetic Event',now()+g*interval '1 minute','Synthetic Location' FROM generate_series(1,10000) g;
      ANALYZE;
    `);
    const queries = {
      normalizedEmailLookup: `SELECT id,email,"disabledAt" FROM "User" WHERE lower(email)=ANY(ARRAY['audit1@virginia.edu','audit500@virginia.edu'])`,
      directoryMembersBase: `SELECT * FROM "ClubMember" WHERE "clubId"='audit-club-1' ORDER BY "joinedAt" ASC`,
      directoryInvitationsBase: `SELECT id,email,"invitedName","invitedYear","requestedRole",permissions,status,"expiresAt" FROM "ClubInvitation" WHERE "clubId"='audit-club-1' ORDER BY "createdAt" DESC`,
      latestDeliveryOneInvite: `SELECT status,"createdAt","failureCode" FROM "InvitationDelivery" WHERE "invitationId"='audit-invite-1' ORDER BY "createdAt" DESC LIMIT 1`,
      nextClubMeeting: `SELECT id,title,date,location,audience FROM "Event" WHERE "clubId"='audit-club-1' AND date>=now() ORDER BY date ASC LIMIT 1`,
    };
    const results = {};
    for (const [name, sql] of Object.entries(queries)) {
      const timings = [];
      let rows;
      for (let i = 0; i < 35; i++) {
        const start = performance.now();
        rows = (await db.query(sql)).rows;
        if (i >= 5) timings.push(performance.now() - start);
      }
      const plan = (await db.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`)).rows[0]['QUERY PLAN'];
      results[name] = { ...stats(timings), resultRows: rows.length, jsonBytes: Buffer.byteLength(JSON.stringify(rows)), sql, plan };
    }
    const indexes = (await db.query(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('User','ClubMember','ClubInvitation','InvitationDelivery','Event','RosterImportRow','Application') ORDER BY tablename,indexname`)).rows;
    const rls = (await db.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,r.rolname,r.rolbypassrls FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE c.relname IN ('User','ClubMember','ClubInvitation','InvitationDelivery','Event')`)).rows;
    return { engine: 'PGlite in-memory PostgreSQL', fixture: '10,000 users, members, invitations, deliveries and events; 20 clubs; 500 rows per club', migrations, queries: results, indexes, rls, note: 'Base-query SQL equivalents, not Prisma-generated relation SQL. Local owner connection, no Supabase auth/network/pooler/production RLS cost.' };
  } finally { await db.close(); }
}

(async () => {
  if (process.argv.includes('--profile-only')) { process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), publicProfileRendering: await publicProfileRendering() }, null, 2) + '\n'); return; }
  if (process.argv.includes('--directory-only')) { process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), directoryEventGrouping: await directoryEventGrouping() }, null, 2) + '\n'); return; }
  if (process.argv.includes('--applicant-only')) { process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), applicantDisplayReads: await applicantDisplayReads() }, null, 2) + '\n'); return; }
  const output = {
    generatedAt: new Date().toISOString(), node: process.version, platform: process.platform,
    limitations: ['No production mutations, credentials, service calls or SMTP.', 'Mock ORM call counts exclude requireAuth/requireClubPermission internals, middleware, generated relation SQL and transaction BEGIN/COMMIT.', 'PGlite wall times cannot predict remote service latency.'],
    csv: await csvMeasurements(),
    roster: await rosterCallCounts(),
    directoryScheduling: await directoryScheduling(),
    pipelineScheduling: await pipelineScheduling(),
    publicProfileRendering: await publicProfileRendering(),
    directoryEventGrouping: await directoryEventGrouping(),
    applicantDisplayReads: await applicantDisplayReads(),
    nextActionScheduling: await nextActionScheduling(),
    localSql: await localSql(),
  };
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
