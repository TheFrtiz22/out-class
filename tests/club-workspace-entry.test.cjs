const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function harness({ search = '', permissions = ['applications.review'], owner = false, status = 'ACTIVE', loading = false, ready = true, selected = 'club', suspended = false, blockedStorage = false } = {}) {
  const storage = new Map(), effects = [], reads = [], changes = [], redirects = [], selections = [];
  const member = { id: 'membership', clubId: 'club', status, isOwner: owner, permissions, club: { id: 'club', name: 'Club', suspendedAt: suspended ? 'now' : null } };
  const auth = { user: { id: 'user', memberships: [member] }, loading, activeClubId: selected, selectClub: id => selections.push(id) };
  const demo = { isDemoEnabled: false, ready };
  const browser = { location: { href: `https://outclass.test/club/club/workspace${search ? '?' + search : ''}` }, history: { replaceState(_state, _title, href) { changes.push(href); browser.location.href = href; search = new URL(href).search.slice(1) } } };
  const localStorage = { getItem: key => { if (blockedStorage) throw Error('Blocked'); return storage.get(key) ?? null }, setItem: (key, value) => { if (blockedStorage) throw Error('Blocked'); storage.set(key, value) } };
  const router = { replace: href => redirects.push(href) };
  const mocks = {
    react: { useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect: effect => effects.push(effect) },
    'next/navigation': { useRouter: () => router, useSearchParams: () => new URLSearchParams(search) },
    'next/dynamic': { default: () => 'Dynamic' },
    '@/contexts/auth-context': { useAuth: () => auth },
    '@/contexts/demo-context': { useDemoMode: () => demo },
    '@/lib/workspace-api': { getClubWorkspaceOverview: async id => { reads.push(id); return { club: { id } } } },
    '@/lib/application-state': { ApplicationStateProvider: 'ApplicationStateProvider' },
  };
  const cache = {};
  function load(file) {
    if (cache[file]) return cache[file];
    const mod = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'module', 'exports', 'window', 'localStorage', code)(name => mocks[name] || (name.startsWith('@/lib/') ? load(name.slice(2) + '.ts') : name.startsWith('@/') ? new Proxy({}, { get: (_target, key) => String(key) }) : require(name)), mod, mod.exports, browser, localStorage);
    return cache[file] = mod.exports;
  }
  const preference = load('lib/club-workspace-preference.ts');
  const key = preference.clubWorkspacePreferenceKey('user', 'club', 'live');
  const Workspace = load('components/club-workspace.tsx').ClubWorkspace;
  return { auth, demo, storage, key, reads, changes, redirects, selections, preference, member,
    render: () => Workspace({ clubId: 'club' }),
    flush: () => { for (const effect of effects.splice(0)) effect() },
    query(value) { search = value },
    href: () => browser.location.href,
  };
}
const shell = tree => tree.props.children[1];

test('first leader entry shows a neutral loader and selects Recruiting overview without a router redirect or Club data read', () => {
  const h = harness();
  assert.equal(h.render().type, 'WorkspaceLoading');
  h.flush();
  assert.deepEqual(h.reads, []);
  assert.deepEqual(h.redirects, []);
  assert.equal(h.href(), 'https://outclass.test/club/club/workspace?section=recruitment&tool=overview');
  const screen = shell(h.render());
  assert.equal(screen.props.mode, 'recruiting');
  assert.equal(screen.props.active, 'overview');
  assert.equal(screen.props.modes.find(mode => mode.id === 'club').href, '/club/club/workspace?section=overview');
});

test('only explicit mode choices persist and general entries restore either saved workspace', () => {
  for (const mode of ['club', 'recruiting']) {
    const h = harness({ search: 'section=recruitment&tool=overview' });
    const screen = shell(h.render());
    h.flush();
    assert.equal(h.storage.size, 0);
    screen.props.onModeSelect(mode);
    assert.equal(h.storage.get(h.key), mode);
    h.query('');
    assert.equal(h.render().type, 'WorkspaceLoading');
    h.flush();
    assert.equal(shell(h.render()).props.mode, mode);
  }
});

test('specific Club and Recruiting links keep their page and query parameters despite a saved opposite preference', () => {
  for (const search of ['section=overview', 'section=tasks&taskView=mine', 'section=settings', 'section=meetings&eventId=meeting', 'section=announcements', 'section=recruitment&tool=applicants&applicantId=app']) {
    const h = harness({ search });
    h.storage.set(h.key, search.includes('recruitment') ? 'club' : 'recruiting');
    const screen = shell(h.render());
    h.flush();
    assert.equal(screen.type, 'ProductShell');
    assert.deepEqual(h.changes, []);
    assert.deepEqual(h.redirects, []);
    assert.equal(new URL(h.href()).search.slice(1), search);
  }
});

test('permission-limited leaders fall back to Club even with a saved Recruiting preference; ordinary members retain their shell', () => {
  const h = harness({ permissions: ['tasks.manage'] });
  h.storage.set(h.key, 'recruiting');
  assert.equal(h.render().type, 'WorkspaceLoading'); h.flush();
  const screen = shell(h.render());
  assert.equal(screen.props.mode, 'club');
  assert.deepEqual(screen.props.modes.map(mode => mode.id), ['club']);
  const member = harness({ permissions: [] });
  assert.equal(shell(member.render()).props.mode, 'clubs'); member.flush();
  assert.deepEqual(member.changes, []);
});

test('entry waits for identity and demo readiness, and synchronizes the selected club before mounting recruiting tools', () => {
  for (const options of [{ loading: true }, { ready: false }]) {
    const h = harness(options); assert.equal(h.render().type, 'WorkspaceLoading'); h.flush();
    assert.deepEqual(h.changes, []); assert.deepEqual(h.reads, []);
  }
  const h = harness({ selected: 'other-club' });
  h.render(); h.flush(); assert.deepEqual(h.selections, ['club']);
  assert.equal(new URL(h.href()).pathname, '/club/club/workspace');
  assert.deepEqual(h.reads, []);
});

test('preferences are isolated per account, club and live/demo/preview, with safe fallback for blocked or invalid storage', () => {
  const h = harness(), p = h.preference;
  const keys = [h.key, p.clubWorkspacePreferenceKey('other', 'club', 'live'), p.clubWorkspacePreferenceKey('user', 'other', 'live'), p.clubWorkspacePreferenceKey('user', 'club', 'demo'), p.clubWorkspacePreferenceKey('user', 'club', 'preview')];
  assert.equal(new Set(keys).size, keys.length);
  h.storage.set(keys[1], 'club'); h.storage.set(keys[2], 'club');
  assert.equal(p.readClubWorkspacePreference(h.key), null);
  h.storage.set(h.key, 'invalid'); assert.equal(p.readClubWorkspacePreference(h.key), null);
  const blocked = harness({ blockedStorage: true });
  assert.doesNotThrow(() => blocked.preference.saveClubWorkspacePreference(blocked.key, 'club'));
  blocked.render(); blocked.flush();
  assert.equal(shell(blocked.render()).props.mode, 'recruiting');
});

test('default routing checks active membership and available recruiting capabilities, including owner and interview roles', () => {
  const h = harness(), entry = (member, preference = null) => h.preference.clubWorkspaceEntryHref('other club', member, preference);
  for (const member of [{ isOwner: true }, { permissions: ['applications.review'] }, { permissions: ['recruitment.manage'] }, { permissions: ['interviews.manage'] }, { interviewOffices: ['BOARD'] }]) {
    assert.equal(entry(member), '/club/other%20club/workspace?section=recruitment&tool=overview');
    assert.equal(entry(member, 'club'), '/club/other%20club/workspace?section=overview');
  }
  for (const member of [{ permissions: [] }, { permissions: ['tasks.manage'] }, { isOwner: true, status: 'INACTIVE' }]) assert.equal(entry(member, 'recruiting'), '/club/other%20club/workspace?section=overview');
  const suspended = harness({ suspended: true }); suspended.render(); suspended.flush(); assert.deepEqual(suspended.changes, []);
});
