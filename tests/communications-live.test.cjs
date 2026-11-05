const { test } = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpers/communications-loader.cjs');
const { startCommunicationsLive } = loader({})('lib/communications-live.ts');

function harness({ streamAllowed = true, visibility = 'visible' } = {}) {
  const docListeners = {}, winListeners = {}, sources = []; let tick, cleared = false, refreshes = 0;
  const doc = { visibilityState: visibility, addEventListener: (k, fn) => { docListeners[k] = fn; }, removeEventListener: k => { delete docListeners[k]; } };
  const win = { addEventListener: (k, fn) => { winListeners[k] = fn; }, removeEventListener: k => { delete winListeners[k]; }, setInterval: fn => { tick = fn; return 7; }, clearInterval: id => { assert.equal(id, 7); cleared = true; } };
  const openStream = () => {
    const listeners = {}, source = { readyState: 1, closed: false, addEventListener: (k, fn) => { listeners[k] = fn; }, close() { source.closed = true; source.readyState = 2; }, emit: (k, data) => listeners[k]?.({ data: JSON.stringify(data) }) };
    sources.push(source); return source;
  };
  const stop = startCommunicationsLive({ changed: () => { refreshes++; }, streamAllowed, doc, win, openStream });
  return {
    doc, sources, stop, get refreshes() { return refreshes; }, get cleared() { return cleared; },
    poll: () => tick(), focus: () => winListeners.focus(), notify: () => winListeners['outclass:communications-changed'](),
    setVisibility(state) { doc.visibilityState = state; docListeners.visibilitychange(); },
    listening: () => Object.keys(docListeners).length + Object.keys(winListeners).length,
  };
}

test('a visible tab refreshes on the first revision and on changes, never on an unchanged reconnect', () => {
  const live = harness();
  assert.equal(live.sources.length, 1);
  live.sources[0].emit('communications', { revision: 'a', unread: 0 });
  assert.equal(live.refreshes, 1, 'the first revision may race the initial load');
  live.sources[0].emit('communications', { revision: 'b', unread: 1 });
  assert.equal(live.refreshes, 2);
  // The server closes each stream after ~45s; the browser reconnects and the
  // new stream re-announces the current revision.
  live.sources[0].readyState = 0;
  live.sources[0].readyState = 1;
  live.sources[0].emit('communications', { revision: 'b', unread: 1 });
  assert.equal(live.refreshes, 2, 'an unchanged revision is not refetched');
  live.sources[0].emit('communications', { revision: 'not-json-revision' });
  assert.equal(live.refreshes, 3);
});

test('the poll runs only while the stream is not connected', () => {
  const live = harness();
  live.poll(); assert.equal(live.refreshes, 0, 'an open stream makes the poll redundant');
  live.sources[0].readyState = 0; // reconnect gap
  live.poll(); assert.equal(live.refreshes, 1);
  live.sources[0].readyState = 1;
  live.sources[0].emit('unavailable', {});
  assert.ok(live.sources[0].closed);
  live.poll(); assert.equal(live.refreshes, 2, 'an unavailable stream falls back to polling');
});

test('a hidden tab holds no stream and does not poll, then catches up when visible', () => {
  const live = harness();
  live.sources[0].emit('communications', { revision: 'a' });
  live.setVisibility('hidden');
  assert.ok(live.sources[0].closed, 'hidden tabs release the server stream');
  live.poll(); assert.equal(live.refreshes, 1, 'hidden tabs do not poll');
  live.setVisibility('visible');
  assert.equal(live.sources.length, 2, 'becoming visible reconnects');
  live.sources[1].emit('communications', { revision: 'a' });
  assert.equal(live.refreshes, 1, 'nothing changed while hidden');
  live.setVisibility('hidden'); live.setVisibility('visible');
  live.sources[2].emit('communications', { revision: 'c' });
  assert.equal(live.refreshes, 2, 'a change while hidden is fetched on return');
  // Events from a stream that was already replaced are ignored.
  live.sources[0].emit('communications', { revision: 'z' });
  assert.equal(live.refreshes, 2);
});

test('a hidden tab at mount opens nothing until it becomes visible', () => {
  const live = harness({ visibility: 'hidden' });
  assert.equal(live.sources.length, 0);
  live.setVisibility('visible');
  assert.equal(live.sources.length, 1);
});

test('support sessions never open the stream; they poll and catch up on return', () => {
  const live = harness({ streamAllowed: false });
  assert.equal(live.sources.length, 0);
  live.poll(); assert.equal(live.refreshes, 1);
  live.setVisibility('hidden'); live.poll(); assert.equal(live.refreshes, 1);
  live.setVisibility('visible'); assert.equal(live.refreshes, 2);
  assert.equal(live.sources.length, 0);
});

test('focus and local change events refresh; cleanup closes the stream and removes every listener', () => {
  const live = harness();
  live.focus(); live.notify();
  assert.equal(live.refreshes, 2);
  live.stop();
  assert.ok(live.sources[0].closed);
  assert.ok(live.cleared);
  assert.equal(live.listening(), 0);
  live.sources[0].emit('communications', { revision: 'late' });
  assert.equal(live.refreshes, 2, 'a stopped stream never refreshes');
});
