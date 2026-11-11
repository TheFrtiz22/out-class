// Production Next.js replaces a thrown Server Action error's message with a
// generic "Server Components render" text and a digest. Client code must route
// caught errors through userMessage(error, fallback) instead of rendering
// error.message. This guard fails on a new raw-message site.
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');

const root = path.join(__dirname, '..');
const roots = ['app', 'components', 'contexts', 'hooks', 'lib'];
const skip = /(^|\/)(node_modules|live-voting|demo)(\/|$)|^app\/api\//;

// Local, synchronous validation that never calls a Server Action: these
// messages come from our own pure helpers and are written for people.
const allowlist = new Map([
  ['components/communication-schedules.tsx', 'resolveScheduleTime date validation'],
  ['components/events/event-schedule-fields.tsx', 'eventSchedule date validation'],
  ['components/interviews/create-room-dialog.tsx', 'roomSlots preview validation'],
  ['components/member-group-builder.tsx', 'group size plan validation'],
  ['components/tasks/task-audience-builder.tsx', 'resolveTaskRecipients preview validation'],
  ['components/profile-photo-crop.tsx', 'photoCropRect image validation'],
  ['lib/resume-pdf.ts', 'worker-thread PDF parsing, not rendered directly'],
]);

const patterns = [
  /\b(\w+)\s+instanceof\s+Error\b[^?;]{0,80}\?\s*\1\.message/g,
  /\bcatch\s*\(\s*(\w+)[^)]*\)\s*\{[^}]{0,200}?\b\1\??\.message\b/g,
  /\.catch\(\s*\(?\s*(\w+)\s*\)?\s*=>[^;]{0,200}?\b\1\??\.message\b/g,
  /\(\s*(\w+)\s+as\s+Error\s*\)\.message/g,
];

function files(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = `${dir}/${entry.name}`;
    if (skip.test(rel)) return [];
    if (entry.isDirectory()) return files(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}

function rawSites(source) {
  const sites = [];
  for (const pattern of patterns) for (const match of source.matchAll(pattern)) {
    const before = source.slice(Math.max(0, match.index - 40), match.index);
    if (/userMessage\(\s*$/.test(before)) continue;
    sites.push(source.slice(0, match.index).split('\n').length);
  }
  return [...new Set(sites)].sort((a, b) => a - b);
}

test('client error handlers use userMessage instead of rendering error.message', () => {
  const offenders = [];
  for (const file of roots.flatMap(files)) {
    if (allowlist.has(file)) continue;
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    // Server modules never render; their messages reach clients only through actionResult.
    if (/^\s*["']use server["']/.test(source)) continue;
    for (const line of rawSites(source)) offenders.push(`${file}:${line}`);
  }
  assert.deepEqual(offenders, [], 'Use userMessage(error, fallback) from @/lib/user-message for these handlers.');
});

test('the guard recognizes raw handlers and accepts userMessage', () => {
  assert.equal(rawSites('catch (e) { setError(e instanceof Error ? e.message : "Could not save.") }').length, 1);
  assert.equal(rawSites('.catch(e => { if (live) setError(e.message) })').length, 1);
  assert.equal(rawSites('catch (err: any) { setGlobalError(err?.message ?? "x") }').length, 1);
  assert.equal(rawSites('catch (e) { setError(userMessage(e, "Could not save.")) }').length, 0);
});

test('every allowlisted file still exists and still needs its exemption', () => {
  for (const [file] of allowlist) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(rawSites(source).length > 0, `${file} no longer needs an allowlist entry`);
  }
});
