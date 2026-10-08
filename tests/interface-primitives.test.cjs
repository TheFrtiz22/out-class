const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
function load(file) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name.startsWith('@/') ? load(name.slice(2) + (name.startsWith('@/lib/') ? '.ts' : '.tsx')) : require(name), mod, mod.exports)
  return mod.exports
}
test('native select retains form data, options, labels, disabled state and change handler', () => {
  const { NativeSelect } = load('components/ui/native-select.tsx')
  let changed = ''
  const tree = NativeSelect({ id: 'term', name: 'term', disabled: true, 'aria-describedby': 'help', defaultValue: 'spring', onChange: e => changed = e.target.value, children: React.createElement('option', { value: 'spring' }, 'Spring') })
  tree.props.onChange({ target: { value: 'fall' } })
  assert.equal(changed, 'fall')
  const html = renderToStaticMarkup(tree)
  assert.match(html, /<select[^>]*id="term"[^>]*name="term"/)
  assert.match(html, /disabled=""/)
  assert.match(html, /aria-describedby="help"/)
  assert.match(html, /<option value="spring" selected="">Spring<\/option>/)
})
test('loading layouts announce one message and keep visual skeletons decorative', () => {
  const { LoadingState } = load('components/ui/loading-state.tsx')
  for (const layout of ['rows', 'cards', 'inline']) {
    const html = renderToStaticMarkup(React.createElement(LoadingState, { label: 'Loading meetings', layout, rows: 2 }))
    assert.equal((html.match(/role="status"/g) || []).length, 1)
    assert.equal((html.match(/Loading meetings/g) || []).length, 1)
    assert.match(html, /aria-busy="true"/)
    if (layout === 'inline') assert.match(html, /aria-hidden="true"/)
    else assert.match(html, /data-slot="skeleton" aria-hidden="true"/)
  }
})
test('empty state keeps its named heading and actionable content across presentation modes', () => {
  const { EmptyState } = load('components/ui/empty-state.tsx')
  const html = renderToStaticMarkup(React.createElement(EmptyState, { title: 'No matching clubs', description: 'Clear your filters.', density: 'compact', align: 'start', tone: 'outlined', action: React.createElement('button', { type: 'button' }, 'Clear filters') }))
  const label = html.match(/aria-labelledby="([^"]+)"/)[1]
  assert.ok(html.includes(`<h3 id="${label}"`))
  assert.match(html, /No matching clubs/)
  assert.match(html, /<button type="button">Clear filters<\/button>/)
})
