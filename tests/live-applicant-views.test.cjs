// Applicants: toolbar, the shared review flow, staged decisions and the board.
// The old drawer, "Start quick review" and "Quick decisions" were replaced by the review flow (Nov 2026).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function compile(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => mocks[name] || require(name.startsWith('@/') ? require('node:path').resolve(name.slice(2)) : name), mod, mod.exports)
  return mod.exports
}
// recruitment-lifecycle throws ActionError (#292); action-result has no imports of its own.
const actionResult = compile('lib/action-result.ts')
const lifecycle = compile('lib/recruitment-lifecycle.ts', { '@prisma/client': {}, '@/lib/action-result': actionResult })
const staged = compile('lib/staged-decisions.ts', { '@/lib/recruitment-lifecycle': lifecycle, '@/lib/action-result': actionResult })
const board = compile('lib/applicant-board.ts')
const zod = require('zod')
const rubric = compile('lib/review-rubric.ts', { zod })
const read = file => fs.readFileSync(file, 'utf8')
const rounds = [{ id: 'r1', name: 'Application review', order: 0, type: 'APPLICATION_REVIEW' }, { id: 'r2', name: 'Interview', order: 1, type: 'INTERVIEW' }, { id: 'r3', name: 'Final round', order: 2, type: 'CUSTOM' }]

test('Advance moves to the next round, and to Accepted from the last round or the waitlist', () => {
  assert.deepEqual(staged.resolveStagedTarget({ status: 'SUBMITTED', roundId: 'r1' }, rounds, 'ADVANCE'), { targetStatus: 'IN_REVIEW', targetRoundId: 'r2' })
  assert.deepEqual(staged.resolveStagedTarget({ status: 'INTERVIEWING', roundId: 'r2' }, rounds, 'ADVANCE'), { targetStatus: 'IN_REVIEW', targetRoundId: 'r3' }, 'leaving an interview round returns to review, as the CRM does')
  assert.deepEqual(staged.resolveStagedTarget({ status: 'IN_REVIEW', roundId: 'r3' }, rounds, 'ADVANCE'), { targetStatus: 'ACCEPTED', targetRoundId: null })
  assert.deepEqual(staged.resolveStagedTarget({ status: 'WAITLISTED', roundId: 'r2' }, rounds, 'ADVANCE'), { targetStatus: 'ACCEPTED', targetRoundId: null })
  // Rounds are ordered by `order`, never by array position.
  assert.deepEqual(staged.resolveStagedTarget({ status: 'IN_REVIEW', roundId: 'r1' }, [...rounds].reverse(), 'ADVANCE').targetRoundId, 'r2')
  assert.equal(staged.advanceLabel({ status: 'IN_REVIEW', roundId: 'r1' }, rounds), 'Advance to Interview')
  assert.equal(staged.advanceLabel({ status: 'IN_REVIEW', roundId: 'r3' }, rounds), 'Advance to Accepted')
})

test('Hold keeps the applicant in review; Reject, Waitlist and Accept map to their statuses; final decisions are not staged', () => {
  assert.deepEqual(staged.resolveStagedTarget({ status: 'SUBMITTED', roundId: 'r1' }, rounds, 'HOLD'), { targetStatus: 'IN_REVIEW', targetRoundId: null })
  assert.deepEqual(staged.resolveStagedTarget({ status: 'IN_REVIEW', roundId: 'r1' }, rounds, 'REJECT'), { targetStatus: 'REJECTED', targetRoundId: null })
  assert.deepEqual(staged.resolveStagedTarget({ status: 'IN_REVIEW', roundId: 'r1' }, rounds, 'WAITLIST'), { targetStatus: 'WAITLISTED', targetRoundId: null })
  assert.deepEqual(staged.resolveStagedTarget({ status: 'INTERVIEWING', roundId: 'r2' }, rounds, 'ACCEPT'), { targetStatus: 'ACCEPTED', targetRoundId: null })
  for (const status of ['ACCEPTED', 'REJECTED', 'DRAFTING']) assert.throws(() => staged.resolveStagedTarget({ status, roundId: 'r1' }, rounds, 'REJECT'), /Final decisions|can't/)
  assert.throws(() => staged.resolveStagedTarget({ status: 'WAITLISTED', roundId: 'r1' }, rounds, 'HOLD'))
  assert.throws(() => staged.resolveStagedTarget({ status: 'WAITLISTED', roundId: 'r1' }, rounds, 'ROUND', 'r2'))
  assert.throws(() => staged.resolveStagedTarget({ status: 'IN_REVIEW', roundId: 'r1' }, rounds, 'ROUND', 'r1'))
  assert.equal(staged.stagedIsStale({ expectedStatus: 'IN_REVIEW', expectedRoundId: 'r1' }, { status: 'IN_REVIEW', roundId: 'r1' }), false)
  assert.equal(staged.stagedIsStale({ expectedStatus: 'IN_REVIEW', expectedRoundId: 'r1' }, { status: 'INTERVIEWING', roundId: 'r1' }), true)
})

test('board columns follow rounds and outcomes, and staged decisions place the card where it will land', () => {
  assert.deepEqual(board.boardColumns(rounds).map(c => c.title), ['Application review', 'Interview', 'Final round', 'Waitlisted', 'Accepted', 'Rejected'])
  assert.deepEqual(board.boardColumns([rounds[0]]).map(c => c.title), ['Pending', 'Waitlisted', 'Accepted', 'Rejected'])
  assert.equal(board.boardColumnFor({ status: 'SUBMITTED', roundId: 'r1' }), 'round:r1')
  assert.equal(board.boardColumnFor({ status: 'DRAFTING', roundId: 'r1' }), null)
  assert.equal(board.boardColumnFor({ status: 'IN_REVIEW', roundId: 'r1' }, { targetStatus: 'IN_REVIEW', targetRoundId: 'r2' }), 'round:r2')
  assert.equal(board.boardColumnFor({ status: 'IN_REVIEW', roundId: 'r1' }, { targetStatus: 'REJECTED', targetRoundId: null }), 'rejected')
  assert.deepEqual(board.boardDrop({ status: 'IN_REVIEW', roundId: 'r1' }, 'round:r2', false), { kind: 'stage', outcome: 'ROUND', roundId: 'r2' })
  assert.deepEqual(board.boardDrop({ status: 'IN_REVIEW', roundId: 'r1' }, 'accepted', false), { kind: 'stage', outcome: 'ACCEPT' })
  assert.deepEqual(board.boardDrop({ status: 'IN_REVIEW', roundId: 'r1' }, 'round:r1', true), { kind: 'unstage' }, 'dropping back home removes the staged decision')
  assert.equal(board.boardDrop({ status: 'ACCEPTED', roundId: 'r1' }, 'rejected', false).kind, 'none')
})

test('grading: any number of categories on their own scales, averaged out of 10; the stored score stays in half points', () => {
  assert.equal(rubric.rubricOverall([{ score: 7, max: 10 }, { score: 10, max: 10 }, { score: 6, max: 10 }]), 7.7)
  assert.equal(rubric.rubricOverall([{ score: 4, max: 5 }, { score: 70, max: 100 }]), 7.5)
  assert.equal(rubric.rubricOverall([]), null)
  assert.equal(rubric.canonicalEvaluationScore(7.7), 7.5)
  assert.equal(rubric.canonicalEvaluationScore(0.2), 1)
  assert.deepEqual(rubric.normalizeReviewRubric(null), rubric.defaultReviewRubric)
  assert.deepEqual(rubric.normalizeReviewRubric({ categories: [] }).categories, [], 'no categories: decisions only')
  const r = { categories: [{ id: '00000000-0000-4000-8000-00000000d001', label: 'Charisma', max: 10 }] }
  const cat = { ...r.categories[0], score: 7 }
  assert.ok(rubric.validateRubricScores({ categories: [cat], overall: 7, overridden: false }, r))
  assert.throws(() => rubric.validateRubricScores({ categories: [cat], overall: 9, overridden: false }, r), /does not match/)
  assert.ok(rubric.validateRubricScores({ categories: [cat], overall: 9, overridden: true }, r), 'a reviewer may edit the overall')
  assert.throws(() => rubric.validateRubricScores({ categories: [{ ...cat, max: 5 }], overall: 7, overridden: true }, r), /changed/)
  assert.equal(rubric.rubricScoresSchema.safeParse({ categories: [{ ...cat, score: 11 }], overall: 7, overridden: true }).success, false)
})

test('one toolbar: view · status dropdown · search · sort · filters · ⋯ (Export CSV and settings); one Review applicants button', () => {
  const src = read('components/views/leader-dashboard/live-leader-workspace.tsx')
  const order = ['label="Applicant view"', '{statusSelect}', 'containerClassName="oc-toolbar-search"', 'oc-toolbar-sort', '<FilterPopover', 'aria-label="More applicant tools"']
  const at = order.map(token => src.indexOf(token))
  assert.ok(at.every(i => i > 0), JSON.stringify(at))
  assert.deepEqual([...at].sort((a, b) => a - b), at)
  const toolbar = src.slice(src.indexOf('oc-applicants-toolbar"'), src.indexOf('aria-label="More applicant tools"') + 1200)
  assert.match(toolbar, /Export CSV/); assert.match(toolbar, /Recruiting settings/); assert.match(toolbar, /Grading categories/)
  assert.match(src, /<PillSelect label="Decision" prefix="Status" size="compact" className="oc-status-select"/, 'status is one "Status: All ▾" dropdown with counts')
  assert.match(src, /label: `\$\{group\.label\} \(\$\{/)
  assert.match(src, /url\.searchParams\.set\("decision", value\)/, 'the status dropdown keeps ?decision=')
  assert.equal((src.match(/: "Review applicants"}/g) || []).length, 1)
  assert.doesNotMatch(src, /Start quick review|Quick decisions|quickQueue|<Sheet|Accept & next/)
  assert.ok(!fs.existsSync('lib/quick-review-queue.ts'))
  const css = read('components/applicant-review/applicant-review.css')
  assert.match(css, /container-type: inline-size/); assert.match(css, /\.oc-status-select \{ flex: none; \}/)
})

test('the review flow is the one decision UI: shared by Applicants, the board, Ranked, the dashboard and Decide', () => {
  const flow = read('components/applicant-review/applicant-review-flow.tsx')
  for (const key of ['a: "ADVANCE"', 'h: "HOLD"', 'r: "REJECT"', '"ArrowLeft"', '"ArrowRight"']) assert.ok(flow.includes(key), key)
  assert.match(flow, /of \$\{ids\.length\}/)
  assert.match(flow, /staged\.stage\(/); assert.doesNotMatch(flow, /setApplicationStatus|publishRecruitmentDecision/, 'the flow never publishes a decision')
  const hook = read('hooks/use-staged-decisions.ts')
  assert.match(hook, /const UNDO_MS = 5000/); assert.match(hook, /label: "Undo"/); assert.match(hook, /put\(app\.id, previous\)/, 'failed saves roll back')
  assert.match(read('components/views/leader-dashboard/live-leader-workspace.tsx'), /<ApplicantReviewFlow/)
  const decide = read('components/live-voting/decide-page.tsx')
  assert.match(decide, /<DecideReview key=\{roundId\} scoped decisionsOnly initialDecision="pending" \/>/)
  assert.match(decide, /<StagedDecisionsPanel/)
  const boardSrc = read('components/applicant-review/applicant-board.tsx')
  assert.match(boardSrc, /KeyboardSensor/); assert.match(boardSrc, /staged\.stage\(/); assert.doesNotMatch(boardSrc, /setApplicationStatus/)
})

test('server: staging needs decision access, refuses self and recused reviewers, and checks the expected state; sending uses the canonical publisher', () => {
  const src = read('actions/review-decisions.ts')
  assert.match(src, /const decideCaps = \["decisions\.manage", "applicants\.identify"\] as const/)
  const stage = src.slice(src.indexOf('export async function stageDecision'), src.indexOf('export async function clearStagedDecision'))
  for (const check of ['requireClubPermission(data.clubId, [...decideCaps])', 'authorizeClubTransaction(tx, data.clubId, user.id, decideCaps', 'app.studentId === user.id', 'app.status !== data.expectedStatus || app.roundId !== data.expectedRoundId', 'assertNotRecused(tx, app.id, member.id)', 'resolveStagedTarget(']) assert.ok(stage.includes(check), check)
  const send = src.slice(src.indexOf('async function sendStagedDecisionsCommand'), src.indexOf('export async function sendStagedDecisions'))
  assert.match(src, /export async function sendStagedDecisions\([^)]*\) \{\n  return actionResult\(\(\) => sendStagedDecisionsCommand\(input\), "sendStagedDecisions"\)/, 'Send refusals reach the user (#292)')
  for (const check of ['supportContext()', 'stagedIsStale(item, app)', 'publishRecruitmentDecision(tx,', 'hasPermission(member, "recruitment.manage")', 'tx.stagedDecision.delete(']) assert.ok(send.includes(check), check)
  assert.match(read('actions/evaluations.ts'), /boundedParse\(evaluateSchema, data\)/)
  assert.match(read('actions/evaluations.ts'), /validateRubricScores\(value, normalizeReviewRubric\(club\.reviewRubric\)\)/)
  const sql = read('prisma/migrations/20261111150000_review_rubric_staged_decisions/migration.sql')
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/); assert.match(sql, /REVOKE ALL ON "StagedDecision" FROM %I',r\)/)

})
// QA saw a column headed only "Test". It is the narrow-width combination of SAT and ACT (hidden from 880px,
// where SAT and ACT get their own columns), so it is labelled as test scores and never shown beside them.
test('applicant list labels the combined SAT/ACT column "Test scores" and swaps it with SAT and ACT at the same width', () => {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('components/views/leader-dashboard/live-applicant-views.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const mocks = { '@/components/ui/data-table': { DataTable: 'DataTable', DataTableSecondary: 'DataTableSecondary' }, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' } }
  const stub = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : typeof key === 'string' && /^[a-z]/.test(key) ? () => ({}) : String(key) })
  new Function('require', 'module', 'exports', code)(name => mocks[name] || (name.startsWith('@/') || name.startsWith('./') ? stub : require(name)), mod, mod.exports)
  const { LiveApplicantList } = mod.exports
  const columns = LiveApplicantList({ applicants: [], rounds: [], open() {}, name: () => 'Applicant', profileFields: new Proxy({}, { get: () => true }) }).props.columns
  const scores = columns.find(c => c.id === 'test'), sat = columns.find(c => c.id === 'sat'), act = columns.find(c => c.id === 'act')
  assert.equal(scores.header, 'Test scores')
  assert.equal(scores.hideFrom, 'lg'); assert.equal(sat.showFrom, 'lg'); assert.equal(act.showFrom, 'lg')
  assert.equal(columns.filter(c => c.header === 'Test').length, 0)
})
