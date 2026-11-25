const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

test("each Settings row ends in a chevron so it reads as something to open", () => {
  const source = fs.readFileSync("components/settings/personal-settings-overview.tsx", "utf8")
  const row = source.match(/<Link key=\{section\.id\}[\s\S]*?<\/Link>/)
  assert.ok(row, "the overview renders one link per section")
  assert.match(row[0], /<ChevronRight [^>]*aria-hidden="true"/)
  assert.match(row[0], /className="group flex items-center/)
  assert.match(source, /import \{ ChevronRight \} from "@\/components\/icons"/)
})
