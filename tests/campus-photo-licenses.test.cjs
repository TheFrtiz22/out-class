// Only licensed campus photographs ship, every rendered one exists, and the footer credits them.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const dir = 'public/images/campus'
const licensed = ['colonnade-1600.webp', 'colonnade-960.webp', 'rotunda-1600.webp', 'rotunda-960.webp']

function sources(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sources(full)
    return /\.(tsx?|css|mjs)$/.test(entry.name) ? [full] : []
  })
}

test('public/images/campus holds only licensed photographs', () => {
  const photos = fs.readdirSync(dir).filter(name => /\.(webp|jpe?g|png|avif)$/i.test(name)).sort()
  assert.deepEqual(photos, licensed)
  const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8')
  assert.match(readme, /creativecommons\.org\/licenses\/by\/2\.0/)
  assert.match(readme, /creativecommons\.org\/licenses\/by-sa\/2\.0/)
})

test('every rendered campus photograph reference is a licensed file', () => {
  const refs = new Set()
  for (const file of [...sources('app'), ...sources('components'), ...sources('lib'), 'next.config.mjs']) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/images\/campus\/([\w.-]+\.(?:webp|jpe?g|png|avif))/g)) refs.add(m[1])
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/src: "([\w.-]+\.webp)"/g)) refs.add(m[1])
  }
  assert.ok(refs.size >= 2, [...refs].join(', '))
  for (const ref of refs) assert.ok(licensed.includes(ref), `${ref} is not a licensed campus photograph`)
})

test('the public footer credits both photographs with title, author and license links', () => {
  const footer = fs.readFileSync('components/landing/public-footer.tsx', 'utf8')
  assert.match(footer, /PHOTO_CREDITS\.map/)
  assert.match(footer, /Photo credits/)
  const credits = fs.readFileSync('lib/photo-credits.ts', 'utf8')
  for (const needle of ['Rotunda UVa from the south east', 'terren in Virginia', 'https://creativecommons.org/licenses/by/2.0/', 'Colonnade UVa academical village', 'Eli Pousson', 'https://creativecommons.org/licenses/by-sa/2.0/', 'adaptations shared under CC BY-SA 2.0']) assert.ok(credits.includes(needle), needle)
})
