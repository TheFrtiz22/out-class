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
  for (const layout of ['rows', 'cards', 'inline', 'applications', 'applicants', 'workspace', 'form', 'document', 'feed', 'table', 'calendar', 'schedule', 'interview', 'voting', 'presentation']) {
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
  const stylesheet = fs.readFileSync('styles/loading.css', 'utf8')
  const skeleton = fs.readFileSync('components/ui/skeleton.tsx', 'utf8')
  assert.match(skeleton, /oc-skeleton/)
  assert.doesNotMatch(skeleton, /animate-pulse/)
  assert.match(stylesheet, /@keyframes oc-skeleton-sheen/)
  const keyframe = stylesheet.match(/@keyframes oc-skeleton-sheen\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(keyframe, /translate3d\(/)
  assert.doesNotMatch(keyframe, /(?:width|height|left|top|filter|box-shadow)\s*:/)
  assert.match(stylesheet, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(stylesheet, /\.oc-loading-preview::after[^}]*animation: none; display: none;/)
  assert.match(stylesheet, /@media \(forced-colors: active\)/)
})
test('applicant skeleton reserves review actions, filters and responsive applicant records', () => {
  const { LoadingState } = load('components/ui/loading-state.tsx')
  const html = renderToStaticMarkup(React.createElement(LoadingState, {
    label: 'Preparing applicants', layout: 'applicants', rows: 5,
  }))
  assert.match(html, /data-layout="applicants"/)
  assert.match(html, /oc-loading-review-toolbar/)
  assert.match(html, /oc-loading-applicant-filters/)
  assert.match(html, /oc-loading-applicant-table-head/)
  assert.equal((html.match(/oc-loading-applicant-record"/g) || []).length, 5)
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
  const css = fs.readFileSync('styles/loading.css', 'utf8')
  assert.match(css, /\.oc-loading-form-fields/)
  assert.match(css, /\.oc-loading-document-paper/)
  assert.doesNotMatch(css, /\.oc-skeleton::after[^}]*animation:/)
})


test('activity is decorative, context-sized and uses the shared Phosphor arc', () => {
  const { LoadingIndicator } = load('components/ui/loading-indicator.tsx')
  for (const size of ['sm', 'md', 'lg']) {
    const html = renderToStaticMarkup(React.createElement(LoadingIndicator, { size }))
    assert.match(html, /data-slot="loading-indicator"/)
    assert.match(html, /aria-hidden="true"/)
    assert.doesNotMatch(html, /role="status"|role="progressbar"/)
    assert.match(html, /<svg/)
  }
})

test('skeleton regions announce once without adding a separate visible status row', () => {
  const { LoadingState } = load('components/ui/loading-state.tsx')
  for (const layout of ['rows','cards','inline','applications','applicants','workspace','form','document']) {
    const html = renderToStaticMarkup(React.createElement(LoadingState, { label: 'Loading information', layout, rows: 2 }))
    assert.equal((html.match(/role="status"/g) || []).length, 1)
    assert.equal((html.match(/Loading information/g) || []).length, 1)
    if (layout === 'inline') assert.match(html, /data-slot="loading-indicator"/)
    else {
      assert.doesNotMatch(html, /data-slot="loading-indicator"/)
      assert.match(html, /class="sr-only">Loading information/)
      assert.match(html, /data-slot="skeleton"/)
    }
  }
  const css = fs.readFileSync('styles/loading.css','utf8')
  assert.match(css, /\.oc-loading-indicator \{ animation: none; \}/)
  assert.doesNotMatch(css, /oc-glow-loading|oc-loading-status|oc-loading-inline-spinner/)
})

test('pending buttons keep their resting content, accessible name, and disabled state', () => {
  const { Button } = load('components/ui/button.tsx')
  const content = React.createElement('span', null, 'Refresh overview')
  const ready = renderToStaticMarkup(React.createElement(Button, { loading: false }, content))
  const busy = renderToStaticMarkup(React.createElement(Button, { loading: true }, content))
  assert.match(ready, /oc-button-content/)
  assert.doesNotMatch(ready, /data-slot="loading-indicator"/)
  assert.match(busy, /disabled=""/)
  assert.match(busy, /aria-busy="true"/)
  assert.match(busy, /Refresh overview/)
  assert.equal((busy.match(/data-slot="loading-indicator"/g) || []).length, 1)
  assert.doesNotMatch(busy, /role="status"|aria-hidden="true"[^>]*>Refresh overview/)
  const slotted = renderToStaticMarkup(React.createElement(Button, { asChild: true }, React.createElement('a', {href:'/settings'}, 'Settings')))
  assert.match(slotted, /<a/)
  assert.doesNotMatch(slotted, /<span class="oc-button-content"/)
})

test('interview loading reserves the room header, candidate, questions and notes instead of a schedule', () => {
  const { LoadingState } = load('components/ui/loading-state.tsx')
  const html = renderToStaticMarkup(React.createElement(LoadingState, {layout:'interview'}))
  for (const part of ['header','presence','columns','applicant','questions','notes']) assert.ok(html.includes(`oc-loading-interview-${part}`))
  assert.doesNotMatch(html, /oc-loading-schedule|data-slot="loading-indicator"/)
  const workspace = fs.readFileSync('components/views/interview-workspace-view.tsx', 'utf8')
  assert.match(workspace, /if \(loading\) return <WorkspaceLoading[^>]*layout="interview"/)
})
