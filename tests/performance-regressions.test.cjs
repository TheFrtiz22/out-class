const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { NextRequest } = require('next/server');
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
function loader(mocks = {}, globals = {}) {
  const cache = {};
  function load(file) {
    file = path.resolve(file); if (cache[file]) return cache[file].exports;
    const mod = { exports: {} }; cache[file] = mod;
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => {
      if (name in mocks) return mocks[name];
      if (name.startsWith('@/components/')) return new Proxy({}, { get: (_, key) => String(key) });
      if (name.endsWith('.css')) return {};
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
      return require(name);
    }, mod, mod.exports, ...Object.values(globals));
    return mod.exports;
  }
  return load;
}
function hooks() {
  const state = [], effects = [], cleanup = new Map(); let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], value => state[i] = typeof value === 'function' ? value(state[i]) : value]; },
    useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i]; },
    useEffect(fn, deps) { const i = cursor++; if (!state[i] || deps.some((v, j) => v !== state[i][j])) { state[i] = deps; effects.push([i, fn]); } },
    useMemo: fn => fn(), useCallback: fn => fn, createContext: () => ({ Provider: 'Provider' }),
  };
  return { react, render: fn => { cursor = 0; return fn(); }, async flush() { for (const [i, fn] of effects.splice(0)) { cleanup.get(i)?.(); cleanup.set(i, fn()); } for (let i = 0; i < 30; i++) await Promise.resolve(); } };
}
const clubId = '00000000-0000-4000-8000-000000000001';

test('read API preserves dates and user JSON, validates scope, and never caches private responses', async () => {
  const dates = { joinedAt: new Date('2026-10-01'), deliveries: [{ sentAt: new Date('2026-10-02') }], json: { $type: 'date', value: 'not-a-date' } };
  const seen = [];
  let demo = false;
  const load = loader({
    'next/headers': { cookies: async () => ({ get: () => demo ? { value: '1' } : undefined }) },
    '@/actions/club-overview': {}, '@/actions/crm': {}, '@/actions/club-onboarding': {}, '@/actions/club-directory': {}, '@/actions/tasks': {}, '@/actions/tutorials': {}, '@/actions/club-settings': {}, '@/actions/applicant-intelligence': {}, '@/actions/meetings': {}, '@/actions/applications': {},
    '@/actions/organization-members': { getOrganizationMemberManagement: async id => { seen.push(id); if (id !== clubId) throw Error('Access denied'); return dates; } },
  });
  const { GET } = load('app/api/workspace/route.ts'), wire = load('lib/workspace-wire.ts');
  const request = (kind, args) => new Request(`https://outclass.test/api/workspace?${new URLSearchParams({ kind, args: JSON.stringify(args) })}`);
  const response = await GET(request('members', [clubId]));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Cookie');
  assert.deepEqual(wire.decodeWorkspaceData(await response.json()), dates);
  assert.equal((await GET(request('members', ['00000000-0000-4000-8000-000000000002']))).status, 403);
  assert.equal((await GET(request('members', [clubId, { userId: 'forged-owner' }]))).status, 400);
  assert.equal((await GET(request('changeOrganizationMemberRole', [clubId]))).status, 400);
  assert.deepEqual(seen, [clubId, '00000000-0000-4000-8000-000000000002']);
  demo = true; assert.equal((await GET(request('members', [clubId]))).status, 403);
  assert.equal(seen.length, 2, 'Direct demo requests never reach a live loader');
  assert.throws(() => wire.decodeWorkspaceData({ data: {}, dates: [['__proto__', 'polluted']] }), /Invalid/);
});

test('ordinary read fetches overlap rather than enter the Server Action queue', async () => {
  let active = 0, max = 0;
  const load = loader({}, { fetch: async (url, options) => {
    assert.match(url, /^\/api\/workspace\?/); assert.equal(options.cache, 'no-store');
    active++; max = Math.max(max, active);
    await new Promise(resolve => setTimeout(resolve, 5)); active--;
    return { ok: true, json: async () => ({ data: [], dates: [] }) };
  } });
  const { readWorkspace } = load('lib/workspace-read.ts');
  await Promise.all([readWorkspace('overview', [clubId]), readWorkspace('members', [clubId]), readWorkspace('invitations', [true])]);
  assert.equal(max, 3);
});

test('root bootstrap starts authenticated content without an identity HTTP waterfall', async () => {
  const h = hooks(), identity = { id: 'user', memberships: [{ clubId, isOwner: true }] }; let calls = 0;
  const { AuthProvider } = loader({ react: h.react, '@/contexts/demo-context': { useDemoMode: () => ({ isDemoEnabled: false }) }, '@/lib/demo/store': {}, '@/lib/permissions': { hasWorkspace: m => m.isOwner } }, { fetch: () => { calls++; throw Error('Unexpected bootstrap request'); } })('contexts/auth-context.tsx');
  const render = () => h.render(() => AuthProvider({ children: 'children', hasSession: true, initialUser: identity }).props.value);
  assert.equal(render().user, identity); assert.equal(render().sessionPending, false);
  await h.flush(); assert.equal(calls, 0); assert.equal(render().loading, false);
});

test('verified Supabase identity is reused only inside the same React request; membership remains live', async () => {
  let requestCache = new Map(), authCalls = 0, memberReads = 0, allowed = true;
  const react = { cache: fn => { const key = Symbol(); return (...args) => { if (!requestCache.has(key)) requestCache.set(key, fn(...args)); return requestCache.get(key); }; } };
  const load = loader({
    react, 'next/headers': { cookies: async () => ({ has: () => false, get: () => undefined }) },
    'next/navigation': { redirect: () => { throw Error('Unauthenticated'); } },
    '@/utils/platform-view-as': { platformViewSession: async () => null },
    './supabase/server': { createClient: async () => ({ auth: { getUser: async () => { authCalls++; return { data: { user: { id: 'user', email: 'user@virginia.edu', email_confirmed_at: '2026-01-01' } }, error: null }; } } }) },
    './prisma': { prisma: { user: { findUnique: async () => ({ id: 'user', email: 'user@virginia.edu', disabledAt: null }) }, clubMember: { findUnique: async ({ where }) => { memberReads++; assert.equal(where.userId_clubId.clubId, clubId); return { isOwner: allowed, status: 'ACTIVE', permissions: [] }; } } } },
  });
  const auth = load('utils/auth.ts');
  await auth.getSessionUser(); await auth.requireClubPermission(clubId, ['members.manage']);
  allowed = false; await assert.rejects(auth.requireClubPermission(clubId, ['members.manage']), /permission/);
  assert.equal(authCalls, 1); assert.equal(memberReads, 2);
  requestCache = new Map(); await auth.getSessionUser(); assert.equal(authCalls, 2);
});

test('duplicate identity refreshes coalesce and a late old-account response cannot replace the new bootstrap', async () => {
  const h = hooks(), requests = [];
  let identity = { id: 'user-a', memberships: [] };
  const { AuthProvider } = loader({ react: h.react, '@/contexts/demo-context': { useDemoMode: () => ({ isDemoEnabled: false }) }, '@/lib/demo/store': {}, '@/lib/permissions': { hasWorkspace: () => false } }, { fetch: () => new Promise(resolve => requests.push(resolve)) })('contexts/auth-context.tsx');
  const render = () => h.render(() => AuthProvider({ children: null, hasSession: true, initialUser: identity }).props.value);
  render(); await h.flush();
  const first = render().refreshUser(), duplicate = render().refreshUser();
  assert.equal(requests.length, 1);
  identity = { id: 'user-b', memberships: [] };
  assert.equal(render().user.id, 'user-b'); await h.flush();
  requests[0]({ ok: true, json: async () => ({ id: 'user-a', memberships: [] }) });
  await Promise.all([first, duplicate]);
  assert.equal(render().user.id, 'user-b');
});

test('middleware avoids duplicate refresh only after demo/support guards; loaders own authentication', async () => {
  let refreshes = 0;
  const { middleware } = loader({ '@/utils/supabase/middleware': { createClient: async () => { refreshes++; return new Response('ok'); } } })('middleware.ts');
  await middleware(new NextRequest('https://outclass.test/api/workspace?kind=members'));
  await middleware(new NextRequest('https://outclass.test/', { method: 'POST', headers: { 'Next-Action': 'any-action' } }));
  assert.equal(refreshes, 0);
  // Use the actual cookie constant; no action header may exempt a demo mutation.
  const { DEMO_COOKIE } = loader()('lib/demo/access.ts');
  assert.equal((await middleware(new NextRequest('https://outclass.test/api/workspace?kind=invitations', { headers: { cookie: `${DEMO_COOKIE}=1` } }))).status, 403);
  assert.equal((await middleware(new NextRequest('https://outclass.test/', { method: 'POST', headers: { 'Next-Action': 'any-action', cookie: `${DEMO_COOKIE}=1` } }))).status, 403);
  await middleware(new NextRequest('https://outclass.test/club/a/workspace')); assert.equal(refreshes, 1);
});

test('query-only club transitions skip RSC navigation and preserve modified/cross-club links', () => {
  const changes = [], location = { href: `https://outclass.test/club/${clubId}/workspace` };
  const api = loader({}, { window: { location, history: { pushState: (_, __, href) => changes.push(href), replaceState: (_, __, href) => changes.push(href) } } })('lib/workspace-navigation.ts');
  let prevented = 0;
  const event = { button: 0, preventDefault: () => prevented++, defaultPrevented: false };
  api.handleClubLink(event, `?section=members`); assert.equal(prevented, 1); assert.equal(changes.length, 1);
  api.handleClubLink({ ...event, ctrlKey: true }, '?section=settings'); assert.equal(changes.length, 1);
  assert.equal(api.navigateWithinClub('/club/other/workspace?section=members'), false);
  assert.equal(api.navigateWithinClub('https://other.test/club/a/workspace'), false);
});

test('Members mounts without Overview and its resource survives navigation only within the same identity/grants', async () => {
  const h = hooks(); let query = 'section=members', calls = 0;
  let member = { id: 'membership', userId: 'user-a', clubId, isOwner: true, status: 'ACTIVE', accessRole: 'OWNER', permissions: [], interviewOffices: [], club: { id: clubId, name: 'Club' } };
  let user = { id: 'user-a', memberships: [member] };
  const load = loader({
    react: h.react, 'next/dynamic': { __esModule: true, default: () => 'Dynamic' }, 'next/link': { __esModule: true, default: 'Link' },
    'next/navigation': { useRouter: () => ({ push() {}, replace() {} }), useSearchParams: () => new URLSearchParams(query) },
    '@/contexts/auth-context': { useAuth: () => ({ user, loading: false, activeClubId: clubId, selectClub() {} }) },
    '@/contexts/demo-context': { useDemoMode: () => ({ ready: true, isDemoEnabled: false }) },
    '@/lib/workspace-api': { getClubWorkspaceOverview: async () => { calls++; return { club: member.club, membership: member }; } },
    '@/lib/application-state': { ApplicationStateProvider: 'Provider', useApplicationState: () => ({}) },
  });
  const { ClubWorkspace } = load('components/club-workspace.tsx');
  const render = () => h.render(() => ClubWorkspace({ clubId, section: 'members' }));
  let tree = render(); await h.flush(); assert.equal(calls, 0);
  const child = nodes(tree).find(n => typeof n.props?.onDirectory === 'function');
  const directory = { actor: member, members: [member], invitations: [], identifierTypes: [] };
  child.props.onDirectory(directory); tree = render();
  query = 'section=settings'; render(); await h.flush();
  query = 'section=members'; tree = render();
  assert.equal(nodes(tree).find(n => n.props?.onDirectory).props.initialDirectory, directory);
  member = { ...member, club: { ...member.club, pipelineVersion: 1 } }; user = { ...user, memberships: [member] }; tree = render();
  assert.equal(nodes(tree).find(n => n.props?.onDirectory).props.initialDirectory, undefined, 'Pipeline/privacy version changes invalidate retained resources');
  user = { id: 'user-b', memberships: [{ ...member, id: 'other-membership', userId: 'user-b' }] }; tree = render();
  assert.equal(nodes(tree).find(n => n.props?.onDirectory).props.initialDirectory, undefined);
  child.props.onDirectory(directory); tree = render(); assert.equal(nodes(tree).find(n => n.props?.onDirectory).props.initialDirectory, undefined, 'Late replies cannot restore another account resource');
  user = { id: 'user-a', memberships: [{ ...member, permissions: ['members.manage'] }] }; tree = render();
  assert.equal(nodes(tree).find(n => n.props?.onDirectory).props.initialDirectory, undefined, 'Grant change invalidates prior data');
});

test('advanced permissions delegate one directory and one self-identity refresh to their owner', async () => {
  let legacy = 0, identity = 0, owner = 0, mutations = 0;
  const target = { id: 'target', isOwner: false, permissions: [], user: { email: 'target@virginia.edu' } };
  const C = loader({ react: { useState: value => [value, () => {}] }, '@/contexts/auth-context': { useAuth: () => ({ user: { memberships: [{ clubId, isOwner: true }] }, refreshUser: async () => identity++ }) }, '@/actions/club-access': { updateClubAccess: async () => mutations++, getClubAccess: async () => { legacy++; return { members: [target], invitations: [] }; } } })('components/club-access-editor.tsx').ClubAccessEditor;
  const tree = C({ clubId, initial: { members: [target], invitations: [] }, selectedMemberId: 'target', onSaved: async () => { owner++; identity++; } });
  nodes(tree).find(n => n.type === 'Button' && n.props.children === 'Save access').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(mutations, 1); assert.equal(legacy, 0); assert.equal(owner, 1); assert.equal(identity, 1);
});
