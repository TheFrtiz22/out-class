const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
function load(file) {
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(require, mod, mod.exports)
  return mod.exports
}
const policy = load('lib/password-policy.ts')
const { passwordIssue, PASSWORD_MESSAGES: M, newPasswordSchema, existingPasswordSchema } = policy

test('length edges: 9 characters fail, 10 pass', () => {
  assert.equal(passwordIssue('abcdefgh1'), M.tooShort)
  assert.equal(passwordIssue('abcdefgh12'), null)
  assert.equal(passwordIssue(''), M.required)
  assert.equal(passwordIssue(undefined), M.required)
})

test('the cap is 72 UTF-8 bytes, not 72 characters', () => {
  const ascii72 = 'a1'.repeat(36)
  assert.equal(ascii72.length, 72)
  assert.equal(passwordIssue(ascii72), null)
  assert.equal(passwordIssue(ascii72 + 'b'), M.tooLong)
  // "é" is 2 bytes: 36 of them is 72 bytes (allowed), 37 is 74 bytes (rejected).
  assert.equal(passwordIssue('é'.repeat(35) + '1'), null)
  assert.equal(policy.passwordByteLength('é'.repeat(36)), 72)
  assert.equal(passwordIssue('é'.repeat(36) + '1'), M.tooLong)
  // 4-byte emoji: 18 of them is exactly 72 bytes but only 18 characters.
  assert.equal(policy.passwordByteLength('🔒'.repeat(18)), 72)
  assert.equal(passwordIssue('🔒'.repeat(17) + 'abcd'), null)
  assert.equal(passwordIssue('🔒'.repeat(17) + 'abcde'), M.tooLong)
  // The minimum counts code points, so 9 emoji plus a letter is 10 characters.
  assert.equal(passwordIssue('🔒'.repeat(9) + 'a'), null)
  assert.equal(passwordIssue('🔒'.repeat(8) + 'a'), M.tooShort)
})

test('strength: one kind of character and common passwords are rejected', () => {
  for (const value of ['abcdefghijk', 'ABCDEFGHIJK', '12345678901', '!!!!!!!!!!!', 'éèêëàâäôöûü']) assert.equal(passwordIssue(value), M.oneKind, value)
  for (const value of ['Password123', 'password123', 'Welcome123', 'QWERTY12345']) assert.equal(passwordIssue(value), M.common, value)
  for (const value of ['a sufficiently long password', 'a-valid-password', 'Chosen-Pass-1!', 'Ünïcödé-länge']) assert.equal(passwordIssue(value), null, value)
})

test('schemas carry the same message; existing passwords only get the byte cap', () => {
  assert.equal(newPasswordSchema.safeParse('short1').error.issues[0].message, M.tooShort)
  assert.equal(newPasswordSchema.safeParse('a sufficiently long password').success, true)
  assert.equal(existingPasswordSchema.safeParse('password').success, true)
  assert.equal(existingPasswordSchema.safeParse('').success, false)
  assert.equal(existingPasswordSchema.safeParse('é'.repeat(37)).success, false)
})

test('every password entry point uses the shared policy', () => {
  const uses = {
    'lib/onboarding-schemas.ts': /password: newPasswordSchema/,
    'lib/password-recovery.ts': /newPassword = newPasswordSchema/,
    'app/api/auth/student-claim/route.ts': /password: newPasswordSchema/,
    'app/api/auth/password-recovery/route.ts': /passwordIssue\(input\.password\)/,
    'app/api/platform/elevation/route.ts': /password: existingPasswordSchema/,
    'components/password-recovery.tsx': /PASSWORD_HINT[\s\S]*minLength=\{PASSWORD_MIN_LENGTH\}/,
    'components/views/student-onboarding-wizard.tsx': /\{PASSWORD_HINT\}/,
    'app/(focus)/auth/student-claim/page.tsx': /passwordIssue\(password\)[\s\S]*minLength=\{PASSWORD_MIN_LENGTH\}/,
  }
  for (const [file, pattern] of Object.entries(uses)) {
    const source = read(file)
    assert.match(source, /from "@\/lib\/password-policy"/, file)
    assert.match(source, pattern, file)
    // No flow keeps its own numeric password bounds.
    assert.doesNotMatch(source, /password:\s*z\.string\(\)[^\n,]*\.(min|max)\(/i, file)
    assert.doesNotMatch(source, /minLength=\{(8|12)\}|maxLength=\{128\}/, file)
  }
})
