const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const manifest = require('../icons8.json')
const mod = { exports: {} }
const code = ts.transpileModule(fs.readFileSync('components/icons.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
new Function('require', 'module', 'exports', code)(require, mod, mod.exports)
const icons = mod.exports

test('every interface icon has a local transparent asset in the pinned pack', async () => {
  assert.equal(manifest.icons.pack, 'm_outlined')
  const files = new Set()
  for (const [name, icon] of Object.entries(manifest.icons.items)) {
    assert.equal(typeof icons[name], 'function', name)
    assert.equal(path.basename(icon.file), `${icon.id}.png`)
    files.add(icon.file)
  }
  assert.deepEqual(Object.keys(icons).sort(), Object.keys(manifest.icons.items).sort())
  for (const file of files) {
    const bytes = fs.readFileSync(file)
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', file)
    assert.equal(bytes.readUInt32BE(16), 96, file)
    assert.equal(bytes.readUInt32BE(20), 96, file)
    assert.ok([4, 6].includes(bytes[25]), `${file} must have an alpha channel`)
    const chunks = []
    for (let offset = 8; offset < bytes.length;) {
      const length = bytes.readUInt32BE(offset)
      if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length))
      offset += length + 12
    }
    assert.ok(require('node:zlib').inflateSync(Buffer.concat(chunks)).length > 0, file)
  }
})

test('icons keep sizing, theme color, SVG selectors, and decorative semantics', () => {
  const markup = renderToStaticMarkup(React.createElement(icons.Settings, {
    size: 18, className: 'size-4 text-primary', style: { opacity: .5 }, 'data-testid': 'settings',
  }))
  assert.match(markup, /<svg/)
  assert.match(markup, /width="18" height="18"/)
  assert.match(markup, /class="oc-icon size-4 text-primary"/)
  assert.match(markup, /aria-hidden="true"/)
  assert.match(markup, /fill="currentColor"/)
  assert.match(markup, /mask-image:url\(&quot;\/icons\/icons8\/82535.png&quot;\)/)
  assert.match(markup, /opacity:0.5/)
  assert.doesNotMatch(markup, /https?:\/\/img\.icons8/)
})

test('standalone labels, titles and caller accessibility overrides are preserved', () => {
  const labelled = renderToStaticMarkup(React.createElement(icons.Mail, { 'aria-label': 'Email' }))
  assert.match(labelled, /role="img"/)
  assert.match(labelled, /aria-label="Email"/)
  assert.doesNotMatch(labelled, /aria-hidden/)
  const titled = renderToStaticMarkup(React.createElement(icons.CalendarDays, { title: 'Schedule' }))
  assert.match(titled, /<title>Schedule<\/title>/)
  assert.doesNotMatch(titled, /aria-hidden/)
  const override = renderToStaticMarkup(React.createElement(icons.Check, { 'aria-hidden': false }))
  assert.match(override, /aria-hidden="false"/)
})
