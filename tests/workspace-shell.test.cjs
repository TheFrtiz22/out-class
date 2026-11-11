// The persistent shell (app/(workspace)/layout.tsx) derives the workspace, club and rail from the URL.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs')
const ts = require('typescript')

const cache = {}
function compile(file) {
  if (cache[file]) return cache[file]
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => name.startsWith('@/lib/') && !name.startsWith('@/lib/demo') ? compile(['.ts', '.tsx'].map(ext => name.slice(2) + ext).find(path => fs.existsSync(path))) : name.startsWith('@/') ? new Proxy({}, { get: (_target, key) => String(key) }) : name === 'next/navigation' ? {} : require(name), mod, mod.exports)
  return cache[file] = mod.exports
}
const load = () => compile('components/shell/workspace-shell.tsx')
const leader = { id: 'm1', clubId: 'club-a', status: 'ACTIVE', isOwner: true, permissions: [], club: { name: 'Club A', suspendedAt: null } }
const member = { id: 'm2', clubId: 'club-b', status: 'ACTIVE', isOwner: false, permissions: [], club: { name: 'Club B', suspendedAt: null } }
const suspended = { ...leader, id: 'm3', clubId: 'club-c', club: { name: 'Club C', suspendedAt: '2026-11-01' } }
const route = (path, search = '', memberships = [leader, member, suspended], demo = false) => load().workspaceRoute(path, new URLSearchParams(search), memberships, demo)

test('the shell resolves each workspace from the URL', () => {
  assert.equal(route('/home').kind, 'personal')
  assert.equal(route('/settings/account').title, 'Account & Security')
  const admin = route('/platform/users')
  assert.deepEqual([admin.kind, admin.active, admin.mode], ['admin', 'users', 'platform'])
  const club = route('/club/club-a/workspace', 'section=recruitment&tool=overview')
  assert.deepEqual([club.kind, club.manager, club.mode, club.clubId], ['club', true, 'recruiting', 'club-a'])
  assert.deepEqual(club.sections.map(section => section.id), ['recruiting', 'club', 'pinned'])
  assert.equal(route('/club/club-a/workspace', 'section=calendar').mode, 'club')
  const plain = route('/club/club-b/workspace')
  assert.deepEqual([plain.manager, plain.mode], [false, 'clubs'])
  assert.ok(plain.sections.some(section => section.id === 'member-club'))
})

test('a club the account cannot run never gets a leader rail', () => {
  // Suspended club: personal rail (the page explains the suspension); demo ignores suspension as before.
  assert.equal(route('/club/club-c/workspace').kind, 'personal')
  assert.equal(route('/club/club-c/workspace', '', [suspended], true).manager, true)
  // No membership: the personal rail (no club pages at all); the page itself refuses access.
  const stranger = route('/club/other/workspace', '', [leader])
  assert.deepEqual([stranger.kind, stranger.manager, stranger.membership], ['personal', false, undefined])
  assert.ok(!stranger.sections.some(section => section.id === 'member-club' || section.id === 'recruiting'))
  assert.equal(route('/club-access/club-b').kind, 'personal', 'club access shows the leader rail only for a workspace member')
  assert.equal(route('/club-access/club-a').manager, true)
})

test('every signed-in workspace route lives under the one shell layout, with content-only loaders', () => {
  for (const dir of ['home', 'explore', 'corkboard', 'applications', 'clubs', 'calendar', 'inbox', 'profile', 'club/[clubId]/workspace', 'platform', 'settings', 'meetings', 'saved-clubs', 'club-access', 'club-claims', 'invitations']) {
    assert.ok(fs.existsSync(`app/(workspace)/${dir}`), dir)
    assert.equal(fs.existsSync(`app/${dir}`), false, `${dir} must not also exist outside the group`)
  }
  const layout = fs.readFileSync('app/(workspace)/layout.tsx', 'utf8')
  assert.match(layout, /WorkspaceShell/)
  for (const file of ['components/club-workspace.tsx', 'components/dashboard-layout.tsx', 'components/admin/admin-shell.tsx']) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /useShellBindings|ShellState/, `${file} hands its page to the persistent shell`)
  }
  assert.equal(fs.existsSync('components/shell/route-workspace-shell.tsx'), false)
})

// Polish item 3 (no blank first paint). A next/dynamic component with a `loading` option sits behind its own
// Suspense boundary. If an update reaches that boundary before its chunk arrives (auth token refresh, the shell's
// notification sync), React 19 deletes the server HTML and shows the fallback: content, loading, content again.
// Student paths therefore render the shell and their own first view as static imports; only views opened later
// in the session stay lazy, and only the marketing homepage keeps the lazy shell (HomeEntry).
const firstViews = {
  'student-dashboard': ['StudentDashboardView', 'OrganizationOwnershipRequests'], explore: ['ExploreView'], tracker: ['ApplicationTrackerView'],
  calendar: ['CalendarView'], inbox: ['InboxView'], 'student-profile': ['UnifiedStudentProfileView'], 'my-clubs': ['PersonalClubs'],
}
const viewModules = {
  StudentDashboardView: '@/components/views/student-dashboard-view', OrganizationOwnershipRequests: '@/components/organization-ownership-requests',
  ExploreView: '@/components/views/explore-view', ApplicationTrackerView: '@/components/views/application-tracker-view', CalendarView: '@/components/views/calendar-view',
  InboxView: '@/components/views/inbox-view', UnifiedStudentProfileView: '@/components/views/unified-student-profile-view', PersonalClubs: '@/components/personal-clubs',
}
const escape = text => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const studentPages = () => {
  const pages = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? pages(`${dir}/${entry.name}`) : entry.name === 'page.tsx' ? [`${dir}/page.tsx`] : [])
  return pages('app/(workspace)').filter(page => fs.readFileSync(page, 'utf8').includes('<StudentWorkspacePage'))
}

test('student paths hydrate their server HTML in place: no dynamic boundary between the page and its first view', () => {
  const entry = fs.readFileSync('components/student-workspace-page.tsx', 'utf8')
  assert.match(entry, /^import \{ AppShell, type StudentViews \} from "@\/components\/app-shell"$/m, 'the shell is a static import on student paths')
  assert.doesNotMatch(entry, /from "(@\/components\/home-entry|next\/dynamic)"/, 'student paths never pass through the lazy homepage entry')
  assert.equal(entry.match(/<AppShell [^>]*views=\{views\}/g)?.length, 2, 'live and demo renders both hand the route its static view')
  const shell = fs.readFileSync('components/app-shell.tsx', 'utf8')
  assert.match(shell, /const View = \{ \.\.\.lazyStudentViews, \.\.\.views \}/)
  const { studentRouteForPath } = require('./helpers/navigation-module.cjs')
  const pages = studentPages()
  assert.ok(pages.length >= 8, pages.join())
  for (const page of pages) {
    const source = fs.readFileSync(page, 'utf8')
    const route = studentRouteForPath(source.match(/<StudentWorkspacePage path="([^"]+)"/)[1])
    const names = firstViews[route.view]
    assert.ok(names, `${page}: ${route.view} has a static first view`)
    for (const name of names) {
      assert.match(source, new RegExp(`^import \\{ ${name} \\} from "${escape(viewModules[name])}"$`, 'm'), `${page} imports ${name} statically`)
      assert.match(source, new RegExp(`views=\\{\\{[^}]*\\b${name}\\b[^}]*\\}\\}`), `${page} hands ${name} to the shell`)
      assert.match(shell, new RegExp(`<View\\.${name}\\b`), `the shell renders ${name} through the static override`)
      assert.doesNotMatch(shell, new RegExp(`<${name}\\b`), `the shell never renders the lazy ${name} directly`)
    }
  }
  // The homepage keeps the lazy shell, behind the full cover only (no workspace placeholder, which was the swap).
  const home = fs.readFileSync('components/home-entry.tsx', 'utf8')
  assert.match(home, /dynamic\(\(\) => import\("@\/components\/app-shell"\)/)
  assert.doesNotMatch(home, /WorkspaceLoading|Loading your workspace/)
})

test('the shell renders a route\'s static first view and keeps the other views lazy', () => {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('components/app-shell.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const mocks = {
    ...require('./helpers/shell-stubs.cjs'),
    'next/dynamic': { __esModule: true, default: loader => { const lazy = () => null; lazy.lazy = String(loader).match(/"(@\/[^"]+)"/)[1]; return lazy } },
    'next/navigation': { useRouter: () => ({}), useSearchParams: () => new URLSearchParams(), usePathname: () => '/home' },
    '@/lib/navigation': require('./helpers/navigation-module.cjs'),
    react: { useState: value => [typeof value === 'function' ? value() : value, () => {}], useEffect() {}, useRef: current => ({ current }), useMemo: fn => fn() },
    '@/contexts/auth-context': { useAuth: () => ({ user: { id: 'student-a', memberships: [] }, selectClub() {} }) },
    '@/contexts/demo-context': { useDemoMode: () => ({ isDemoEnabled: false }) },
    '@/lib/student-navigation': { canonicalStudentParams: () => null, resolveStudentView: () => true, sectionForStudentView: () => 'explore' },
  }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? {} : require(name), mod, mod.exports)
  const types = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(types) : [node.type, ...types(node.props?.children)]
  const render = views => types(mod.exports.AppShell({ initialView: 'student-dashboard', initialSession: { id: 'student-a' }, hasProfile: true, initialData: {}, views }))
  const StaticDashboard = () => null, StaticRequests = () => null
  const rendered = render({ StudentDashboardView: StaticDashboard, OrganizationOwnershipRequests: StaticRequests })
  assert.ok(rendered.includes(StaticDashboard) && rendered.includes(StaticRequests), 'the server-rendered view is the static one')
  assert.equal(rendered.some(type => type?.lazy), false, 'no lazy boundary is rendered on the first paint of /home')
  // Without static views (the homepage and /preview), the views stay lazy.
  assert.deepEqual(render(undefined).filter(type => type?.lazy).map(type => type.lazy), ['@/components/organization-ownership-requests', '@/components/views/student-dashboard-view'])
})
