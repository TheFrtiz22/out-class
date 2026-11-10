// Server-render contracts of the filter primitives; interaction is covered by filter-controls-browser.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadComponent } = require('./helpers/component-module.cjs')
const h = React.createElement

test('segmented pills keep aria-pressed toggles and put counts in the accessible name', () => {
  const { SegmentedControl, PillGroup } = loadComponent('components/ui/segmented-control.tsx')
  assert.equal(PillGroup, SegmentedControl)
  const html = renderToStaticMarkup(h(SegmentedControl, { label: 'Decision', value: 'pending', onChange() {}, options: [{ value: 'all', label: 'All' }, { value: 'pending', label: 'Pending', count: 1, icon: h('svg') }] }))
  assert.match(html, /role="group" aria-label="Decision"/)
  assert.match(html, /aria-pressed="true"[^>]*><span class="oc-segment-icon" aria-hidden="true"><svg><\/svg><\/span>Pending<span class="oc-segment-count"> 1<\/span><\/button>/)
  assert.match(html, /aria-pressed="false"[^>]*>All<\/button>/)
})

test('section tabs are links in the segmented track with aria-current on the active tab', () => {
  const { SectionTabs } = loadComponent('components/ui/section-tabs.tsx')
  const html = renderToStaticMarkup(h(SectionTabs, { label: 'Decisions navigation', current: 'letters', items: [{ id: 'voting', label: 'Voting room', href: '/v' }, { id: 'letters', label: 'Decision letters', href: '/l' }] }))
  assert.match(html, /^<nav aria-label="Decisions navigation"[^>]*class="oc-segmented-control oc-section-tabs"/)
  assert.match(html, /<a[^>]*aria-current="page"[^>]*href="\/l">Decision letters<\/a>/)
  assert.doesNotMatch(html, /aria-current="page" href="\/v"/)
  assert.equal(renderToStaticMarkup(h(SectionTabs, { label: 'x', current: 'a', items: [{ id: 'a', label: 'A', href: '/a' }] })), '')
})

test('stepper numbers steps and marks the current one', () => {
  const { Stepper } = loadComponent('components/ui/stepper.tsx')
  const html = renderToStaticMarkup(h(Stepper, { label: 'Scheduling workflow', current: 'rooms', onSelect() {}, steps: [{ id: 'availability', label: 'Availability', complete: true }, { id: 'rooms', label: 'Set interview times' }] }))
  assert.match(html, /<nav aria-label="Scheduling workflow"[^>]*><ol>/)
  assert.match(html, /aria-current="step"><span class="oc-stepper-marker" aria-hidden="true">2<\/span>Set interview times/)
  assert.match(html, /Availability<span class="sr-only"> \(done\)<\/span>/)
})

test('search field: named searchbox, clear only with a value and a handler, shortcut hint only while empty', () => {
  const { SearchField } = loadComponent('components/ui/search-field.tsx')
  const empty = renderToStaticMarkup(h(SearchField, { 'aria-label': 'Search events', value: '', onChange() {}, onClear() {}, shortcut: '/' }))
  assert.match(empty, /<input[^>]*type="search"[^>]*aria-keyshortcuts="\/"[^>]*aria-label="Search events"/)
  assert.doesNotMatch(empty, /Clear search/); assert.match(empty, /<kbd class="oc-search-field-shortcut" aria-hidden="true">\/<\/kbd>/)
  const filled = renderToStaticMarkup(h(SearchField, { 'aria-label': 'Search events', value: 'jazz', onChange() {}, onClear() {}, shortcut: '/' }))
  assert.match(filled, /aria-label="Clear search"/); assert.doesNotMatch(filled, /<kbd/)
})

test('filter styles use tokens: no colour literals and only the 999px pill radius', () => {
  const css = fs.readFileSync('styles/filter-controls.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/)
  for (const m of css.matchAll(/border-radius\s*:\s*([^;}]+)/g)) assert.match(m[1].trim(), /^(999px|var\(--[\w-]+\)( var\(--[\w-]+\))*( 0 0)?)$/, m[0])
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/); assert.match(css, /@media \(forced-colors: active\)/)
  assert.match(fs.readFileSync('app/globals.css', 'utf8'), /@import "\.\.\/styles\/filter-controls\.css";/)
})

test('pill select stays controlled for an empty value, with or without an "all" option', () => {
  const { PillSelect } = loadComponent('components/ui/pill-select.tsx')
  const options = [{ value: 'a', label: 'Ada' }]
  assert.equal(PillSelect({ label: 'Candidate', value: '', onChange() {}, options }).props.value, '', 'placeholder state is controlled, not undefined')
  assert.equal(PillSelect({ label: 'Major', allLabel: 'All majors', value: '', onChange() {}, options }).props.value, '__oc_all__')
  let picked = null; PillSelect({ label: 'Major', allLabel: 'All majors', value: 'a', onChange: v => picked = v, options }).props.onValueChange('__oc_all__')
  assert.equal(picked, '', 'the "all" choice maps back to ""')
})

test('rule threshold sliders are disabled while a save or preview is pending (a fieldset cannot disable Radix sliders)', () => {
  assert.match(fs.readFileSync('components/views/screening-dashboard-view.tsx', 'utf8'), /<RangeSlider [^>]*disabled=\{busy\}/)
})
