const { test } = require('node:test'), assert = require('node:assert/strict')
const { loader } = require('./helpers/communications-loader.cjs')
const { AutosaveQueue } = loader({})('lib/autosave-queue.ts')
const tick = () => new Promise(resolve => setImmediate(resolve))
test('rapid typing debounces writes and Saved waits for actual persistence', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const calls = []; let release
  const queue = new AutosaveQueue('', value => { calls.push(value); return new Promise(r => release = r) }, () => {})
  queue.change('a'); t.mock.timers.tick(700); queue.change('ab'); t.mock.timers.tick(849)
  assert.deepEqual(calls, []); assert.equal(queue.dirty, true)
  t.mock.timers.tick(1); await tick(); assert.deepEqual(calls, ['ab']); assert.equal(queue.state, 'saving')
  release(); await queue.flush(); assert.equal(queue.state, 'saved'); assert.equal(queue.dirty, false)
})
test('overlapping flushes serialize immutable snapshots and cannot revert late edits', async () => {
  let release; const calls = [], recovery = []
  const queue = new AutosaveQueue({ text: '' }, async value => { calls.push(value); if(calls.length === 1) await new Promise(r => release = r) }, () => {}, value => recovery.push(value))
  queue.change({ text: 'first' }); const flight = queue.flush(); await tick()
  queue.change({ text: 'latest' }); assert.equal(queue.flush(), flight); assert.equal(calls.length, 1)
  release(); await flight
  assert.deepEqual(calls, [{ text: 'first' }, { text: 'latest' }]); assert.equal(queue.value.text, 'latest'); assert.equal(queue.state, 'saved'); assert.equal(recovery.at(-1), null)
  queue.dispose()
})
test('failure retains newest changes and recovery, retry and offline edits are safe', async () => {
  let fail = true, persisted; const recovery = []
  const queue = new AutosaveQueue('', async value => { if(fail)throw Error('offline');persisted=value }, () => {}, value => recovery.push(value))
  queue.change('unsaved'); await assert.rejects(queue.flush(), /offline/)
  assert.equal(queue.state, 'error'); assert.equal(queue.dirty, true); assert.equal(recovery.at(-1), 'unsaved')
  queue.change('newer while offline'); fail = false; await queue.flush()
  assert.equal(persisted, 'newer while offline'); assert.equal(queue.state, 'saved'); assert.equal(recovery.at(-1), null)
})
test('unmount keeps an in-flight writer and flushes its latest edit without notifying disposed UI', async () => {
  let release, notices=0;const writes=[]
  const queue=new AutosaveQueue('',async value=>{writes.push(value);if(writes.length===1)await new Promise(r=>release=r)},()=>notices++)
  queue.change('a');const flight=queue.flush();await tick();queue.change('b');queue.dispose();const before=notices;release();await flight
  assert.deepEqual(writes,['a','b']);assert.equal(notices,before);assert.equal(queue.state,'saved')
})
test('synchronous validation failure does not wedge the queue and empty strings are saved', async () => {
  let fail=true;const calls=[];const queue=new AutosaveQueue('original',value=>{if(fail)throw Error('invalid');calls.push(value);return Promise.resolve()},()=>{})
  queue.change('');await assert.rejects(queue.flush(),/invalid/);fail=false;await queue.flush();assert.deepEqual(calls,['']);assert.equal(queue.saving,false)
})
test('typing within the same pending state does not cause redundant status renders', () => {
  let notices=0;const queue=new AutosaveQueue('',async()=>{},()=>notices++)
  queue.change('a');queue.change('ab');queue.change('abc');assert.equal(notices,1);queue.dispose()
})
