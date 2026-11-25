// Admin Clubs and Users/Applications directories: the search box kept its narrow default width
// (about 200px, even on a 1280px screen) and cut off its own placeholder on phones. It now grows to
// fill its row up to the same max width the members list search uses.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const read = f => fs.readFileSync(require('node:path').join(__dirname, '..', f), 'utf8')

for (const [file, label] of [['components/admin/admin-clubs.tsx', 'Search clubs'], ['components/admin/admin-directory.tsx', 'Search']]) {
  test(`${file}: the search box grows to fill its row`, () => {
    assert.match(read(file), new RegExp(`<SearchField aria-label="${label}" containerClassName="min-w-0 max-w-md flex-1 basis-60"`))
  })
}
