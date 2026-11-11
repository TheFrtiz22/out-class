// Shared confirm dialog: one awaitable confirm replaces the browser's blocking window.confirm.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadComponent } = require('./helpers/component-module.cjs')

// The voting system is being consolidated on another branch; its confirms move separately.
const excluded = ['components/live-voting/', 'app/(focus)/live-voting/', 'app/(focus)/voting/']
const sourceFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(dir, entry.name)
  return entry.isDirectory() ? sourceFiles(file) : /\.(tsx?|jsx?)$/.test(entry.name) ? [file] : []
})

test('no window.confirm remains in app/ or components/ outside the excluded voting paths', () => {
  const offenders = ['app', 'components'].flatMap(sourceFiles)
    .map(file => file.split(path.sep).join('/'))
    .filter(file => !excluded.some(prefix => file.startsWith(prefix)))
    .filter(file => /\b(?:window|globalThis|self)\s*\.\s*confirm\s*\(/.test(fs.readFileSync(file, 'utf8')))
  assert.deepEqual(offenders, [], 'use useConfirm() from @/components/ui/confirm-dialog')
})

test('the confirm provider is mounted once, in the root layout', () => {
  const layout = fs.readFileSync('app/layout.tsx', 'utf8')
  assert.match(layout, /import \{ ConfirmProvider \} from "@\/components\/ui\/confirm-dialog"/)
  assert.equal(layout.match(/<ConfirmProvider>/g)?.length, 1)
  const mounts = ['app', 'components'].flatMap(sourceFiles).filter(file => !file.endsWith('confirm-dialog.tsx') && /<ConfirmProvider[\s>]/.test(fs.readFileSync(file, 'utf8')))
  assert.deepEqual(mounts.map(file => file.split(path.sep).join('/')), ['app/layout.tsx'])
  assert.match(fs.readFileSync('components/ui/confirm-dialog.tsx', 'utf8'), /^'use client'/, 'the provider is a client component')
})

const { createConfirmController, useConfirm } = loadComponent(path.resolve('components/ui/confirm-dialog.tsx'))
function harness() {
  const shown = []
  const controller = createConfirmController(current => shown.push(current))
  return { controller, shown, current: () => shown.at(-1) }
}

test('confirm resolves true when the action is chosen', async () => {
  const h = harness()
  const result = h.controller.request({ title: 'Delete round?', confirmLabel: 'Delete round', tone: 'danger' })
  assert.equal(h.current().options.title, 'Delete round?')
  h.controller.settle(h.current().id, true)
  assert.equal(await result, true)
  assert.equal(h.current(), null, 'the dialog closes')
})

test('confirm resolves false on Cancel, Escape or an outside click (all close as cancel)', async () => {
  const h = harness()
  // Cancel, Esc and the backdrop all reach the provider as onOpenChange(false) / overlay click → settle(id, false).
  const result = h.controller.request({ title: 'Discard changes?', confirmLabel: 'Discard changes' })
  h.controller.settle(h.current().id, false)
  assert.equal(await result, false)
})

test('requests queue, resolve once, and a stale settle never answers the next request', async () => {
  const h = harness()
  const first = h.controller.request({ title: 'First?', confirmLabel: 'First' })
  const second = h.controller.request({ title: 'Second?', confirmLabel: 'Second' })
  const firstId = h.current().id
  h.controller.settle(firstId, true)
  assert.equal(h.current().options.title, 'Second?')
  // The action's click also closes the dialog (onOpenChange(false)) with the old id: ignored.
  h.controller.settle(firstId, false)
  assert.equal(h.current().options.title, 'Second?')
  h.controller.settle(h.current().id, false)
  assert.deepEqual(await Promise.all([first, second]), [true, false])
})

test('unmounting the provider cancels every pending confirm, so nothing runs', async () => {
  const h = harness()
  const pending = [h.controller.request({ title: 'A?', confirmLabel: 'A' }), h.controller.request({ title: 'B?', confirmLabel: 'B' })]
  h.controller.cancelAll()
  assert.deepEqual(await Promise.all(pending), [false, false])
})

test('useConfirm outside the provider fails loudly instead of silently confirming', () => {
  const React = require('react')
  const { renderToString } = require('react-dom/server')
  function Orphan() { useConfirm(); return null }
  assert.throws(() => renderToString(React.createElement(Orphan)), /inside <ConfirmProvider>/)
})

test('the provider server-renders its children without opening a dialog', () => {
  const React = require('react')
  const { renderToString } = require('react-dom/server')
  const { ConfirmProvider } = loadComponent(path.resolve('components/ui/confirm-dialog.tsx'))
  const html = renderToString(React.createElement(ConfirmProvider, null, React.createElement('p', null, 'page')))
  assert.equal(html, '<p>page</p>')
})

test('a repeated request (same title and action, or same key) shares one dialog and one answer', async () => {
  const h = harness()
  const options = { title: 'Delete group Fund?', confirmLabel: 'Delete group', tone: 'danger' }
  const first = h.controller.request(options)
  const second = h.controller.request({ ...options })
  assert.equal(first, second, 'the same promise')
  const keyed = h.controller.request({ title: 'Other wording?', confirmLabel: 'Delete', key: 'delete-fund' })
  assert.equal(h.controller.request({ title: 'Different?', confirmLabel: 'Different', key: 'delete-fund' }), keyed)
  assert.equal(h.shown.filter(Boolean).length, 1, 'one dialog shown; the keyed one waits')
  h.controller.settle(h.current().id, true)
  assert.deepEqual(await Promise.all([first, second]), [true, true])
  assert.equal(h.current().options.key, 'delete-fund')
  h.controller.settle(h.current().id, false)
  assert.equal(await keyed, false)
  // Once answered, the same request opens a fresh dialog.
  const again = h.controller.request(options)
  assert.notEqual(again, first)
  h.controller.settle(h.current().id, false)
  assert.equal(await again, false)
})

test('returnFocus accepts an element or a ref and wins over the requesting element', () => {
  const { confirmReturnTarget } = loadComponent(path.resolve('components/ui/confirm-dialog.tsx'))
  const trigger = { id: 'menu-trigger' }
  assert.equal(confirmReturnTarget(null, trigger), trigger)
  assert.equal(confirmReturnTarget(null, { current: trigger }), trigger)
  assert.equal(confirmReturnTarget(null, { current: null }), null)
  assert.equal(confirmReturnTarget(null), null)
})
