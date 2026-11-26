// Inbox: on phones the long description filled the header's first row, so the settings gear wrapped onto a
// row of its own under the description. The header now keeps the gear beside the title.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const css = fs.readFileSync(require('node:path').join(__dirname, '../styles/product-components.css'), 'utf8')

test('the Inbox header does not wrap its settings gear onto a new row', () => {
  assert.match(css, /^\.oc-notifications-header \{ flex-wrap: nowrap; align-items: flex-start; \}$/m)
})

test('the gear does not shrink and lines up with the title', () => {
  assert.match(css, /^\.oc-notifications-header > \.oc-page-header-action \{ flex-shrink: 0; margin-top: min\(0px, calc\(\(var\(--oc-text-title\) \* var\(--oc-leading-heading\) - var\(--oc-control-height\)\) \/ 2\)\); \}$/m)
})
