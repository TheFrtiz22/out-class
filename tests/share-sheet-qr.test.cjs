const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

test('club share sheet offers a QR code for the public club page via a first-party short link', () => {
  const sheet = fs.readFileSync('components/share/share-sheet.tsx', 'utf8')
  const club = fs.readFileSync('components/clubs/share-club-button.tsx', 'utf8')
  // Only the approved QR stack and short-link system.
  assert.match(sheet, /from "@\/components\/qr\/qr-presenter-dialog"/)
  assert.match(club, /createShortLink\(\{ target: path \}\)/)
  // The sheet itself imports no server action: it is bundled into isolated UI fixtures.
  assert.doesNotMatch(sheet, /@\/actions\//)
  assert.doesNotMatch(sheet, /from "(qrcode|react-qr-code|qrcode\.react)"|api\.qrserver|chart\.googleapis/)
  // Falls back to the page's own address when no short link can be made (signed out, offline).
  assert.match(sheet, /setQrValue\(short \|\| url\)/)
  // createShortLink redirects signed-out callers away from the page, so it only runs for a signed-in sharer.
  assert.match(sheet, /const short = !resolve \? "" : await Promise\.race\(/)
  assert.match(club, /const \{ user \} = useAuth\(\)[\s\S]*const shortLink = user \? \(\) => createShortLink/)
  // The presenter is its own dialog, opened after the sheet closes.
  assert.match(sheet, /setOpen\(false\)\s*\n\s*setQrOpen\(true\)/)
  assert.match(sheet, /trigger=\{false\}/)
  assert.match(sheet, />\{qrLoading \? "Loading…" : "QR code"\}</)
  // Clubs opt in; the code points at the same public path as the link.
  assert.match(club, /const path = clubSharePath\(club\.id\)[\s\S]*qr=\{\{ filename: clubQrFilename\(club\.name\)/)
  assert.match(club, /club\.source === "preview"\) return null/)
})
