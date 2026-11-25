const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8")

test("the interview schedule page title is in sentence case, like the rest of the app", () => {
  const page = read("app/(workspace)/settings/interviews/page.tsx"), shell = read("components/shell/workspace-shell.tsx")
  assert.match(page, /metadata=\{title:"My interview schedule"\}/)
  assert.match(page, /title="My interview schedule"/)
  assert.match(shell, /schedule \? "My interview schedule"/)
  for (const source of [page, shell]) assert.doesNotMatch(source, /My Interview Schedule/)
  assert.match(page, />Update my availability<\/Link>/)
  assert.match(read("mobile/src/app/settings/interviews.tsx"), />Update my availability<\/Text>/)
  for (const source of [page, read("mobile/src/app/settings/interviews.tsx")]) assert.doesNotMatch(source, /Update My Availability/)
})
