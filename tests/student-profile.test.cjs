const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name === "@/lib/test-scores" ? load("lib/test-scores.ts") : require(name), mod, mod.exports)
  return mod.exports
}

const helpers = load('lib/student-profile.ts')

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const OTHER_UUID = '00000000-0000-0000-0000-000000000000';

function action() {
  const calls = []
  const actions = load('actions/profile.ts', {
    '@/lib/student-profile': helpers,
    '@/utils/auth': { requireAuth: async () => ({ user: { id: VALID_UUID, email: 'authenticated-student@virginia.edu' } }) },
    '@/utils/prisma': { prisma: { studentProfile: { update: async args => { calls.push(args); return { id: 'profile', ...args.data, experiences: [] } }, upsert: async args => { calls.push(args); return { id: 'profile', ...args.create } } } } },
    'next/cache': { revalidatePath: () => {} },
  })
  return { calls, ...actions }
}

test('education edits preserve unrelated profile fields and allow clearing optional scores', async () => {
  const { calls, updateStudentProfileSection } = action()
  await updateStudentProfileSection({ section: 'education', major: 'Math', gradYear: 2028, gpa: null, satScore: null, userId: 'another-student', resumeUrl: 'https://wrong.example' })
  assert.deepEqual(calls[0].where, { userId: VALID_UUID })
  assert.deepEqual(calls[0].data, { major: 'Math', gradYear: 2028, gpa: null, satScore: null })
})

test('experience changes use one nested update and strip client record IDs', async () => {
  const { calls, updateStudentProfileSection } = action()
  await updateStudentProfileSection({ section: 'experience', experiences: [{ id: 'client-uuid', title: 'A', subtitle: 'B', period: 'C' }] })
  assert.deepEqual(calls[0].data, { experiences: { deleteMany: {}, create: [{ title: 'A', subtitle: 'B', period: 'C' }] } })
})

test('invalid links and scores never reach persistence', async () => {
  const { calls, updateStudentProfileSection } = action()
  for (const payload of [
    { section: 'links', linkedinUrl: 'https://linkedin.com.evil.com/user', resumeUrl: null },
    { section: 'links', linkedinUrl: 'not-a-url', resumeUrl: null },
    { section: 'links', linkedinUrl: null, resumeUrl: 'javascript:alert(1)' },
    { section: 'links', linkedinUrl: null, resumeUrl: 'https://evil.com/resume.pdf' },
    { section: 'links', linkedinUrl: null, resumeUrl: '../secret.pdf' },
    { section: 'links', linkedinUrl: null, resumeUrl: '/foo.pdf' },
    { section: 'links', linkedinUrl: null, resumeUrl: 'random-text' },
    { section: 'links', linkedinUrl: null, resumeUrl: `${OTHER_UUID}/file.pdf` }, // valid path format but not current user's UUID (caught by authorization check, wait no caught by Zod? No, caught by authorization check in the action)
    { section: 'education', major: 'Math', gradYear: 2028, gpa: 5, satScore: null },
    { section: 'identity', firstName: ' ', lastName: 'Student', bio: '' },
  ]) assert.ok((await updateStudentProfileSection(payload)).error)
  assert.equal(calls.length, 0)
})

test('links can be removed without modifying other sections', async () => {
  const { calls, updateStudentProfileSection } = action()
  await updateStudentProfileSection({ section: 'links', linkedinUrl: '', resumeUrl: '' })
  assert.deepEqual(calls[0].data, { linkedinUrl: null, resumeUrl: null })
})

test('completion reflects saved supported data and excludes optional scores', () => {
  const items = helpers.profileChecklist({ firstName: 'Student', lastName: 'Name', major: 'Math', gradYear: 2028, bio: null, experiences: [], resumeUrl: null, linkedinUrl: null })
  assert.equal(items.find(i => i.label === 'Name').complete, true)
  assert.equal(items.find(i => i.label === 'Education').complete, true)
  assert.equal(items.find(i => i.label === 'Introduction').complete, false)
  assert.equal(items.find(i => i.label === 'Experience').complete, false)
  assert.equal(items.find(i => i.label === 'Résumé').complete, false)
})

test('resume path validation rules', async () => {
  const validPath = `${VALID_UUID}/123456-resume.pdf`
  assert.equal(helpers.storagePathSchema.safeParse(validPath).success, true)

  const invalidPaths = [
    'javascript:alert(1)',
    'https://evil.com/resume.pdf',
    '../secret.pdf',
    '/foo.pdf',
    'random-text'
  ]
  for (const p of invalidPaths) {
    assert.equal(helpers.storagePathSchema.safeParse(p).success, false, `Failed to reject ${p}`)
  }
})

test('resume ownership authorization during save', async () => {
  const { updateStudentProfileSection, upsertStudentProfile } = action()
  
  const myPath = `${VALID_UUID}/123456-resume.pdf`
  const anotherPath = `${OTHER_UUID}/123456-resume.pdf`

  // Own path succeeds
  const res1 = await updateStudentProfileSection({ section: 'links', linkedinUrl: null, resumeUrl: myPath })
  assert.ok(!res1.error)

  // Other path fails
  const res2 = await updateStudentProfileSection({ section: 'links', linkedinUrl: null, resumeUrl: anotherPath })
  assert.ok(res2.error)

  // Upsert tests
  const profileData = { firstName: 'F', lastName: 'L', computingId: 'a', major: 'Math', gradYear: 2028 };
  
  await assert.rejects(upsertStudentProfile({ ...profileData, resumeUrl: anotherPath }))
  const res3 = await upsertStudentProfile({ ...profileData, resumeUrl: myPath })
  assert.ok(res3.success)
})
