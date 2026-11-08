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
  assert.equal(route('/settings/notifications').title, 'Notifications')
  const admin = route('/platform/users')
  assert.deepEqual([admin.kind, admin.active, admin.mode], ['admin', 'users', 'platform'])
  const club = route('/club/club-a/workspace', 'section=recruitment&tool=overview')
  assert.deepEqual([club.kind, club.manager, club.mode, club.clubId], ['club', true, 'recruiting', 'club-a'])
  assert.deepEqual(club.sections.map(section => section.id), ['recruiting', 'club'])
  assert.equal(route('/club/club-a/workspace', 'section=meetings').mode, 'club')
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
