// "Didn't advance" letters: a rejection before the club's last active round uses its own wording.
// The application status and the letter's stored decision stay REJECTED; only the copy differs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const letters = load('lib/decision-letters.ts')
const values = { firstName: 'Alex', fullName: 'Alex Student', clubName: 'Example Club', roundName: 'First Interviews', date: new Date('2026-10-10'), expiresAt: null, logoReference: null, accent: '#142d4e' }

test('letter kind: only a rejection with a later round is "didn\'t advance"', () => {
  assert.equal(letters.letterKindFor('REJECTED', true), 'NOT_ADVANCED')
  assert.equal(letters.letterKindFor('REJECTED', false), 'REJECTED')
  for (const decision of ['ACCEPTED', 'WAITLISTED']) for (const later of [true, false]) assert.equal(letters.letterKindFor(decision, later), decision)
  assert.deepEqual([...letters.decisionTypes], ['ACCEPTED', 'WAITLISTED', 'REJECTED'], 'statuses that publish letters are unchanged')
  assert.deepEqual([...letters.letterKinds], ['ACCEPTED', 'WAITLISTED', 'REJECTED', 'NOT_ADVANCED'])
})

test('default "didn\'t advance" copy names the round and differs from the final rejection', () => {
  const letter = letters.resolveLetter('NOT_ADVANCED', {}, values)
  assert.match(letter.body, /from First Interviews to the next round/)
  assert.ok(!letter.body.includes('{{'))
  assert.equal('celebration' in letter, false)
  assert.notEqual(letter.body, letters.resolveLetter('REJECTED', {}, values).body)
  assert.match(letters.resolveLetter('NOT_ADVANCED', {}, { ...values, roundName: '  ' }).body, /from this round/, 'blank round name falls back')
  // Custom wording, and {{round.name}} in any template.
  const custom = { ...letters.defaultLetters.NOT_ADVANCED, body: '{{student.firstName}}: not past {{round.name}}.' }
  assert.equal(letters.letterTemplatesSchema.safeParse({ NOT_ADVANCED: custom }).success, true)
  assert.equal(letters.resolveLetter('NOT_ADVANCED', { NOT_ADVANCED: custom }, values).body, 'Alex: not past First Interviews.')
  assert.equal(letters.letterTemplatesSchema.safeParse({ NOT_ADVANCED: { ...custom, body: '{{round.secret}}' } }).success, false)
  assert.equal(letters.letterTemplatesSchema.safeParse({ NOT_ADVANCED: { ...custom, celebration: 'lasers' } }).success, false)
  // Saved templates and frozen schedules without the new key still parse.
  assert.equal(letters.letterTemplatesSchema.safeParse({ REJECTED: letters.defaultLetters.REJECTED }).success, true)
})

function harness({ status = 'REJECTED', order = 0, later = 1, enabled = true, roundClub = 'club' } = {}) {
  const state = { letters: [], counts: [] }
  state.tx = {
    application: { findUniqueOrThrow: async q => { assert.deepEqual(q.select.round, { select: { name: true, order: true, clubId: true } }); return { id: 'app', status, decisionVersion: 2, studentId: 'student', clubId: 'club', round: { name: 'Round 1', order, clubId: roundClub }, student: { studentProfile: { firstName: 'Alex', lastName: 'Student' } }, club: { name: 'Example Club', color: '#142d4e', logoUrl: null, decisionLetterTemplates: null, sendFormalDecisionLetters: enabled }, recruitmentOffer: null } } },
    pipelineRound: { count: async q => { state.counts.push(q.where); return later } },
    decisionLetter: { create: async q => { state.letters.push(q.data); return { id: 'letter' } } },
    userNotification: { create: async () => ({}) },
    auditLog: { create: async () => ({}) },
  }
  return state
}
const { publishDecisionCommunication } = load('utils/decision-communications.ts')

test('publishing: rejection before the last round sends "didn\'t advance"; the stored decision stays REJECTED', async () => {
  const early = harness({ order: 0, later: 2 })
  await publishDecisionCommunication(early.tx, 'app', 'actor')
  assert.deepEqual(early.counts, [{ clubId: 'club', archivedAt: null, order: { gt: 0 } }], 'only active later rounds of this club count')
  assert.equal(early.letters[0].decision, 'REJECTED')
  assert.match(early.letters[0].content.body, /from Round 1 to the next round/)

  const final = harness({ order: 3, later: 0 })
  await publishDecisionCommunication(final.tx, 'app', 'actor')
  assert.match(final.letters[0].content.body, /unable to offer you membership/)

  for (const status of ['ACCEPTED', 'WAITLISTED']) {
    const other = harness({ status, later: 2 })
    await publishDecisionCommunication(other.tx, 'app', 'actor')
    assert.equal(other.counts.length, 0, `${status} does not look up rounds`)
    assert.equal(other.letters[0].decision, status)
  }
  const off = harness({ enabled: false })
  await publishDecisionCommunication(off.tx, 'app', 'actor')
  assert.equal(off.letters.length, 0)
  assert.equal(off.counts.length, 0, 'no round lookup when formal letters are off')
})

test('a frozen schedule snapshot uses its own "didn\'t advance" wording', async () => {
  const s = harness({ later: 1 })
  const templates = { ...letters.defaultLetters, NOT_ADVANCED: { ...letters.defaultLetters.NOT_ADVANCED, body: 'Frozen wording for {{round.name}}.' } }
  await publishDecisionCommunication(s.tx, 'app', 'actor', { enabled: true, templates, name: 'Example Club', color: '#142d4e', logoUrl: null })
  assert.equal(s.letters[0].content.body, 'Frozen wording for Round 1.')
})

test('the letter editor offers the new outcome and the overview counts every letter kind', () => {
  const editor = fs.readFileSync('components/communications/template-editor.tsx', 'utf8')
  assert.match(editor, /NOT_ADVANCED:"Didn't advance"/)
  assert.match(editor, /\['ACCEPTED','REJECTED','NOT_ADVANCED','WAITLISTED'\]/)
  assert.match(fs.readFileSync('components/live-voting/decide-overview.tsx', 'utf8'), /letterKinds\.filter\(type => templates\.value!\.templates\[type\]\)/)
  assert.match(fs.readFileSync('lib/demo/communications.ts', 'utf8'), /letterKindFor\(app\.status as LetterDecision,laterRound\)/)
})

test('a club\'s custom rejection letter stands in until it edits "didn\'t advance"', async () => {
  const customRejected = { ...letters.defaultLetters.REJECTED, body: 'Our own rejection wording.' }
  const customNotAdvanced = { ...letters.defaultLetters.NOT_ADVANCED, body: 'Our own wording for {{round.name}}.' }
  // Custom rejection, no "didn't advance": the club's rejection wording.
  assert.equal(letters.resolveLetter('NOT_ADVANCED', { REJECTED: customRejected }, values).body, 'Our own rejection wording.')
  assert.equal(letters.notAdvancedUsesRejection({ REJECTED: customRejected }), true)
  // Neither customized (also a frozen snapshot that merged in the defaults): the default "didn't advance" wording.
  for (const templates of [{}, { ...letters.defaultLetters }]) {
    assert.match(letters.resolveLetter('NOT_ADVANCED', templates, values).body, /from First Interviews to the next round/)
    assert.equal(letters.notAdvancedUsesRejection(templates), false)
  }
  // A frozen snapshot with a custom rejection and the default "didn't advance" still falls back.
  assert.equal(letters.resolveLetter('NOT_ADVANCED', { ...letters.defaultLetters, REJECTED: customRejected }, values).body, 'Our own rejection wording.')
  // Both customized: each keeps its own wording.
  const both = { REJECTED: customRejected, NOT_ADVANCED: customNotAdvanced }
  assert.equal(letters.resolveLetter('NOT_ADVANCED', both, values).body, 'Our own wording for First Interviews.')
  assert.equal(letters.resolveLetter('REJECTED', both, values).body, 'Our own rejection wording.')
  assert.equal(letters.notAdvancedUsesRejection(both), false)

  // Publishing with the club's stored templates.
  const s = harness({ later: 1 })
  const find = s.tx.application.findUniqueOrThrow
  s.tx.application.findUniqueOrThrow = async q => { const app = await find(q); return { ...app, club: { ...app.club, decisionLetterTemplates: { REJECTED: customRejected } } } }
  await publishDecisionCommunication(s.tx, 'app', 'actor')
  assert.equal(s.letters[0].content.body, 'Our own rejection wording.')
  assert.equal(s.letters[0].decision, 'REJECTED')

  const editor = fs.readFileSync('components/communications/template-editor.tsx', 'utf8')
  assert.match(editor, /notAdvancedUsesRejection\(templates\)\?"Until you edit this, applicants who don't advance get your rejection letter\."/)
})

test('a round from another club gives no round name and is treated as a final rejection', async () => {
  const s = harness({ later: 3, roundClub: 'other-club' })
  await publishDecisionCommunication(s.tx, 'app', 'actor')
  assert.equal(s.counts.length, 0, 'no later-round lookup for a mismatched round')
  assert.match(s.letters[0].content.body, /unable to offer you membership/)
  assert.equal(s.letters[0].decision, 'REJECTED')
  // A template using {{round.name}} falls back instead of naming the other club's round.
  const t = harness({ status: 'ACCEPTED', roundClub: 'other-club' })
  const find = t.tx.application.findUniqueOrThrow
  t.tx.application.findUniqueOrThrow = async q => { const app = await find(q); return { ...app, club: { ...app.club, decisionLetterTemplates: { ACCEPTED: { ...letters.defaultLetters.ACCEPTED, body: 'Welcome after {{round.name}}.' } } } } }
  await publishDecisionCommunication(t.tx, 'app', 'actor')
  assert.equal(t.letters[0].content.body, 'Welcome after this round.')
})
