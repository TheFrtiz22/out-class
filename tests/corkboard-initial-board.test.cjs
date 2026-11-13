const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs')
const read = file => fs.readFileSync(file, 'utf8')

test('/corkboard renders the unfiltered public board on the server, cached and invalidated with event changes', () => {
  const page = read('app/(workspace)/corkboard/page.tsx')
  assert.match(page, /unstable_cache\(\(\) => getPublicCorkboard\(\), \["public-corkboard-default"\], \{ revalidate: 60, tags: \["club-directory"\] \}\)/)
  assert.match(page, /<CorkboardView initialBoard=\{initialBoard\} \/>/)
  assert.match(page, /readDefaultBoard\(\)\.catch\(\(\) => undefined\)/, 'a failed read falls back to the client load')
  assert.match(read('actions/campus-events.ts'), /revalidateTag\("club-directory"\)/, 'event changes invalidate the cached board')
})

test('the board starts from the server data and fetches only for later filters, retries or account changes', () => {
  const board = read('components/events/public-event-board.tsx')
  assert.match(board, /useState<CampusEvent\[\]>\(initialBoard\?\.events \?\? \[\]\)/)
  assert.match(board, /\[loading, setLoading\] = useState\(!initialBoard\)/)
  assert.match(board, /if \(seeded\.current\) \{\s*seeded\.current = false;\s*if \(filters === initialFilters && retry === 0\) return;/)
})

test('public event reads select no reviewer, submitter or rejection fields', () => {
  const source = read('actions/campus-events.ts')
  const select = /const publicEventSelect = \{[\s\S]*?\} as const;/.exec(source)[0]
  for (const field of ['submittedBy', 'rejectionReason', 'reviewedAt', 'submittedAt']) assert.doesNotMatch(select, new RegExp(field))
  assert.match(source, /getPublicCampusEvent[\s\S]*?select: publicEventSelect/)
  assert.match(source, /getPublicCorkboard[\s\S]*?select: publicEventSelect/)
})
