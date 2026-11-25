const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const profile = load('lib/student-profile.ts', { '@/lib/scholar-status': { scholarStatusSchema: require('zod').z.any() }, '@/lib/test-scores': { actShape: {} } })
const firstIssue = input => profile.profileSectionSchema.safeParse(input).error?.issues[0]?.message

// The server returns the first issue's message to the student as the save error, so it must read as plain advice.
test('a half-filled experience is refused with a message a student can act on', () => {
  assert.equal(firstIssue({ section: 'experience', experiences: [{ title: 'Analyst', subtitle: ' ', period: '' }] }), 'Add an organization for each experience.')
  assert.equal(firstIssue({ section: 'experience', experiences: [{ title: '', subtitle: 'Club', period: '' }] }), 'Add a role or project for each experience.')
})

test('blank names are refused with a plain message, not a validator default', () => {
  assert.equal(firstIssue({ section: 'identity', firstName: ' ', lastName: 'Klinger' }), 'Add your first name.')
  assert.equal(firstIssue({ section: 'identity', firstName: 'Jesse', lastName: '' }), 'Add your last name.')
  assert.ok(fs.readFileSync('lib/student-profile.ts', 'utf8').includes('major: z.string().trim().min(1, "Add your major.")'))
})

test('a just-added, still empty experience is not sent, so adding one does not fail the save', () => {
  const dialog = fs.readFileSync('components/edit-student-profile-dialog.tsx', 'utf8')
  assert.match(dialog, /experiences: snapshot\.experiences\.filter\(hasExperienceContent\)/)
  // The shared filter drops a row only when title, subtitle and period are all blank.
  const { hasExperienceContent } = load('lib/student-profile.ts')
  assert.equal(hasExperienceContent({ title: '', subtitle: ' ', period: '' }), false)
  assert.equal(hasExperienceContent({ title: '', subtitle: '', period: '2025' }), true)
  assert.equal(hasExperienceContent({ title: 'Treasurer', subtitle: '', period: '' }), true)
})
