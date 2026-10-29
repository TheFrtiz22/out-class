const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
function load(file) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name === '@/components/icons' ? require('./helpers/icons.cjs') : name.startsWith('@/') ? load(name.slice(2) + (name.startsWith('@/lib/') ? '.ts' : '.tsx')) : require(name), mod, mod.exports)
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
  for (const layout of ['rows', 'cards', 'inline', 'applications', 'applicants', 'workspace', 'form', 'document']) {
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

test('contextual loading uses compositor-friendly motion and respects accessibility settings', () => {
  const stylesheet = fs.readFileSync('styles/interface-primitives.css', 'utf8')
  const skeleton = fs.readFileSync('components/ui/skeleton.tsx', 'utf8')
  assert.match(skeleton, /oc-skeleton/)
  assert.doesNotMatch(skeleton, /animate-pulse/)
  assert.match(stylesheet, /@keyframes oc-skeleton-sheen/)
  const keyframe = stylesheet.match(/@keyframes oc-skeleton-sheen\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(keyframe, /translate3d\(/)
  assert.doesNotMatch(keyframe, /(?:width|height|left|top|filter|box-shadow)\s*:/)
  assert.match(stylesheet, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(stylesheet, /\.oc-skeleton::after \{ animation: none; display: none;/)
  assert.match(stylesheet, /@media \(forced-colors: active\)/)
})
test('applicant skeleton reserves recognisable pipeline steps and list rows', () => {
  const { LoadingState } = load('components/ui/loading-state.tsx')
  const html = renderToStaticMarkup(React.createElement(LoadingState, {
    label: 'Preparing applicants', layout: 'applicants', rows: 5,
  }))
  assert.match(html, /data-layout="applicants"/)
  assert.equal((html.match(/oc-loading-pipeline-step/g) || []).length, 3)
  assert.equal((html.match(/oc-loading-row"/g) || []).length, 5)
  assert.equal((html.match(/role="status"/g) || []).length, 1)
  assert.equal((html.match(/Preparing applicants/g) || []).length, 1)
  assert.doesNotMatch(html, /% complete|progressbar/i)
})

test('form and letter placeholders retain editable-workspace structure without fabricated progress', () => {
  const { LoadingState } = load('components/ui/loading-state.tsx')
  for (const layout of ['form', 'document']) {
    const html = renderToStaticMarkup(React.createElement(LoadingState, { label: 'Preparing workspace', layout, rows: 3 }))
    assert.match(html, new RegExp('data-layout="' + layout + '"'))
    assert.match(html, /aria-busy="true"/)
    assert.equal((html.match(/role="status"/g) || []).length, 1)
    assert.equal((html.match(/Preparing workspace/g) || []).length, 1)
    assert.match(html, /data-slot="skeleton" aria-hidden="true"/)
    assert.doesNotMatch(html, /progressbar|[0-9]+% complete/)
  }
  const css = fs.readFileSync('styles/interface-primitives.css', 'utf8')
  assert.match(css, /\.oc-loading-form-fields/)
  assert.match(css, /\.oc-loading-document-paper/)
  assert.match(css, /\.oc-loading-row:nth-child\(n \+ 6\)/)
})
