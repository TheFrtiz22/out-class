// Shared setup for the two-request race suites on the disposable security database
// (node scripts/run-disposable-postgres.cjs security). Real Prisma, real
// utils/prisma, real transactions, locks and constraints; only request
// authentication is synthetic. Every statement pays a small simulated round trip
// so the two transactions overlap the way two browser requests would.
'use strict';
const assert = require('node:assert/strict');
const { AsyncLocalStorage } = require('node:async_hooks');
const fs = require('node:fs'), path = require('node:path');

const databaseUrl = process.env.OUTCLASS_SECURITY_TEST_DATABASE_URL;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function loader(mocks) {
  const ts = require('typescript');
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name), mod, mod.exports);
    return mod.exports;
  }
  return load;
}

/** A verified UVA account as requireAuth({ verifyEmail: true }) returns it. */
const account = user => user && ({ user, supabaseUser: { id: user.id, email: user.email, confirmation_sent_at: '2026-09-01T00:00:00Z', email_confirmed_at: '2026-10-01T00:00:00Z' } });

async function raceFixture(t, { roundTripMs = 6 } = {}) {
  const url = new URL(databaseUrl);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/outclass_security_test', 'Requires the disposable local outclass_security_test database');
  const { PrismaClient } = require('@prisma/client');
  const operator = new PrismaClient({ datasourceUrl: databaseUrl });
  // The application connects as the non-superuser role that owns the tables, as in production.
  const base = new PrismaClient({ datasourceUrl: databaseUrl.replace('fixture_superuser@', 'outclass_production_app@') });
  t.after(async () => { await base.$disconnect(); await operator.$disconnect(); });
  const identity = await operator.$queryRaw`SELECT current_database() AS name, host(inet_server_addr()) AS address`;
  assert.equal(identity[0].name, 'outclass_security_test'); assert.equal(identity[0].address, '127.0.0.1');

  let delay = 0;
  const delayed = base.$extends({ query: { async $allOperations({ args, query }) {
    if (delay) await sleep(delay / 2);
    const result = await query(args);
    if (delay) await sleep(delay / 2);
    return result;
  } } });
  class Client { constructor() { return delayed; } }
  const request = new AsyncLocalStorage();
  const policy = loader({})('utils/verified-email-policy.ts');
  const { hasPermission } = loader({})('lib/permissions.ts');
  const mocks = {
    '@prisma/client': { ...require('@prisma/client'), PrismaClient: Client },
    'next/headers': { cookies: async () => ({ has: () => false, get: () => undefined }), headers: async () => new Headers() },
    'next/cache': { revalidatePath() {}, revalidateTag() {}, unstable_cache: fn => fn },
    'next/server': { after() {} },
    // The hosted Auth settings probe is the only external call; the account itself is still checked.
    '@/utils/verified-email-policy': { ...policy, requireVerifiedEmailPolicy: async () => {} },
    '@/utils/auth': {
      requireAuth: async () => { const user = request.getStore(); assert.ok(user, 'signed in'); return account(user); },
      getSessionUser: async () => request.getStore() ?? null,
      requireClubPermission: async (clubId, permissions) => {
        const user = request.getStore();
        const membership = await operator.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId } } });
        if (!membership || !permissions.every(p => hasPermission(membership, p))) throw new Error('Permission denied');
        return { ...account(user), membership };
      },
    },
  };
  const load = loader(mocks);
  const as = (user, fn) => request.run(user, fn);
  const settle = promise => promise.then(value => ({ ok: true, value }), error => ({ ok: false, error: String(error?.message || error) }));
  /** Start both calls in the same tick, with simulated latency so their transactions overlap. */
  async function race(...calls) {
    delay = roundTripMs;
    try { return await Promise.all(calls.map(([user, fn]) => settle(as(user, fn)))); }
    finally { delay = 0; }
  }
  const user = label => operator.user.create({ data: { email: `${label}-${Math.random().toString(36).slice(2, 10)}@virginia.edu` } });
  const club = (data = {}) => operator.club.create({ data: { name: 'Race fixture', slug: `race-${Math.random().toString(36).slice(2)}`, tagline: '', description: '', color: '#142d4e', category: 'Other', ...data } });
  return { operator, load, as, race, user, club };
}

module.exports = { databaseUrl, raceFixture };
