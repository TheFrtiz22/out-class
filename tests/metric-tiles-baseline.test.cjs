const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

// Recruiting › Conversion at phone width: "Reached interviews · 100%" wraps to two lines, which used to push
// that tile's number below Applied, Accepted and Joined. Each tile now keeps its number on the bottom row.
const css = fs.readFileSync(path.join(__dirname, '../components/product/dashboard/dashboard.css'), 'utf8')

test('metric tiles keep their numbers on one line when a label wraps', () => {
  assert.match(css, /\.oc-metric-tiles > div \{[^}]*grid-template-rows: 1fr auto;[^}]*align-items: end;/)
  assert.match(css, /\.oc-metric-tiles dt \{ align-self: start; \}/)
})
