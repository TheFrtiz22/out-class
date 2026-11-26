const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const read = file => fs.readFileSync(path.join(__dirname, "..", "components/admin", file), "utf8")
const cases = [
  ["admin-corkboard.tsx", 'title={query || status ? "No matching events" : "No events yet"}'],
  ["admin-clubs.tsx", `title={query||status!=='ALL'?"No matching clubs":"No clubs yet"}`],
  ["admin-directory.tsx", 'title={query || status ? "No matching records" : "No records yet"}'],
  ["admin-permissions.tsx", 'title={query ? "No matching club access" : "No club access yet"}'],
  ["admin-reports.tsx", 'title={query || status || kind ? (support ? "No matching support requests" : "No matching reports") : support ? "No support requests yet" : "No reports yet"}'],
]

test("admin empty lists only say 'matching' when a search or filter is applied", () => {
  for (const [file, title] of cases) {
    const source = read(file)
    assert.ok(source.includes(title), file)
    assert.doesNotMatch(source, /title="No matching/, file)
    assert.doesNotMatch(source, /title=\{support \? "No matching/, file)
  }
})
