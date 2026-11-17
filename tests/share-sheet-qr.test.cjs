const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

test('club share sheet offers a QR code for the public club page via a first-party short link', () => {
  const sheet = fs.readFileSync('components/share/share-sheet.tsx', 'utf8')
  const club = fs.readFileSync('components/clubs/share-club-button.tsx', 'utf8')
  // Only the approved QR stack and short-link system.
  assert.match(sheet, /from "@\/components\/qr\/qr-presenter-dialog"/)
  assert.match(sheet, /createShortLink\(\{ target: path \}\)/)
  assert.doesNotMatch(sheet, /from "(qrcode|react-qr-code|qrcode\.react)"|api\.qrserver|chart\.googleapis/)
  // Falls back to the page's own address when no short link can be made (signed out, offline).
  assert.match(sheet, /setQrValue\(short \|\| url\)/)
  // createShortLink redirects signed-out callers away from the page, so it only runs for a signed-in sharer.
  assert.match(sheet, /const short = !qr\?\.shortLink \? "" : await Promise\.race\(/)
  assert.match(club, /const \{ user \} = useAuth\(\)[\s\S]*shortLink: !!user/)
  // The presenter is its own dialog, opened after the sheet closes.
  assert.match(sheet, /setOpen\(false\)\s*\n\s*setQrOpen\(true\)/)
  assert.match(sheet, /trigger=\{false\}/)
  assert.match(sheet, />\{qrLoading \? "Loading…" : "QR code"\}</)
  // Clubs opt in; the code points at the same public path as the link.
  assert.match(club, /path=\{clubSharePath\(club\.id\)\}[\s\S]*qr=\{\{ filename: qrFilename\(club\.name\)/)
  assert.match(club, /club\.source === "preview"\) return null/)
})

test('club QR filenames are safe slugs', () => {
  const club = fs.readFileSync('components/clubs/share-club-button.tsx', 'utf8')
  const body = club.slice(club.indexOf('function qrFilename'))
  const qrFilename = new Function(`${body.replace(/: string/g, '')}; return qrFilename`)()
  assert.equal(qrFilename('TAMID at UVA'), 'tamid-at-uva-qr-code')
  assert.equal(qrFilename('  ★★ '), 'club-qr-code')
  assert.ok(qrFilename('x'.repeat(200)).length <= 68)
})
