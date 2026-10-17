const { test } = require('node:test'), assert = require('node:assert/strict')
const { harness } = require('./helpers/interview-harness.cjs')
const { composerEnter } = harness().load('lib/composer-enter.ts')
function key(patch = {}) {
  const calls = { prevented: 0, stopped: 0, submitted: 0 }
  const event = { key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false, defaultPrevented: false, nativeEvent: {}, preventDefault() { calls.prevented++ }, stopPropagation() { calls.stopped++ }, ...patch }
  composerEnter(event, () => calls.submitted++)
  return calls
}
test('plain Enter invokes only the supplied composer action and prevents enclosing form submission', () => {
  assert.deepEqual(key(), { prevented: 1, stopped: 1, submitted: 1 })
  assert.deepEqual(key({ repeat: true }), { prevented: 1, stopped: 1, submitted: 0 })
})
test('newlines, shortcuts, IME and already-handled events remain native', () => {
  for (const patch of [{ shiftKey: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { nativeEvent: { isComposing: true } }, { nativeEvent: { keyCode: 229 } }, { key: 'Process' }, { key: 'Tab' }, { defaultPrevented: true }]) {
    assert.deepEqual(key(patch), { prevented: 0, stopped: 0, submitted: 0 })
  }
})
