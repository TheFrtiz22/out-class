// Instant feedback: optimistic actions change the UI before the server answers and roll back on
// refusal; actions that must wait disable their button and show a pending label while they run.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

const stub = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
function load(file, mocks, extra = '') {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8') + extra, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name]
    : name.endsWith('.css') ? {}
    : name === 'react/jsx-runtime' ? require(name)
    : name.startsWith('@/lib/') && fs.existsSync(name.slice(2) + '.ts') && !/workspace-api|campus-events|club-workspace|club-colors/.test(name) ? load(name.slice(2) + '.ts', mocks)
    : stub, mod, mod.exports)
  return mod.exports
}
// A tiny hook runtime: enough for useState/useRef/useEffect components rendered as plain functions.
function hooks() {
  const state = [], effects = []; let cursor = 0
  return {
    react: {
      useState: value => { const i = cursor++; if (!(i in state)) state[i] = typeof value === 'function' ? value() : value; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next }] },
      useRef: value => { const i = cursor++; if (!(i in state)) state[i] = { current: value }; return state[i] },
      useEffect: (fn, deps) => { const i = cursor++; if (!state[i] || !deps || deps.some((v, j) => v !== state[i][j])) { state[i] = deps || []; effects.push(fn) } },
    },
    reset() { cursor = 0 },
    async flush() { for (const fn of effects.splice(0)) fn(); for (let i = 0; i < 15; i++) await Promise.resolve() },
  }
}
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
const text = tree => JSON.stringify(tree)
const button = (tree, label) => nodes(tree).find(n => ['Button', 'button'].includes(n.type) && text(n.props.children).includes(label))
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function withWindow(fn) {
  const before = global.window; global.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {}, location: { assign() {} } }
  return Promise.resolve().then(fn).finally(() => { global.window = before })
}

// ---------- (a) RSVP ----------
function rsvpHarness(setRsvp, event = {}) {
  const h = hooks(), calls = []
  const { RsvpControls } = load('components/events/public-event-board.tsx', { react: h.react, '@/lib/workspace-api': { getCampusEventRsvp: async () => ({ going: false }), setCampusEventRsvp: input => { calls.push(input); return setRsvp(input) } } })
  const props = { event: { id: 'event', rsvpEnabled: true, date: new Date(Date.now() + 864e5).toISOString(), rsvpDeadline: null, capacity: null, rsvpCount: 3, ...event }, identity: 'student', onChanged: count => calls.push({ count }) }
  return { calls, render() { h.reset(); return RsvpControls(props) }, flush: h.flush }
}

test('RSVP shows “You’re going” before the server answers and rolls back with an inline error on rejection', () => withWindow(async () => {
  const pending = deferred(), h = rsvpHarness(() => pending.promise)
  h.render(); await h.flush()
  button(h.render(), 'RSVP').props.onClick()
  let tree = h.render()
  assert.match(text(tree), /You’re going/, 'optimistic state before the server resolves')
  assert.equal(button(tree, 'Cancel RSVP').props.disabled, true, 'no double submit while saving')
  // workspace-api unwraps the action's { ok: false } result into a UserFacingError.
  pending.reject(Object.assign(Error('This event is full.'), { userFacing: true })); await h.flush()
  tree = h.render()
  assert.doesNotMatch(text(tree), /You’re going/)
  assert.ok(button(tree, 'RSVP'))
  assert.ok(nodes(tree).some(n => n.props?.role === 'alert' && text(n.props.children).includes('This event is full.')))
}))

test('RSVP rolls back when the server refuses without throwing, and keeps the confirmed state on success', () => withWindow(async () => {
  let h = rsvpHarness(async () => ({ ok: false, error: 'RSVP closed.' }))
  h.render(); await h.flush(); button(h.render(), 'RSVP').props.onClick(); await h.flush()
  assert.doesNotMatch(text(h.render()), /You’re going/); assert.match(text(h.render()), /RSVP closed\./)
  h = rsvpHarness(async () => ({ ok: true, going: true, count: 4 }))
  h.render(); await h.flush(); button(h.render(), 'RSVP').props.onClick(); await h.flush()
  assert.match(text(h.render()), /You’re going/); assert.deepEqual(h.calls.at(-1), { count: 4 })
}))

test('cancelling from “Your RSVPs” removes the row at once and restores it in place on failure', () => withWindow(async () => {
  const h = hooks(), pending = deferred()
  const { MyEventRsvps } = load('components/events/public-event-board.tsx', { react: h.react, '@/lib/workspace-api': { getMyCampusEventRsvps: async () => [{ eventId: 'a', title: 'Alpha', available: true }, { eventId: 'b', title: 'Beta', available: true }], setCampusEventRsvp: () => pending.promise } }, '\nexport { MyEventRsvps as MyEventRsvps };')
  const render = () => { h.reset(); return MyEventRsvps({ onCancelled() {} }) }
  render(); await h.flush()
  const cancel = nodes(render()).filter(n => n.type === 'Button' && text(n.props.children).includes('Cancel'))[0]
  cancel.props.onClick()
  assert.doesNotMatch(text(render()), /Alpha/, 'row leaves before the server resolves')
  pending.reject(Error('offline')); await h.flush()
  const after = text(render())
  assert.ok(after.indexOf('Alpha') >= 0 && after.indexOf('Alpha') < after.indexOf('Beta'), 'row returns to its place')
  assert.match(after, /Could not cancel/)
}))

// ---------- (a) Invitation “Not now” ----------
function invitationHarness(dismiss) {
  const h = hooks(), changes = []
  const { OrganizationInvitationCard } = load('components/organization-invitation-card.tsx', { react: h.react, '@/actions/club-onboarding': { setOrganizationInvitationDismissed: dismiss, acceptIdentityClubInvitation: async () => ({}), declineIdentityClubInvitation: async () => ({}) } })
  const invitation = { id: 'inv', requestedRole: 'MEMBER', dismissedAt: null, club: { id: 'club', name: 'Consulting Club', logoUrl: null, marketing: null, color: null } }
  return { changes, render() { h.reset(); return OrganizationInvitationCard({ invitation, onChanged: async c => { changes.push(c) } }) }, flush: h.flush }
}

test('“Not now” hides the invitation before the server answers and restores it with an inline error on failure', () => withWindow(async () => {
  const pending = deferred(), h = invitationHarness(() => pending.promise)
  button(h.render(), 'Not now').props.onClick()
  let tree = h.render()
  assert.match(text(tree), /Hidden from your dashboard/)
  assert.equal(button(tree, 'Show on dashboard').props.disabled, true)
  pending.reject(Error('offline')); await h.flush()
  tree = h.render()
  assert.doesNotMatch(text(tree), /Hidden from your dashboard/)
  assert.ok(button(tree, 'Not now'))
  assert.ok(nodes(tree).some(n => n.props?.role === 'alert'))
  assert.equal(h.changes.length, 0)
}))

test('a confirmed “Not now” reports the change once', () => withWindow(async () => {
  const h = invitationHarness(async () => {})
  button(h.render(), 'Not now').props.onClick(); await h.flush()
  assert.deepEqual(h.changes, [{ id: 'inv', kind: 'dismissed', clubName: 'Consulting Club' }])
}))

// ---------- (a) Pipeline board stage move ----------
// Board drops stage a decision (nothing is sent). The staged placement shows before the server answers
// and rolls back to the previous staged state if the write is refused.
test('a board drop stages optimistically, keeps the revision check, and rolls back on a refusal', () => {
  const source = fs.readFileSync('hooks/use-staged-decisions.ts', 'utf8')
  const body = source.slice(source.indexOf('const write = useCallback'), source.indexOf('return true', source.indexOf('const write = useCallback')))
  assert.ok(body.indexOf('put(app.id, {') < body.indexOf('await stageDecision'), 'placed before the write')
  assert.match(body, /expectedStatus: app\.status as "IN_REVIEW", expectedRoundId: app\.roundId/)
  const failure = source.slice(source.indexOf('} catch (error) {', source.indexOf('const write = useCallback')))
  assert.match(failure, /put\(app\.id, previous\)/, 'a refused stage restores the previous placement')
})

// ---------- (b) Must-wait actions disable and acknowledge while pending ----------
test('every must-wait submit in the listed surfaces is disabled while pending and says so', () => {
  const read = file => fs.readFileSync(file, 'utf8')
  const expectations = [
    ['components/applications/application-form.tsx', /disabled=\{busy\}[^\n]*?onClick=\{\(\) => void persist\(true\)\}>\s*\{busy \? "Submitting…"/],
    ['components/interviews/booking-picker.tsx', /<Button disabled=\{busy \|\|[^\n]*?onReserve[^\n]*?>\{busy \? "Saving…"/],
    ['components/organization-invitation-card.tsx', /disabled=\{!!busy\}[^\n]*?respond\("accepted"\)\}>\s*\{busy === "accepted" \?/],
    ['components/organization-invitation-card.tsx', /disabled=\{!!busy\} onClick=\{\(\) => void respond\("declined"\)\}>\{busy === "declined" \? "Declining…"/],
    ['components/club-announcements.tsx', /<Button disabled=\{busy[^\n]*?onClick=\{\(\)=>void publish\(\)\}>\{busy\?"Publishing…"/],
    ['components/club-announcements.tsx', /<Button type="submit" disabled=\{busy[^\n]*?>[^]*?\{busy\?"Reviewing recipients…"/],
    ['components/club-tasks.tsx', /<Button className="w-full sm:w-auto" disabled=\{busy \|\| uploading\}>\s*\{busy\s*\? "Submitting…"/],
    ['components/qr/meeting-check-in.tsx', /disabled=\{busy \|\| !title\}[^]*?\{busy \? "Checking in…" : "Check in"\}/],
    ['components/communications-preferences.tsx', /<Button disabled=\{saving\} onClick=\{\(\)=>void save\(\)\}>\{saving\?"Saving…"/],
    ['components/applicant-review/review-grading.tsx', /disabled=\{!ready\} onClick=\{\(\) => void submit\(\)\}>\{busy \? "Submitting…" : "Submit grade"\}/],
    ['components/applicant-review/staged-decisions-panel.tsx', /<Button disabled=\{busy \|\| !chosen\.length\} onClick=\{\(\) => void send\(\)\}>\{busy \? "Sending…"/],
    ['components/applicant-review/applicant-review-flow.tsx', /<Button disabled=\{busy \|\| targetRound === app\.roundId\}[^\n]*?>\{busy \? "Moving…" : "Move round"\}/],
    ['components/applicant-review/applicant-review-flow.tsx', /<Button disabled=\{busy \|\| reason\.trim\(\)\.length < 10\}[^\n]*?>\{busy \? "Returning…" : "Reconsider"\}/],
  ]
  for (const [file, pattern] of expectations) assert.match(read(file), pattern, `${file}: ${pattern}`)
  // No surface uses <form action={serverAction}>, so useFormStatus has no form to observe; keep it that way or add it.
  for (const file of expectations.map(([f]) => f)) {
    const src = read(file)
    if (/<form[^>]*\saction=\{/.test(src)) assert.match(src, /useFormStatus/, `${file} uses a form action without useFormStatus`)
  }
})
