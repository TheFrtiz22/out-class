const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), mod, mod.exports)
  return mod.exports
}
const helpers = load('lib/student-profile.ts')
function action() {
  const calls = []
  const actions = load('actions/profile.ts', {
    '@/lib/student-profile': helpers,
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'authenticated-student' } }) },
    '@/utils/prisma': { prisma: { studentProfile: { update: async args => { calls.push(args); return { id: 'profile', ...args.data, experiences: [] } } } } },
    'next/cache': { revalidatePath: () => {} },
  })
  return { calls, ...actions }
}
test('education edits preserve unrelated profile fields and allow clearing optional scores', async () => {
  const { calls, updateStudentProfileSection } = action()
  await updateStudentProfileSection({ section: 'education', major: 'Math', gradYear: 2028, gpa: null, satScore: null, userId: 'another-student', resumeUrl: 'https://wrong.example' })
  assert.deepEqual(calls[0].where, { userId: 'authenticated-student' })
  assert.deepEqual(calls[0].data, { major: 'Math', gradYear: 2028, gpa: null, satScore: null })
})
test('experience changes use one nested update and strip client record IDs', async () => {
  const { calls, updateStudentProfileSection } = action()
  await updateStudentProfileSection({ section: 'experience', experiences: [{ id: 'foreign', title: 'Research assistant', subtitle: 'Lab', period: '2025–2026' }] })
  assert.deepEqual(calls[0].data, { experiences: { deleteMany: {}, create: [{ title: 'Research assistant', subtitle: 'Lab', period: '2025–2026' }] } })
})
test('invalid links and scores never reach persistence', async () => {
  const { calls, updateStudentProfileSection } = action()
  for (const payload of [
    { section: 'links', linkedinUrl: 'https://linkedin.com.evil.com/user', resumeUrl: null },
    { section: 'links', linkedinUrl: 'not-a-url', resumeUrl: null },
    { section: 'links', linkedinUrl: null, resumeUrl: 'javascript:alert(1)' },
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
  assert.equal(items.filter(item => item.complete).length, 2)
  assert.equal(items.length, 6)
  assert.equal(helpers.safeProfileUrl('javascript:alert(1)'), undefined)
})
