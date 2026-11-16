// Résumé summary action (actions/resume-summary.ts): authorized exactly like the PDF routes, cached per
// file and parser version, and never revealing content in errors. Synthetic data only.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs')
const { harness, id } = require('./helpers/interview-harness.cjs')
const TEXT = ['Avery Sample', 'avery@example.edu', 'EDUCATION', 'University of Virginia | B.A. Economics | May 2027', 'EXPERIENCE', 'Example Co | Analyst | Jun 2025 – Aug 2025', '• Grew sign-ups 30%'].join('\n')
const HASH = 'a'.repeat(64)

function setup(extract = async () => TEXT) {
  let calls = 0
  const h = harness({ '@/lib/resume-pdf': { extractPdfText: async bytes => { calls++; return extract(bytes) }, pdfExtractionIdle: () => true } })
  process.env.SUPABASE_SECRET_KEY = 'synthetic-only'; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.invalid'
  h.state.documents.push({ id: id(300), applicationId: h.scope.applicationId, roundId: h.scope.roundId, content: new Uint8Array(Buffer.from('%PDF-1.7 fixture')), contentHash: HASH, createdAt: new Date() })
  const action = h.load('actions/resume-summary.ts')
  return { h, action, get calls() { return calls }, interview: (scope = h.scope) => action.getResumeSummary({ kind: 'interview', ...scope, documentId: id(300) }), recruiting: (clubId = h.scope.clubId) => action.getResumeSummary({ kind: 'recruiting', clubId, applicationId: h.scope.applicationId }) }
}

test('permitted interviewer and reviewer get the summary; the cache row belongs to the résumé owner', async () => {
  const t = setup()
  const result = await t.interview()
  assert.equal(result.status, 'ready')
  assert.deepEqual(result.summary.sections.map(s => s.kind), ['Education', 'Experience'])
  assert.doesNotMatch(JSON.stringify(result), /Avery|example\.edu/, 'contact header stripped')
  assert.equal(t.h.state.summaries.length, 1)
  assert.deepEqual([t.h.state.summaries[0].userId, t.h.state.summaries[0].contentHash], [id(99), HASH])
  const reviewed = await t.recruiting()
  assert.equal(reviewed.status, 'ready')
  assert.equal(t.h.state.summaries.at(-1).userId, id(99))
})

test('cache hit skips extraction; a row from another parser version is ignored and replaced', async () => {
  const t = setup()
  await t.interview(); await t.interview()
  assert.equal(t.calls, 1, 'second view read the cache')
  const { RESUME_SUMMARY_PARSER_VERSION } = t.h.load('lib/resume-summary.ts')
  const u = setup()
  u.h.state.summaries.push({ userId: id(99), contentHash: HASH, parserVersion: RESUME_SUMMARY_PARSER_VERSION - 1, summary: { sections: [], confidence: 0, parserVersion: RESUME_SUMMARY_PARSER_VERSION - 1 }, confidence: 0 })
  assert.equal((await u.interview()).status, 'ready')
  assert.equal(u.calls, 1, 'older parser output is not reused')
  assert.deepEqual(u.h.state.summaries.map(r => r.parserVersion), [RESUME_SUMMARY_PARSER_VERSION], 'older version removed')
  const corrupt = setup()
  corrupt.h.state.summaries.push({ userId: id(99), contentHash: HASH, parserVersion: RESUME_SUMMARY_PARSER_VERSION, summary: { bad: true }, confidence: 1 })
  assert.equal((await corrupt.interview()).status, 'ready'); assert.equal(corrupt.calls, 1, 'an invalid cached row is rebuilt')
})

test('anonymous review, other clubs, outsiders and missing access are denied before any extraction', async () => {
  const cases = [
    ['anonymous round', t => { t.h.round.anonymousReview = true }],
    ['outsider', t => { t.h.as(98) }],
    ['the applicant themself', t => { t.h.as(99) }],
    ['membership missing', t => { t.h.deny(true) }],
  ]
  for (const [label, mutate] of cases) {
    const t = setup(); mutate(t)
    await assert.rejects(t.interview(), /Résumé summary unavailable\./, `${label}: interview`)
    await assert.rejects(t.recruiting(), /Résumé summary unavailable\./, `${label}: review`)
    assert.equal(t.calls, 0, label); assert.equal(t.h.state.summaries.length, 0, label)
  }
  const t = setup()
  await assert.rejects(t.interview({ ...t.h.scope, clubId: id(9) }), /unavailable/)
  await assert.rejects(t.recruiting(id(9)), /unavailable/)
  const reviewerWithoutIdentity = setup(); reviewerWithoutIdentity.h.members[0].isOwner = false; reviewerWithoutIdentity.h.members[0].permissions = ['applications.review']
  await assert.rejects(reviewerWithoutIdentity.recruiting(), /unavailable/, 'review without applicants.identify')
  await assert.rejects(t.action.getResumeSummary({ kind: 'recruiting', clubId: t.h.scope.clubId, applicationId: t.h.scope.applicationId, path: 'x/y.pdf' }), 'no caller-chosen path')
  assert.equal(t.calls, 0)
})

test('busy extraction is not cached; unreadable files are; errors never carry résumé text', async () => {
  const busy = setup(async () => { throw Error('PDF processing is busy. Please try again shortly.') })
  await assert.rejects(busy.interview(), e => /busy/.test(e.message) && !/Avery|Economics/.test(e.message))
  assert.equal(busy.h.state.summaries.length, 0)
  const scanned = setup(async () => '')
  assert.deepEqual(await scanned.interview(), { status: 'unreadable' })
  assert.equal(scanned.h.state.summaries.length, 1, 'scanned result cached')
  const broken = setup(async () => { throw Error('Avery Sample secret text') })
  assert.deepEqual(await broken.interview(), { status: 'unreadable' }, 'a malformed file reads as unreadable, without its error text')
  for (const file of ['actions/resume-summary.ts', 'utils/resume-summary.ts', 'lib/resume-summary.ts', 'components/resume-summary-panel.tsx'])
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /Sentry|captureException|console\./, `${file} reports nothing`)
})

test('the summary reuses the PDF routes’ authorization and the shared reviewer read', () => {
  const src = fs.readFileSync('actions/resume-summary.ts', 'utf8')
  assert.match(src, /authorizeInterview\(tx, scope, user\.id, "resume", "share"\)/)
  assert.match(src, /readRecruitingResume\(data\.clubId, data\.applicationId, user\.id\)/)
  assert.match(fs.readFileSync('app/api/recruiting-resumes/route.ts', 'utf8'), /readRecruitingResume\(/)
  assert.match(fs.readFileSync('utils/recruiting-resume.ts', 'utf8'), /authorizeRecruitingResume\(tx, clubId, applicationId, userId\)[\s\S]*if \(await authorize\(\) !== path\)/)
  assert.match(fs.readFileSync('actions/interview-resumes.ts', 'utf8'), /if \(pinnedFor\) warmResumeSummary\(pinnedFor, bytes, hash\)/, 'pinning warms the cache')
  assert.match(fs.readFileSync('lib/workspace-api.ts', 'utf8'), /getResumeSummary = adapt\(resumeSummaries\.getResumeSummary, "getResumeSummary"\)/)
})
