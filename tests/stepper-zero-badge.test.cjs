'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { loadComponent } = require('./helpers/component-module.cjs')

// A "0" badge beside Vote or Send reads as a step with nothing in it, and on phones the badge is all that shows
// for an inactive step. A zero count shows no badge; the spoken label still carries the count.
test('stepper hides a zero count badge and keeps non-zero ones', () => {
  const { Stepper } = loadComponent('components/ui/stepper.tsx')
  const h = React.createElement
  const html = renderToStaticMarkup(h(Stepper, { label: 'Decide steps', current: 'overview', onSelect() {}, steps: [
    { id: 'overview', label: 'Overview' },
    { id: 'voting', label: 'Vote', badge: 0 },
    { id: 'send', label: 'Send', badge: 3 },
  ] }))
  assert.doesNotMatch(html, /oc-stepper-badge" aria-hidden="true">0</)
  assert.match(html, /data-step="send"><span class="oc-stepper-marker" aria-hidden="true">3<\/span><span class="oc-stepper-label">Send<\/span><span class="oc-stepper-badge" aria-hidden="true">3<\/span>/)
  assert.equal((html.match(/oc-stepper-badge/g) || []).length, 1)
})
