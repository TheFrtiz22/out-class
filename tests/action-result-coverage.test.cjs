// A Server Action that throws ActionError loses that message in production
// unless it returns through actionResult(). This guard finds every exported
// action that can throw ActionError (directly, through a helper in its own
// file, or through an imported helper that throws one) and requires it to be
// wrapped in actionResult or listed below with a reviewed reason.
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');

// Shared guards used by nearly every action. Their refusals are safe, but an
// unwrapped action that hits one shows the screen's fallback, which is the
// accepted behaviour until that action is converted.
const sharedGuards = new Set(['requireAuth', 'requireClubPermission', 'assertClubOperational', 'lockOperationalClub', 'authorizeClubTransaction']);

// Reviewed exclusions: exported actions that can throw ActionError but are
// intentionally not wrapped. Reads surface failures as the screen's load
// fallback; server-only helpers are called by other actions that wrap them.
const exclusions = new Map([
  ['actions/club-onboarding.ts#createClubIdentityInvitation', 'called by inviteOrganizationMember and admin actions, which return or throw for their own callers'],
  ['actions/club-onboarding.ts#getRosterImport', 'read; failures show the load fallback'],
  ['actions/campus-events.ts#getCampusEventRsvpDashboard', 'read; failures show the load fallback'],
  ['actions/campus-events.ts#toggleCampusEventRsvp', 'already returns { ok, error } through RsvpResult'],
  ['actions/decision-schedules.ts#getDecisionSchedules', 'read; failures show the load fallback'],
  ['actions/crm.ts#getClubPipeline', 'read through /api/workspace'],
  ['actions/crm.ts#getClubPipelineList', 'read through /api/workspace'],
  ['actions/crm.ts#getClubPipelinePage', 'read through /api/workspace'],
  ['actions/crm.ts#getClubPipelineSelection', 'read through /api/workspace'],
  ['actions/crm.ts#getRankedReviewRound', 'read through /api/workspace'],
  ['actions/interview-rooms.ts#getApplicantSchedule', 'read; failures show the load fallback'],
  ['actions/organization-members.ts#getOrganizationMemberManagement', 'read through /api/workspace'],
  ['actions/profile.ts#updateStudentProfileSection', 'already returns { error }; the graduation-year support refusal is returned as that message'],
  ['actions/resume-import.ts#confirmResumeImport', 'already returns { ok, code, message }; the graduation-year support refusal is returned as FORBIDDEN'],
  ['actions/campus-events.ts#setCampusEventRsvp', 'already returns { ok, error } through RsvpResult'],
  ['actions/campus-events.ts#getCampusEventAttendees', 'read; failures show the load fallback'],
  ['actions/club-overview.ts#getClubWorkspaceOverview', 'read; failures show the load fallback'],
  ['actions/club-overview.ts#getDashboardReviewQueue', 'read; failures show the load fallback'],
  ['actions/tasks.ts#getTaskWorkspace', 'read; failures show the load fallback'],
  ['actions/admin-workspace.ts#changeAdminDesignatedLeader', 'platform admin tool, not yet converted; shows its fallback'],
  ['actions/platform-admin.ts#changePlatformResource', 'platform admin tool, not yet converted; shows its fallback'],
  ['actions/voting-room-finalization.ts#finalizeLiveVotingRoom', 'live voting is out of scope for this change'],
  ['actions/voting-room-finalization.ts#previewLiveVotingFinalization', 'live voting is out of scope for this change'],
]);

function skipString(s, i) {
  const q = s[i];
  for (i++; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (q === '`' && s[i] === '$' && s[i + 1] === '{') { i = matching(s, i + 1) ; continue; }
    if (s[i] === q) return i;
  }
  return i;
}
function matching(s, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const stack = [pairs[s[open]]];
  for (let i = open + 1; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(s, i); continue; }
    if (c === '/' && s[i + 1] === '/') { i = s.indexOf('\n', i); if (i < 0) return s.length; continue; }
    if (c === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i) + 1; continue; }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) { stack.pop(); if (!stack.length) return i; }
  }
  return s.length;
}

// Top-level function declarations (and const arrow functions) with their bodies.
function functions(source) {
  const out = new Map();
  const pattern = /^(export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\(|^(export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/gm;
  for (const m of source.matchAll(pattern)) {
    const name = m[2] || m[4], exported = !!(m[1] || m[3]);
    const paramsOpen = m.index + m[0].length - 1, paramsClose = matching(source, paramsOpen);
    const bodyOpen = source.indexOf('{', paramsClose);
    if (bodyOpen < 0) continue;
    out.set(name, { exported, body: source.slice(bodyOpen, matching(source, bodyOpen) + 1) });
  }
  return out;
}

const moduleCache = new Map();
function throwersOf(file) {
  if (moduleCache.has(file)) return moduleCache.get(file);
  const result = new Set(); moduleCache.set(file, result);
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return result;
  const source = fs.readFileSync(full, 'utf8'), fns = functions(source);
  const imported = new Map();
  for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']@\/((?:actions|utils|lib)\/[\w/-]+)["']/g))
    for (const part of m[1].split(',')) {
      const [orig, alias] = part.replace(/^\s*type\s+/, '').trim().split(/\s+as\s+/);
      if (orig && !part.trim().startsWith('type ')) imported.set((alias || orig).trim(), { name: orig.trim(), file: `${m[2]}.ts` });
    }
  const calls = (body, name) => new RegExp(`(?<![\\w.])${name}\\s*\\(`).test(body);
  for (const [name, fn] of fns) if (/new ActionError\(/.test(fn.body)) result.add(name);
  for (const [local, ref] of imported) if (!sharedGuards.has(ref.name) && !ref.file.startsWith('actions/') && throwersOf(ref.file).has(ref.name))
    for (const [name, fn] of fns) if (calls(fn.body, local)) result.add(name);
  for (let changed = true; changed;) {
    changed = false;
    for (const [name, fn] of fns) if (!result.has(name) && [...result].some(t => t !== name && calls(fn.body, t))) { result.add(name); changed = true; }
  }
  return result;
}

// interviewActionResult (utils/interview-access) is actionResult plus the uniform ACCESS_REVOKED mapping.
const wrapped = body => /^\{\s*return\s+(?:interviewActionResult|actionResult)\(/.test(body);

test('every exported action that can throw ActionError returns through actionResult', () => {
  const unwrapped = [], stale = [];
  for (const entry of fs.readdirSync(path.join(root, 'actions')).filter(f => f.endsWith('.ts')).sort()) {
    const file = `actions/${entry}`, source = fs.readFileSync(path.join(root, file), 'utf8');
    if (!/^\s*["']use server["']/.test(source)) continue;
    const throwers = throwersOf(file);
    for (const [name, fn] of functions(source)) {
      if (!fn.exported) continue;
      const key = `${file}#${name}`, canThrow = throwers.has(name);
      if (exclusions.has(key)) { if (!canThrow || wrapped(fn.body)) stale.push(key); continue; }
      if (canThrow && !wrapped(fn.body)) unwrapped.push(key);
    }
  }
  assert.deepEqual(unwrapped, [], 'Wrap these in actionResult(work, name) or add a reviewed exclusion.');
  assert.deepEqual(stale, [], 'These exclusions no longer apply; remove them.');
});

test('the analysis follows local helpers and imported throwing helpers', () => {
  const fns = functions('async function helper() { if (x) throw new ActionError("No.") }\nexport async function act() { return helper() }\nexport async function safe() { return actionResult(() => helper(), "safe") }');
  assert.deepEqual([...fns.keys()], ['helper', 'act', 'safe']);
  assert.equal(wrapped(fns.get('safe').body), true);
  assert.equal(wrapped(fns.get('act').body), false);
  assert.ok(throwersOf('actions/recruitment-offers.ts').has('respondToOfferCommand'), 'imported utils/recruitment-offers helper is followed');
  assert.ok(throwersOf('actions/applications.ts').has('submitApplication'));
});
