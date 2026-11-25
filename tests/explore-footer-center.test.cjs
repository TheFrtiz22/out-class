// Explore cards: the status line ("Applications open", "Not recruiting on OutClass") sat on the bottom edge of the
// 44px open button, leaving a wide gap under the stats divider. It now centres against the button.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const css = fs.readFileSync(require('node:path').join(__dirname, '../components/clubs/explore-directory.css'), 'utf8')

test('the card status line centres against the open button', () => {
  const rule = css.match(/\.oc-explore-card-footer \{([^}]*)\}/)[1]
  assert.match(rule, /align-items: center/)
})
