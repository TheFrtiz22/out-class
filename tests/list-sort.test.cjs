// The shared list sort lives in the URL (?sort=&order=) so it survives resizes, layout switches and reloads.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
function load(file) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name === 'react' ? {} : name === 'next/navigation' ? {} : require(name), mod, mod.exports)
  return mod.exports
}
const { readListSort, writeListSort } = load('hooks/use-list-sort.ts')
const keys = ['name', 'gpa', 'year'], natural = key => key !== 'name'

test('reads a known key and order, and falls back to the list default for anything else', () => {
  assert.deepEqual(readListSort(new URLSearchParams('sort=gpa&order=asc'), keys, 'name', natural), { key: 'gpa', descending: false })
  assert.deepEqual(readListSort(new URLSearchParams('sort=gpa'), keys, 'name', natural), { key: 'gpa', descending: true }, 'no order uses the natural direction')
  assert.deepEqual(readListSort(new URLSearchParams('sort=password&order=desc'), keys, 'name', natural), { key: 'name', descending: true }, 'unknown keys are ignored')
  assert.deepEqual(readListSort(null, keys, 'name', natural), { key: 'name', descending: false })
})

test('writes only non-default sorts and keeps other query parameters', () => {
  const url = new URL('https://example.invalid/club/x/workspace?section=recruitment&tool=applicants')
  assert.equal(writeListSort(url, 'gpa', true, 'name', natural).search, '?section=recruitment&tool=applicants&sort=gpa&order=desc')
  assert.equal(writeListSort(url, 'name', false, 'name', natural).search, '?section=recruitment&tool=applicants', 'the default sort leaves a clean link')
  assert.equal(writeListSort(new URL('https://example.invalid/?sort=year&order=asc&decision=pending'), 'year', false, 'name', natural).search, '?sort=year&order=asc&decision=pending')
})
