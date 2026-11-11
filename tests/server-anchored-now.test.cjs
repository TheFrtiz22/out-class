// BUG-1: deadline state on server-rendered views follows the server's clock, not the device's.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load() {
  const state = { device: 0, hydrating: true, timers: [] };
  let slots = [], index = 0;
  const react = {
    useSyncExternalStore: (_subscribe, client, server) => state.hydrating ? server() : client(),
    useState(init) { const i = index++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => { slots[i] = v }] },
    useEffect(fn) { withDevice(fn) },
  };
  const mod = { exports: {} };
  const realNow = Date.now;
  const withDevice = fn => { const saved = Date.now; Date.now = () => state.device; try { return fn() } finally { Date.now = saved } };
  const withClock = fn => { Date.now = () => state.device; global.window = {}; try { return fn() } finally { Date.now = realNow; delete global.window } };
  // The shared minute clock (FE-4): ticks reach every subscriber; a subscription reads the time at once.
  const minuteClock = { subscribe(fn) { state.timers.push(fn); fn(); return () => { state.timers = state.timers.filter(t => t !== fn) } } };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('hooks/use-server-now.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(
    name => name === 'react' ? react : name === '@/lib/minute-clock' ? { minuteClock } : require(name), mod, mod.exports);
  return {
    state,
    mount(serverNow) { slots = []; index = 0; state.timers = []; return withClock(() => mod.exports.useServerAnchoredNow(serverNow)) },
    render(serverNow) { index = 0; return withClock(() => mod.exports.useServerAnchoredNow(serverNow)) },
    tick(ms) { state.device += ms; withClock(() => state.timers.forEach(fn => fn())) },
  };
}

const server = Date.parse('2026-11-09T16:00:00Z');

test('hydration uses the server time even when the device clock is 15 minutes ahead; ticks keep the offset', () => {
  const h = load(); h.state.device = server + 15 * 60_000;
  assert.equal(h.mount(server), server, 'hydration matches the server HTML');
  h.state.hydrating = false; h.tick(60_000);
  assert.equal(h.render(server), server + 60_000, 'later minutes keep the server offset');
});

test('remounting after 30 minutes (back from Tracker or Calendar) is current, not the stale render time', () => {
  const h = load(); h.state.device = server + 15 * 60_000;
  h.mount(server); h.state.hydrating = false;
  h.state.device += 30 * 60_000;
  assert.equal(h.mount(server), server + 30 * 60_000, 'device clock plus the offset measured at hydration');
});

test('a view opened client-side without a hydration anchor uses the device clock', () => {
  const h = load(); h.state.hydrating = false; h.state.device = server;
  assert.equal(h.mount(undefined), server);
  assert.equal(h.mount(server), server, 'a client-only mount ignores serverNow');
});

test('FE-4: the hook subscribes to the shared minute clock instead of owning a timer, and can pause', () => {
  const source = fs.readFileSync('hooks/use-server-now.ts', 'utf8');
  assert.doesNotMatch(source, /setInterval|setTimeout/);
  assert.match(source, /minuteClock\.subscribe\(/);
  assert.match(source, /if \(!enabled\) return/);
});
