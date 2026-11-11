const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// FE-25: interface arrows are Phosphor icons from @/components/icons, and the account entry is "Sign in".
// These paths are owned by other open branches; they are checked once those land.
const SKIPPED = [
  'components/live-voting/',
  'app/(focus)/live-voting/',
  'app/(focus)/voting/',
  'components/qr/',
  'components/inbox/',
  'app/api/auth/confirm-email/',
]
// Icon modules carry component names (e.g. LogIn), not copy.
const NOT_COPY = ['components/icons/']
// Admin impersonation keeps "Log in as": it matches the typed confirmation phrase the API requires.
const LOGIN_ALLOWED = { 'components/admin/admin-directory.tsx': /^Log in as$/ }

const ROOTS = ['app', 'components', 'lib']
const ARROW = /[←-↙⇐-⇕⟵-⟹]|&[lr]arr;|(?:^|\s)(?:->|<-)(?:\s|$)/
const LOGIN_LABEL = /\bLog ?[Ii]n\b|\bLogin\b/

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return files(full)
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) ? [full] : []
  })
}

/** Text a user can read: JSX text and string literals (attributes, labels, metadata). Comments are not nodes. */
function copy(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found = []
  const visit = node => {
    if (ts.isJsxText(node)) found.push({ kind: 'jsx', text: node.getText().trim() })
    else if (ts.isStringLiteral(node) && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent))) return
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) found.push({ kind: 'string', text: node.text })
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found.filter(item => item.text)
}

const scanned = ROOTS.flatMap(files).map(file => file.split(path.sep).join('/')).filter(file => ![...SKIPPED, ...NOT_COPY].some(prefix => file.startsWith(prefix)))

test('interface copy in .tsx uses Phosphor arrow icons, not text arrows', () => {
  const offenders = scanned.filter(file => file.endsWith('.tsx')).flatMap(file => copy(file).filter(item => ARROW.test(item.text)).map(item => `${file}: ${item.text.slice(0, 80)}`))
  assert.deepEqual(offenders, [])
})

test('account entry labels say "Sign in", never "Log In" or "Login"', () => {
  const offenders = scanned.flatMap(file => copy(file).filter(item => LOGIN_LABEL.test(item.text) && !LOGIN_ALLOWED[file]?.test(item.text)).map(item => `${file}: ${item.text.slice(0, 80)}`))
  assert.deepEqual(offenders, [])
})

test('the interview booking link signs in and returns to the same invitation', () => {
  const page = fs.readFileSync('components/interviews/booking-link-page.tsx', 'utf8')
  assert.match(page, /href=\{`\/login\?next=\$\{encodeURIComponent\(`\/interviews\/book\?\$\{new URLSearchParams\(\{ \.\.\.\(clubId \? \{ clubId \} : \{\}\), \.\.\.\(roundId \? \{ roundId \} : \{\}\) \}\)\}`\)\}`\}/)
  const mod = { exports: {} }
  new Function('module', 'exports', ts.transpileModule(fs.readFileSync('lib/auth.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(mod, mod.exports)
  const next = `/interviews/book?${new URLSearchParams({ clubId: 'club-1', roundId: 'round-1' })}`
  const link = new URL(`/login?next=${encodeURIComponent(next)}`, 'https://outclass.invalid')
  const requested = link.searchParams.get('next')
  for (const resolve of [mod.exports.safeReturnPath, mod.exports.loginReturnPath, mod.exports.signInReturnPath, mod.exports.signupReturnPath]) assert.equal(resolve(requested), next)
})
