const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const css = fs.readFileSync('styles/pressed-states.css', 'utf8')
const globals = fs.readFileSync('app/globals.css', 'utf8')
const tokens = fs.readFileSync('styles/tokens.css', 'utf8')
const glass = fs.readFileSync('styles/navigation-glass.css', 'utf8')
const button = fs.readFileSync('components/ui/button.tsx', 'utf8')

const rules = source => [...source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector.trim(), body }))
const blockAfter = (source, marker) => {
  const start = source.indexOf(marker)
  assert.ok(start >= 0, `missing ${marker}`)
  let depth = 0
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1)
  }
  throw new Error(`unclosed ${marker}`)
}
const motionBlocks = marker => css.split(marker).slice(1).map(part => blockAfter(marker + part, marker)).join('\n')
const noPreference = motionBlocks('@media (prefers-reduced-motion: no-preference)')
const reduce = motionBlocks('@media (prefers-reduced-motion: reduce)')
const outsideMotion = rules(css.replace(/@media \(prefers-reduced-motion: [a-z-]+\) \{(?:[^{}]|\{[^{}]*\})*\}/g, ''))
const splitList = selector => { const out = ['']; let depth = 0; for (const ch of selector) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) out.push(''); else out[out.length - 1] += ch } return out.map(part => part.trim()) }
const activeTone = outsideMotion.filter(rule => /:active/.test(rule.selector) && /box-shadow|opacity/.test(rule.body))

test('pressed states are imported once, after the glass tokens, and the old opacity and nudge rules are gone', () => {
  assert.match(globals, /@import "\.\.\/styles\/navigation-glass\.css";\n@import "\.\.\/styles\/pressed-states\.css";/)
  assert.doesNotMatch(globals, /:active \{ opacity: \.88; \}|translateY\(1px\)/)
  assert.match(tokens, /--oc-press-scale: \.98;/)
  for (const token of ['--oc-glass-press-shade', '--oc-glass-navy-press-shade', '--oc-glass-on-navy-press-shade']) assert.match(glass, new RegExp(`${token}: inset 0 0 0 100vmax var\\(`))
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, 'pressed states use tokens, not hex')
})

test('every Button variant (and so IconButton) has a pressed tone, and the variant list is complete', () => {
  const variants = [...blockAfter(button, 'variant: {').matchAll(/^\s*'?([a-z-]+)'?: ''/gm)].map(match => match[1])
  assert.deepEqual(variants.sort(), ['accent', 'default', 'destructive', 'ghost', 'glass', 'glass-primary', 'link', 'outline', 'secondary'])
  const buttonRules = activeTone.filter(rule => rule.selector.includes('[data-button]'))
  for (const variant of variants) {
    assert.ok(buttonRules.some(rule => rule.selector.includes(`[data-variant="${variant}"]`)), `${variant} has a pressed tone`)
  }
  for (const rule of buttonRules) {
    assert.match(rule.selector, /:not\(:disabled\)/, `disabled buttons never press: ${rule.selector}`)
    assert.match(rule.selector, /:not\(\[aria-disabled="true"\]\)/)
    assert.match(rule.selector, /:not\(\[data-loading="true"\]\)/)
  }
  assert.match(noPreference, /\[data-button\][^{]*:active \{ transform: scale\(var\(--oc-press-scale\)\); \}/)
})

test('shared controls and the main custom controls define an :active style', () => {
  const controls = [
    '[data-slot="tabs-trigger"]', '[data-slot="dropdown-menu-item"]', '[data-slot="dropdown-menu-checkbox-item"]', '[data-slot="dropdown-menu-radio-item"]',
    '[data-slot="select-item"]', '[data-slot="command-item"]', '[data-slot="select-trigger"]', '[data-slot="checkbox"]', '[data-slot="switch"]', '.oc-toggle',
    '.oc-segmented-control button', '.oc-filter-chips-more', '.oc-section-tabs > a[data-segment]', '.oc-dt tbody tr[data-openable]', 'button.oc-dt-card-open',
    '.oc-dock-rail nav', '.oc-context-sidebar nav', '.oc-mobile-destination', '.oc-floating-circle', '.oc-floating-search', '.oc-workspace-option',
    'button.oc-header-club', '[role="menuitem"]', '.oc-pinned-flyer', '.oc-explore-card article', '.oc-explore-suggested-list', '[data-slot="card"]',
  ]
  for (const control of controls) assert.ok(activeTone.some(rule => rule.selector.includes(control)), `${control} has a pressed tone`)
  for (const rule of activeTone) assert.doesNotMatch(rule.body, /transform/, `scale only inside the no-preference block: ${rule.selector}`)
})

test('reduced motion drops every press transform and keeps the tone; focus rings are left alone', () => {
  assert.ok(noPreference.length > 0 && reduce.length > 0)
  const scaled = rules(noPreference.slice(noPreference.indexOf('{') + 1)).filter(rule => /transform/.test(rule.body))
  assert.ok(scaled.length >= 3)
  assert.match(reduce, /\[data-button\]:active,[\s\S]*\{ transform: none !important; \}/)
  for (const hook of ['[data-slot="card"]', '.oc-explore-card article', '.oc-floating-circle', 'button.oc-header-club', '.oc-directory-recruitment button']) assert.ok(reduce.includes(hook), `${hook} has no transform under reduced motion`)
  assert.match(reduce, /\.oc-pinned-flyer:active \{ transform: rotate\(var\(--flyer-rotation\)\) !important; \}/)
  assert.ok(activeTone.length > 10)
  assert.doesNotMatch(css, /:focus-visible[^,{]*\{[^}]*outline/, 'no focus outline changes here')
  for (const rule of activeTone.filter(rule => /box-shadow: var\(--oc-glass/.test(rule.body) && !/::before|> td|:has\(/.test(rule.selector))) {
    for (const selector of splitList(rule.selector)) assert.match(selector, /:not\(:focus-visible\)/, `tone keeps the focus halo: ${selector}`)
  }
})
