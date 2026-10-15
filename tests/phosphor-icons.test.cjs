const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const icons = require('./helpers/icons.cjs')
const render = (Icon, props) => renderToStaticMarkup(React.createElement(Icon, props))

test('every shared icon renders native Phosphor SVG geometry without raster masks', () => {
  assert.ok(Object.keys(icons).length > 100)
  for (const [name, Icon] of Object.entries(icons)) {
    const markup = render(Icon)
    assert.match(markup, /<svg/, name)
    assert.match(markup, /viewBox="0 0 256 256"/, name)
    assert.match(markup, /data-icon-pack="phosphor"/, name)
    assert.match(markup, /data-icon-weight="regular"/, name)
    assert.match(markup, /<path/, name)
    assert.doesNotMatch(markup, /mask|<image|\.png/, name)
  }
})

test('icons preserve size, inherited color, selectors and decorative semantics', () => {
  const markup = render(icons.Settings, { size: 18, className: 'size-4 text-primary', style: { opacity: .5 } })
  assert.match(markup, /width="18" height="18"/)
  assert.match(markup, /class="oc-icon size-4 text-primary"/)
  assert.match(markup, /aria-hidden="true"/)
  assert.match(markup, /focusable="false"/)
  assert.match(markup, /fill="currentColor"/)
  assert.match(markup, /opacity:0.5/)
  assert.match(render(icons.Mail, { size: '1em', color: 'red' }), /fill="red"/)
})

test('selected fill weights change actual glyph geometry', () => {
  for (const name of ['Home', 'Compass', 'BookmarkCheck', 'Users']) {
    const regular = render(icons[name])
    const fill = render(icons[name], { weight: 'fill' })
    assert.match(fill, /data-icon-weight="fill"/)
    const paths = markup => [...markup.matchAll(/<path d="([^"]+)"/g)].map(match => match[1])
    assert.notDeepEqual(paths(regular), paths(fill), name)
  }
})

test('standalone labels, titles, alt and caller accessibility overrides are preserved', () => {
  const labelled = render(icons.Mail, { 'aria-label': 'Email' })
  assert.match(labelled, /role="img"/)
  assert.match(labelled, /aria-label="Email"/)
  assert.doesNotMatch(labelled, /aria-hidden/)
  for (const props of [{ title: 'Schedule' }, { alt: 'Schedule' }]) {
    const markup = render(icons.CalendarDays, props)
    assert.match(markup, /<title>Schedule<\/title>/)
    assert.doesNotMatch(markup, /aria-hidden/)
  }
  assert.match(render(icons.Check, { 'aria-hidden': false }), /aria-hidden="false"/)
  assert.match(render(icons.Check, { 'aria-labelledby': 'status' }), /aria-labelledby="status"/)
})

test('individual SSR imports render without React client context', async () => {
  // The package resolves require() to its client barrel, so test the actual ESM
  // modules used by Next.js separately from the CommonJS component harness.
  const source = fs.readFileSync('components/icons.tsx', 'utf8')
  const imports = [...source.matchAll(/from "(@phosphor-icons\/react\/dist\/ssr\/[^\"]+)"/g)].map(match => match[1])
  assert.ok(imports.length > 90)
  for (const specifier of imports) {
    const glyphModule = await import(specifier)
    const name = specifier.split('/').at(-1)
    const markup = render(glyphModule[`${name}Icon`])
    assert.match(markup, /<path/, name)
  }
  const notice = fs.readFileSync('public/licenses/phosphor-icons-MIT.txt', 'utf8')
  assert.equal(notice, fs.readFileSync('node_modules/@phosphor-icons/react/LICENSE', 'utf8'))
})
