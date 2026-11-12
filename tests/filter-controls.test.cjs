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
  assert.match(html, /aria-current="step"><span class="oc-stepper-marker" aria-hidden="true">2<\/span><span class="oc-stepper-label">Set interview times<\/span>/)
  assert.match(html, /Availability<\/span><span class="sr-only"> \(done\)<\/span>/)
  assert.match(html, /<li data-complete="true"><button type="button" class="oc-stepper-step" data-step="availability"><span class="oc-stepper-marker" aria-hidden="true"><svg/, 'finished steps show a check')
  const badge = renderToStaticMarkup(h(Stepper, { label: 'Decide steps', current: 'voting', steps: [{ id: 'voting', label: 'Vote', badge: 2 }] }))
  assert.match(badge, /aria-current="step"><span class="oc-stepper-marker" aria-hidden="true">1<\/span><span class="oc-stepper-label">Vote<\/span><span class="oc-stepper-badge" aria-hidden="true">2<\/span>/)
})

test('stepper nav: Back and Next, each side optional', () => {
  const { StepperNav } = loadComponent('components/ui/stepper.tsx')
  const both = renderToStaticMarkup(h(StepperNav, { onBack() {}, onNext() {}, nextLabel: 'Next: Send' }))
  assert.match(both, /data-slot="stepper-nav"/); assert.match(both, />Back<\/button>/); assert.match(both, />Next: Send<svg/)
  assert.doesNotMatch(renderToStaticMarkup(h(StepperNav, { onNext() {} })), />Back</)
  assert.equal(renderToStaticMarkup(h(StepperNav, {})), '')
})

test('underline tabs: a tablist of tabs with counts, faded empty tabs, links when given an href', () => {
  const { UnderlineTabs } = loadComponent('components/ui/underline-tabs.tsx')
  const html = renderToStaticMarkup(h(UnderlineTabs, { label: 'Application stage', value: 'review', onChange() {}, items: [{ id: 'drafts', label: 'Drafts', count: 0 }, { id: 'review', label: 'In review', count: 2 }] }))
  assert.match(html, /^<div role="tablist" aria-label="Application stage" aria-orientation="horizontal"/)
  assert.match(html, /<button type="button" role="tab" aria-selected="false" tabindex="-1" class="oc-underline-tab" data-value="drafts" data-empty="true">Drafts<span class="oc-underline-tab-count"> \(0\)<\/span><\/button>/)
  assert.match(html, /role="tab" aria-selected="true" tabindex="0"[^>]*>In review<span class="oc-underline-tab-count"> \(2\)/)
  const links = renderToStaticMarkup(h(UnderlineTabs, { label: 'Sections', value: 'a', items: [{ id: 'a', label: 'A', href: '/a' }, { id: 'b', label: 'B', href: '/b' }] }))
  assert.match(links, /<a role="tab" aria-selected="true"[^>]*aria-current="page"[^>]*href="\/a">A<\/a>/)
})

test('round select: "Round: All" from the real rounds; no All where a page never had one', () => {
  const src = fs.readFileSync('components/ui/round-select.tsx', 'utf8')
  assert.match(src, /prefix = "Round"/); assert.match(src, /allLabel=\{includeAll \? allLabel : undefined\}/)
  assert.match(src, /rounds\.map\(round => \(\{ value: round\.id, label: round\.name \}\)\)/)
  for (const file of ['components/interviews/interview-rooms-list.tsx', 'components/interview-access-setup.tsx', 'components/live-voting/decide-page.tsx', 'components/interviews/room-manager.tsx', 'components/ranked-review-list.tsx', 'components/views/leader-dashboard/live-leader-workspace.tsx', 'components/availability/admin-overview.tsx'])
    assert.match(fs.readFileSync(file, 'utf8'), /<RoundSelect /, file)
  assert.match(fs.readFileSync('components/interviews/room-manager.tsx', 'utf8'), /<RoundSelect label="Recruitment round" includeAll=\{false\}/)
  assert.match(fs.readFileSync('components/ranked-review-list.tsx', 'utf8'), /<RoundSelect label="Ranked round" includeAll=\{false\}/)
})

test('filter chips are light outlined chips, not the navy pill', () => {
  const { FilterChips } = loadComponent('components/ui/filter-chips.tsx')
  const html = renderToStaticMarkup(h(FilterChips, { label: 'Browse categories', value: 'all', onChange() {}, options: [{ value: 'all', label: 'All' }, { value: 'finance', label: 'Finance' }] }))
  assert.match(html, /class="oc-segmented-control oc-chip-row"/)
  const css = fs.readFileSync('styles/filter-controls.css', 'utf8')
  assert.match(css, /\.oc-segmented-control\.oc-chip-row > button\[data-segment\]\[data-selected\] \{ border-color: var\(--primary\); background: var\(--accent\)/)
})

test('search field: named searchbox, clear only with a value and a handler, shortcut hint only while empty', () => {
  const { SearchField } = loadComponent('components/ui/search-field.tsx')
  const empty = renderToStaticMarkup(h(SearchField, { 'aria-label': 'Search events', value: '', onChange() {}, onClear() {}, shortcut: '/' }))
  assert.match(empty, /<input[^>]*type="search"[^>]*aria-keyshortcuts="\/"[^>]*aria-label="Search events"/)
  assert.doesNotMatch(empty, /Clear search/); assert.match(empty, /<kbd class="oc-search-field-shortcut" aria-hidden="true">\/<\/kbd>/)
  const filled = renderToStaticMarkup(h(SearchField, { 'aria-label': 'Search events', value: 'jazz', onChange() {}, onClear() {}, shortcut: '/' }))
  assert.match(filled, /aria-label="Clear search"/); assert.doesNotMatch(filled, /<kbd/)
})

test('filter styles use tokens: no colour literals and only the 999px pill radius (0 for underlines)', () => {
  const css = fs.readFileSync('styles/filter-controls.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/)
  for (const m of css.matchAll(/border-radius\s*:\s*([^;}]+)/g)) assert.match(m[1].trim(), /^(0|999px|var\(--[\w-]+\)( var\(--[\w-]+\))*( 0 0)?)$/, m[0])
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
