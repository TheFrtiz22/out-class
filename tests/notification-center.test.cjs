const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(path.resolve(name.slice(2) + '.ts'), mocks) : require(name), mod, mod.exports)
  return mod.exports
}
const presentation = load('lib/notification-presentation.ts')
const notification = (id, extra = {}) => ({ id: `durable-${id}`, durableId: id, href: `/applications/${id}/decision?letterId=saved-letter`, title: 'Saved update', preview: 'Body', body: ['Body'], club: 'A club', type: 'Decision Available', read: false, createdAt: '2026-10-14T10:00:00Z', ...extra })
const dto = (id, extra = {}) => ({ id, href: `/applications/${id}/decision?letterId=saved-letter`, title: 'Saved update', body: 'Body', type: 'DECISION', createdAt: '2026-10-14T10:00:00Z', clubId: 'club', readAt: null, ...extra })
function harness(api = {}) {
  const slots = []; let cursor = 0
  const react = { createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } }, useEffect() {},
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((dep, j) => dep !== slots[i].deps[j])) slots[i] = { fn, deps }; return slots[i].fn },
    useMemo(fn, deps) { return react.useCallback(fn, deps)() } }
  const events = [], errors = [], reads = [], archives = []
  const { ApplicationStateProvider } = load('lib/application-state.tsx', {
    react, '@/contexts/demo-context': { useDemoMode: () => ({ isDemoEnabled: false }) },
    '@/lib/demo/store': { demoStore: { active: () => false } },
    '@/lib/communications-client': { ...load('lib/communications-client.ts'), communicationsChanged: () => events.push('changed') },
    '@/actions/communications': { setDurableNotificationsRead: async (ids, read) => { reads.push({ ids, read }) }, setDurableNotificationsArchived: async (ids, archived) => { archives.push({ ids, archived }) }, ...api },
    sonner: { toast: { error: text => errors.push(text) } },
  })
  const render = () => { cursor = 0; return ApplicationStateProvider({ initialData: {}, persistLocalState: false, children: null }).props.value }
  render()
  const sync = (items, unread = items.filter(item => !item.readAt).length, nextCursor = null, append = false) => render().syncDurableNotifications({ items, unread, nextCursor }, append)
  return { render, sync, events, errors, reads, archives }
}

test('exact task, decision, interview and invitation destinations are preserved; general inbox updates read inline', () => {
  for (const href of ['/applications/a/decision?letterId=v2', '/club/b/workspace?section=recruitment&tool=interviews&assignmentId=x', '/invitations/invite', '/settings/interviews']) assert.deepEqual(presentation.notificationDestination(notification('a', { href })), { kind: 'href', href })
  assert.deepEqual(presentation.notificationDestination(notification('a', { taskHref: '/club/c/workspace?section=tasks&taskId=t' })), { kind: 'href', href: '/club/c/workspace?section=tasks&taskId=t' })
  assert.deepEqual(presentation.notificationDestination(notification('a', { href: '/?workspace=student&view=inbox', type: 'Announcement' })), { kind: 'detail' })
  assert.deepEqual(presentation.notificationDestination(notification('a', { href: undefined, eventId: 'event' })), { kind: 'calendar', eventId: 'event' })
})
test('legacy application actions retain draft/status semantics and missing destinations remain readable', () => {
  const item = notification('a', { href: undefined, clubId: 'club', cta: 'View application' })
  assert.deepEqual(presentation.notificationDestination(item, [{ clubId: 'club', status: 'Drafting' }]), { kind: 'application', clubId: 'club', view: 'tracker' })
  assert.equal(presentation.notificationDestination(item, []).view, 'status')
  assert.equal(presentation.notificationDestination(notification('a', { href: undefined })).kind, 'detail')
})
test('feed sorts newest first, filters unread, deduplicates IDs, and formats relative/invalid times', () => {
  const old = notification('old', { read: true }), fresh = notification('fresh', { createdAt: '2026-10-14T11:00:00Z' })
  assert.deepEqual(presentation.notificationFeed([old, fresh, fresh], false).map(item => item.id), ['durable-fresh', 'durable-old'])
  assert.deepEqual(presentation.notificationFeed([old, fresh], true).map(item => item.id), ['durable-fresh'])
  assert.match(presentation.notificationRelativeTime(fresh.createdAt, '', Date.parse('2026-10-14T11:05:00Z')), /5.*min.*ago/)
  assert.equal(presentation.notificationRelativeTime(undefined, 'Saved date'), 'Saved date')
})
test('read mutation updates badge immediately, survives stale realtime data, and persists without duplicate entries', async () => {
  let resolve; const pending = new Promise(done => { resolve = done })
  const h = harness({ setDurableNotificationsRead: () => pending }); h.sync([dto('a')])
  const result = h.render().markNotificationRead('durable-a')
  assert.equal(h.render().durableUnread, 0); assert.equal(h.render().notifications[0].read, true)
  h.sync([dto('a')]); assert.equal(h.render().durableUnread, 0); assert.equal(h.render().notifications[0].read, true)
  resolve(); assert.equal(await result, true)
  h.sync([dto('a', { readAt: new Date() })]); h.sync([dto('a', { readAt: new Date() })], 0, null, true)
  assert.equal(h.render().notifications.length, 1); assert.equal(h.render().durableUnread, 0)
})
test('failed read restores the item and count while preserving new arrivals', async () => {
  let reject; const h = harness({ setDurableNotificationsRead: () => new Promise((_, fail) => { reject = fail }) }); h.sync([dto('a')])
  const action = h.render().markNotificationRead('durable-a')
  h.sync([dto('new'), dto('a')], 2); reject(Error('Offline'))
  assert.equal(await action, false); assert.equal(h.render().durableUnread, 2)
  assert.ok(h.render().notifications.every(item => !item.read)); assert.equal(h.render().notifications.length, 2)
  assert.equal(h.errors.length, 1); assert.equal(h.events.length, 1)
})
test('archive remains absent through stale snapshots; failure restores it without losing arrivals', async () => {
  let reject; const h = harness({ setDurableNotificationsArchived: () => new Promise((_, fail) => { reject = fail }) }); h.sync([dto('a')])
  const action = h.render().deleteNotifications(['durable-a'])
  assert.equal(h.render().durableUnread, 0); assert.equal(h.render().notifications.length, 0)
  h.sync([dto('new'), dto('a')], 2); assert.deepEqual(h.render().notifications.map(item => item.id), ['durable-new'])
  reject(Error('Offline')); assert.equal(await action, false)
  assert.equal(h.render().durableUnread, 2); assert.equal(h.render().notifications.length, 2)
})
test('mark all reads owned older pages and splits backend writes at its 100-ID limit', async () => {
  const pages = [], h = harness({ getDurableNotifications: async cursor => { pages.push(cursor); return { items: Array.from({ length: 110 }, (_, i) => dto('old-' + i)), unread: 111, nextCursor: null } } })
  h.sync([dto('a')], 111, 'owned-cursor')
  assert.equal(await h.render().markAllNotificationsRead(), true)
  assert.deepEqual(pages, ['owned-cursor']); assert.deepEqual(h.reads.map(call => call.ids.length), [100, 11])
  assert.equal(h.render().durableUnread, 0); assert.ok(h.render().notifications.every(item => item.read))
})
test('failed bulk pagination never marks a partial loaded feed as read', async () => {
  const h = harness({ getDurableNotifications: async () => { throw Error('Unavailable') } }); h.sync([dto('a')], 2, 'cursor')
  assert.equal(await h.render().markAllNotificationsRead(), false)
  assert.equal(h.render().notifications[0].read, false); assert.equal(h.reads.length, 0)
})

test('durable task history sharing one destination survives pagination while the derived task duplicate is suppressed', async () => {
  const h = harness(), href = '/club/club/workspace?section=tasks&taskId=same-task'
  h.render().syncTaskNotifications([notification('local', { id: 'task-update-local', durableId: undefined, taskHref: href })])
  h.sync([dto('first', { type: 'TASK', href })], 2, 'cursor')
  h.sync([dto('older', { type: 'TASK', href })], 2, null, true)
  assert.deepEqual(h.render().notifications.map(item => item.id), ['durable-first', 'durable-older'])
  assert.equal(await h.render().markAllNotificationsRead(), true)
  assert.deepEqual(h.reads[0].ids, ['first', 'older'])
})

test('overlapping bulk clicks share one pagination operation and retain IDs displaced by a realtime refresh', async () => {
  let release, pageCalls = 0
  const h = harness({ getDurableNotifications: async () => { pageCalls++; await new Promise(done => { release = done }); return { items: [dto('older')], unread: 3, nextCursor: null } } })
  h.sync([dto('first')], 2, 'cursor')
  const first = h.render().markAllNotificationsRead(), second = h.render().markAllNotificationsRead()
  h.sync([dto('incoming')], 3, 'new-cursor')
  release(); assert.equal(await first, true); assert.equal(await second, true)
  assert.equal(pageCalls, 1); assert.deepEqual(h.reads[0].ids.sort(), ['first', 'older'])
  assert.equal(h.render().notifications.find(item => item.id === 'durable-incoming').read, false)
})

test('platform notification expansion reaches the existing inbox while profile and personal destinations remain intact', () => {
  const destinations = []
  const { AdminShell } = load('components/admin/admin-shell.tsx', {
    'next/navigation': { usePathname: () => '/platform/users', useRouter: () => ({ push: href => destinations.push(href) }) },
    '@/lib/application-state': { ApplicationStateProvider: 'Provider' }, '@/components/shell/product-shell': { ProductShell: 'ProductShell' },
  })
  const shell = AdminShell({ children: null }).props.children
  for (const view of ['inbox', 'student-profile', 'student-dashboard']) shell.props.onNavigate(view)
  assert.deepEqual(destinations, ['/?workspace=student&view=inbox', '/?workspace=student&view=student-profile', '/?workspace=student'])
})

function notificationClickHarness({ read = false, result = true, allowed = true, sameClub = true } = {}) {
  const slots = []; let cursor = 0; const events = []
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } }, useEffect() {},
  }
  const href = '/club/qa/workspace?section=recruitment&tool=interviews&interview=1&applicationId=app&roundId=round&roomId=room&slotId=slot&bookingId=booking'
  const item = notification('assignment', { href, type: 'Interview Invite', read })
  const { NotificationCenter } = load(process.env.OUTCLASS_NOTIFICATION_SOURCE || 'components/shell/notification-center.tsx', {
    react, 'next/link': 'Link', 'next/navigation': { useRouter: () => ({ push: url => events.push(['router', url]) }) },
    '@/lib/application-state': { useApplicationState: () => ({ notifications: [item], trackedApps: [], markNotificationRead: async id => { events.push(['read', id]); if (result instanceof Error) throw result; return result } }) },
    '@/contexts/organization-invitations-context': { useOrganizationInvitations: () => ({ invitations: [] }) },
    '@/lib/product-navigation': { canLeaveWorkspace: () => allowed },
    '@/lib/workspace-navigation': { navigateWithinClub: url => { if (sameClub) events.push(['workspace', url]); return sameClub } },
    '@/lib/notification-presentation': presentation,
    '@/components/icons': new Proxy({}, { get: (_, key) => key }),
    '@/components/ui/popover': { Popover: 'Popover', PopoverContent: 'PopoverContent', PopoverTrigger: 'PopoverTrigger' },
    '@/components/ui/dropdown-menu': { DropdownMenu: 'Menu', DropdownMenuTrigger: 'MenuTrigger', DropdownMenuContent: 'MenuContent', DropdownMenuItem: 'MenuItem' },
    '@/components/ui/icon-button': { IconButton: 'IconButton' },
    '@/components/organization-invitation-card': { OrganizationInvitationCard: 'Invitation' },
    './notification-center.css': {},
  })
  const render = () => { cursor = 0; return NotificationCenter({ unread: read ? 0 : 1, pendingInvitations: 0, loadState: {}, onRetry() {}, onNavigate() {} }) }
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]
  const link = () => nodes(render()).find(n => n.type === 'Link')
  const click = extra => { const event = { button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, ...extra }; link().props.onClick(event); return event }
  return { events, href, click, nodes: () => nodes(render()) }
}

test('unread assignment commits its exact workspace destination before the read mutation instead of relying on a later Link dispatch', async () => {
  const originalFrame = global.requestAnimationFrame; global.requestAnimationFrame = () => {}
  try {
    const h = notificationClickHarness()
    assert.equal(h.click().defaultPrevented, true)
    assert.deepEqual(h.events, [['workspace', h.href], ['read', 'durable-assignment']])
    await new Promise(resolve => setImmediate(resolve))
  } finally { global.requestAnimationFrame = originalFrame }
})
test('already-read assignment still navigates once without another notification write', () => {
  const h = notificationClickHarness({ read: true })
  h.click(); h.click()
  assert.deepEqual(h.events, [['workspace', h.href]])
})
test('a failed or rejected read cannot swallow navigation and retains a visible retry', async () => {
  const originalFrame = global.requestAnimationFrame; global.requestAnimationFrame = () => {}
  try {
    for (const result of [false, Error('Unavailable')]) {
      const h = notificationClickHarness({ result })
      h.click(); await new Promise(resolve => setImmediate(resolve))
      assert.deepEqual(h.events, [['workspace', h.href], ['read', 'durable-assignment']])
      assert.ok(h.nodes().some(n => n.props?.role === 'alert'))
    }
  } finally { global.requestAnimationFrame = originalFrame }
})
test('rapid repeated assignment activation cannot duplicate navigation or the pending mutation', async () => {
  const originalFrame = global.requestAnimationFrame; global.requestAnimationFrame = () => {}
  try {
    const h = notificationClickHarness(); h.click(); h.click()
    await new Promise(resolve => setImmediate(resolve)); h.click()
    assert.deepEqual(h.events, [['workspace', h.href], ['read', 'durable-assignment']])
  } finally { global.requestAnimationFrame = originalFrame }
})
test('cross-workspace destinations use the router once, with their complete saved context', () => {
  const h = notificationClickHarness({ sameClub: false, read: true })
  h.click(); assert.deepEqual(h.events, [['router', h.href]])
})
test('modified clicks retain native link behavior and denied draft navigation performs no read or navigation', () => {
  const h = notificationClickHarness({ read: true })
  assert.equal(h.click({ ctrlKey: true }).defaultPrevented, false); assert.deepEqual(h.events, [])
  const denied = notificationClickHarness({ allowed: false })
  assert.equal(denied.click().defaultPrevented, true); assert.deepEqual(denied.events, [])
})
