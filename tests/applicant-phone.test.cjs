const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const read = file => fs.readFileSync(file, 'utf8')
const phone = load('lib/phone.ts')

test('phone numbers normalize to E.164; a number without a country code is US/Canada', () => {
  for (const value of ['4345550123', '(434) 555-0123', '434-555-0123', '434.555.0123', '1 434 555 0123', '+1 (434) 555-0123', ' +14345550123 '])
    assert.equal(phone.normalizePhone(value), '+14345550123', value)
  assert.equal(phone.normalizePhone('+44 20 7946 0958'), '+442079460958')
  assert.equal(phone.normalizePhone('+86 138 0013 8000'), '+8613800138000')
})

test('invalid phone numbers are refused', () => {
  for (const value of ['', '   ', '555-0123', '434555012', '43455501234', '034-555-0123', '434-155-0123', '+1 034 555 0123', '+0 123 456 789', '+123', '+1234567890123456', '434555O123', 'call me', '434-555-0123 ext 4', '4345550123;tel:+1', '++14345550123', '1+4345550123', '4'.repeat(60)])
    assert.throws(() => phone.normalizePhone(value), /10-digit US number/, JSON.stringify(value))
  assert.equal(phone.phoneSchema.safeParse('nope').success, false)
  assert.equal(phone.phoneSchema.parse('(434) 555-0123'), '+14345550123')
})

test('only normalized stored values are shown or dialled', () => {
  assert.equal(phone.formatPhone('+14345550123'), '(434) 555-0123')
  assert.equal(phone.formatPhone('+442079460958'), '+442079460958')
  assert.equal(phone.phoneHref('+14345550123'), 'tel:+14345550123')
  for (const value of [null, undefined, '', '4345550123', 'javascript:alert(1)', '+1434555012x']) {
    assert.equal(phone.validPhone(value), false); assert.equal(phone.formatPhone(value), ''); assert.equal(phone.phoneHref(value), undefined)
  }
})

test('the profile has a contact section; earlier sections keep their positions for résumé import', () => {
  const profile = load('lib/student-profile.ts', { '@/lib/scholar-status': { scholarStatusSchema: require('zod').z.any() }, '@/lib/test-scores': { actShape: {} } })
  const sections = profile.profileSectionSchema.options.map(option => option.shape.section.value)
  assert.deepEqual(sections, ['identity', 'education', 'experience', 'links', 'contact'])
  assert.deepEqual(profile.profileSectionSchema.parse({ section: 'contact', phone: '434 555 0123' }), { section: 'contact', phone: '+14345550123' })
  assert.equal(profile.profileSectionSchema.safeParse({ section: 'contact', phone: '' }).success, false)
  assert.equal(profile.profileSectionSchema.safeParse({ section: 'contact' }).success, false)
  assert.equal(profile.profileSectionSnapshot({ phone: '+14345550123', firstName: 'A' }, 'contact'), JSON.stringify([['phone', '+14345550123']]))
})

test('the recruiter profile allowlist never carries the phone number', () => {
  const { recruitmentProfile } = load('lib/recruitment-profile.ts', { '@/lib/student-profile': { supportedGpa: v => v ?? null } })
  const full = { id: 'p', userId: 'u', firstName: 'A', lastName: 'B', computingId: 'ab1c', major: 'M', gradYear: 2028, transferStudent: false, scholarStatus: null, gpa: 3.5, satScore: null, actScore: null, actEnglish: null, actMath: null, actReading: null, actScience: null, bio: null, linkedinUrl: null, resumeUrl: null, headshotUrl: null, experiences: [], gender: null, pronouns: null, highSchool: null, phone: '+14345550123' }
  const out = recruitmentProfile(full, true)
  assert.equal('phone' in out, false)
  assert.equal(JSON.stringify(out).includes('4345550123'), false)
  assert.match(read('lib/recruitment-profile.ts'), /Omit<FullStudentProfile, [^>]*"phone"/)
  // Anonymous projections are built field by field and name no phone.
  assert.equal(/phone/i.test(read('lib/anonymous-review.ts')), false)
  // Platform support view-as and rosters select explicit columns without it.
  assert.equal(/phone/i.test(read('actions/platform-admin.ts')), false)
  assert.equal(/phone/i.test(read('actions/club-access.ts')), false)
})

test('pipeline detail: the number leaves the server only for an accepted, identified applicant and a decision manager', () => {
  const { pipelineDetailProjection } = load('lib/pipeline-detail.ts', {
    '@/lib/application-review-visibility': { applicationReviewVisibility: raw => ({ caps: { participate: true }, ownSubmitted: false, assigned: true, roundScore: null, evaluations: raw.evaluations }) },
    '@/lib/anonymous-review': { anonymousApplication: app => ({ id: app.id, anonymous: true }), identifiedApplication: app => ({ id: app.id, anonymous: false }) },
    '@/lib/recruitment-profile': { genderVisibility: () => false },
    '@/lib/decision-publication-guard': { decisionPublicationGuard: () => null },
    '@/lib/student-applications': { visibleQuestionIds: () => new Set() },
  })
  const app = (over = {}) => ({ id: 'a', clubId: 'c', studentId: 's', status: 'ACCEPTED', evaluations: [], answers: [], interviewAssignments: [], recruitmentOffer: null, round: { anonymousReview: false, applicantDisplay: null }, student: { studentProfile: { phone: '+14345550123' } }, ...over })
  const member = permissions => ({ id: 'm', userId: 'u', status: 'ACTIVE', permissions })
  const decider = member(['decisions.manage', 'applicants.identify', 'applications.review'])
  assert.equal(pipelineDetailProjection(app(), decider).offerPhone, '+14345550123')
  assert.equal(pipelineDetailProjection(app(), { id: 'o', userId: 'o', isOwner: true }).offerPhone, '+14345550123')
  // Not accepted yet (any other status): withheld.
  for (const status of ['SUBMITTED', 'IN_REVIEW', 'INTERVIEWING', 'WAITLISTED', 'REJECTED'])
    assert.equal(pipelineDetailProjection(app({ status }), decider).offerPhone, null, status)
  // Reviewers, interviewers and members without both capabilities: withheld.
  for (const permissions of [[], ['applications.review'], ['applications.review', 'applicants.identify'], ['decisions.manage'], ['decisions.view', 'applicants.identify'], ['recruitment.manage', 'applicants.identify']])
    assert.equal(pipelineDetailProjection(app(), member(permissions)).offerPhone, null, permissions.join())
  // Suspended or removed membership, anonymous-review round, own application, missing or malformed number: withheld.
  assert.equal(pipelineDetailProjection(app(), { ...decider, status: 'REMOVED' }).offerPhone, null)
  assert.equal(pipelineDetailProjection(app({ round: { anonymousReview: true, applicantDisplay: null } }), decider).offerPhone, null)
  assert.equal(pipelineDetailProjection(app({ studentId: 'u' }), decider).offerPhone, null)
  assert.equal(pipelineDetailProjection(app({ student: { studentProfile: null } }), decider).offerPhone, null)
  assert.equal(pipelineDetailProjection(app({ student: { studentProfile: { phone: '434' } } }), decider).offerPhone, null)
  // A member who stepped out of this applicant loses it with the rest of the detail.
  assert.match(read('actions/crm.ts'), /recused\.has\(raw\.id\) \? \{ \.\.\.projected,[^}]*offerPhone: null/)
})

test('staged decisions: the number accompanies an acceptance only, for decision managers, never an anonymous round', () => {
  const src = read('actions/review-decisions.ts')
  assert.match(src, /phone: row\.targetStatus === "ACCEPTED" && !row\.application\.round\.anonymousReview && validPhone\(applicant\?\.phone\) \? applicant\.phone : null/)
  // Every reader of the view requires both decision capabilities.
  assert.match(src, /const decideCaps = \["decisions\.manage", "applicants\.identify"\] as const/)
  const list = src.slice(src.indexOf('export async function listStagedDecisions'), src.indexOf('const stageInput'))
  assert.match(list, /requireClubPermission\(clubId, \[\.\.\.decideCaps\]/)
  assert.match(list, /authorizeClubTransaction\(tx, clubId, user\.id, decideCaps/)
  const stage = src.slice(src.indexOf('export async function stageDecision'), src.indexOf('const clearInput'))
  assert.match(stage, /requireClubPermission\(data\.clubId, \[\.\.\.decideCaps\]\)/)
  assert.equal((src.match(/view\(row, member\.id/g) || []).length, 2)
})

test('a phone number is required to create a profile and to submit an application', () => {
  const profile = read('actions/profile.ts')
  assert.match(profile, /phone: phoneSchema,\n/)
  assert.equal((profile.match(/phone: parsed\.phone,/g) || []).length, 2)
  const apply = read('actions/applications.ts')
  assert.match(apply, /if \(submit\) \{[\s\S]*?if \(!validPhone\(profile\.phone\)\) throw new ActionError\(PHONE_REQUIRED_MESSAGE\)/)
  // Drafts still save without one: only submission is held.
  assert.equal((apply.match(/validPhone\(/g) || []).length, 1)
  assert.match(read('lib/demo/workspace.ts'), /submit && !validPhone\(demoUser\(\)\.profile\.phone\)/)
  const onboarding = load('lib/onboarding-schemas.ts', { '@/lib/student-profile': { gpaSchema: require('zod').z.number(), linkedinUrlSchema: require('zod').z.string() }, '@/lib/password-policy': { newPasswordSchema: require('zod').z.string() } })
  const base = { gradYear: '2028', major: 'Economics' }
  assert.equal(onboarding.academicProfileSchema.safeParse(base).success, false)
  assert.equal(onboarding.academicProfileSchema.safeParse({ ...base, phone: '' }).success, false)
  assert.equal(onboarding.academicProfileSchema.safeParse({ ...base, phone: '12345' }).success, false)
  assert.equal(onboarding.academicProfileSchema.safeParse({ ...base, phone: '(434) 555-0123' }).success, true)
})

test('migration is additive, nullable and constrains the stored format', () => {
  const sql = read('prisma/migrations/20261112200000_student_profile_phone/migration.sql')
  assert.match(sql, /ALTER TABLE "StudentProfile" ADD COLUMN "phone" TEXT,/)
  assert.match(sql, /CHECK \(\s*"phone" IS NULL OR "phone" ~ '\^\\\+\[1-9\]\[0-9\]\{7,14\}\$'/)
  assert.equal(/NOT NULL|DROP |UPDATE |GRANT |POLICY/i.test(sql.replace(/--.*$/gm, '')), false)
  assert.match(read('prisma/schema.prisma'), /\n  phone       String\?\n/)
})

test('demo numbers are fictional (555-01xx) and the privacy policy lists the phone number', () => {
  assert.match(read('lib/demo/seed.ts'), /phone: `\+1434555\$\{String\(100 \+ \(i % 100\)\)\.padStart\(4, "0"\)\}`/)
  assert.match(read('lib/legal-content.ts'), /phone number/)
})
