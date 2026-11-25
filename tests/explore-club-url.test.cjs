const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const src = fs.readFileSync("components/views/explore-view.tsx", "utf8")

test("opening a club from Explore puts it in the address so Back returns to the list", () => {
  const open = src.slice(src.indexOf("function open(club: DirectoryClub"), src.indexOf("function closeClub()"))
  assert.match(open, /url\.searchParams\.set\("club", club\.id\)/)
  assert.match(open, /window\.history\.pushState\(/)
})

test("Back to Explore steps back through history instead of only clearing state", () => {
  const close = src.slice(src.indexOf("function closeClub()"), src.indexOf("const featured"))
  assert.match(close, /if \(pushedClub\.current\) \{ window\.history\.back\(\); return \}/)
  assert.match(src, /<ClubProfileView club=\{loaded\} onBack=\{closeClub\}/)
  assert.doesNotMatch(src, /onBack=\{\(\) => setSelected\(null\)\}/)
})

test("a ?club= address opens that club, and leaving it closes the profile", () => {
  assert.match(src, /const id = new URLSearchParams\(filterQuery\)\.get\("club"\)/)
  assert.match(src, /if \(!id\) \{ pushedClub\.current = false; setSelected\(null\); return \}/)
  assert.match(src, /\}, \[filterQuery, clubs\]\)/)
})
