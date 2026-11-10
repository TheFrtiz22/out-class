// Server-side removal of hidden profile fields, and leader profile rendering of only enabled fields.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadComponent } = require('./helpers/component-module.cjs')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const lib = load('lib/profile-field-visibility.ts')
const all = on => Object.fromEntries(lib.profileFieldKeys.map(k => [k, on]))
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const { ApplicantProfileFacts, applicantProfileFacts } = loadComponent('components/views/leader-dashboard/applicant-profile-facts.tsx')
const profile = { academicYear: 'Third Year', gpa: 3.91, satScore: 1510, actScore: 34, linkedinUrl: 'https://www.linkedin.com/in/ada', experiences: [{ id: 'e1', title: 'Analyst', subtitle: 'Fund', period: '2025' }] }
const render = (fields, extra = {}) => renderToStaticMarkup(React.createElement(ApplicantProfileFacts, { profile, fields, resume: React.createElement('button', { type: 'button' }, 'Résumé'), ...extra }))

test('GPA and LinkedIn are hidden by default on the leader profile', () => {
  const html = render(lib.defaultProfileFieldVisibility())
  assert.doesNotMatch(html, /GPA|3\.91|linkedin/i)
  assert.match(html, /Third Year · ACT 34 · SAT 1510/)
  assert.match(html, /Analyst/)
  assert.match(html, /Résumé/)
})

test('the profile renders only enabled fields and leaves no empty labels or rows', () => {
  const none = render(all(false))
  assert.equal(none, '', 'every field hidden: nothing at all is rendered')
  const onlyGpa = render({ ...all(false), gpa: true })
  assert.equal(onlyGpa, '<p class="text-xs text-muted-foreground" data-profile-facts="">GPA 3.91</p>')
  const onlyLinkedin = render({ ...all(false), linkedin: true })
  assert.match(onlyLinkedin, /^<div class="flex flex-wrap items-center gap-4 text-sm"><a href="https:\/\/www\.linkedin\.com\/in\/ada"/)
  assert.doesNotMatch(onlyLinkedin, /Résumé|data-profile-facts/)
  const everything = render(all(true))
  assert.match(everything, /Third Year · GPA 3\.91 · ACT 34 · SAT 1510/)
  assert.match(everything, /LinkedIn/)
  // An enabled field without a value is skipped rather than shown as an empty label.
  assert.deepEqual(applicantProfileFacts({ academicYear: '', gpa: null, satScore: 1400, actScore: null }, all(true)), ['SAT 1400'])
  assert.equal(renderToStaticMarkup(React.createElement(ApplicantProfileFacts, { profile: { experiences: [] }, fields: all(true) })), '')
})

const pageRead = load('lib/pipeline-page-read.ts')
const leader = { id: id(1), userId: id(2), status: 'ACTIVE', isOwner: true, permissions: [] }
const roundId = id(3), appId = id(4)
const row = () => ({ id: appId, roundId, status: 'IN_REVIEW', studentId: id(5), student: { email: 'ada@virginia.edu', studentProfile: { firstName: 'Ada', lastName: 'Lovelace', major: 'Math', gradYear: 2028, transferStudent: false, gpa: 3.9, satScore: 1500, actScore: 34 } } })
const tx = { application: { findMany: async () => [row()] } }
const rounds = [{ id: roundId, name: 'Review', order: 0, type: 'CUSTOM', anonymousReview: false, genderVisible: false }]
const privacy = new Map([[roundId, false]])

test('pipeline summaries omit hidden fields on the server, so filters cannot infer them', async () => {
  const [hidden] = await pageRead.readPipelineMetadata(tx, {}, leader, {}, privacy, lib.defaultProfileFieldVisibility())
  assert.equal(hidden.student.studentProfile.gpa, null)
  assert.equal(hidden.student.studentProfile.satScore, 1500)
  const [shown] = await pageRead.readPipelineMetadata(tx, {}, leader, {}, privacy, all(true))
  assert.equal(shown.student.studentProfile.gpa, 3.9)
  const page = async (fields, query) => pageRead.readPipelinePage(tx, {}, leader, rounds, query, 'scope', async ids => ids.map(id => ({ id })), privacy, fields)
  assert.equal((await page(lib.defaultProfileFieldVisibility(), { gpa: 5 })).page.total, 1, 'a filter on a hidden GPA is ignored, so it cannot reveal who passes')
  assert.equal((await page(all(true), { gpa: 3 })).page.total, 1)
  assert.equal((await page({ ...all(true), major: false }, { major: 'Physics' })).page.total, 1)
  assert.deepEqual((await page({ ...all(true), major: false }, {})).facets.majors.filter(Boolean), [])
})

test('the CRM read applies the club setting to every pipeline payload, read in the same snapshot', () => {
  const crm = fs.readFileSync('actions/crm.ts', 'utf8')
  assert.match(crm, /archivedAt: true, club: \{ select: \{ profileFieldVisibility: true \} \}/)
  assert.match(crm, /const profileFields = normalizeProfileFieldVisibility\(allRounds\[0\]\?\.club\?\.profileFieldVisibility\)/)
  assert.match(crm, /restrictApplicationProfile\(pipelineDetailProjection\(raw, membership, prior\.get\(raw\.id\) \?\? \[\]\), profileFields\)/)
  assert.match(crm, /restrictApplicationProfile\(pipelineSummaryProjection\(app, membership\), profileFields\)/)
  assert.match(crm, /restrictApplicationProfile\(rankedReviewProjection\(app, membership\), profileFields\)/)
  assert.match(crm, /readPipelineSelection\(tx, where, membership, query, rounds, roundPrivacy, profileFields\)/)
  assert.match(crm, /profileFields: pipeline\.profileFields/)
})

test('applicant display and voting slides treat the club setting as a ceiling', () => {
  const { projectApplicantDisplay, defaultDisplayConfig } = load('lib/applicant-display.ts')
  const app = { id: appId, clubId: id(6), roundId, status: 'IN_REVIEW', studentId: id(5), student: { id: id(5), email: 'ada@virginia.edu', studentProfile: { firstName: 'Ada', lastName: 'Lovelace', major: 'Math', gradYear: 2028, gpa: 3.9, satScore: 1500, actScore: 34, headshotUrl: null, resumeUrl: 'https://example.com/r.pdf', linkedinUrl: 'https://www.linkedin.com/in/ada', experiences: [] } }, answers: [], evaluations: [] }
  const round = { id: roundId, name: 'Review', anonymousReview: false, applicantDisplay: {} }
  const capped = projectApplicantDisplay(app, round, defaultDisplayConfig, [], undefined, lib.defaultProfileFieldVisibility())
  for (const key of ['configured', 'visible', 'withheld']) for (const f of ['gpa', 'linkedin']) assert.ok(!capped[key].includes(f), `${key} ${f}`)
  assert.equal(capped.sections.some(s => s.field === 'gpa'), false)
  assert.deepEqual(capped.links.map(l => l.field), ['resume'])
  assert.doesNotMatch(JSON.stringify(capped), /3\.9|linkedin\.com/)
  const open = projectApplicantDisplay(app, round, defaultDisplayConfig, [], undefined, all(true))
  assert.ok(open.visible.includes('gpa')); assert.deepEqual(open.links.map(l => l.field), ['resume', 'linkedin'])
  const slide = projectApplicantDisplay(app, round, { version: 1, fields: ['name', 'gpa', 'major'] }, [], undefined, { ...all(true), gpa: false, major: false })
  assert.deepEqual(slide.visible, ['name'], 'a slide field the club hides cannot be selected')
  assert.match(fs.readFileSync('actions/applicant-intelligence.ts', 'utf8'), /feedback, normalizeProfileFieldVisibility\(app\.club\?\.profileFieldVisibility\)\)/)
})

test('the leader dossier, list, filters and sorts follow the club setting', () => {
  const src = fs.readFileSync('components/views/leader-dashboard/live-leader-workspace.tsx', 'utf8')
  assert.match(src, /const profileFields = data\?\.profileFields \?\? defaultProfileFieldVisibility\(\)/)
  assert.match(src, /<ApplicantProfileFacts profile=\{active\.student\.studentProfile\} fields=\{profileFields\}/)
  assert.match(src, /\{profileFields\.resume && <aside className="oc-applicant-resume"/)
  assert.match(src, /\{profileFields\.photo && <Avatar/)
  assert.match(src, /\{profileFields\.gpa && <div>\s*<Label htmlFor="leader-gpa">/)
  assert.match(src, /sortOptions\.filter\(option => sortableByProfile\(option\.key, profileFields\)\)/)
  assert.doesNotMatch(src, /` · GPA \$\{active/)
  const list = fs.readFileSync('components/views/leader-dashboard/live-applicant-views.tsx', 'utf8')
  assert.match(list, /\{profileFields\.gpa && <TableCell>/)
  assert.match(list, /shown\.map\(column => <TableHead/)
})

test('Demo Mode applies the same ceiling from the demo store', () => {
  const demo = fs.readFileSync('lib/demo/workspace.ts', 'utf8')
  assert.match(demo, /const profileFields = demoProfileFieldVisibility\(clubId\)/)
  assert.match(demo, /restrictApplicationProfile\(s\.clubs/)
  assert.match(demo, /feedback, demoProfileFieldVisibility\(input\.clubId\)\)/)
  assert.match(fs.readFileSync('lib/demo/voting-room.ts', 'utf8'), /normalizeProfileFieldVisibility\(c\.state\.profileFieldVisibility\?\.\[c\.club\.id\]\)/)
})
