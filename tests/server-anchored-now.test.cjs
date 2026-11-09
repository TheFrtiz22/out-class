// BUG-1: deadline state on server-rendered views follows the server's clock, not the device's.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function hook(deviceNow) {
  const slots = [], timers = []; let effect, index = 0, now = deviceNow;
  const react = { useState(init) { const i = index++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => { slots[i] = v }] }, useEffect(fn) { effect = fn } };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'setInterval', 'clearInterval', ts.transpileModule(fs.readFileSync('hooks/use-server-now.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(
    name => name === 'react' ? react : require(name), mod, mod.exports, fn => timers.push(fn), () => {});
  const realNow = Date.now;
  return {
    render(serverNow) { index = 0; Date.now = () => now; try { return mod.exports.useServerAnchoredNow(serverNow) } finally { Date.now = realNow } },
    mount() { Date.now = () => now; try { effect() } finally { Date.now = realNow } },
    tick(ms) { now += ms; Date.now = () => now; try { timers.forEach(fn => fn()) } finally { Date.now = realNow } },
  };
}

test('the first render uses the server time even when the device clock is 15 minutes ahead', () => {
  const server = Date.parse('2026-11-09T16:00:00Z'), h = hook(server + 15 * 60_000);
  assert.equal(h.render(server), server, 'hydration matches the server HTML');
  h.mount(); h.tick(60_000);
  assert.equal(h.render(server), server + 60_000, 'later minutes keep the server offset');
});

test('a view opened client-side uses the device clock', () => {
  const device = Date.parse('2026-11-09T16:15:00Z'), h = hook(device);
  assert.equal(h.render(undefined), device);
});

test('the club profile reads its deadline clock from the server render time', () => {
  assert.match(fs.readFileSync('components/views/club-profile-view.tsx', 'utf8'), /const now = useServerAnchoredNow\(serverNow\)/);
  assert.match(fs.readFileSync('app/(workspace)/club/[clubId]/page.tsx', 'utf8'), /<PublicClubPage [^>]*serverNow=\{Date\.now\(\)\}/);
});
