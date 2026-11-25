const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

// User-facing copy says "club", never "organization" (lib/copy/terms.ts). The club Home setup checklist and its
// "Continue setup: …" button read these titles.
test("club setup checklist steps say club, not organization", () => {
  const src = fs.readFileSync("lib/organization-onboarding.ts", "utf8")
  const copy = [...src.matchAll(/(?:title|detail): (?:'([^']*)'|[^,]*\? '([^']*)' : '([^']*)')/g)].flatMap(m => m.slice(1).filter(Boolean))
  assert.ok(copy.length >= 8)
  for (const line of copy) assert.doesNotMatch(line, /organization/i, line)
  assert.match(src, /title: 'Complete club profile'/)
  assert.match(src, /title: 'Claim club'/)
})

test("club setup checklist's loading, error and finished states say club", () => {
  const src = fs.readFileSync("components/organization-setup-checklist.tsx", "utf8")
  for (const stale of ["organization setup progress", "organization setup checklist", "Organization setup checklist", "Organization setup complete"]) assert.ok(!src.includes(stale), stale)
  assert.match(src, /aria-label="Club setup checklist"/)
  assert.match(src, /'Club setup complete'/)
})
