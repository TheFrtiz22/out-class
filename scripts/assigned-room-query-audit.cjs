// Real local Auth/session/Prisma reads outside Next. Never exports SQL, parameters or rows.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ts = require('typescript'), { createHash } = require('node:crypto'), { performance } = require('node:perf_hooks');
const { PrismaClient } = require('@prisma/client');
const { Actor } = require('../tests/helpers/onboarding-e2e.cjs');
const { fixtureProfile } = require('./navigation-fixture-config.cjs');
const { distribution } = require('./navigation-audit.cjs');

async function assignedRoomQueryAudit(buildRoots, outputDirectory) {
  const profile = fixtureProfile('crossover'), config = profile.readConfig(path.join(profile.root, 'config.json'));
  for (const [variant, root] of Object.entries(buildRoots)) assert.equal(root, path.join(profile.root, variant === 'A' ? 'build-a' : 'build-b'));
  const fixture = JSON.parse(fs.readFileSync(path.join(profile.root, 'active-interview-fixture.json')));
  const pool = new URL(config.status.DB_URL); pool.searchParams.set('connection_limit', '8');
  Object.assign(process.env, { DATABASE_URL: pool.href, POSTGRES_PRISMA_URL: pool.href, NEXT_PUBLIC_SUPABASE_URL: config.status.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.status.PUBLISHABLE_KEY, SUPABASE_SECRET_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', COMMUNICATIONS_EMAIL_ENABLED: 'false', RESEND_API_KEY: '', SMTP_HOST: '' });
  const actor = new Actor(config); await actor.signIn(fixture.credentials[0].email, fixture.credentials[0].password);
  const jar = { getAll: () => [...actor.cookies].map(([name, value]) => ({ name, value })), get: name => actor.cookies.has(name) ? { value: actor.cookies.get(name) } : undefined, has: name => actor.cookies.has(name), set: (name, value) => actor.cookies.set(name, value) };
  const originalFetch = global.fetch, results = []; let queries = [], auth = [], expectedDigest;
  global.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url || String(input)); assert.equal(url.origin, config.status.API_URL);
    const start = performance.now(), response = await originalFetch(input, init);
    if (url.pathname.startsWith('/auth/')) auth.push({ path: url.pathname, durationMs: performance.now() - start, status: response.status });
    return response;
  };
  try {
    for (const variant of ['B', 'A']) {
      const db = new PrismaClient({ datasourceUrl: pool.href, log: [{ emit: 'event', level: 'query' }] });
      db.$on('query', event => queries.push({ operation: event.query.trim().split(/\s+/)[0], table: event.query.match(/(?:FROM|JOIN)\s+(?:"public"\.)?"?(\w+)"?/i)?.[1] || null, durationMs: event.duration }));
      const cache = {}, mocks = { '@/utils/prisma': { prisma: db }, '@/utils/platform-view-as': { platformViewSession: async () => null }, 'next/headers': { cookies: async () => jar }, 'next/cache': { revalidatePath() {}, revalidateTag() {}, unstable_cache: fn => fn }, 'next/navigation': { redirect() { throw Error('Fixture authorization denied'); } }, 'next/server': { after() { throw Error('Read unexpectedly scheduled a write'); } } };
      function load(file) {
        file = path.resolve(file);
        // requireAuth uses ./prisma; the action uses @/utils/prisma. Observe both
        // through the same real client, including live-session and account reads.
        if (file === path.join(buildRoots[variant], 'utils/prisma.ts')) return mocks['@/utils/prisma'];
        if (cache[file]) return cache[file].exports;
        const mod = { exports: {} }; cache[file] = mod;
        const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
        new Function('require', 'module', 'exports', code)(name => {
          if (Object.hasOwn(mocks, name)) return mocks[name]; if (name === 'server-only') return {};
          if (name.startsWith('@/') || name.startsWith('.')) {
            const target = name.startsWith('@/') ? path.join(buildRoots[variant], name.slice(2)) : path.resolve(path.dirname(file), name);
            for (const suffix of ['', '.ts', '.tsx', '/index.ts']) if (fs.existsSync(target + suffix) && fs.statSync(target + suffix).isFile()) return load(target + suffix);
            throw Error('Missing local loader dependency');
          }
          return require(name);
        }, mod, mod.exports); return mod.exports;
      }
      try {
        const api = load(path.join(buildRoots[variant], 'actions/interview-entry.ts')), samples = [];
        for (let i = 0; i < 22; i++) {
          queries = []; auth = []; const start = performance.now(), value = await api.getAssignedInterviewRooms(fixture.clubId), elapsedMs = performance.now() - start;
          assert.equal(value.length, 24); assert.ok(value.every(row => row.canOpen));
          assert.ok(queries.every(q => ['SELECT', 'BEGIN', 'COMMIT'].includes(q.operation)), 'Loader must remain read-only');
          assert.equal(auth.filter(a => a.path.endsWith('/user') && a.status === 200).length, 1, 'Each read must remotely verify identity');
          const digest = createHash('sha256').update(JSON.stringify(value)).digest('hex'); expectedDigest ||= digest; assert.equal(digest, expectedDigest, 'Before and after must return identical room projections');
          if (i >= 2) samples.push({ elapsedMs, queries: [...queries], auth: [...auth], jsonBytes: Buffer.byteLength(JSON.stringify(value)), projectionSha256: digest });
        }
        results.push({ variant, samples, elapsedMs: distribution(samples.map(s => s.elapsedMs)), queryCount: distribution(samples.map(s => s.queries.length)), jsonBytes: distribution(samples.map(s => s.jsonBytes)) });
      } finally { await db.$disconnect(); }
    }
  } finally { global.fetch = originalFetch; }
  fs.writeFileSync(path.join(outputDirectory, 'QUERY_AUDIT.json'), JSON.stringify({ realLocalAuthAndSessionChecks: true, includesRelativeAuthPrismaImports: true, identicalProjection: true, limitations: ['Outside Next HTTP; cookie context and absent support-session context adapted.', 'Two warmups and twenty measured calls per build; B then A is query-count evidence, not an independent latency study.', 'Only SQL operation/table/duration is retained; no SQL, parameters, credentials or protected payloads.'], results }, null, 2) + '\n');
}
module.exports = { assignedRoomQueryAudit };
