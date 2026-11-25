// Explore's "Suggested for you" always said "Based on the clubs you saved and your major", even for a student who
// had saved nothing and only answered the interest survey. The line now names only the signals the student gave.
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const root = path.join(__dirname, '..')
function load(file, cache = new Map()) {
  file = path.resolve(root, file)
  if (cache.has(file)) return cache.get(file).exports
  const mod = { exports: {} }; cache.set(file, mod)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const resolve = name => ['.ts', '.tsx'].map(ext => name + ext).find(f => fs.existsSync(path.join(root, f))) ?? name + '.ts'
  new Function('require', 'module', 'exports', code)(name => name.startsWith('@/') ? load(resolve(name.slice(2)), cache) : require(name), mod, mod.exports)
  return mod.exports
}

test('the basis line names only what the student gave', () => {
  const { suggestionBasis } = load('lib/club-suggestions.ts')
  assert.equal(typeof suggestionBasis, 'function', 'suggestionBasis is exported')
  const none = { interests: [], goals: [] }
  assert.equal(suggestionBasis({ savedCount: 0, major: null, survey: { interests: ['tech'], goals: [] } }), 'Based on your interests.')
  assert.equal(suggestionBasis({ savedCount: 2, major: '', survey: none }), 'Based on the clubs you saved.')
  assert.equal(suggestionBasis({ savedCount: 0, major: 'Biology', survey: null }), 'Based on your major.')
  assert.equal(suggestionBasis({ savedCount: 1, major: 'Biology', survey: { interests: [], goals: ['lead'] } }), 'Based on the clubs you saved, your interests and your major.')
  assert.equal(suggestionBasis({ savedCount: 0, major: '  ', survey: none }), '')
})

test('Explore shows the computed line, not a fixed claim', () => {
  const view = fs.readFileSync(path.join(root, 'components/views/explore-view.tsx'), 'utf8')
  assert.doesNotMatch(view, /Based on the clubs you saved and your major/)
  assert.match(view, /\{basis && <p>\{basis\}<\/p>\}/)
})
