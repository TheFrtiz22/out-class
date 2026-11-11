const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', source)(name => name in mocks ? mocks[name] : name.startsWith('@/lib/') ? load(name.slice(2) + '.ts', mocks) : require(name), mod, mod.exports);
  return mod.exports;
}
test('shared route layout authenticates protected pages and retains public pages for visitors', async () => {
  let checks = 0;
  const mocks = {
    'next/headers': { cookies: async () => ({ has: () => false, get: () => undefined }) },
    '@/utils/auth': { getSessionUser: async () => ({ data: { user: null } }), requireAuth: async () => { checks++; throw Error('Sign in'); } },
    '@/components/shell/workspace-shell': { WorkspaceShell: 'Shell' },
    '@/components/landing/public-page-frame': { PublicPageFrame: 'PublicFrame' },
    '@/components/maintenance-gate': { MaintenanceGate: 'MaintenanceGate' },
  };
  // The gate keeps each route's access rule and renders only the page; app/(workspace)/layout.tsx draws the frame once.
  const { AuthenticatedPageLayout } = load('components/shell/authenticated-page-layout.tsx', mocks);
  const visitor = await AuthenticatedPageLayout({ children: 'public', optional: true });
  assert.equal(visitor.props.children, 'public');
  assert.equal(checks, 0);
  await assert.rejects(AuthenticatedPageLayout({ children: 'private' }), /Sign in/);
  assert.equal(checks, 1);
  mocks['@/components/shell/workspace-frame'] = load('components/shell/workspace-frame.ts', mocks);
  const { default: Layout } = load('app/(workspace)/layout.tsx', mocks);
  // Signed-out visitors get the public header, page margins and footer around public pages.
  const frame = await Layout({ children: 'public' });
  assert.equal(frame.type, 'PublicFrame'); assert.equal(frame.props.children, 'public');
  mocks['@/utils/auth'].getSessionUser = async () => ({ data: { user: { email_confirmed_at: 'verified' } } });
  mocks['@/utils/auth'].requireAuth = async () => { checks++; };
  assert.equal((await AuthenticatedPageLayout({ children: 'account', optional: true })).props.children, 'account');
  assert.equal(checks, 2);
  mocks['@/components/shell/workspace-frame'] = load('components/shell/workspace-frame.ts', mocks);
  // Signed-in product routes pass through the maintenance gate, which wraps the shell.
  const shell = await load('app/(workspace)/layout.tsx', mocks).default({ children: 'account' });
  assert.equal(shell.type, 'MaintenanceGate'); assert.equal(shell.props.children.type, 'Shell');
});
test('organization Settings includes only supported configuration and keeps operations reachable', () => {
  const { availableSettings } = load('lib/club-settings.ts');
  assert.deepEqual(availableSettings({ permissions: ['application.manage'] }).map(item => item.id), ['application']);
  assert.deepEqual(availableSettings({ permissions: ['recruitment.manage'] }).map(item => item.id), ['cycles', 'pipeline', 'notifications']);
  assert.deepEqual(availableSettings({ status: 'LEFT', isOwner: true }), []);
  assert.ok(!availableSettings({ isOwner: true }).some(item => item.id === 'tasks'));
  assert.ok(availableSettings({ permissions: ['club.settings'] }).some(item => item.id === 'notifications'));
  const { managerNavigation } = load('lib/product-navigation.ts');
  const nav = managerNavigation({ isOwner: true }, 'club', 'recruiting');
  assert.ok(nav.some(item => item.id === 'applicants'));
  assert.ok(nav.some(item => item.id === 'interviews'));
  assert.equal(nav.find(item => item.id === 'settings').href, '/club/club/workspace?section=settings');
  assert.ok(!nav.some(item => item.id === 'cycles'));
});
test('legacy task URL retains filters and repeated query values in the shared workspace destination', async () => {
  let destination;
  const { default: Page } = load('app/(workspace)/club/[clubId]/tasks/page.tsx', { 'next/navigation': { redirect: href => { destination = href; } } });
  await Page({ params: Promise.resolve({ clubId: 'club id' }), searchParams: Promise.resolve({ taskView: 'mine', tag: ['first', 'second'], section: 'other' }) });
  const url = new URL(destination, 'https://outclass.test');
  assert.equal(url.pathname, '/club/club%20id/workspace');
  assert.equal(url.searchParams.get('section'), 'tasks');
  assert.equal(url.searchParams.get('taskView'), 'mine');
  assert.deepEqual(url.searchParams.getAll('tag'), ['first', 'second']);
});

test('demo-capable layouts require the verified allowlist and never bypass live Settings or support authorization', async () => {
  let allowed = true, support = false, verified = true, checks = 0;
  const mocks = {
    'next/headers': { cookies: async () => ({ has: () => support, get: () => ({ value: '1' }) }) },
    '@/utils/auth': { getSessionUser: async () => ({ data: { user: { email: 'presenter@virginia.edu', email_confirmed_at: verified ? 'verified' : null } } }), requireAuth: async () => { checks++; throw Error('Live authorization'); } },
    '@/lib/demo/access': { DEMO_COOKIE: 'demo', canAccessDemo: email => allowed && email === 'presenter@virginia.edu' },
    '@/components/shell/workspace-shell': { WorkspaceShell: 'Shell' },
    '@/components/landing/public-page-frame': { PublicPageFrame: 'PublicFrame' },
    '@/components/maintenance-gate': { MaintenanceGate: 'MaintenanceGate' },
  };
  const { AuthenticatedPageLayout } = load('components/shell/authenticated-page-layout.tsx', mocks);
  assert.equal((await AuthenticatedPageLayout({ children: 'meeting', allowDemo: true })).props.children, 'meeting');
  assert.equal(checks, 0);
  const { workspaceFrame } = load('components/shell/workspace-frame.ts', mocks);
  assert.equal(await workspaceFrame(), 'shell');
  await assert.rejects(AuthenticatedPageLayout({ children: 'settings' }), /Live authorization/);
  for (const condition of ['not-allowed', 'unverified', 'support']) {
    allowed = condition !== 'not-allowed'; verified = condition !== 'unverified'; support = condition === 'support';
    await assert.rejects(AuthenticatedPageLayout({ children: 'meeting', allowDemo: true }), /Live authorization/);
  }
  assert.equal(checks, 4);
  // An unverified demo cookie never selects the product shell for a signed-out visitor.
  allowed = true; verified = false; support = false;
  assert.equal(await workspaceFrame(), 'public');
});
