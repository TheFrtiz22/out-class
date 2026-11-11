// FE-4: one shared minute clock replaces the per-view 60 s timers.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => mocks[name] || (name.startsWith('@/') ? load(path.resolve(name.slice(2) + '.ts'), mocks) : require(name)), mod, mod.exports);
  return mod.exports;
}

function fakeHost() {
  const host = { time: Date.parse('2026-11-10T15:00:30Z'), timers: new Map(), next: 1, listeners: [] };
  const target = { addEventListener: (type, fn) => host.listeners.push([type, fn]), removeEventListener: (type, fn) => { host.listeners = host.listeners.filter(([t, f]) => t !== type || f !== fn) } };
  host.api = {
    now: () => new Date(host.time),
    setTimeout: (fn, delay) => { const id = host.next++; host.timers.set(id, { fn, at: host.time + delay }); return id },
    clearTimeout: id => host.timers.delete(id),
    window: target, document: { ...target, visibilityState: 'visible' },
  };
  host.advance = ms => { host.time += ms; for (const [id, t] of [...host.timers]) if (t.at <= host.time) { host.timers.delete(id); t.fn() } };
  return host;
}

const { createMinuteClock } = load('lib/minute-clock.ts');

test('many subscribers share one minute-aligned timer; each gets the time at once and on every minute', () => {
  const host = fakeHost(), clock = createMinuteClock(() => host.api);
  const seen = [[], [], []];
  const stops = seen.map(list => clock.subscribe(now => list.push(+now)));
  assert.equal(host.timers.size, 1, 'one timer for every subscriber');
  assert.deepEqual(seen.map(list => list.length), [1, 1, 1], 'each subscriber reads the time immediately');
  host.advance(30_000);
  assert.deepEqual(seen.map(list => list.at(-1)), Array(3).fill(Date.parse('2026-11-10T15:01:00Z')), 'ticks land on the minute boundary');
  assert.equal(host.timers.size, 1);
  stops[0](); stops[1]();
  assert.equal(clock.running, true);
  stops[2]();
  assert.equal(clock.running, false); assert.equal(host.timers.size, 0); assert.equal(host.listeners.length, 0, 'last unsubscribe removes timer and listeners');
});

test('a hidden tab stops ticking and catches up when it becomes visible', () => {
  const host = fakeHost(), clock = createMinuteClock(() => host.api), seen = [];
  clock.subscribe(now => seen.push(+now));
  host.api.document.visibilityState = 'hidden';
  host.listeners.find(([type]) => type === 'visibilitychange')[1]();
  assert.equal(host.timers.size, 0);
  host.time += 5 * 60_000; host.api.document.visibilityState = 'visible';
  host.listeners.find(([type]) => type === 'visibilitychange')[1]();
  assert.equal(seen.at(-1), host.time); assert.equal(host.timers.size, 1);
});

test('no stray per-view 60 s clocks remain; student views use the shared clock', () => {
  const roots = ['components', 'hooks', 'contexts', 'app', 'lib'];
  const files = [];
  const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) { if (!/node_modules|live-voting/.test(full)) walk(full) } else if (/\.tsx?$/.test(entry.name)) files.push(full) } };
  roots.forEach(walk);
  const minuteTimer = /setInterval\([\s\S]{0,120}?set(Now|Data)\([\s\S]{0,60}?60_?000/;
  const clocks = files.filter(file => minuteTimer.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(clocks, [], 'minute re-render timers must use the shared clock');
  for (const file of ['components/views/application-tracker-view.tsx', 'components/views/calendar-view.tsx', 'components/views/explore-view.tsx', 'components/shell/notification-center.tsx', 'components/communications/decision-letter.tsx', 'components/views/club-profile-view.tsx']) {
    assert.match(fs.readFileSync(file, 'utf8'), /useServerAnchoredNow\(/, file);
  }
  assert.match(fs.readFileSync('hooks/use-welcome-clock.ts', 'utf8'), /minuteClock\.subscribe\(setNow\)/);
  assert.match(fs.readFileSync('hooks/use-server-now.ts', 'utf8'), /minuteClock\.subscribe\(/);
  // Hydration: views render the server time (or nothing, for greetings) first, never a fresh Date.now() state.
  for (const file of ['components/views/application-tracker-view.tsx', 'components/views/calendar-view.tsx', 'components/views/explore-view.tsx', 'components/shell/notification-center.tsx']) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /useState\(\(?\)?\s*=?>?\s*(Date\.now\(\)|new Date\(\))\)/, file);
  }
});
